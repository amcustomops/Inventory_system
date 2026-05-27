const centralPool = require('../db');
const onboardingService = require('../services/onboardingService');

function safeParseJson(val) {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try {
        return JSON.parse(val);
    } catch (e) {
        return null;
    }
}

/**
 * Get platform-wide KPIs for dashboard metrics grid
 */
exports.getPlatformMetrics = async (req, res) => {
    let conn;
    try {
        conn = await centralPool.centralPool.getConnection();
        
        // Fetch tenant counts
        const [companiesCount] = await conn.query('SELECT COUNT(*) as count FROM companies');
        const [activeCount] = await conn.query("SELECT COUNT(*) as count FROM companies WHERE status = 'ACTIVE'");
        const [suspendedCount] = await conn.query("SELECT COUNT(*) as count FROM companies WHERE status = 'SUSPENDED'");
        
        // Fetch active plan pricing to compute Monthly Recurring Revenue (MRR)
        const subscriptions = await conn.query(`
            SELECT p.price 
            FROM subscriptions s 
            JOIN plans p ON s.plan_id = p.id 
            WHERE s.status = 'ACTIVE' OR s.status = 'TRIAL'
        `);

        const mrr = subscriptions.reduce((sum, sub) => sum + Number(sub.price), 0);

        res.json({
            totalTenants: Number(companiesCount.count),
            activeTenants: Number(activeCount.count),
            suspendedTenants: Number(suspendedCount.count),
            monthlyRevenue: mrr
        });
    } catch (err) {
        console.error('[Admin API] Error fetching metrics:', err);
        res.status(500).json({ message: 'Error retrieving platform metrics' });
    } finally {
        if (conn) conn.release();
    }
};

/**
 * Get list of all onboarded companies
 */
exports.getTenants = async (req, res) => {
    let conn;
    try {
        conn = await centralPool.centralPool.getConnection();
        const rows = await conn.query(`
            SELECT c.id, c.name, c.tenant_id, c.db_name, c.status, c.created_at, p.name as plan_name, s.status as sub_status 
            FROM companies c
            LEFT JOIN subscriptions s ON c.id = s.company_id
            LEFT JOIN plans p ON s.plan_id = p.id
            ORDER BY c.created_at DESC
        `);

        const formatted = rows.map(r => ({
            ...r,
            id: r.id.toString(),
            created_at: r.created_at
        }));
        res.json(formatted);
    } catch (err) {
        console.error('[Admin API] Error fetching tenants:', err);
        res.status(500).json({ message: 'Error retrieving tenants list' });
    } finally {
        if (conn) conn.release();
    }
};

/**
 * Create a new tenant company via onboarding service
 */
exports.createTenant = async (req, res) => {
    const { name, tenantId, ownerName, ownerEmail, password, planId } = req.body;
    
    if (!name || !tenantId || !ownerName || !ownerEmail || !password || !planId) {
        return res.status(400).json({ message: 'All registration fields are required' });
    }

    try {
        const details = await onboardingService.onboardCompany({
            companyName: name,
            tenantId,
            ownerName,
            ownerEmail,
            password,
            planId: Number(planId)
        });
        res.status(201).json({ message: 'Tenant created successfully', ...details });
    } catch (err) {
        console.error('[Admin API] Error onboarding company:', err);
        res.status(400).json({ message: err.message || 'Failed to onboard tenant' });
    }
};

/**
 * Update tenant status (Active / Suspended)
 */
exports.toggleTenantStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVE', 'SUSPENDED', 'INACTIVE'

    if (!['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status parameter' });
    }

    let conn;
    try {
        conn = await centralPool.centralPool.getConnection();
        
        // Double check if tenant exists
        const check = await conn.query('SELECT id FROM companies WHERE id = ?', [id]);
        if (check.length === 0) {
            return res.status(404).json({ message: 'Tenant company not found' });
        }

        await conn.query('UPDATE companies SET status = ? WHERE id = ?', [status, id]);
        
        // Return updated list format
        res.json({ message: `Tenant status successfully updated to ${status.toLowerCase()}` });
    } catch (err) {
        console.error('[Admin API] Error toggling status:', err);
        res.status(500).json({ message: 'Error updating tenant status' });
    } finally {
        if (conn) conn.release();
    }
};

/**
 * Get unified central audit logs with pagination
 */
exports.getPlatformLogs = async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let conn;
    try {
        conn = await centralPool.centralPool.getConnection();
        
        const logs = await conn.query(
            `SELECT l.*, c.name as company_name 
             FROM platform_audit_logs l
             LEFT JOIN companies c ON l.company_id = c.id
             ORDER BY l.created_at DESC 
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const [totalRows] = await conn.query('SELECT COUNT(*) as count FROM platform_audit_logs');

        const formatted = logs.map(l => ({
            ...l,
            id: l.id.toString(),
            company_id: l.company_id?.toString() || null,
            user_id: l.user_id?.toString() || null,
            old_value: safeParseJson(l.old_value),
            new_value: safeParseJson(l.new_value)
        }));

        res.json({
            logs: formatted,
            pagination: {
                page,
                limit,
                total: Number(totalRows.count),
                pages: Math.ceil(Number(totalRows.count) / limit)
            }
        });
    } catch (err) {
        console.error('[Admin API] Error fetching logs:', err);
        res.status(500).json({ message: 'Error retrieving platform audit logs' });
    } finally {
        if (conn) conn.release();
    }
};
