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