const mariadb = require('mariadb');
require('dotenv').config();

async function checkState() {
    const pool = mariadb.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 4000,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'tenant_primary',
        ssl: { rejectUnauthorized: false }
    });

    let conn;
    try {
        conn = await pool.getConnection();
        const locations = await conn.query('SELECT * FROM LOCATIONS');
        const products = await conn.query('SELECT * FROM PRODUCTS');
        const inventory = await conn.query('SELECT * FROM INVENTORY');
        const suppliers = await conn.query('SELECT * FROM SUPPLIERS');
        
        console.log('Locations count:', locations.length);
        console.log('Locations:', locations);
        console.log('Products count:', products.length);
        console.log('Products:', products.map(p => ({ id: p.id.toString(), name: p.name, sku: p.sku })));
        console.log('Inventory count:', inventory.length);
        console.log('Inventory:', inventory);
        console.log('Suppliers count:', suppliers.length);
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

checkState();
