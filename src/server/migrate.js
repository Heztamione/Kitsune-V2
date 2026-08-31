const { migrate, pool } = require('./db');

migrate()
  .then(() => console.log('Database migrations completed.'))
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
