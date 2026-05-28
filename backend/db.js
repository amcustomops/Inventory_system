const mariadb = require('mariadb');
const tenantContext = require('./utils/context');
require('dotenv').config();

// Create the central database pool (holds tenant registries, plans, and platform users)
const centralPool = mariadb.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  multipleStatements: true,
  ssl: {
    rejectUnauthorized: false
  }
});

// Run a quick schema check/migration for central platform database on startup
(async () => {
    let conn;
    try {
        conn = await centralPool.getConnection();
        const columns = await conn.query("SHOW COLUMNS FROM companies LIKE 'ai_enabled'");
        if (columns.length === 0) {
            await conn.query("ALTER TABLE companies ADD COLUMN ai_enabled BOOLEAN DEFAULT TRUE");
            console.log('[DB Master] Migrated central DB: Added ai_enabled column to companies table.');
        }
    } catch (err) {
        console.error('[DB Master] Failed to check/migrate central DB schema:', err);
    } finally {
        if (conn) conn.release();
    }
})();

// A wrapper object that acts as a proxy for the pool
const poolWrapper = {
    // Return connection from active tenant pool if available; otherwise fallback to central DB
    async getConnection(...args) {
        const tenantPool = tenantContext.getStore();
        if (tenantPool) {
            return tenantPool.getConnection(...args);
        }
        return centralPool.getConnection(...args);
    },

    // Allow executing queries directly on the active pool wrapper
    async query(...args) {
        const tenantPool = tenantContext.getStore();
        if (tenantPool) {
            return tenantPool.query(...args);
        }
        return centralPool.query(...args);
    },

    // End/close central pool
    async end() {
        return centralPool.end();
    },

    // Expose direct access to the central database pool
    centralPool: centralPool
};

module.exports = poolWrapper;