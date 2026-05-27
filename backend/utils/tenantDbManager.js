const mariadb = require('mariadb');
require('dotenv').config();

class TenantDbManager {
    constructor() {
        this.pools = new Map(); // tenantId -> connection pool
        this.lastUsed = new Map(); // tenantId -> timestamp

        // Periodically check for idle pools every 5 minutes to release connections
        this.pruner = setInterval(() => this.cleanupIdlePools(), 5 * 60 * 1000);
    }

    /**
     * Get or create a connection pool for a specific tenant database
     */
    async getTenantPool(tenantId, dbName) {
        if (!tenantId || !dbName) {
            throw new Error('[DB Manager] tenantId and dbName are required');
        }

        const cleanTenantId = tenantId.toLowerCase().trim();

        if (this.pools.has(cleanTenantId)) {
            this.lastUsed.set(cleanTenantId, Date.now());
            return this.pools.get(cleanTenantId);
        }

        console.log(`[DB Manager] Creating new connection pool for tenant: ${cleanTenantId} (${dbName})`);

        const pool = mariadb.createPool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 4000,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: dbName,
            connectionLimit: 10,
            multipleStatements: true,
            ssl: {
                rejectUnauthorized: false
            }
        });

        this.pools.set(cleanTenantId, pool);
        this.lastUsed.set(cleanTenantId, Date.now());

        return pool;
    }

    /**
     * Closes pools that have not been used for more than 15 minutes
     */
    async cleanupIdlePools() {
        const now = Date.now();
        const maxIdleTime = 15 * 60 * 1000; // 15 minutes

        for (const [tenantId, lastActive] of this.lastUsed.entries()) {
            if (now - lastActive > maxIdleTime) {
                console.log(`[DB Manager] Pruning idle database connection pool for tenant: ${tenantId}`);
                const pool = this.pools.get(tenantId);
                if (pool) {
                    try {
                        await pool.end();
                    } catch (err) {
                        console.error(`[DB Manager] Error ending pool for ${tenantId}:`, err);
                    }
                }
                this.pools.delete(tenantId);
                this.lastUsed.delete(tenantId);
            }
        }
    }

    /**
     * Closes all connection pools gracefully on system shutdown
     */
    async shutdownAll() {
        console.log('[DB Manager] Gracefully shutting down all tenant connection pools...');
        if (this.pruner) clearInterval(this.pruner);

        for (const [tenantId, pool] of this.pools.entries()) {
            try {
                await pool.end();
            } catch (err) {
                console.error(`[DB Manager] Error ending pool for tenant ${tenantId}:`, err);
            }
        }
        this.pools.clear();
        this.lastUsed.clear();
    }
}

module.exports = new TenantDbManager();
