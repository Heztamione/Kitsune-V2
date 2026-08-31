const crypto = require('crypto');
const { pool } = require('./db');
const services = require('./services');
const { publicUser } = require('./auth');

class Realtime {
  constructor(iceServers) {
    this.clients = new Map();
    this.userSockets = new Map();
    this.callRooms = new Map();
    this.callInvites = new Map();
    this.iceServers = iceServers;
    this.sequence = 0;
    this.heartbeat = setInterval(() => this.ping(), 30000);
    this.heartbeat.unref();
  }

  isOnline = userId => Boolean(this.userSockets.get(userId)?.size);

  send(ws, type, data = {}) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type, seq: ++this.sequence, ...data }));
  }

  sendToUser(userId, type, data = {}) {
    for (const ws of this.userSockets.get(userId) || []) this.send(ws, type, data);
  }

  broadcast(type, data = {}, excludedUserId) {
    for (const [ws, client] of this.clients) if (client.user.id !== excludedUserId) this.send(ws, type, data);
  }

  async broadcastRelevant(userId, type, data = {}) {
    const relevant = await pool.query(
      `SELECT DISTINCT target_id FROM (
        SELECT other.user_id AS target_id FROM guild_members mine JOIN guild_members other ON other.guild_id = mine.guild_id WHERE mine.user_id = $1 AND other.user_id <> $1
        UNION SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END FROM friendships WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)
        UNION SELECT other.user_id FROM dm_members mine JOIN dm_members other ON other.thread_id = mine.thread_id WHERE mine.user_id = $1 AND other.user_id <> $1
      ) related`,
      [userId]
    );
    for (const row of relevant.rows) this.sendToUser(row.target_id, type, data);
  }

  async broadcastGuild(guildId, type, data = {}, excludedUserId) {
    const members = await pool.query('SELECT user_id FROM guild_members WHERE guild_id = $1', [guildId]);
    for (const row of members.rows) if (row.user_id !== excludedUserId) this.sendToUser(row.user_id, type, data);
  }

  async connect(ws, user, req) {
    const client = { user, alive: true, events: [], rooms: new Set(), ip: req.socket.remoteAddress };
    this.clients.set(ws, client);
    if (!this.userSockets.has(user.id)) this.userSockets.set(user.id, new Set());
    const firstSocket = this.userSockets.get(user.id).size === 0;
    this.userSockets.get(user.id).add(ws);
    ws.on('pong', () => { client.alive = true; });
    ws.on('message', raw => this.handle(ws, raw));
    ws.on('close', () => this.disconnect(ws));
    ws.on('error', () => {});
    if (firstSocket && user.status === 'offline') user.status = 'online';
    if (firstSocket) await pool.query('UPDATE users SET status = $1, updated_at = now() WHERE id = $2', [user.status, user.id]);
    const ready = await services.bootstrap(user, this.isOnline, this.iceServers);
    this.send(ws, 'ready', ready);
    if (firstSocket) {
      for (const server of ready.servers) {
        const member = server.members.find(item => item.id === user.id);
        if (member) await this.broadcastGuild(server.id, 'member-upsert', { serverId: server.id, user: member }, user.id);
      }
      await this.broadcastRelevant(user.id, 'presence', { userId: user.id, status: user.status, activity: user.activity });
    }
  }

  allowEvent(client) {
    const now = Date.now();
    client.events = client.events.filter(time => now - time < 60000);
    if (client.events.length >= 120) return false;
    client.events.push(now);
    return true;
  }

  async handle(ws, raw) {
    const client = this.clients.get(ws);
    if (!client || !this.allowEvent(client)) return this.send(ws, 'error', { code: 'RATE_LIMITED', message: 'Too many realtime events.' });
    if (!Buffer.isBuffer(raw) || raw.length > 65536) return this.send(ws, 'error', { code: 'INVALID_EVENT', message: 'Invalid event.' });
    let event;
    try { event = JSON.parse(raw.toString('utf8')); } catch (_) { return this.send(ws, 'error', { code: 'INVALID_JSON', message: 'Invalid JSON.' }); }
    try {
      if (event.type === 'message') {
        const created = await services.createChannelMessage(client.user, { channelId: event.channelId, content: event.content ?? event.payload?.text, attachments: event.attachments ?? event.payload?.attachments, replyTo: event.replyTo });
        await this.broadcastGuild(created.guildId, 'message', { serverId: created.guildId, channelId: created.channelId, payload: created.message });
      } else if (event.type === 'dm-message') {
        const created = await services.createDmMessage(client.user, event);
        const members = await pool.query('SELECT user_id FROM dm_members WHERE thread_id = $1', [created.threadId]);
        for (const row of members.rows) this.sendToUser(row.user_id, 'dm-message', created);
      } else if (event.type === 'typing') {
        if (event.channelId) {
          const channel = await services.verifyChannelMember(client.user.id, event.channelId);
          if (channel) await this.broadcastGuild(channel.guild_id, 'typing', { channelId: event.channelId, user: publicUser(client.user) }, client.user.id);
        } else if (event.threadId && await services.verifyDmMember(client.user.id, event.threadId)) {
          const members = await pool.query('SELECT user_id FROM dm_members WHERE thread_id = $1 AND user_id <> $2', [event.threadId, client.user.id]);
          for (const row of members.rows) this.sendToUser(row.user_id, 'typing', { threadId: event.threadId, user: publicUser(client.user) });
        }
      } else if (event.type === 'status') {
        const status = ['online', 'idle', 'dnd'].includes(event.status) ? event.status : 'online';
        const activity = String(event.activity || '').slice(0, 128);
        await pool.query('UPDATE users SET status = $1, activity = $2, updated_at = now() WHERE id = $3', [status, activity, client.user.id]);
        client.user.status = status; client.user.activity = activity;
        await this.broadcastRelevant(client.user.id, 'presence', { userId: client.user.id, status, activity });
      } else if (event.type === 'call-invite') {
        await this.inviteCall(ws, event);
      } else if (event.type === 'call-accept') {
        await this.acceptCall(ws, event.roomId);
      } else if (event.type === 'call-decline') {
        this.declineCall(ws, event.roomId);
      } else if (event.type === 'voice-join') {
        await this.joinVoice(ws, event.channelId);
      } else if (event.type === 'call-leave') {
        this.leaveCall(ws, event.roomId);
      } else if (['rtc-offer', 'rtc-answer', 'rtc-ice'].includes(event.type)) {
        this.relayRtc(ws, event);
      } else if (event.type === 'call-media-state') {
        this.relayCallState(ws, event);
      } else if (event.type === 'heartbeat') {
        this.send(ws, 'heartbeat-ack', { timestamp: Date.now() });
      }
    } catch (error) {
      this.send(ws, 'error', { code: 'EVENT_FAILED', message: error.status && error.status < 500 ? error.message : 'Realtime operation failed.' });
      if (!error.status || error.status >= 500) console.error(error);
    }
  }

  addToRoom(ws, roomId) {
    const client = this.clients.get(ws);
    if (!this.callRooms.has(roomId)) this.callRooms.set(roomId, new Set());
    this.callRooms.get(roomId).add(ws);
    client.rooms.add(roomId);
  }

  roomParticipants(roomId, exceptUserId) {
    const users = new Map();
    for (const ws of this.callRooms.get(roomId) || []) {
      const user = this.clients.get(ws)?.user;
      if (user && user.id !== exceptUserId) users.set(user.id, publicUser(user));
    }
    return Array.from(users.values());
  }

  async inviteCall(ws, event) {
    const client = this.clients.get(ws);
    const targetId = String(event.targetId || '');
    if (!targetId || targetId === client.user.id) throw Object.assign(new Error('Invalid call target.'), { status: 400 });
    await services.openDm(client.user.id, targetId);
    if (!this.isOnline(targetId)) throw Object.assign(new Error('User is offline.'), { status: 409 });
    const roomId = crypto.randomUUID();
    this.callInvites.set(roomId, { callerId: client.user.id, targetId, callType: event.callType === 'video' ? 'video' : 'voice', expires: Date.now() + 60000 });
    this.addToRoom(ws, roomId);
    this.send(ws, 'call-ringing', { roomId, targetId });
    this.sendToUser(targetId, 'call-invite', { roomId, from: publicUser(client.user), callType: event.callType === 'video' ? 'video' : 'voice' });
  }

  async acceptCall(ws, roomId) {
    const client = this.clients.get(ws);
    const invite = this.callInvites.get(roomId);
    if (!invite || invite.targetId !== client.user.id || invite.expires < Date.now()) throw Object.assign(new Error('Call invitation expired.'), { status: 410 });
    this.addToRoom(ws, roomId);
    this.callInvites.delete(roomId);
    const participants = this.roomParticipants(roomId, client.user.id);
    this.send(ws, 'call-joined', { roomId, participants });
    this.sendToUser(invite.callerId, 'call-accepted', { roomId, user: publicUser(client.user) });
  }

  declineCall(ws, roomId) {
    const client = this.clients.get(ws);
    const invite = this.callInvites.get(roomId);
    if (!invite || invite.targetId !== client.user.id) return;
    this.callInvites.delete(roomId);
    this.sendToUser(invite.callerId, 'call-declined', { roomId, userId: client.user.id });
    this.leaveCall(ws, roomId);
  }

  async joinVoice(ws, channelId) {
    const client = this.clients.get(ws);
    const channel = await services.verifyChannelMember(client.user.id, channelId);
    if (!channel || channel.type !== 'voice') throw Object.assign(new Error('Voice channel not found.'), { status: 404 });
    const roomId = `voice:${channelId}`;
    const participants = this.roomParticipants(roomId, client.user.id);
    this.addToRoom(ws, roomId);
    this.send(ws, 'call-joined', { roomId, channelId, participants });
    for (const peer of participants) this.sendToUser(peer.id, 'call-peer-joined', { roomId, user: publicUser(client.user) });
  }

  relayRtc(ws, event) {
    const client = this.clients.get(ws);
    if (!client.rooms.has(event.roomId)) return;
    const targetSockets = this.userSockets.get(String(event.targetId || '')) || [];
    for (const target of targetSockets) {
      if (this.clients.get(target)?.rooms.has(event.roomId)) this.send(target, event.type, { roomId: event.roomId, fromId: client.user.id, description: event.description, candidate: event.candidate, screen: Boolean(event.screen) });
    }
  }

  relayCallState(ws, event) {
    const client = this.clients.get(ws);
    if (!client?.rooms.has(event.roomId)) return;
    for (const peer of this.callRooms.get(event.roomId) || []) {
      if (peer !== ws) this.send(peer, 'call-media-state', { roomId: event.roomId, userId: client.user.id, screen: Boolean(event.screen) });
    }
  }

  leaveCall(ws, roomId) {
    const client = this.clients.get(ws);
    if (!client || !client.rooms.has(roomId)) return;
    const room = this.callRooms.get(roomId);
    room?.delete(ws);
    client.rooms.delete(roomId);
    if (!room?.size) this.callRooms.delete(roomId);
    else for (const peer of room) this.send(peer, 'call-peer-left', { roomId, userId: client.user.id });
  }

  disconnect(ws) {
    const client = this.clients.get(ws);
    if (!client) return;
    for (const roomId of [...client.rooms]) this.leaveCall(ws, roomId);
    this.clients.delete(ws);
    const sockets = this.userSockets.get(client.user.id);
    sockets?.delete(ws);
    if (!sockets?.size) {
      this.userSockets.delete(client.user.id);
      pool.query("UPDATE users SET status = 'offline', updated_at = now() WHERE id = $1", [client.user.id]).catch(() => {});
      this.broadcastRelevant(client.user.id, 'presence', { userId: client.user.id, status: 'offline', activity: client.user.activity }).catch(() => {});
    }
  }

  ping() {
    for (const [ws, client] of this.clients) {
      if (!client.alive) { this.disconnect(ws); ws.terminate(); continue; }
      client.alive = false;
      ws.ping();
    }
    const now = Date.now();
    for (const [roomId, invite] of this.callInvites) if (invite.expires < now) this.callInvites.delete(roomId);
  }
}

module.exports = Realtime;
