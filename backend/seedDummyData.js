const mariadb = require('mariadb');
require('dotenv').config();

async function seed(tenantId = 'primary') {
    const dbName = `tenant_${tenantId}`;
    console.log(`=== Seeding dummy data for database: ${dbName} ===`);

    const pool = mariadb.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 4000,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: dbName,
        multipleStatements: true,
        ssl: { rejectUnauthorized: false }
    });

    let conn;
    try {
        conn = await pool.getConnection();

        // Disable foreign key checks to make seeding clean
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');

        // 1. Seed Locations if none exist
        const locCheck = await conn.query('SELECT COUNT(*) as count FROM LOCATIONS');
        if (Number(locCheck[0].count) === 0) {
            console.log('Seeding Locations...');
            await conn.query(`
                INSERT INTO LOCATIONS (name, address) VALUES
                ('Main Warehouse', 'Ahmedabad, Gujarat'),
                ('Retail Outlet A', 'Vadodara, Gujarat'),
                ('Distribution Hub East', 'Mumbai, Maharashtra')
            `);
        } else {
            console.log('Locations already contain data. Skipping location seed.');
        }

        // 2. Seed Categories if none exist
        const catCheck = await conn.query('SELECT COUNT(*) as count FROM CATEGORIES');
        if (Number(catCheck[0].count) === 0) {
            console.log('Seeding Categories...');
            await conn.query(`
                INSERT INTO CATEGORIES (name, description) VALUES
                ('Electronics', 'Electronic appliances and consumer gadgets'),
                ('Office Supplies', 'Pens, notebooks, desk organizers and paper')
            `);
        } else {
            console.log('Categories already contain data. Skipping category seed.');
        }

        // 3. Seed Suppliers if none exist
        const supCheck = await conn.query('SELECT COUNT(*) as count FROM SUPPLIERS');
        if (Number(supCheck[0].count) === 0) {
            console.log('Seeding Suppliers...');
            await conn.query(`
                INSERT INTO SUPPLIERS (name, email, phone, address) VALUES
                ('TechSource Solutions', 'sales@techsource.com', '+91 98765 43210', 'Mumbai, India'),
                ('Global Stationery Co', 'info@globalstationery.com', '+91 91234 56789', 'Delhi, India')
            `);
        } else {
            console.log('Suppliers already contain data. Skipping supplier seed.');
        }

        // Fetch IDs to link products and inventory
        const locations = await conn.query('SELECT id, name FROM LOCATIONS');
        const categories = await conn.query('SELECT id, name FROM CATEGORIES');
        const suppliers = await conn.query('SELECT id, name FROM SUPPLIERS');

        const catElectronicsId = categories.find(c => c.name === 'Electronics')?.id;
        const catSuppliesId = categories.find(c => c.name === 'Office Supplies')?.id;
        const supTechId = suppliers.find(s => s.name === 'TechSource Solutions')?.id;
        const supStatId = suppliers.find(s => s.name === 'Global Stationery Co')?.id;

        // 4. Seed Products if none exist
        const prodCheck = await conn.query('SELECT COUNT(*) as count FROM PRODUCTS');
        let products = [];
        if (Number(prodCheck[0].count) === 0) {
            console.log('Seeding Products...');
            await conn.query(`
                INSERT INTO PRODUCTS (name, sku, category_id, supplier_id, cost_price, selling_price, reorder_level, track_expiry, track_batch, ordering_cost, holding_cost) VALUES
                ('Wireless Mouse', 'MOUSE-001', ?, ?, 450.00, 899.00, 10, FALSE, FALSE, 50.00, 5.00),
                ('Mechanical Keyboard', 'KEYBRD-002', ?, ?, 1800.00, 3299.00, 5, FALSE, FALSE, 80.00, 15.00),
                ('Gel Pen Box', 'PEN-003', ?, ?, 120.00, 250.00, 20, FALSE, FALSE, 20.00, 1.50),
                ('A4 Paper Rim', 'PAPER-004', ?, ?, 180.00, 350.00, 15, FALSE, FALSE, 25.00, 2.00)
            `, [
                catElectronicsId, supTechId,
                catElectronicsId, supTechId,
                catSuppliesId, supStatId,
                catSuppliesId, supStatId
            ]);
            products = await conn.query('SELECT id, sku FROM PRODUCTS');
        } else {
            console.log('Products already contain data. Skipping product seed.');
            products = await conn.query('SELECT id, sku FROM PRODUCTS');
        }

        // 5. Seed Inventory if none exist
        const invCheck = await conn.query('SELECT COUNT(*) as count FROM INVENTORY');
        if (Number(invCheck[0].count) === 0) {
            console.log('Seeding Inventory...');
            for (const prod of products) {
                for (const loc of locations) {
                    // Seed random quantities between 15 and 150
                    const qty = Math.floor(Math.random() * (150 - 15 + 1)) + 15;
                    await conn.query('INSERT INTO INVENTORY (product_id, location_id, quantity) VALUES (?, ?, ?)', [prod.id, loc.id, qty]);
                }
            }
            console.log('Seeded Inventory successfully.');
        } else {
            console.log('Inventory already contains data. Skipping inventory seed.');
        }

        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('=== Seeding completed successfully ===');
    } catch (e) {
        console.error('Error during seeding:', e);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

// Seed the default primary tenant if run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const tenant = args[0] || 'primary';
    seed(tenant);
}

module.exports = seed;
