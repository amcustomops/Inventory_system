const centralPool = require('../db');
const tenantDbManager = require('../utils/tenantDbManager');
const tenantContext = require('../utils/context');

// In-memory cache to prevent hitting the central database on every request
const tenantCache = new Map();
const CACHE_TTL = 60 * 1000; // Cache tenant meta for 1 minute

async function resolveTenant(req, res, next) {
    const path = req.path;

    // Bypass tenant resolution for system health checks, platform-wide admin endpoints, and admin login
    if (path === '/api/health' || path.startsWith('/api/admin') || path === '/api/ml-status' || path === '/api/auth/admin-login') {
        return next();
    }

    // Resolve tenant identifier from header or query param
    const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;

    if (!tenantId) {
        return res.status(400).json({ error: 'Tenant identification header (X-Tenant-Id) is required' });
    }

    const cleanTenantId = tenantId.toString().toLowerCase().trim();

    // Check cache
    const cached = tenantCache.get(cleanTenantId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        req.tenant = cached.data;
        return setupTenantDb(req, res, next);
    }

    // Lookup in central database
    let conn;
    try {
        conn = await centralPool.centralPool.getConnection(); // Use centralPool directly to avoid interceptor loop
        const rows = await conn.query(
            'SELECT id as company_id, name, tenant_id, db_name, status, ai_enabled FROM companies WHERE tenant_id = ?',
            [cleanTenantId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: `Tenant workspace '${cleanTenantId}' not found` });
        }

        const tenant = {
            ...rows[0],
            ai_enabled: rows[0].ai_enabled === 1 || rows[0].ai_enabled === true || rows[0].ai_enabled === null || rows[0].ai_enabled === undefined
        };

        if (tenant.status !== 'ACTIVE') {
            return res.status(403).json({ error: `Tenant workspace is currently ${tenant.status.toLowerCase()}` });
        }

        // Cache the metadata
        tenantCache.set(cleanTenantId, {
            timestamp: Date.now(),
            data: tenant
        });

        req.tenant = tenant;
        setupTenantDb(req, res, next);

    } catch (err) {
        console.error('[Tenant Resolver] Error resolving tenant:', err);
        return res.status(500).json({ error: 'Internal server error during tenant resolution' });
    } finally {
        if (conn) conn.release();
    }
}

async function setupTenantDb(req, res, next) {
    try {
        // Resolve database connection pool and append it to request
        req.db = await tenantDbManager.getTenantPool(req.tenant.tenant_id, req.tenant.db_name);
        
        // Wrap execution of downstream routes inside the tenant database pool context
        tenantContext.run(req.db, () => {
            next();
        });
    } catch (err) {
        console.error(`[Tenant Resolver] Failed to open pool for tenant ${req.tenant.tenant_id}:`, err);
        return res.status(500).json({ error: 'Database connection failed' });
    }
}

const clearTenantCache = (tenantId) => {
    if (tenantId) {
        tenantCache.delete(tenantId.toString().toLowerCase().trim());
    }
};

resolveTenant.clearTenantCache = clearTenantCache;

module.exports = resolveTenant;
