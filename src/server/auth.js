const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { pool, transaction } = require('./db');

const COOKIE_NAME = 'kitsune_session';
const USERNAME = /^[a-zA-Z0-9_\- ]{2,24}$/;

// Load protected accounts list and designated Tenko
let protectedUsernames = [];
let tenkoUsername = null;
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'protected-accounts.json'), 'utf8'));
  protectedUsernames = (cfg.accounts || []).map(u => u.toLowerCase());
  if (cfg.tenko) tenkoUsername = String(cfg.tenko).toLowerCase();
} catch (_) { /* file may not exist yet */ }

function isProtectedUsername(usernameKey) {
  return protectedUsernames.includes(String(usernameKey || '').toLowerCase());
}

// Legacy state file path (Kitsune v1 imported accounts)
const LEGACY_STATE_PATH = path.join(require('os').homedir(), 'AppData', 'Roaming', 'kitsune', 'kitsune-server-state.json');

function loadLegacyAccounts() {
  try {
    if (!fs.existsSync(LEGACY_STATE_PATH)) return {};
    const state = JSON.parse(fs.readFileSync(LEGACY_STATE_PATH, 'utf8'));
    return state.accounts || {};
  } catch (_) { return {}; }
}

// Seed protected accounts on startup if they don't exist.
// Uses legacy state file data (SHA-256 hashes) for accounts that were imported from Kitsune v1.
async function seedProtectedAccounts() {
  if (!protectedUsernames.length) return;
  const legacyAccounts = loadLegacyAccounts();

  // Seed the designated Tenko account first so it becomes the first user and owns the public shrine.
  const seedOrder = tenkoUsername && protectedUsernames.includes(tenkoUsername)
    ? [tenkoUsername, ...protectedUsernames.filter(u => u !== tenkoUsername)]
    : [...protectedUsernames];

  for (const usernameKey of seedOrder) {
    const existing = await pool.query('SELECT id FROM users WHERE username_key = $1', [usernameKey]);
    if (existing.rowCount) continue;

    const legacy = legacyAccounts[usernameKey];
    const displayName = legacy ? legacy.name : usernameKey;
    // Use legacy SHA-256 hash if available, otherwise generate a random password (account exists but needs password reset)
    const passwordHash = legacy ? legacy.hash : bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const isDesignatedTenko = usernameKey === tenkoUsername;
    const role = (legacy && legacy.role === 'Tenko') ? 'Tenko' : (isDesignatedTenko ? 'Tenko' : 'Wanderer');
    const avatar = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=1a1018&radius=50`;

    try {
      await transaction(async client => {
        const count = await client.query('SELECT count(*)::int AS count FROM users');
        const first = count.rows[0].count === 0;
        const created = await client.query(
          'INSERT INTO users(username, username_key, password_hash, avatar, platform_role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [displayName, usernameKey, passwordHash, avatar, first ? 'Tenko' : role]
        );
        if (first) {
          await seedPublicGuild(client, created.rows[0].id);
        } else {
          const publicGuild = await client.query('SELECT id FROM guilds WHERE is_public = true LIMIT 1');
          const guildId = publicGuild.rows[0]?.id;
          if (guildId) {
            const memberRole = isDesignatedTenko ? 'Tenko' : 'Wanderer';
            await client.query("INSERT INTO guild_members(guild_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [guildId, created.rows[0].id, memberRole]);
          }
        }
      });
      console.log(`[auth] Seeded protected account: ${displayName} (${first ? 'Tenko' : role})`);
    } catch (e) {
      console.error(`[auth] Failed to seed protected account ${usernameKey}:`, e.message);
    }
  }
}

function key(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function tokenHash(token) {
  return crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex');
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.username,
    tag: row.username_key.replace(/\s/g, ''),
    avatar: row.avatar,
    bio: row.bio,
    status: row.status,
    activity: row.activity,
    role: row.platform_role,
  };
}

function cookieOptions(req, maxAge) {
  const secure = config.production || req.secure || req.headers['x-forwarded-proto'] === 'https';
  return { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge };
}

async function issueSession(req, res, userId, remember) {
  const token = crypto.randomBytes(32).toString('base64url');
  const seconds = remember ? config.sessionDays * 86400 : 86400;
  await pool.query(
    'INSERT INTO sessions(token_hash, user_id, expires_at, user_agent, ip) VALUES ($1, $2, now() + ($3 * interval \'1 second\'), $4, $5)',
    [tokenHash(token), userId, seconds, String(req.headers['user-agent'] || '').slice(0, 512), req.ip]
  );
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, token, cookieOptions(req, seconds)));
}

async function seedPublicGuild(client, ownerId) {
  const guild = await client.query('INSERT INTO guilds(name, icon, owner_id, is_public) VALUES ($1, $2, $3, $4) RETURNING id', ['Kitsune Public', 'K', ownerId, true]);
  const guildId = guild.rows[0].id;
  await client.query('INSERT INTO guild_members(guild_id, user_id, role) VALUES ($1, $2, $3)', [guildId, ownerId, 'Tenko']);
  const info = await client.query('INSERT INTO categories(guild_id, name, position) VALUES ($1, $2, $3) RETURNING id', [guildId, 'Information', 0]);
  const community = await client.query('INSERT INTO categories(guild_id, name, position) VALUES ($1, $2, $3) RETURNING id', [guildId, 'Community', 1]);
  const voice = await client.query('INSERT INTO categories(guild_id, name, position) VALUES ($1, $2, $3) RETURNING id', [guildId, 'Voice', 2]);
  const channels = [
    [info.rows[0].id, 'rules', 'text', 'Read before you run.', 0],
    [info.rows[0].id, 'announcements', 'announcement', 'Server updates.', 1],
    [community.rows[0].id, 'general', 'text', 'General chat.', 0],
    [community.rows[0].id, 'memes', 'text', 'Share gaming media.', 1],
    [voice.rows[0].id, 'Lounge', 'voice', '', 0],
    [voice.rows[0].id, 'Squad 1', 'voice', '', 1],
  ];
  for (const [categoryId, name, type, topic, position] of channels) {
    await client.query('INSERT INTO channels(guild_id, category_id, name, type, topic, position) VALUES ($1, $2, $3, $4, $5, $6)', [guildId, categoryId, name, type, topic, position]);
  }
}

async function register(req, res) {
  const username = String(req.body.username || '').trim().replace(/\s+/g, ' ');
  const usernameKey = key(username);
  const password = String(req.body.password || '');
  if (!USERNAME.test(username)) return res.status(400).json({ error: 'Name must be 2-24 characters and use letters, numbers, spaces, _ or -.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8-128 characters.' });
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [842020]);
      const count = await client.query('SELECT count(*)::int AS count FROM users');
      const first = count.rows[0].count === 0;
      const avatar = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(username)}&backgroundColor=1a1018&radius=50`;
      const created = await client.query(
        'INSERT INTO users(username, username_key, password_hash, avatar, platform_role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [username, usernameKey, passwordHash, avatar, first ? 'Tenko' : 'Wanderer']
      );
      if (first) await seedPublicGuild(client, created.rows[0].id);
      else await client.query("INSERT INTO guild_members(guild_id, user_id, role) SELECT id, $1, 'Wanderer' FROM guilds WHERE is_public = true ON CONFLICT DO NOTHING", [created.rows[0].id]);
      return created.rows[0];
    });
    await issueSession(req, res, user.id, Boolean(req.body.remember));
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That account already exists.' });
    throw error;
  }
}

