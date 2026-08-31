const { pool, transaction } = require('./db');
const { publicUser } = require('./auth');
const fs = require('fs');
const path = require('path');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Load protected accounts list
let protectedUsernames = [];
try {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'protected-accounts.json'), 'utf8'));
  protectedUsernames = (config.accounts || []).map(u => u.toLowerCase());
} catch (_) { /* file may not exist yet */ }

function isProtectedUsername(username) {
  return protectedUsernames.includes(String(username || '').toLowerCase());
}

async function isProtectedUser(userId) {
  if (!protectedUsernames.length) return false;
  const result = await pool.query('SELECT username_key FROM users WHERE id = $1', [userId]);
  if (!result.rowCount) return false;
  return isProtectedUsername(result.rows[0].username_key);
}

function requireUuid(value, label = 'ID') {
  if (!UUID.test(String(value || ''))) throw Object.assign(new Error(`Invalid ${label}.`), { status: 400 });
  return String(value);
}

function parseCursor(value) {
  if (!value) return null;
  const time = Date.parse(String(value));
  if (!Number.isFinite(time)) throw Object.assign(new Error('Invalid message cursor.'), { status: 400 });
  return new Date(time).toISOString();
}

function sanitizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map(item => {
    const name = String(item?.name || 'image').slice(0, 128);
    const data = String(item?.data || '');
    if (item?.type !== 'image' || data.length > 1500000 || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(data)) throw Object.assign(new Error('Only PNG, JPEG, WebP, or GIF images up to 1 MB are supported.'), { status: 400 });
    return { type: 'image', name, data };
  });
}

function messageRow(row) {
  const reactionMap = new Map();
  for (const reaction of row.reactions || []) {
    if (!reactionMap.has(reaction.emoji)) reactionMap.set(reaction.emoji, { emoji: reaction.emoji, users: [] });
    reactionMap.get(reaction.emoji).users.push(reaction.userId || reaction.userid || reaction.user_id);
  }
  return {
    id: row.id,
    author: row.username || 'Deleted User',
    authorId: row.author_id || 'deleted',
    avatar: row.avatar || '',
    text: row.content,
    ts: new Date(row.created_at).getTime(),
    attachments: row.attachments || [],
    reactions: Array.from(reactionMap.values()),
    system: row.system || false,
    edited: row.edited_at ? new Date(row.edited_at).getTime() : null,
  };
}

async function loadGuilds(userId, isOnline) {
  const rows = await pool.query(
    `SELECT g.id AS guild_id, g.name AS guild_name, g.icon, g.owner_id,
      c.id AS category_id, c.name AS category_name, c.position AS category_position,
      ch.id AS channel_id, ch.name AS channel_name, ch.type AS channel_type, ch.topic, ch.position AS channel_position
     FROM guild_members mine
     JOIN guilds g ON g.id = mine.guild_id
     LEFT JOIN categories c ON c.guild_id = g.id
     LEFT JOIN channels ch ON ch.category_id = c.id
     WHERE mine.user_id = $1
     ORDER BY g.created_at, c.position, ch.position`,
    [userId]
  );
  const guilds = new Map();
  for (const row of rows.rows) {
    if (!guilds.has(row.guild_id)) guilds.set(row.guild_id, { id: row.guild_id, name: row.guild_name, icon: row.icon, ownerId: row.owner_id, categories: [], members: [], banned: [] });
    const guild = guilds.get(row.guild_id);
    let category = guild.categories.find(x => x.id === row.category_id);
    if (row.category_id && !category) {
      category = { id: row.category_id, name: row.category_name, channels: [] };
      guild.categories.push(category);
    }
    if (category && row.channel_id) category.channels.push({ id: row.channel_id, name: row.channel_name, type: row.channel_type === 'announcement' ? 'text' : row.channel_type, topic: row.topic });
  }
  if (!guilds.size) return [];
  const memberRows = await pool.query(
    `SELECT gm.guild_id, gm.role, gm.nickname, u.* FROM guild_members gm JOIN users u ON u.id = gm.user_id
     WHERE gm.guild_id = ANY($1::uuid[]) ORDER BY u.username_key`,
    [Array.from(guilds.keys())]
  );
  for (const row of memberRows.rows) {
    const user = publicUser(row);
    user.role = row.role;
    user.name = row.nickname || user.name;
    user.status = isOnline(row.id) ? row.status : 'offline';
    guilds.get(row.guild_id).members.push(user);
  }
  return Array.from(guilds.values());
}

