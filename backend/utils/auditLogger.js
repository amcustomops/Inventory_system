const centralPool = require('../db');

/**
 * Log write/mutation action to the central database for system-wide auditing
 * 
 * @param {number|null} companyId - Central company ID (null for Super Admin actions)
 * @param {number|null} userId - User ID (tenant user ID or central admin user ID)
 * @param {string} userEmail - Email of the user performing the action
 * @param {string} action - Action performed (e.g. 'CREATE_PRODUCT', 'UPDATE_INVENTORY')
 * @param {string} entityType - Target entity/table (e.g. 'PRODUCTS', 'LOCATIONS')
 * @param {number} entityId - Primary key of the affected entity
 * @param {object|null} oldValue - Original JSON payload before change
 * @param {object|null} newValue - Modified JSON payload after change
 */
async function logToCentral(companyId, userId, userEmail, action, entityType, entityId, oldValue = null, newValue = null) {
    let conn;
    try {
        conn = await centralPool.centralPool.getConnection();
        await conn.query(
            `INSERT INTO platform_audit_logs 
            (company_id, user_id, user_email, action, entity_type, entity_id, old_value, new_value)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                companyId ? Number(companyId) : null,
                userId ? Number(userId) : null,
                userEmail,
                action,
                entityType,
                entityId ? Number(entityId) : 0,
                oldValue ? JSON.stringify(oldValue) : null,
                newValue ? JSON.stringify(newValue) : null
            ]
        );
        console.log(`[Central Audit] Logged action '${action}' for ${userEmail} (Tenant: ${companyId || 'Platform'}).`);
    } catch (err) {
        console.error('[Central Audit] Error inserting central log:', err);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = { logToCentral };
