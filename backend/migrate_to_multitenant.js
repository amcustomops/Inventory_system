const centralPool = require('./db');
const mariadb = require('mariadb');
const onboardingService = require('./services/onboardingService');
require('dotenv').config();

async function runMigration() {
    console.log('=== STARTING SINGLE-TENANT TO MULTI-TENANT SAAS MIGRATION ===');
    
    const legacyTenantId = 'primary';
    const companyName = 'Legacy Main Enterprise';
    const defaultOwnerEmail = 'owner@enterprise.com';
    const defaultPassword = 'Password2026Secure!';

    let centralConn;
    try {
        centralConn = await centralPool.centralPool.getConnection();

        // 1. Check if the legacy company is already migrated
        const existingCompany = await centralConn.query(
            'SELECT id, tenant_id, db_name FROM companies WHERE tenant_id = ?',
            [legacyTenantId]
        );

        let tenantDbName;
        if (existingCompany.length > 0) {
            console.log(`Legacy tenant '${legacyTenantId}' already onboarded in central catalog.`);
            tenantDbName = existingCompany[0].db_name;
        } else {
            console.log(`Step 1: Provisioning new tenant workspace database for '${legacyTenantId}'...`);
            const details = await onboardingService.onboardCompany({
                companyName,
                tenantId: legacyTenantId,
                ownerName: 'Enterprise Admin',
                ownerEmail: defaultOwnerEmail,
                password: defaultPassword,
                planId: 3 // Seeded Enterprise Core plan
            });
            tenantDbName = details.dbName;
            console.log(`  Database ${tenantDbName} created and seeded successfully.`);
        }

        // 2. Open connection to the tenant database
        console.log(`Step 2: Connecting to tenant database: ${tenantDbName}...`);
        const tenantPool = mariadb.createPool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 4000,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: tenantDbName,
            multipleStatements: true,
            ssl: { rejectUnauthorized: false }
        });

        const tenantConn = await tenantPool.getConnection();

        try {
            // Disable checks temporarily to preserve primary keys and handle setup
            await tenantConn.query('SET FOREIGN_KEY_CHECKS = 0');

            console.log('Step 3: Migrating Locations...');
            const locations = await centralConn.query('SELECT * FROM LOCATIONS');
            console.log(`  Found ${locations.length} locations to migrate.`);
            for (const loc of locations) {
                await tenantConn.query(
                    'INSERT INTO LOCATIONS (id, name, address, created_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
                    [loc.id, loc.name, loc.address, loc.created_at]
                );
            }

            console.log('Step 4: Migrating Suppliers...');
            const suppliers = await centralConn.query('SELECT * FROM SUPPLIERS');
            console.log(`  Found ${suppliers.length} suppliers to migrate.`);
            for (const sup of suppliers) {
                await tenantConn.query(
                    'INSERT INTO SUPPLIERS (id, name, email, phone, address, created_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
                    [sup.id, sup.name, sup.email, sup.phone, sup.address, sup.created_at]
                );
            }

            console.log('Step 5: Migrating Categories...');
            const categories = await centralConn.query('SELECT * FROM CATEGORIES');
            console.log(`  Found ${categories.length} categories to migrate.`);
            for (const cat of categories) {
                await tenantConn.query(
                    'INSERT INTO CATEGORIES (id, name, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
                    [cat.id, cat.name, cat.description]
                );
            }

            console.log('Step 6: Migrating Products...');
            const products = await centralConn.query('SELECT * FROM PRODUCTS');
            console.log(`  Found ${products.length} products to migrate.`);
            for (const p of products) {
                // If products contains ordering_cost/holding_cost, migrate them; else default
                await tenantConn.query(
                    `INSERT INTO PRODUCTS 
                    (id, name, sku, category_id, supplier_id, cost_price, selling_price, reorder_level, track_expiry, track_batch, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                    ON DUPLICATE KEY UPDATE sku=VALUES(sku)`,
                    [p.id, p.name, p.sku, p.category_id, p.supplier_id, p.cost_price, p.selling_price, p.reorder_level, p.track_expiry, p.track_batch, p.created_at]
                );
            }

            console.log('Step 7: Migrating Stock Quantities...');
            const inventory = await centralConn.query('SELECT * FROM INVENTORY');
            console.log(`  Found ${inventory.length} inventory records.`);
            for (const inv of inventory) {
                await tenantConn.query(
                    'INSERT INTO INVENTORY (id, product_id, location_id, quantity, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)',
                    [inv.id, inv.product_id, inv.location_id, inv.quantity, inv.updated_at]
                );
            }

            console.log('Step 8: Migrating Users and Roles mapping...');
            // Fetch seeded tenant role details
            const tenantRoles = await tenantConn.query('SELECT id, name FROM roles');
            const roleMap = {};
            tenantRoles.forEach(r => {
                roleMap[r.name] = r.id;
            });

            // Fetch users in central DB (representing old single-tenant database)
            // Wait, we renamed the USERS table to lowercase 'users' but in the single-tenant setup, it was UPPERCASE USERS.
            // Since we ran setupCentralDb, the central DB now has USERS (legacy) and users/roles/etc. doesn't exist there, but the old USERS table might still be there.
            // Let's select from USERS (uppercase) which was the original table.
            const oldUsers = await centralConn.query('SELECT * FROM USERS');
            console.log(`  Found ${oldUsers.length} legacy users to migrate.`);
            for (const u of oldUsers) {
                const targetRoleId = roleMap[u.role] || roleMap['staff'];
                await tenantConn.query(
                    'INSERT INTO users (id, name, email, password_hash, role_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email=VALUES(email)',
                    [u.id, u.name, u.email, u.password_hash, targetRoleId, 'ACTIVE', u.created_at]
                );
            }

            console.log('Step 9: Migrating Stock Movements...');
            const movements = await centralConn.query('SELECT * FROM STOCK_MOVEMENTS');
            console.log(`  Found ${movements.length} movements.`);
            for (const mv of movements) {
                await tenantConn.query(
                    'INSERT INTO STOCK_MOVEMENTS (id, product_id, location_id, type, quantity, reference_type, reference_id, performed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [mv.id, mv.product_id, mv.location_id, mv.type, mv.quantity, mv.reference_type, mv.reference_id, mv.performed_by, mv.created_at]
                );
            }

            console.log('Step 10: Migrating Purchase Orders...');
            const poOrders = await centralConn.query('SELECT * FROM PURCHASE_ORDERS');
            for (const po of poOrders) {
                await tenantConn.query(
                    'INSERT INTO PURCHASE_ORDERS (id, supplier_id, po_number, po_date, valid_from, valid_to, shipping_address, status, total_amount, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [po.id, po.supplier_id, po.po_number, po.po_date, po.valid_from, po.valid_to, po.shipping_address, po.status, po.total_amount, po.created_by, po.created_at]
                );
            }

            const poItems = await centralConn.query('SELECT * FROM PURCHASE_ORDER_ITEMS');
            for (const item of poItems) {
                await tenantConn.query(
                    'INSERT INTO PURCHASE_ORDER_ITEMS (id, purchase_order_id, product_id, ordered_quantity, received_quantity, cost_price, tax_percentage) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, item.purchase_order_id, item.product_id, item.ordered_quantity, item.received_quantity, item.cost_price, item.tax_percentage]
                );
            }

            console.log('Step 11: Migrating Sales History...');
            const sales = await centralConn.query('SELECT * FROM SALES_HISTORY');
            for (const s of sales) {
                await tenantConn.query(
                    'INSERT INTO SALES_HISTORY (id, product_id, location_id, quantity_sold, sale_date) VALUES (?, ?, ?, ?, ?)',
                    [s.id, s.product_id, s.location_id, s.quantity_sold, s.sale_date]
                );
            }

            await tenantConn.query('SET FOREIGN_KEY_CHECKS = 1');
            console.log('=== DATA MIGRATION COMPLETED SUCCESSFULLY ===');

        } finally {
            if (tenantConn) tenantConn.release();
            await tenantPool.end();
        }

    } catch (err) {
        console.error('Migration execution failed:', err);
    } finally {
        if (centralConn) centralConn.release();
    }
}

runMigration();
