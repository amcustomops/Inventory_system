const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const centralPool = require('../db');
const { emailQueue } = require('../utils/queue');

class OnboardingService {
    /**
     * Create a new tenant company: database, schema, seed, and owner user
     */
    async onboardCompany({ companyName, tenantId, ownerName, ownerEmail, password, planId }) {
        if (!companyName || !tenantId || !ownerName || !ownerEmail || !password || !planId) {
            throw new Error('All fields are required to onboard a new company');
        }

        const cleanTenantId = tenantId.toLowerCase().trim();
        const dbName = `tenant_${cleanTenantId}`;
        
        let centralConn;
        try {
            centralConn = await centralPool.centralPool.getConnection();
            await centralConn.beginTransaction();

            // 1. Double check if company/tenant already exists in central DB
            const existing = await centralConn.query(
                'SELECT id FROM companies WHERE tenant_id = ? OR db_name = ?',
                [cleanTenantId, dbName]
            );
            if (existing.length > 0) {
                throw new Error(`Tenant '${cleanTenantId}' already exists`);
            }

            // 2. Create the company entry in the central catalog
            const companyResult = await centralConn.query(
                'INSERT INTO companies (name, tenant_id, db_name, status) VALUES (?, ?, ?, ?)',
                [companyName, cleanTenantId, dbName, 'INACTIVE']
            );
            const companyId = Number(companyResult.insertId);

            // 3. Create the subscription record
            const planRows = await centralConn.query('SELECT * FROM plans WHERE id = ?', [planId]);
            if (planRows.length === 0) {
                throw new Error('Pricing plan not found');
            }

            const trialDays = 14;
            const trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

            await centralConn.query(
                'INSERT INTO subscriptions (company_id, plan_id, status, trial_ends_at) VALUES (?, ?, ?, ?)',
                [companyId, planId, 'TRIAL', trialEndsAt]
            );

            // 4. Provision the physical database on the server
            console.log(`[Onboarding] Provisioning database: ${dbName}`);
            await centralConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

            // 5. Initialize the database schema and seed standard data
            await this.initializeTenantDatabase(dbName, ownerName, ownerEmail, password);

            // Seed dummy products, locations, and inventory for the new tenant workspace
            const seedDummyData = require('../seedDummyData');
            await seedDummyData(cleanTenantId);

            // 6. Complete activation status
            await centralConn.query('UPDATE companies SET status = ? WHERE id = ?', ['ACTIVE', companyId]);
            await centralConn.commit();

            console.log(`[Onboarding] Tenant '${cleanTenantId}' successfully onboarded.`);
            return { companyId, tenantId: cleanTenantId, dbName };

        } catch (err) {
            if (centralConn) {
                try {
                    await centralConn.rollback();
                } catch (rollbackErr) {
                    console.error('[Onboarding] Rollback failed:', rollbackErr);
                }
            }
            console.error('[Onboarding] Error onboarding company, rolling back changes...', err);
            throw err;
        } finally {
            if (centralConn) centralConn.release();
        }
    }