async function login(req, res) {
  const usernameKey = key(String(req.body.username || ''));
  const password = String(req.body.password || '');
  const found = await pool.query('SELECT * FROM users WHERE username_key = $1', [usernameKey]);
  const user = found.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
  // Check bcrypt first, then fall back to SHA-256 for legacy (Kitsune v1) accounts
  const bcryptMatch = await bcrypt.compare(password, user.password_hash);
  const sha256Match = user.password_hash.length === 64 && crypto.createHash('sha256').update(password).digest('hex') === user.password_hash;
  if (!bcryptMatch && !sha256Match) return res.status(401).json({ error: 'Invalid username or password.' });
  // If the user logged in with a legacy SHA-256 hash, upgrade to bcrypt
  if (!bcryptMatch && sha256Match) {
    const newHash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
  }
  await issueSession(req, res, user.id, Boolean(req.body.remember));
  res.json({ user: publicUser(user) });
}

async function authenticateRequest(req) {
  const parsed = cookie.parse(req.headers.cookie || '');
  const token = parsed[COOKIE_NAME];
  if (!token) return null;
  const result = await pool.query(
    `SELECT u.*, s.token_hash FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(token)]
  );
  if (!result.rowCount) return null;
  pool.query('UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1', [result.rows[0].token_hash]).catch(() => {});
  return result.rows[0];
}

async function requireAuth(req, res, next) {
  try {
    req.user = await authenticateRequest(req);
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    next();
  } catch (error) { next(error); }
}

async function logout(req, res) {
  const parsed = cookie.parse(req.headers.cookie || '');
  if (parsed[COOKIE_NAME]) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(parsed[COOKIE_NAME])]);
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, '', cookieOptions(req, 0)));
  res.status(204).end();
}

async function changePassword(req, res, next) {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 8 || newPassword.length > 128) return res.status(400).json({ error: 'New password must be 8-128 characters.' });

    const found = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const row = found.rows[0];
    if (!row) return res.status(404).json({ error: 'User not found.' });

    const bcryptMatch = await bcrypt.compare(currentPassword, row.password_hash);
    const sha256Match = row.password_hash.length === 64 && crypto.createHash('sha256').update(currentPassword).digest('hex') === row.password_hash;
    if (!bcryptMatch && !sha256Match) return res.status(401).json({ error: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    res.status(204).end();
  } catch (error) { next(error); }
}

module.exports = { register, login, logout, changePassword, requireAuth, authenticateRequest, publicUser, seedProtectedAccounts, isProtectedUsername };