async function loadFriends(userId, isOnline) {
  const result = await pool.query(
    `SELECT f.requester_id, f.addressee_id, f.status AS friendship_status, u.*
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE f.requester_id = $1 OR f.addressee_id = $1
     ORDER BY u.username_key`,
    [userId]
  );
  return result.rows.map(row => ({ ...publicUser(row), status: isOnline(row.id) ? row.status : 'offline', pending: row.friendship_status === 'pending', incoming: row.addressee_id === userId }));
}

async function loadBlocked(userId) {
  const result = await pool.query('SELECT u.* FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = $1 ORDER BY u.username_key', [userId]);
  return result.rows.map(row => ({ ...publicUser(row), status: 'offline', activity: 'Blocked' }));
}

async function loadDms(userId, isOnline) {
  const result = await pool.query(
    `SELECT d.id AS thread_id, u.* FROM dm_threads d
     JOIN dm_members mine ON mine.thread_id = d.id AND mine.user_id = $1
     JOIN dm_members other ON other.thread_id = d.id AND other.user_id <> $1
     JOIN users u ON u.id = other.user_id
     ORDER BY d.created_at DESC`,
    [userId]
  );
  return result.rows.map(row => ({ ...publicUser(row), threadId: row.thread_id, status: isOnline(row.id) ? row.status : 'offline', unread: false }));
}

async function bootstrap(user, isOnline, iceServers) {
  const [guilds, friends, blocked, dms] = await Promise.all([
    loadGuilds(user.id, isOnline),
    loadFriends(user.id, isOnline),
    loadBlocked(user.id),
    loadDms(user.id, isOnline),
  ]);
  return { me: publicUser(user), servers: guilds, friends, blocked, dms, iceServers };
}

async function createGuild(userId, name, icon) {
  name = String(name || '').trim();
  icon = String(icon || 'K').slice(0, 8);
  if (name.length < 2 || name.length > 100) throw Object.assign(new Error('Shrine name must be 2-100 characters.'), { status: 400 });
  return transaction(async client => {
    const guild = await client.query('INSERT INTO guilds(name, icon, owner_id) VALUES ($1, $2, $3) RETURNING *', [name, icon, userId]);
    const guildId = guild.rows[0].id;
    await client.query('INSERT INTO guild_members(guild_id, user_id, role) VALUES ($1, $2, $3)', [guildId, userId, 'Tenko']);
    const community = await client.query('INSERT INTO categories(guild_id, name, position) VALUES ($1, $2, $3) RETURNING id', [guildId, 'Community', 0]);
    const voice = await client.query('INSERT INTO categories(guild_id, name, position) VALUES ($1, $2, $3) RETURNING id', [guildId, 'Voice', 1]);
    await client.query('INSERT INTO channels(guild_id, category_id, name, type, topic, position) VALUES ($1, $2, $3, $4, $5, $6)', [guildId, community.rows[0].id, 'general', 'text', 'General chat.', 0]);
    await client.query('INSERT INTO channels(guild_id, category_id, name, type, topic, position) VALUES ($1, $2, $3, $4, $5, $6)', [guildId, voice.rows[0].id, 'Lounge', 'voice', '', 0]);
    return guild.rows[0];
  });
}

async function verifyChannelMember(userId, channelId) {
  const result = await pool.query(
    'SELECT ch.*, gm.role FROM channels ch JOIN guild_members gm ON gm.guild_id = ch.guild_id WHERE ch.id = $1 AND gm.user_id = $2',
    [channelId, userId]
  );
  return result.rows[0] || null;
}

