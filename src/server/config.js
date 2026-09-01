const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const production = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || (production ? '' : crypto.randomBytes(48).toString('hex'));

const demoMode = !process.env.DATABASE_URL;
if (production && demoMode) console.warn('WARNING: Running in production without DATABASE_URL — using in-memory demo mode. Data will NOT persist across restarts.');
if (!sessionSecret) throw new Error('SESSION_SECRET is required in production.');

module.exports = {
  production,
  port: Number(process.env.PORT || 8080),
  trustProxy: process.env.TRUST_PROXY === '1',
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === '1',
  demoMode,
  sessionSecret,
  rememberMeDays: Math.max(1, Number(process.env.REMEMBER_ME_DAYS || process.env.SESSION_DAYS || 30)),
  noRememberDays: Math.max(1, Number(process.env.SESSION_NO_REMEMBER_DAYS || 1)),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean),
  turnUrls: (process.env.TURN_URLS || '').split(',').map(x => x.trim()).filter(Boolean),
  turnUsername: process.env.TURN_USERNAME || '',
  turnCredential: process.env.TURN_CREDENTIAL || '',
  protectedAccountsPassword: process.env.PROTECTED_ACCOUNTS_PASSWORD || '',
};
