'use strict';

/*
 * Apply only the additive user_presence table to an existing local MySQL
 * database. This is deliberately separate from database/seed.js: running it
 * never inserts, updates, or deletes users, profiles, or campus content.
 */

const db = require('../config/db');

const USER_PRESENCE_DDL = `
CREATE TABLE IF NOT EXISTS user_presence (
  user_id INT NOT NULL PRIMARY KEY,
  last_seen_at TIMESTAMP(3) NOT NULL,
  KEY idx_user_presence_last_seen_at (last_seen_at),
  CONSTRAINT fk_user_presence_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

async function applyUserPresenceMysqlMigration(pool = db) {
  await pool.query(USER_PRESENCE_DDL);
}

async function main() {
  try {
    await applyUserPresenceMysqlMigration();
    console.log('MySQL user presence table is ready.');
  } catch (error) {
    console.error('MySQL user presence migration failed.');
    process.exitCode = 1;
  } finally {
    if (db && typeof db.end === 'function') await db.end().catch(() => {});
  }
}

if (require.main === module) main();

module.exports = { USER_PRESENCE_DDL, applyUserPresenceMysqlMigration };
