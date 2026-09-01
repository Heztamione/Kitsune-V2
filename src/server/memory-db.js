// In-memory fallback store that provides the same pool/transaction interface as db.js.
// Used when DATABASE_URL is not configured so the server can run without PostgreSQL.
// Includes disk persistence so accounts and messages survive restarts.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Cross-platform persistence directory.
// On Windows: %APPDATA%/kitsune  (same as before)
// On Linux/macOS and others: ~/.local/share/kitsune (XDG-style)
// Falls back to an os.tmpdir() location if the preferred dir isn't writable.
function resolvePersistDir() {
  const candidates = [];
  if (process.platform === 'win32' && process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'kitsune'));
  } else {
    const xdg = process.env.XDG_DATA_HOME;
    if (xdg) candidates.push(path.join(xdg, 'kitsune'));
    candidates.push(path.join(os.homedir(), '.local', 'share', 'kitsune'));
    candidates.push(path.join(os.homedir(), '.kitsune'));
  }
  if (process.env.KITSUNE_PERSIST_DIR) candidates.unshift(process.env.KITSUNE_PERSIST_DIR);
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, '.kitsune-write-probe');
      fs.writeFileSync(probe, '');
      fs.unlinkSync(probe);
      return dir;
    } catch (_) { /* try next candidate */ }
  }
  // Last resort: a temp directory (data won't persist, but the server still runs).
  const tmp = path.join(os.tmpdir(), 'kitsune');
  try { fs.mkdirSync(tmp, { recursive: true }); } catch (_) {}
  return tmp;
}
const PERSIST_DIR = resolvePersistDir();
const PERSIST_FILE = path.join(PERSIST_DIR, 'kitsune-db-state.json');
const SAVE_INTERVAL_MS = 30000; // Save every 30 seconds

const tables = {
  users: new Map(),
  sessions: new Map(),
  guilds: new Map(),
  guild_members: new Map(), // key: `${guildId}:${userId}`
  guild_bans: new Map(),
  categories: new Map(),
  channels: new Map(),
  messages: new Map(),
  dm_threads: new Map(),
  dm_members: new Map(), // key: `${threadId}:${userId}`
  dm_messages: new Map(),
  friendships: new Map(), // key: `${requesterId}:${addresseeId}`
  blocks: new Map(), // key: `${blockerId}:${blockedId}`
  reactions: new Map(),
  schema_migrations: new Map(),
};

let migrated = false;

function uuid() { return crypto.randomUUID(); }
function now() { return new Date(); }
function iso(d) { return new Date(d).toISOString(); }

// ---- Disk persistence ----
// Serializes all in-memory tables to JSON on disk so data survives restarts.
function serializeState() {
  const state = {};
  for (const [name, map] of Object.entries(tables)) {
    if (name === 'schema_migrations') continue;
    state[name] = Array.from(map.entries());
  }
  return state;
}

function deserializeState(state) {
  for (const [name, entries] of Object.entries(state)) {
    if (!tables[name]) continue;
    for (const [key, value] of entries) {
      tables[name].set(key, value);
    }
  }
}

function saveToDisk() {
  try {
    fs.mkdirSync(PERSIST_DIR, { recursive: true });
    const data = JSON.stringify(serializeState());
    const tmp = PERSIST_FILE + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, PERSIST_FILE);
  } catch (e) {
    console.error('[memory-db] Failed to save state:', e.message);
  }
}

function loadFromDisk() {
  try {
    if (!fs.existsSync(PERSIST_FILE)) return false;
    const data = fs.readFileSync(PERSIST_FILE, 'utf8');
    if (!data.trim()) return false;
    const state = JSON.parse(data);
    deserializeState(state);
    console.log('[memory-db] Restored state from disk:', PERSIST_FILE);
    return true;
  } catch (e) {
    console.error('[memory-db] Failed to load state:', e.message);
    return false;
  }
}

// Load persisted state on module initialization
loadFromDisk();

// Auto-save on an interval
const saveTimer = setInterval(saveToDisk, SAVE_INTERVAL_MS);
saveTimer.unref();

// Save on shutdown
process.on('SIGINT', () => { saveToDisk(); });
process.on('SIGTERM', () => { saveToDisk(); });
process.on('beforeExit', () => { saveToDisk(); });

// Helper: parse a value that might be a JSON string or already an object
function parseJson(val) {
  if (val == null) return [];
  if (typeof val === 'string') { try { return JSON.parse(val); } catch (_) { return []; } }
  return val;
}

// Helper: build a user row from the users map
function userRow(id) {
  const u = tables.users.get(id);
  if (!u) return null;
  return { ...u };
}

// Helper: public user fields
function publicFields(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.username, tag: u.username_key.replace(/\s/g, ''),
    avatar: u.avatar, bio: u.bio, status: u.status, activity: u.activity,
    role: u.platform_role,
  };
}