async function createChannelMessage(user, input) {
  const content = String(input.content || '').trim();
  const attachments = sanitizeAttachments(input.attachments);
  if ((!content && !attachments.length) || content.length > 4000) throw Object.assign(new Error('Message must contain text or an attachment.'), { status: 400 });
  const channel = await verifyChannelMember(user.id, input.channelId);
  if (!channel || channel.type === 'voice') throw Object.assign(new Error('Channel not found.'), { status: 404 });
  const inserted = await pool.query(
    `INSERT INTO messages(channel_id, author_id, content, attachments, reply_to) VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [channel.id, user.id, content, JSON.stringify(attachments), input.replyTo || null]
  );
  return { guildId: channel.guild_id, channelId: channel.id, message: messageRow({ ...inserted.rows[0], username: user.username, avatar: user.avatar }) };
}

async function listChannelMessages(userId, channelId, limit = 50, before) {
  if (!(await verifyChannelMember(userId, channelId))) throw Object.assign(new Error('Channel not found.'), { status: 404 });
  const size = Math.min(100, Math.max(1, Number(limit) || 50));
  const result = await pool.query(
    `SELECT m.*, u.username, u.avatar,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('emoji', r.emoji, 'userId', r.user_id)) FROM reactions r WHERE r.message_id = m.id), '[]'::jsonb) AS reactions
     FROM messages m LEFT JOIN users u ON u.id = m.author_id
     WHERE m.channel_id = $1 AND m.deleted_at IS NULL AND ($2::timestamptz IS NULL OR m.created_at < $2)
     ORDER BY m.created_at DESC LIMIT $3`,
    [channelId, parseCursor(before), size]
  );
  return result.rows.reverse().map(messageRow);
}

async function editChannelMessage(user, messageId, content) {
  content = String(content || '').trim();
  if (!content || content.length > 4000) throw Object.assign(new Error('Message must be 1-4000 characters.'), { status: 400 });
  const result = await pool.query(
    `UPDATE messages m SET content = $1, edited_at = now() FROM channels ch, guild_members gm
     WHERE m.id = $2 AND m.author_id = $3 AND m.channel_id = ch.id AND gm.guild_id = ch.guild_id AND gm.user_id = $3 AND m.deleted_at IS NULL
     RETURNING m.*, ch.guild_id`,
    [content, messageId, user.id]
  );
  if (!result.rowCount) throw Object.assign(new Error('Message not found or cannot be edited.'), { status: 404 });
  return { guildId: result.rows[0].guild_id, channelId: result.rows[0].channel_id, message: messageRow({ ...result.rows[0], username: user.username, avatar: user.avatar }) };
}

async function deleteChannelMessage(userId, messageId) {
  const result = await pool.query(
    `UPDATE messages m SET deleted_at = now() FROM channels ch, guild_members gm
     WHERE m.id = $1 AND m.channel_id = ch.id AND gm.guild_id = ch.guild_id AND gm.user_id = $2
       AND (m.author_id = $2 OR gm.role IN ('Admin', 'Tenko')) AND m.deleted_at IS NULL
     RETURNING m.id, m.channel_id, ch.guild_id`,
    [messageId, userId]
  );
  if (!result.rowCount) throw Object.assign(new Error('Message not found or cannot be deleted.'), { status: 404 });
  return { messageId: result.rows[0].id, channelId: result.rows[0].channel_id, guildId: result.rows[0].guild_id };
}

async function toggleMessageReaction(userId, messageId, emoji) {
  emoji = String(emoji || '').slice(0, 32);
  if (!emoji) throw Object.assign(new Error('Invalid reaction.'), { status: 400 });
  const allowed = await pool.query('SELECT m.channel_id, ch.guild_id FROM messages m JOIN channels ch ON ch.id = m.channel_id JOIN guild_members gm ON gm.guild_id = ch.guild_id AND gm.user_id = $2 WHERE m.id = $1 AND m.deleted_at IS NULL', [messageId, userId]);
  if (!allowed.rowCount) throw Object.assign(new Error('Message not found.'), { status: 404 });
  const deleted = await pool.query('DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3', [messageId, userId, emoji]);
  if (!deleted.rowCount) await pool.query('INSERT INTO reactions(message_id, user_id, emoji) VALUES ($1, $2, $3)', [messageId, userId, emoji]);
  return { messageId, emoji, userId, added: !deleted.rowCount, channelId: allowed.rows[0].channel_id, guildId: allowed.rows[0].guild_id };
}

async function openDm(userId, otherId) {
  requireUuid(otherId, 'user ID');
  if (userId === otherId) throw Object.assign(new Error('You cannot message yourself.'), { status: 400 });
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [[userId, otherId].sort().join(':')]);
    const allowed = await client.query(
      `SELECT 1 FROM friendships WHERE status = 'accepted' AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
       AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1))`,
      [userId, otherId]
    );
    if (!allowed.rowCount) throw Object.assign(new Error('Direct messages require an accepted friendship.'), { status: 403 });
    const existing = await client.query(
      `SELECT dm.thread_id FROM dm_members dm WHERE dm.user_id IN ($1, $2) GROUP BY dm.thread_id
       HAVING count(*) = 2 AND (SELECT count(*) FROM dm_members allm WHERE allm.thread_id = dm.thread_id) = 2 LIMIT 1`,
      [userId, otherId]
    );
    if (existing.rowCount) return existing.rows[0].thread_id;
    const thread = await client.query('INSERT INTO dm_threads DEFAULT VALUES RETURNING id');
    await client.query('INSERT INTO dm_members(thread_id, user_id) VALUES ($1, $2), ($1, $3)', [thread.rows[0].id, userId, otherId]);
    return thread.rows[0].id;
  });
}

async function verifyDmMember(userId, threadId) {
  const result = await pool.query('SELECT 1 FROM dm_members WHERE thread_id = $1 AND user_id = $2', [threadId, userId]);
  return Boolean(result.rowCount);
}

async function createDmMessage(user, input) {
  const content = String(input.content || '').trim();
  const attachments = sanitizeAttachments(input.attachments);
  if ((!content && !attachments.length) || content.length > 4000) throw Object.assign(new Error('Message must contain text or an attachment.'), { status: 400 });
  if (!(await verifyDmMember(user.id, input.threadId))) throw Object.assign(new Error('Conversation not found.'), { status: 404 });
  const blocked = await pool.query(
    `SELECT 1 FROM dm_members other JOIN blocks b ON (b.blocker_id = $1 AND b.blocked_id = other.user_id) OR (b.blocker_id = other.user_id AND b.blocked_id = $1)
     WHERE other.thread_id = $2 AND other.user_id <> $1 LIMIT 1`,
    [user.id, input.threadId]
  );
  if (blocked.rowCount) throw Object.assign(new Error('This conversation is blocked.'), { status: 403 });
  const inserted = await pool.query(
    'INSERT INTO dm_messages(thread_id, author_id, content, attachments, reply_to) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [input.threadId, user.id, content, JSON.stringify(attachments), input.replyTo || null]
  );
  return { threadId: input.threadId, message: messageRow({ ...inserted.rows[0], username: user.username, avatar: user.avatar }) };
}

async function editDmMessage(user, messageId, content) {
  content = String(content || '').trim();
  if (!content || content.length > 4000) throw Object.assign(new Error('Message must be 1-4000 characters.'), { status: 400 });
  const result = await pool.query("UPDATE dm_messages SET content = $1, edited_at = now() WHERE id = $2 AND author_id = $3 AND deleted_at IS NULL RETURNING *", [content, messageId, user.id]);
  if (!result.rowCount) throw Object.assign(new Error('Message not found or cannot be edited.'), { status: 404 });
  return { threadId: result.rows[0].thread_id, message: messageRow({ ...result.rows[0], username: user.username, avatar: user.avatar }) };
}

async function deleteDmMessage(userId, messageId) {
  const result = await pool.query('UPDATE dm_messages SET deleted_at = now() WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL RETURNING id, thread_id', [messageId, userId]);
  if (!result.rowCount) throw Object.assign(new Error('Message not found or cannot be deleted.'), { status: 404 });
  return { messageId: result.rows[0].id, threadId: result.rows[0].thread_id };
}

async function listDmMessages(userId, threadId, limit = 50, before) {
  if (!(await verifyDmMember(userId, threadId))) throw Object.assign(new Error('Conversation not found.'), { status: 404 });
  const size = Math.min(100, Math.max(1, Number(limit) || 50));
  const result = await pool.query(
    `SELECT m.*, u.username, u.avatar FROM dm_messages m LEFT JOIN users u ON u.id = m.author_id
     WHERE m.thread_id = $1 AND m.deleted_at IS NULL AND ($2::timestamptz IS NULL OR m.created_at < $2)
     ORDER BY m.created_at DESC LIMIT $3`,
    [threadId, parseCursor(before), size]
  );
  return result.rows.reverse().map(messageRow);
}

async function addFriend(userId, username) {
  const other = await pool.query('SELECT id FROM users WHERE username_key = $1', [String(username || '').trim().toLowerCase().replace(/\s+/g, ' ')]);
  if (!other.rowCount) throw Object.assign(new Error('User not found.'), { status: 404 });
  if (other.rows[0].id === userId) throw Object.assign(new Error('You cannot add yourself.'), { status: 400 });
  const blocked = await pool.query('SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)', [userId, other.rows[0].id]);
  if (blocked.rowCount) throw Object.assign(new Error('Friend request is not allowed.'), { status: 403 });
  try {
    await pool.query("INSERT INTO friendships(requester_id, addressee_id, status) VALUES ($1, $2, 'pending')", [userId, other.rows[0].id]);
  } catch (error) {
    if (error.code === '23505') throw Object.assign(new Error('A friendship or request already exists.'), { status: 409 });
    throw error;
  }
  return other.rows[0].id;
}

async function acceptFriend(userId, otherId) {
  const result = await pool.query("UPDATE friendships SET status = 'accepted', updated_at = now() WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'", [otherId, userId]);
  if (!result.rowCount) throw Object.assign(new Error('Friend request not found.'), { status: 404 });
}

async function removeFriend(userId, otherId) {
  await pool.query('DELETE FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)', [userId, otherId]);
}

async function blockUser(userId, otherId) {
  if (userId === otherId) throw Object.assign(new Error('You cannot block yourself.'), { status: 400 });
  await transaction(async client => {
    await client.query('DELETE FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)', [userId, otherId]);
    await client.query('INSERT INTO blocks(blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, otherId]);
  });
}

async function updateMemberRole(actorId, guildId, userId, role) {
  const actor = await pool.query('SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2', [guildId, actorId]);
  if (!actor.rowCount || actor.rows[0].role !== 'Tenko') throw Object.assign(new Error('Owner permission required.'), { status: 403 });
  if (!['Admin', 'Wanderer'].includes(role)) throw Object.assign(new Error('Invalid role.'), { status: 400 });
  if (await isProtectedUser(userId)) throw Object.assign(new Error('This account is protected and cannot have its role changed.'), { status: 403 });
  const result = await pool.query('UPDATE guild_members SET role = $1 WHERE guild_id = $2 AND user_id = $3 AND role <> \'Tenko\'', [role, guildId, userId]);
  if (!result.rowCount) throw Object.assign(new Error('Member not found or protected.'), { status: 404 });
}

async function clearGuildMessages(actorId, guildId) {
  const actor = await pool.query('SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2', [guildId, actorId]);
  if (!actor.rowCount || actor.rows[0].role !== 'Tenko') throw Object.assign(new Error('Owner permission required.'), { status: 403 });
  const result = await pool.query('DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE guild_id = $1)', [guildId]);
  return result.rowCount;
}

async function removeGuildMember(actorId, guildId, userId, ban, reason = '') {
  const actor = await pool.query('SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2', [guildId, actorId]);
  if (!actor.rowCount || actor.rows[0].role !== 'Tenko') throw Object.assign(new Error('Owner permission required.'), { status: 403 });
  if (await isProtectedUser(userId)) throw Object.assign(new Error('This account is protected and cannot be kicked or banned.'), { status: 403 });
  const target = await pool.query('SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2', [guildId, userId]);
  if (!target.rowCount || target.rows[0].role === 'Tenko') throw Object.assign(new Error('Member not found or protected.'), { status: 404 });
  await transaction(async client => {
    if (ban) await client.query('INSERT INTO guild_bans(guild_id, user_id, banned_by, reason) VALUES ($1, $2, $3, $4) ON CONFLICT (guild_id, user_id) DO UPDATE SET banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason, created_at = now()', [guildId, userId, actorId, String(reason).slice(0, 512)]);
    await client.query('DELETE FROM guild_members WHERE guild_id = $1 AND user_id = $2', [guildId, userId]);
  });
}

module.exports = {
  bootstrap,
  createGuild,
  verifyChannelMember,
  createChannelMessage,
  listChannelMessages,
  editChannelMessage,
  deleteChannelMessage,
  toggleMessageReaction,
  openDm,
  verifyDmMember,
  createDmMessage,
  editDmMessage,
  deleteDmMessage,
  listDmMessages,
  addFriend,
  acceptFriend,
  removeFriend,
  blockUser,
  updateMemberRole,
  clearGuildMessages,
  removeGuildMember,
  isProtectedUsername,
  isProtectedUser,
};
