const config = require('./config');

// Backup/restore is supported in demo (in-memory) mode. PostgreSQL backups
// should be done with pg_dump / pg_restore for large production datasets.

function getMemoryTables() {
  return require('./memory-db').tables;
}

function isEmpty() {
  if (config.demoMode) {
    const tables = getMemoryTables();
    return tables.users.size === 0;
  }
  return false;
}

function exportDb() {
  if (!config.demoMode) throw Object.assign(new Error('Database backup is only supported in demo mode. Use pg_dump for PostgreSQL.'), { status: 501 });
  const tables = getMemoryTables();
  const result = {};
  for (const [name, map] of Object.entries(tables)) {
    result[name] = Array.from(map.values());
  }
  return result;
}

function importDb(data) {
  if (!config.demoMode) throw Object.assign(new Error('Database restore is only supported in demo mode. Use pg_restore for PostgreSQL.'), { status: 501 });
  if (!data || typeof data !== 'object') throw Object.assign(new Error('Invalid backup data.'), { status: 400 });
  const tables = getMemoryTables();
  for (const [name, rows] of Object.entries(data)) {
    const map = tables[name];
    if (!map || !Array.isArray(rows)) continue;
    map.clear();
    for (const row of rows) {
      if (!row || !row.id) continue;
      map.set(row.id, row);
    }
  }
  // Persist immediately
  const memory = require('./memory-db');
  if (memory.saveToDisk) memory.saveToDisk();
  return { imported: true };
}

async function restoreFromUrlIfEmpty() {
  const url = process.env.BACKUP_URL;
  if (!url) return false;
  if (!isEmpty()) {
    console.log('[backup] BACKUP_URL set but database is not empty; skipping auto-restore.');
    return false;
  }
  try {
    console.log('[backup] Auto-restoring from BACKUP_URL...');
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    importDb(data);
    console.log('[backup] Auto-restore completed.');
    return true;
  } catch (error) {
    console.error('[backup] Auto-restore failed:', error.message);
    return false;
  }
}

module.exports = { exportDb, importDb, isEmpty, restoreFromUrlIfEmpty };