// The query interpreter. Pattern-matches on SQL text.
async function query(text, params = []) {
  const sql = String(text || '').trim();
  const upper = sql.replace(/\s+/g, ' ').toUpperCase();

  // --- Health check ---
  if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }], rowCount: 1 };

  // --- Advisory locks (no-op) ---
  if (upper.startsWith('SELECT PG_ADVISORY')) return { rows: [], rowCount: 0 };

  // --- Schema migrations ---
  if (upper.startsWith('CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS')) return { rows: [], rowCount: 0 };
  if (upper.startsWith('SELECT 1 FROM SCHEMA_MIGRATIONS')) {
    const version = Number(params[0] || 1);
    return { rows: tables.schema_migrations.has(version) ? [{ '?column?': 1 }] : [], rowCount: tables.schema_migrations.has(version) ? 1 : 0 };
  }
  if (upper.startsWith('INSERT INTO SCHEMA_MIGRATIONS')) {
    const version = Number(params[0] || 1);
    tables.schema_migrations.set(version, { version, applied_at: now() });
    return { rows: [], rowCount: 1 };
  }

  // --- Sessions ---
  if (upper.startsWith('INSERT INTO SESSIONS(')) {
    const [tokenHash, userId, seconds, remember, userAgent, ip] = params;
    const id = uuid();
    const expiresAt = new Date(Date.now() + Number(seconds) * 1000);
    tables.sessions.set(id, { id, token_hash: tokenHash, user_id: userId, expires_at: expiresAt, remember: Boolean(remember), user_agent: userAgent, ip, last_seen_at: now(), created_at: now() });
    return { rows: [{ id }], rowCount: 1 };
  }
  if (upper.startsWith('SELECT U.*, S.TOKEN_HASH, S.REMEMBER FROM SESSIONS S JOIN USERS U')) {
    const tokenHash = params[0];
    for (const s of tables.sessions.values()) {
      if (s.token_hash === tokenHash && s.expires_at > now()) {
        const u = userRow(s.user_id);
        if (u) return { rows: [{ ...u, token_hash: s.token_hash, remember: s.remember }], rowCount: 1 };
      }
    }
    return { rows: [], rowCount: 0 };
  }
  if (upper.startsWith('UPDATE SESSIONS SET EXPIRES_AT = NOW() + ($2')) {
    const [tokenHash, seconds] = params;
    for (const s of tables.sessions.values()) {
      if (s.token_hash === tokenHash) {
        s.expires_at = new Date(Date.now() + Number(seconds) * 1000);
        s.last_seen_at = now();
      }
    }
    return { rows: [], rowCount: 1 };
  }
  if (upper.startsWith('UPDATE SESSIONS SET LAST_SEEN_AT')) {
    const tokenHash = params[0];
    for (const s of tables.sessions.values()) { if (s.token_hash === tokenHash) s.last_seen_at = now(); }
    return { rows: [], rowCount: 1 };
  }
  if (upper.startsWith('DELETE FROM SESSIONS WHERE TOKEN_HASH')) {
    const tokenHash = params[0];
    let count = 0;
    for (const [id, s] of tables.sessions) { if (s.token_hash === tokenHash) { tables.sessions.delete(id); count++; } }
    return { rows: [], rowCount: count };
  }
  if (upper.startsWith('DELETE FROM SESSIONS WHERE EXPIRES_AT')) {
    let count = 0;
    for (const [id, s] of tables.sessions) { if (s.expires_at <= now()) { tables.sessions.delete(id); count++; } }
    return { rows: [], rowCount: count };
  }

  // --- Users ---
  if (upper.startsWith('SELECT COUNT(*)::INT AS COUNT FROM USERS')) {
    return { rows: [{ count: tables.users.size }], rowCount: 1 };
  }
  if (upper.startsWith('INSERT INTO USERS(')) {
    // Supports both the old (5 params) and new (6 params including recovery_code_hash) INSERT statements.
    const username = params[0];
    const usernameKey = params[1];
    const passwordHash = params[2];
    const recoveryCodeHash = params.length >= 6 ? params[3] : null;
    const avatar = params.length >= 6 ? params[4] : params[3];
    const platformRole = params.length >= 6 ? params[5] : params[4];
    // Enforce unique constraint on username_key
    for (const u of tables.users.values()) {
      if (u.username_key === usernameKey) { const err = new Error('unique violation'); err.code = '23505'; throw err; }
    }
    const id = uuid();
    const user = {
      id, username, username_key: usernameKey, password_hash: passwordHash, recovery_code_hash: recoveryCodeHash,
      avatar, platform_role: platformRole, bio: '', status: 'offline', activity: '',
      created_at: now(), updated_at: now(),
    };
    tables.users.set(id, user);
    return { rows: [{ ...user }], rowCount: 1 };
  }
  if (upper.startsWith('SELECT * FROM USERS WHERE USERNAME_KEY')) {
    const usernameKey = params[0];
    for (const u of tables.users.values()) { if (u.username_key === usernameKey) return { rows: [{ ...u }], rowCount: 1 }; }
    return { rows: [], rowCount: 0 };
  }
  if (upper.startsWith('SELECT ID FROM USERS WHERE USERNAME_KEY')) {
    const usernameKey = params[0];
    for (const u of tables.users.values()) { if (u.username_key === usernameKey) return { rows: [{ id: u.id }], rowCount: 1 }; }
    return { rows: [], rowCount: 0 };
  }
  if (upper.startsWith('SELECT USERNAME_KEY FROM USERS WHERE ID')) {
    const userId = params[0];
    const u = tables.users.get(userId);
    if (u) return { rows: [{ username_key: u.username_key }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }
  if (upper.startsWith('UPDATE USERS SET STATUS = $1, ACTIVITY = $2')) {
    const [status, activity, userId] = params;
    const u = tables.users.get(userId);
    if (u) { u.status = status; u.activity = activity; u.updated_at = now(); }
    return { rows: [], rowCount: u ? 1 : 0 };
  }
  if (upper.startsWith('UPDATE USERS SET STATUS = $1, UPDATED_AT = NOW() WHERE ID = $2')) {
    const [status, userId] = params;
    const u = tables.users.get(userId);
    if (u) { u.status = status; u.updated_at = now(); }
    return { rows: [], rowCount: u ? 1 : 0 };
  }
  if (upper.startsWith("UPDATE USERS SET STATUS = 'OFFLINE'")) {
    const userId = params[0];
    const u = tables.users.get(userId);
    if (u) { u.status = 'offline'; u.updated_at = now(); }
    return { rows: [], rowCount: u ? 1 : 0 };
  }
  if (upper.startsWith('UPDATE USERS SET USERNAME = $1')) {
    const [username, usernameKey, bio, avatar, userId] = params;
    const u = tables.users.get(userId);
    if (!u) return { rows: [], rowCount: 0 };
    // Check unique constraint
    for (const other of tables.users.values()) { if (other.id !== userId && other.username_key === usernameKey) { const err = new Error('unique violation'); err.code = '23505'; throw err; } }
    u.username = username; u.username_key = usernameKey; u.bio = bio; u.avatar = avatar; u.updated_at = now();
    return { rows: [{ ...u }], rowCount: 1 };
  }
  if (upper.startsWith('UPDATE USERS SET PASSWORD_HASH = $1')) {
    // Supports both the old 2-param form and the new 3-param form that also clears recovery_code_hash.
    const passwordHash = params[0];
    const userId = params.length >= 3 ? params[2] : params[1];
    const recoveryCodeHash = params.length >= 3 ? params[1] : undefined;
    const u = tables.users.get(userId);
    if (u) { u.password_hash = passwordHash; if (recoveryCodeHash !== undefined) u.recovery_code_hash = recoveryCodeHash; u.updated_at = now(); }
    return { rows: [], rowCount: u ? 1 : 0 };
  }
  if (upper.startsWith('UPDATE USERS SET RECOVERY_CODE_HASH = $1 WHERE ID = $2')) {
    const [recoveryCodeHash, userId] = params;
    const u = tables.users.get(userId);
    if (u) { u.recovery_code_hash = recoveryCodeHash; u.updated_at = now(); }
    return { rows: [], rowCount: u ? 1 : 0 };
  }
  if (upper.startsWith('UPDATE USERS SET PLATFORM_ROLE = $1 WHERE ID = $2')) {
    const [role, userId] = params;
    const u = tables.users.get(userId);
    if (u) { u.platform_role = role; u.updated_at = now(); }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  // --- Guilds ---
  if (upper.startsWith('INSERT INTO GUILDS(NAME, ICON, OWNER_ID, IS_PUBLIC) VALUES')) {
    const [name, icon, ownerId, isPublic] = params;
    const id = uuid();
    const guild = { id, name, icon, owner_id: ownerId, is_public: Boolean(isPublic), created_at: now() };
    tables.guilds.set(id, guild);
    return { rows: [{ id }], rowCount: 1 };
  }
  if (upper.startsWith('SELECT * FROM GUILDS WHERE IS_PUBLIC = TRUE LIMIT 1')) {
    for (const g of tables.guilds.values()) {
      if (g.is_public) return { rows: [{ ...g }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
  if (upper.startsWith('SELECT 1 FROM GUILD_MEMBERS WHERE GUILD_ID = $1 AND USER_ID = $2')) {
    const [guildId, userId] = params;
    const m = tables.guild_members.get(`${guildId}:${userId}`);
    return { rows: m ? [{ exists: true }] : [], rowCount: m ? 1 : 0 };
  }
  if (upper.startsWith('INSERT INTO GUILD_MEMBERS(GUILD_ID, USER_ID, ROLE) VALUES ($1, $2, $3)')) {
    const [guildId, userId, role] = params;
    tables.guild_members.set(`${guildId}:${userId}`, { guild_id: guildId, user_id: userId, role, nickname: null, joined_at: now() });
    return { rows: [], rowCount: 1 };
  }
  if (upper.startsWith('UPDATE GUILDS SET OWNER_ID = $1 WHERE ID = $2')) {
    const [ownerId, guildId] = params;
    const g = tables.guilds.get(guildId);
    if (g) { g.owner_id = ownerId; g.updated_at = now(); }
    return { rows: [], rowCount: g ? 1 : 0 };
  }
  if (upper.startsWith('INSERT INTO GUILDS(NAME, ICON, OWNER_ID) VALUES')) {
    const [name, icon, ownerId] = params;
    const id = uuid();
    const guild = { id, name, icon, owner_id: ownerId, is_public: false, created_at: now() };
    tables.guilds.set(id, guild);
    return { rows: [{ ...guild }], rowCount: 1 };
  }

  // --- Guild members ---
  if (upper.startsWith('INSERT INTO GUILD_MEMBERS(GUILD_ID, USER_ID, ROLE) VALUES ($1, $2, ')) {
    const [guildId, userId, role] = params;
    tables.guild_members.set(`${guildId}:${userId}`, { guild_id: guildId, user_id: userId, role, nickname: null, joined_at: now() });
    return { rows: [], rowCount: 1 };
  }
  if (upper.startsWith("INSERT INTO GUILD_MEMBERS(GUILD_ID, USER_ID, ROLE) SELECT ID, $1, 'WANDERER' FROM GUILDS WHERE IS_PUBLIC = TRUE")) {
    const userId = params[0];
    let count = 0;
    for (const g of tables.guilds.values()) {
      if (g.is_public && !tables.guild_members.has(`${g.id}:${userId}`)) {
        tables.guild_members.set(`${g.id}:${userId}`, { guild_id: g.id, user_id: userId, role: 'Wanderer', nickname: null, joined_at: now() });
        count++;
      }
    }
    return { rows: [], rowCount: count };
  }
  if (upper.startsWith('SELECT ROLE FROM GUILD_MEMBERS WHERE GUILD_ID = $1 AND USER_ID = $2')) {
    const [guildId, userId] = params;
    const m = tables.guild_members.get(`${guildId}:${userId}`);
    return { rows: m ? [{ role: m.role }] : [], rowCount: m ? 1 : 0 };
  }
  if (upper.startsWith('UPDATE GUILD_MEMBERS SET ROLE = $1 WHERE GUILD_ID = $2 AND USER_ID = $3')) {
    const [role, guildId, userId] = params;
    const m = tables.guild_members.get(`${guildId}:${userId}`);
    if (m && m.role !== 'Tenko') { m.role = role; return { rows: [], rowCount: 1 }; }
    return { rows: [], rowCount: 0 };
  }
  if (upper.startsWith('DELETE FROM GUILD_MEMBERS WHERE GUILD_ID = $1 AND USER_ID = $2')) {
    const [guildId, userId] = params;
    const key = `${guildId}:${userId}`;
    const existed = tables.guild_members.has(key);
    tables.guild_members.delete(key);
    return { rows: [], rowCount: existed ? 1 : 0 };
  }
  if (upper.startsWith('SELECT USER_ID FROM GUILD_MEMBERS WHERE GUILD_ID = $1')) {
    const guildId = params[0];
    const rows = [];
    for (const m of tables.guild_members.values()) if (m.guild_id === guildId) rows.push({ user_id: m.user_id });
    return { rows, rowCount: rows.length };
  }

  // --- Guild bans ---
  if (upper.startsWith('INSERT INTO GUILD_BANS(')) {
    const [guildId, userId, bannedBy, reason] = params;
    const key = `${guildId}:${userId}`;
    tables.guild_bans.set(key, { guild_id: guildId, user_id: userId, banned_by: bannedBy, reason, created_at: now() });
    return { rows: [], rowCount: 1 };
  }

  // --- Categories ---
  if (upper.startsWith('INSERT INTO CATEGORIES(GUILD_ID, NAME, POSITION) VALUES')) {
    const [guildId, name, position] = params;
    const id = uuid();
    tables.categories.set(id, { id, guild_id: guildId, name, position, created_at: now() });
    return { rows: [{ id }], rowCount: 1 };
  }

  // --- Channels ---
  if (upper.startsWith('INSERT INTO CHANNELS(GUILD_ID, CATEGORY_ID, NAME, TYPE, TOPIC, POSITION) VALUES')) {
    // Handle multi-row insert: ($1, $2, ...), ($1, $3, ...), ...
    const guildId = params[0];
    // Count number of value groups by counting occurrences of "($1,"
    const groupCount = (sql.match(/\(\$1,/g) || []).length;
    const rows = [];
    let paramIdx = 1;
    for (let i = 0; i < groupCount; i++) {
      const categoryId = params[paramIdx++];
      const name = params[paramIdx++];
      const type = paramIdx < params.length ? params[paramIdx++] : 'text';
      const topic = paramIdx < params.length ? params[paramIdx++] : '';
      const position = paramIdx < params.length ? params[paramIdx++] : 0;
      const id = uuid();
      const channel = { id, guild_id: guildId, category_id: categoryId, name, type, topic, position, created_at: now() };
      tables.channels.set(id, channel);
      rows.push({ id });
    }
    return { rows, rowCount: rows.length };
  }
  if (upper.startsWith('SELECT CH.*, GM.ROLE FROM CHANNELS CH JOIN GUILD_MEMBERS GM')) {
    const [channelId, userId] = params;
    const ch = tables.channels.get(channelId);
    const gm = tables.guild_members.get(`${ch?.guild_id}:${userId}`);
    if (!ch || !gm) return { rows: [], rowCount: 0 };
    return { rows: [{ ...ch, role: gm.role }], rowCount: 1 };
  }

  // --- Messages ---
  if (upper.startsWith('INSERT INTO MESSAGES(CHANNEL_ID, AUTHOR_ID, CONTENT, ATTACHMENTS, REPLY_TO) VALUES')) {
    const [channelId, authorId, content, attachmentsJson, replyTo] = params;
    const id = uuid();
    const msg = {
      id, channel_id: channelId, author_id: authorId, content,
      attachments: parseJson(attachmentsJson), reply_to: replyTo || null,
      deleted_at: null, edited_at: null, system: false, created_at: now(),
    };
    tables.messages.set(id, msg);
    return { rows: [{ ...msg }], rowCount: 1 };
  }
  if (upper.startsWith('SELECT M.*, U.USERNAME, U.AVATAR, COALESCE(')) {
    // List channel messages with reactions
    const [channelId, before, limit] = params;
    let msgs = [];
    for (const m of tables.messages.values()) {
      if (m.channel_id === channelId && !m.deleted_at) {
        if (before && m.created_at >= new Date(before)) continue;
        const u = tables.users.get(m.author_id);
        const reactions = [];
        for (const r of tables.reactions.values()) {
          if (r.message_id === m.id) reactions.push({ emoji: r.emoji, userId: r.user_id });
        }
        msgs.push({ ...m, username: u?.username || 'Deleted User', avatar: u?.avatar || '', reactions });
      }
    }
    msgs.sort((a, b) => b.created_at - a.created_at);
    msgs = msgs.slice(0, Number(limit) || 50).reverse();
    return { rows: msgs, rowCount: msgs.length };
  }
  if (upper.startsWith('UPDATE MESSAGES M SET CONTENT = $1, EDITED_AT = NOW()')) {
    const [content, messageId, userId] = params;
    const m = tables.messages.get(messageId);
    if (!m || m.author_id !== userId || m.deleted_at) return { rows: [], rowCount: 0 };
    const ch = tables.channels.get(m.channel_id);
    m.content = content; m.edited_at = now();
    return { rows: [{ ...m, guild_id: ch?.guild_id, channel_id: m.channel_id }], rowCount: 1 };
  }
  if (upper.startsWith('UPDATE MESSAGES M SET DELETED_AT = NOW()')) {
    const [messageId, userId] = params;
    const m = tables.messages.get(messageId);
    if (!m || m.deleted_at) return { rows: [], rowCount: 0 };
    const ch = tables.channels.get(m.channel_id);
    const gm = tables.guild_members.get(`${ch?.guild_id}:${userId}`);
    if (m.author_id !== userId && gm?.role !== 'Admin' && gm?.role !== 'Tenko') return { rows: [], rowCount: 0 };
    m.deleted_at = now();
    return { rows: [{ id: m.id, channel_id: m.channel_id, guild_id: ch?.guild_id }], rowCount: 1 };
  }
  if (upper.startsWith('DELETE FROM MESSAGES WHERE CHANNEL_ID IN')) {
    const guildId = params[0];
    let count = 0;
    const channelIds = new Set();
    for (const ch of tables.channels.values()) if (ch.guild_id === guildId) channelIds.add(ch.id);
    for (const [id, m] of tables.messages) { if (channelIds.has(m.channel_id)) { tables.messages.delete(id); count++; } }
    return { rows: [], rowCount: count };
  }

  // --- Reactions ---
  if (upper.startsWith('SELECT M.CHANNEL_ID, CH.GUILD_ID FROM MESSAGES M JOIN CHANNELS CH')) {
    const [messageId, userId] = params;
    const m = tables.messages.get(messageId);
    if (!m || m.deleted_at) return { rows: [], rowCount: 0 };
    const ch = tables.channels.get(m.channel_id);
    const gm = tables.guild_members.get(`${ch?.guild_id}:${userId}`);
    if (!gm) return { rows: [], rowCount: 0 };
    return { rows: [{ channel_id: m.channel_id, guild_id: ch?.guild_id }], rowCount: 1 };
  }
  if (upper.startsWith('DELETE FROM REACTIONS WHERE MESSAGE_ID')) {
    const [messageId, userId, emoji] = params;
    let deleted = false;
    for (const [id, r] of tables.reactions) {
      if (r.message_id === messageId && r.user_id === userId && r.emoji === emoji) { tables.reactions.delete(id); deleted = true; break; }
    }
    return { rows: [], rowCount: deleted ? 1 : 0 };
  }
  if (upper.startsWith('INSERT INTO REACTIONS(MESSAGE_ID, USER_ID, EMOJI) VALUES')) {
    const [messageId, userId, emoji] = params;
    const id = uuid();
    tables.reactions.set(id, { id, message_id: messageId, user_id: userId, emoji, created_at: now() });
    return { rows: [], rowCount: 1 };
  }

  // --- DM threads ---
  if (upper.startsWith('INSERT INTO DM_THREADS DEFAULT VALUES')) {
    const id = uuid();
    tables.dm_threads.set(id, { id, created_at: now() });
    return { rows: [{ id }], rowCount: 1 };
  }
  if (upper.startsWith('SELECT DM.THREAD_ID FROM DM_MEMBERS DM WHERE DM.USER_ID IN')) {
    const [userId1, userId2] = params;
    const userThreads1 = new Set();
    const userThreads2 = new Set();
    for (const dm of tables.dm_members.values()) {
      if (dm.user_id === userId1) userThreads1.add(dm.thread_id);
      if (dm.user_id === userId2) userThreads2.add(dm.thread_id);
    }
    for (const threadId of userThreads1) {
      if (userThreads2.has(threadId)) {
        // Check exactly 2 members
        let count = 0;
        for (const dm of tables.dm_members.values()) if (dm.thread_id === threadId) count++;
        if (count === 2) return { rows: [{ thread_id: threadId }], rowCount: 1 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  // --- DM members ---
  if (upper.startsWith('INSERT INTO DM_MEMBERS(THREAD_ID, USER_ID) VALUES ($1, $2), ($1, $3)')) {
    const [threadId, userId1, userId2] = params;
    tables.dm_members.set(`${threadId}:${userId1}`, { thread_id: threadId, user_id: userId1, joined_at: now() });
    tables.dm_members.set(`${threadId}:${userId2}`, { thread_id: threadId, user_id: userId2, joined_at: now() });
    return { rows: [], rowCount: 2 };
  }
  if (upper.startsWith('SELECT 1 FROM DM_MEMBERS WHERE THREAD_ID = $1 AND USER_ID = $2')) {
    const [threadId, userId] = params;
    const exists = tables.dm_members.has(`${threadId}:${userId}`);
    return { rows: exists ? [{ '?column?': 1 }] : [], rowCount: exists ? 1 : 0 };
  }
  if (upper.startsWith('SELECT USER_ID FROM DM_MEMBERS WHERE THREAD_ID = $1')) {
    const threadId = params[0];
    const rows = [];
    for (const dm of tables.dm_members.values()) if (dm.thread_id === threadId) rows.push({ user_id: dm.user_id });
    return { rows, rowCount: rows.length };
  }
  if (upper.startsWith('SELECT USER_ID FROM DM_MEMBERS WHERE THREAD_ID = $1 AND USER_ID <> $2')) {
    const [threadId, userId] = params;
    const rows = [];
    for (const dm of tables.dm_members.values()) if (dm.thread_id === threadId && dm.user_id !== userId) rows.push({ user_id: dm.user_id });
    return { rows, rowCount: rows.length };
  }

  // --- DM messages ---
  if (upper.startsWith('INSERT INTO DM_MESSAGES(THREAD_ID, AUTHOR_ID, CONTENT, ATTACHMENTS, REPLY_TO) VALUES')) {
    const [threadId, authorId, content, attachmentsJson, replyTo] = params;
    const id = uuid();
    const msg = {
      id, thread_id: threadId, author_id: authorId, content,
      attachments: parseJson(attachmentsJson), reply_to: replyTo || null,
      deleted_at: null, edited_at: null, created_at: now(),
    };
    tables.dm_messages.set(id, msg);
    return { rows: [{ ...msg }], rowCount: 1 };
  }
  if (upper.startsWith('UPDATE DM_MESSAGES SET CONTENT = $1, EDITED_AT = NOW()')) {
    const [content, messageId, userId] = params;
    const m = tables.dm_messages.get(messageId);
    if (!m || m.author_id !== userId || m.deleted_at) return { rows: [], rowCount: 0 };
    m.content = content; m.edited_at = now();
    return { rows: [{ ...m }], rowCount: 1 };
  }
  if (upper.startsWith('UPDATE DM_MESSAGES SET DELETED_AT = NOW()')) {
    const [messageId, userId] = params;
    const m = tables.dm_messages.get(messageId);
    if (!m || m.author_id !== userId || m.deleted_at) return { rows: [], rowCount: 0 };
    m.deleted_at = now();
    return { rows: [{ id: m.id, thread_id: m.thread_id }], rowCount: 1 };
  }
  if (upper.startsWith('SELECT M.*, U.USERNAME, U.AVATAR FROM DM_MESSAGES M LEFT JOIN USERS U')) {
    const [threadId, before, limit] = params;
    let msgs = [];
    for (const m of tables.dm_messages.values()) {
      if (m.thread_id === threadId && !m.deleted_at) {
        if (before && m.created_at >= new Date(before)) continue;
        const u = tables.users.get(m.author_id);
        msgs.push({ ...m, username: u?.username || 'Deleted User', avatar: u?.avatar || '' });
      }
    }
    msgs.sort((a, b) => b.created_at - a.created_at);
    msgs = msgs.slice(0, Number(limit) || 50).reverse();
    return { rows: msgs, rowCount: msgs.length };
  }

  // --- Friendships ---
  if (upper.startsWith('SELECT F.REQUESTER_ID, F.ADDRESSEE_ID, F.STATUS AS FRIENDSHIP_STATUS, U.* FROM FRIENDSHIPS F JOIN USERS U')) {
    const userId = params[0];
    const rows = [];
    for (const f of tables.friendships.values()) {
      if (f.requester_id === userId || f.addressee_id === userId) {
        const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id;
        const u = tables.users.get(otherId);
        if (u) rows.push({ ...u, requester_id: f.requester_id, addressee_id: f.addressee_id, friendship_status: f.status });
      }
    }
    rows.sort((a, b) => a.username_key.localeCompare(b.username_key));
    return { rows, rowCount: rows.length };
  }
  if (upper.startsWith('INSERT INTO FRIENDSHIPS(REQUESTER_ID, ADDRESSEE_ID, STATUS) VALUES')) {
    const [requesterId, addresseeId] = params;
    const key = `${requesterId}:${addresseeId}`;
    if (tables.friendships.has(key)) { const err = new Error('unique violation'); err.code = '23505'; throw err; }
    tables.friendships.set(key, { requester_id: requesterId, addressee_id: addresseeId, status: 'pending', created_at: now(), updated_at: now() });
    return { rows: [], rowCount: 1 };
  }
  if (upper.startsWith('UPDATE FRIENDSHIPS SET STATUS = ')) {
    const [requesterId, addresseeId] = params;
    const f = tables.friendships.get(`${requesterId}:${addresseeId}`);
    if (f && f.status === 'pending') { f.status = 'accepted'; f.updated_at = now(); return { rows: [], rowCount: 1 }; }
    return { rows: [], rowCount: 0 };
  }
  if (upper.startsWith('DELETE FROM FRIENDSHIPS WHERE')) {
    const [userId, otherId] = params;
    let count = 0;
    if (tables.friendships.has(`${userId}:${otherId}`)) { tables.friendships.delete(`${userId}:${otherId}`); count++; }
    if (tables.friendships.has(`${otherId}:${userId}`)) { tables.friendships.delete(`${otherId}:${userId}`); count++; }
    return { rows: [], rowCount: count };
  }
  if (upper.startsWith('SELECT 1 FROM FRIENDSHIPS WHERE STATUS = ')) {
    // Check accepted friendship with no blocks
    const [userId, otherId] = params;
    const f1 = tables.friendships.get(`${userId}:${otherId}`);
    const f2 = tables.friendships.get(`${otherId}:${userId}`);
    const accepted = (f1?.status === 'accepted' || f2?.status === 'accepted');
    if (!accepted) return { rows: [], rowCount: 0 };
    const blocked = tables.blocks.has(`${userId}:${otherId}`) || tables.blocks.has(`${otherId}:${userId}`);
    if (blocked) return { rows: [], rowCount: 0 };
    return { rows: [{ '?column?': 1 }], rowCount: 1 };
  }

  // --- Blocks ---
  if (upper.startsWith('SELECT U.* FROM BLOCKS B JOIN USERS U ON U.ID = B.BLOCKED_ID WHERE B.BLOCKER_ID = $1')) {
    const userId = params[0];
    const rows = [];
    for (const b of tables.blocks.values()) {
      if (b.blocker_id === userId) {
        const u = tables.users.get(b.blocked_id);
        if (u) rows.push({ ...u });
      }
    }
    rows.sort((a, b) => a.username_key.localeCompare(b.username_key));
    return { rows, rowCount: rows.length };
  }
  if (upper.startsWith('SELECT 1 FROM BLOCKS WHERE')) {
    const [userId, otherId] = params;
    const blocked = tables.blocks.has(`${userId}:${otherId}`) || tables.blocks.has(`${otherId}:${userId}`);
    return { rows: blocked ? [{ '?column?': 1 }] : [], rowCount: blocked ? 1 : 0 };
  }
  if (upper.startsWith('INSERT INTO BLOCKS(BLOCKER_ID, BLOCKED_ID) VALUES')) {
    const [blockerId, blockedId] = params;
    const key = `${blockerId}:${blockedId}`;
    if (!tables.blocks.has(key)) tables.blocks.set(key, { blocker_id: blockerId, blocked_id: blockedId, created_at: now() });
    return { rows: [], rowCount: 1 };
  }
  if (upper.startsWith('DELETE FROM BLOCKS WHERE BLOCKER_ID = $1 AND BLOCKED_ID = $2')) {
    const [blockerId, blockedId] = params;
    const key = `${blockerId}:${blockedId}`;
    const existed = tables.blocks.has(key);
    tables.blocks.delete(key);
    return { rows: [], rowCount: existed ? 1 : 0 };
  }

  // --- Complex queries: loadGuilds, loadDms, broadcastRelevant ---
  if (upper.startsWith('SELECT G.ID AS GUILD_ID, G.NAME AS GUILD_NAME')) {
    // loadGuilds - first query
    const userId = params[0];
    const guildIds = new Set();
    for (const gm of tables.guild_members.values()) {
      if (gm.user_id === userId) guildIds.add(gm.guild_id);
    }
    const rows = [];
    for (const guildId of guildIds) {
      const g = tables.guilds.get(guildId);
      if (!g) continue;
      // Get categories for this guild
      const cats = [];
      for (const c of tables.categories.values()) {
        if (c.guild_id === guildId) {
          cats.push(c);
          // Get channels for this category
          for (const ch of tables.channels.values()) {
            if (ch.category_id === c.id) {
              rows.push({
                guild_id: guildId, guild_name: g.name, icon: g.icon, owner_id: g.owner_id,
                category_id: c.id, category_name: c.name, category_position: c.position,
                channel_id: ch.id, channel_name: ch.name, channel_type: ch.type, topic: ch.topic, channel_position: ch.position,
              });
            }
          }
          // If category has no channels, still include it
          const hasChannels = [...tables.channels.values()].some(ch => ch.category_id === c.id);
          if (!hasChannels) {
            rows.push({
              guild_id: guildId, guild_name: g.name, icon: g.icon, owner_id: g.owner_id,
              category_id: c.id, category_name: c.name, category_position: c.position,
              channel_id: null, channel_name: null, channel_type: null, topic: null, channel_position: null,
            });
          }
        }
      }
      // If guild has no categories
      if (cats.length === 0) {
        rows.push({ guild_id: guildId, guild_name: g.name, icon: g.icon, owner_id: g.owner_id, category_id: null, category_name: null, category_position: null, channel_id: null, channel_name: null, channel_type: null, topic: null, channel_position: null });
      }
    }
    // Sort by guild created_at, category position, channel position
    rows.sort((a, b) => {
      const ga = tables.guilds.get(a.guild_id)?.created_at || 0;
      const gb = tables.guilds.get(b.guild_id)?.created_at || 0;
      if (ga !== gb) return new Date(ga) - new Date(gb);
      if ((a.category_position || 0) !== (b.category_position || 0)) return (a.category_position || 0) - (b.category_position || 0);
      return (a.channel_position || 0) - (b.channel_position || 0);
    });
    return { rows, rowCount: rows.length };
  }
  if (upper.startsWith('SELECT GM.GUILD_ID, GM.ROLE, GM.NICKNAME, U.* FROM GUILD_MEMBERS GM JOIN USERS U')) {
    // loadGuilds - members query. params: [arrayOfGuildIds]
    const guildIds = params[0];
    const rows = [];
    for (const gm of tables.guild_members.values()) {
      if (guildIds.includes(gm.guild_id)) {
        const u = tables.users.get(gm.user_id);
        if (u) rows.push({ ...u, guild_id: gm.guild_id, role: gm.role, nickname: gm.nickname });
      }
    }
    rows.sort((a, b) => a.username_key.localeCompare(b.username_key));
    return { rows, rowCount: rows.length };
  }
  if (upper.startsWith('SELECT D.ID AS THREAD_ID, U.* FROM DM_THREADS D')) {
    // loadDms
    const userId = params[0];
    const threadIds = new Set();
    for (const dm of tables.dm_members.values()) {
      if (dm.user_id === userId) threadIds.add(dm.thread_id);
    }
    const rows = [];
    for (const threadId of threadIds) {
      for (const dm of tables.dm_members.values()) {
        if (dm.thread_id === threadId && dm.user_id !== userId) {
          const u = tables.users.get(dm.user_id);
          if (u) rows.push({ ...u, thread_id: threadId });
        }
      }
    }
    // Sort by thread created_at DESC
    rows.sort((a, b) => {
      const ta = tables.dm_threads.get(a.thread_id)?.created_at || 0;
      const tb = tables.dm_threads.get(b.thread_id)?.created_at || 0;
      return new Date(tb) - new Date(ta);
    });
    return { rows, rowCount: rows.length };
  }
  if (upper.startsWith('SELECT DISTINCT TARGET_ID FROM')) {
    // broadcastRelevant
    const userId = params[0];
    const targetIds = new Set();
    // Guild co-members
    const myGuilds = new Set();
    for (const gm of tables.guild_members.values()) if (gm.user_id === userId) myGuilds.add(gm.guild_id);
    for (const gm of tables.guild_members.values()) if (myGuilds.has(gm.guild_id) && gm.user_id !== userId) targetIds.add(gm.user_id);
    // Accepted friends
    for (const f of tables.friendships.values()) {
      if (f.status === 'accepted') {
        if (f.requester_id === userId) targetIds.add(f.addressee_id);
        else if (f.addressee_id === userId) targetIds.add(f.requester_id);
      }
    }
    // DM partners
    const myThreads = new Set();
    for (const dm of tables.dm_members.values()) if (dm.user_id === userId) myThreads.add(dm.thread_id);
    for (const dm of tables.dm_members.values()) if (myThreads.has(dm.thread_id) && dm.user_id !== userId) targetIds.add(dm.user_id);
    return { rows: Array.from(targetIds).map(id => ({ target_id: id })), rowCount: targetIds.size };
  }

  // --- DM message blocked check ---
  if (upper.startsWith('SELECT 1 FROM DM_MEMBERS OTHER JOIN BLOCKS B')) {
    const [userId, threadId] = params;
    for (const dm of tables.dm_members.values()) {
      if (dm.thread_id === threadId && dm.user_id !== userId) {
        if (tables.blocks.has(`${userId}:${dm.user_id}`) || tables.blocks.has(`${dm.user_id}:${userId}`)) {
          return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }
      }
    }
    return { rows: [], rowCount: 0 };
  }

  // --- Pool end ---
  if (upper === 'END' || upper.startsWith('END;')) return { rows: [], rowCount: 0 };

  // Unknown query — log and return empty
  console.warn('[memory-db] Unhandled query:', sql.slice(0, 120));
  return { rows: [], rowCount: 0 };
}

const pool = {
  query,
  end() { return Promise.resolve(); },
  on() {},
  connect() { return Promise.resolve({ query, release() {} }); },
};

async function migrate() {
  if (migrated) return;
  migrated = true;
  tables.schema_migrations.set(1, { version: 1, applied_at: now() });
  tables.schema_migrations.set(2, { version: 2, applied_at: now() });
  // Save initial state after migration
  saveToDisk();
}

async function transaction(fn) {
  // In-memory transactions are synchronous-ish; just run the function with a client-like object
  const client = { query };
  return fn(client);
}

module.exports = { pool, migrate, transaction, tables, saveToDisk };