    /**
     * Connect to the new database, read schema.sql, initialize tables, seed roles, and insert the owner
     */
    async initializeTenantDatabase(dbName, ownerName, ownerEmail, plainPassword) {
        // Build database connection pool specifically for this tenant DB
        const tenantPool = require('mariadb').createPool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 4000,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: dbName,
            multipleStatements: true,
            ssl: {
                rejectUnauthorized: false
            }
        });

        let conn;
        try {
            conn = await tenantPool.getConnection();

            // Load schema.sql relative to this service file
            const schemaSqlPath = path.join(__dirname, '../schema.sql');
            const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');

            console.log(`[Onboarding] Creating tables in ${dbName}...`);
            // Split SQL statements by semicolon to avoid multi-statement syntax errors on some engines
            const queries = schemaSql.split(';').filter(q => q.trim() !== '');
            for (let query of queries) {
                if (query.trim()) {
                    await conn.query(query);
                }
            }
            console.log(`[Onboarding] Database schema initialized for ${dbName}.`);

            // Seed RBAC Roles and Permissions
            await this.seedPermissionsAndRoles(conn);

            // Fetch 'owner' role ID
            const roles = await conn.query("SELECT id FROM roles WHERE name = 'owner'");
            if (roles.length === 0) {
                throw new Error('[Onboarding] Failed to seed system owner role');
            }
            const ownerRoleId = roles[0].id;

            // Securely hash owner password
            const salt = await bcrypt.genSalt(10);
            const hashedPwd = await bcrypt.hash(plainPassword, salt);

            // Insert system owner account into tenant DB
            const userResult = await conn.query(
                'INSERT INTO users (name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, ?)',
                [ownerName, ownerEmail, hashedPwd, ownerRoleId, 'ACTIVE']
            );

            console.log(`[Onboarding] Seeded Owner account: ${ownerEmail} in ${dbName}`);

            // 7. Queue welcome email invitation asynchronously
            const loginUrl = `/login?tenantId=${dbName.replace('tenant_', '')}`;
            await emailQueue.add('send-welcome-email', {
                email: ownerEmail,
                name: ownerName,
                companyName: dbName.replace('tenant_', '').toUpperCase(),
                temporaryPassword: plainPassword,
                loginUrl: loginUrl
            });
            console.log(`[Onboarding] Welcome email queued for ${ownerEmail}.`);

        } finally {
            if (conn) conn.release();
            await tenantPool.end(); // Terminate temporary onboarding pool
        }
    }

    /**
     * Seeds default role hierarchies and permission strings
     */
    async seedPermissionsAndRoles(conn) {
        // Permissions
        const permissionsList = [
            ['products.create', 'Create inventory products'],
            ['products.edit', 'Modify product details'],
            ['products.view', 'View inventory catalog'],
            ['locations.manage', 'Add/edit warehouse positions'],
            ['suppliers.manage', 'Create or remove vendors'],
            ['analytics.view', 'Inspect demand forecasting insights'],
            ['users.manage', 'Add/edit company employees']
        ];

        for (const [key, desc] of permissionsList) {
            await conn.query(
                'INSERT INTO permissions (key_name, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE description=VALUES(description)',
                [key, desc]
            );
        }

        // Roles
        await conn.query("INSERT INTO roles (name, description, is_system) VALUES ('owner', 'Company Owner - Full administrative access', TRUE) ON DUPLICATE KEY UPDATE description=VALUES(description)");
        await conn.query("INSERT INTO roles (name, description, is_system) VALUES ('manager', 'General Manager - Operations permissions', TRUE) ON DUPLICATE KEY UPDATE description=VALUES(description)");
        await conn.query("INSERT INTO roles (name, description, is_system) VALUES ('warehouse', 'Warehouse Staff - Move & track inventory', TRUE) ON DUPLICATE KEY UPDATE description=VALUES(description)");
        await conn.query("INSERT INTO roles (name, description, is_system) VALUES ('staff', 'Standard Employee - General workspace viewer', TRUE) ON DUPLICATE KEY UPDATE description=VALUES(description)");
        
        // Link all permissions to the owner role
        const [ownerRole] = await conn.query("SELECT id FROM roles WHERE name = 'owner'");
        const [managerRole] = await conn.query("SELECT id FROM roles WHERE name = 'manager'");
        const [warehouseRole] = await conn.query("SELECT id FROM roles WHERE name = 'warehouse'");

        const allPermissions = await conn.query("SELECT id FROM permissions");
        for (const p of allPermissions) {
            await conn.query("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [ownerRole.id, p.id]);
        }
        
        // Managers get all except user management
        const managerPermissions = await conn.query("SELECT id FROM permissions WHERE key_name != 'users.manage'");
        for (const p of managerPermissions) {
            await conn.query("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [managerRole.id, p.id]);
        }

        // Warehouse staff get only view permissions, locations, and movements
        const warehousePermissions = await conn.query(
            "SELECT id FROM permissions WHERE key_name IN ('products.view', 'locations.manage')"
        );
        for (const p of warehousePermissions) {
            await conn.query("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)", [warehouseRole.id, p.id]);
        }
    }
}

module.exports = new OnboardingService();
