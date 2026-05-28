const mariadb = require('mariadb');
const adminController = require('../controllers/adminController');
const { checkAiEnabled } = require('../middlewares/authMiddleware');
const centralPool = require('../db');
require('dotenv').config();

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        jsonPayload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.jsonPayload = payload;
            return this;
        }
    };
}

async function runTests() {
    console.log('=== STARTING AI TOGGLE INTEGRATION TESTS ===');

    const dbName = 'tenant_primary';
    const pool = mariadb.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 4000,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME, // Connect to master/central database
        ssl: { rejectUnauthorized: false }
    });

    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Find a test company in companies table (usually ID 1)
        const companies = await conn.query('SELECT id, name, tenant_id, ai_enabled FROM companies LIMIT 1');
        if (companies.length === 0) {
            throw new Error('No companies found in companies table to test AI toggle');
        }
        const targetCompany = companies[0];
        const companyId = targetCompany.id.toString();
        const tenantId = targetCompany.tenant_id;
        console.log(`Targeting Company ID: ${companyId}, Tenant ID: ${tenantId}`);
        console.log(`Initial ai_enabled state in DB: ${targetCompany.ai_enabled}`);

        // 2. Perform Toggle AI OFF Action
        console.log('\n--- Test Case 1: Disabling AI Features ---');
        const mockAdminReqOff = {
            params: { id: companyId },
            body: { aiEnabled: false },
            user: { userId: 1, email: 'admin@platform.com', role: 'SUPER_ADMIN' }
        };
        const mockResOff = createMockRes();
        await adminController.toggleTenantAi(mockAdminReqOff, mockResOff);

        console.log(`Status Code: ${mockResOff.statusCode}`);
        console.log(`Payload Message: ${mockResOff.jsonPayload?.message}`);
        if (mockResOff.statusCode !== 200) {
            throw new Error(`Toggle AI OFF failed with status ${mockResOff.statusCode}`);
        }

        // Verify database value is 0 (false)
        const [compOff] = await conn.query('SELECT ai_enabled FROM companies WHERE id = ?', [companyId]);
        console.log(`ai_enabled in DB after disabling: ${compOff.ai_enabled} (expected 0 / false)`);
        if (compOff.ai_enabled === 1 || compOff.ai_enabled === true) {
            throw new Error('DB field ai_enabled was not updated to false');
        }

        // Verify Platform Audit Log is created
        const auditOff = await conn.query(
            "SELECT * FROM platform_audit_logs WHERE action = 'DISABLE_AI_FEATURES' AND company_id = ? ORDER BY id DESC LIMIT 1",
            [companyId]
        );
        if (auditOff.length === 0) {
            throw new Error('No platform audit log found for DISABLE_AI_FEATURES');
        }
        console.log('DISABLE_AI_FEATURES Audit Log:', {
            id: auditOff[0].id.toString(),
            action: auditOff[0].action,
            user_email: auditOff[0].user_email
        });

        // 3. Test checkAiEnabled Middleware when AI is disabled
        console.log('\n--- Test Case 2: Testing Middleware with AI Disabled ---');
        const mockReqMiddlewareOff = {
            tenant: { tenant_id: tenantId, ai_enabled: false }
        };
        const mockResMiddlewareOff = createMockRes();
        let nextCalledOff = false;
        const mockNextOff = () => {
            nextCalledOff = true;
        };

        checkAiEnabled(mockReqMiddlewareOff, mockResMiddlewareOff, mockNextOff);
        console.log(`Middleware next called: ${nextCalledOff} (expected: false)`);
        console.log(`Middleware status code: ${mockResMiddlewareOff.statusCode} (expected: 403)`);
        console.log(`Middleware response:`, mockResMiddlewareOff.jsonPayload);

        if (nextCalledOff) {
            throw new Error('Middleware allowed request even though AI features are disabled');
        }
        if (mockResMiddlewareOff.statusCode !== 403) {
            throw new Error(`Expected middleware status 403, got ${mockResMiddlewareOff.statusCode}`);
        }
        if (!mockResMiddlewareOff.jsonPayload.ai_disabled) {
            throw new Error('Expected response payload to have ai_disabled = true');
        }

        // 4. Perform Toggle AI ON Action
        console.log('\n--- Test Case 3: Enabling AI Features ---');
        const mockAdminReqOn = {
            params: { id: companyId },
            body: { aiEnabled: true },
            user: { userId: 1, email: 'admin@platform.com', role: 'SUPER_ADMIN' }
        };
        const mockResOn = createMockRes();
        await adminController.toggleTenantAi(mockAdminReqOn, mockResOn);

        console.log(`Status Code: ${mockResOn.statusCode}`);
        console.log(`Payload Message: ${mockResOn.jsonPayload?.message}`);
        if (mockResOn.statusCode !== 200) {
            throw new Error(`Toggle AI ON failed with status ${mockResOn.statusCode}`);
        }

        // Verify database value is 1 (true)
        const [compOn] = await conn.query('SELECT ai_enabled FROM companies WHERE id = ?', [companyId]);
        console.log(`ai_enabled in DB after enabling: ${compOn.ai_enabled} (expected 1 / true)`);
        if (compOn.ai_enabled === 0 || compOn.ai_enabled === false) {
            throw new Error('DB field ai_enabled was not updated to true');
        }

        // Verify Platform Audit Log is created
        const auditOn = await conn.query(
            "SELECT * FROM platform_audit_logs WHERE action = 'ENABLE_AI_FEATURES' AND company_id = ? ORDER BY id DESC LIMIT 1",
            [companyId]
        );
        if (auditOn.length === 0) {
            throw new Error('No platform audit log found for ENABLE_AI_FEATURES');
        }
        console.log('ENABLE_AI_FEATURES Audit Log:', {
            id: auditOn[0].id.toString(),
            action: auditOn[0].action,
            user_email: auditOn[0].user_email
        });

        // 5. Test checkAiEnabled Middleware when AI is enabled
        console.log('\n--- Test Case 4: Testing Middleware with AI Enabled ---');
        const mockReqMiddlewareOn = {
            tenant: { tenant_id: tenantId, ai_enabled: true }
        };
        const mockResMiddlewareOn = createMockRes();
        let nextCalledOn = false;
        const mockNextOn = () => {
            nextCalledOn = true;
        };

        checkAiEnabled(mockReqMiddlewareOn, mockResMiddlewareOn, mockNextOn);
        console.log(`Middleware next called: ${nextCalledOn} (expected: true)`);
        if (!nextCalledOn) {
            throw new Error('Middleware blocked request even though AI features are enabled');
        }

        console.log('\n=== ALL AI TOGGLE TESTS COMPLETED SUCCESSFULLY ===');

    } catch (e) {
        console.error('\n❌ TEST RUN FAILED:', e.message);
        console.error(e);
        process.exit(1);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

runTests();
