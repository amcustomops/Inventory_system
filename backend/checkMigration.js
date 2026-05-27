const mariadb = require('mariadb');
require('dotenv').config();

async function check() {
    console.log('Checking tenant_primary database contents...');
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
        const tables = ['users', 'LOCATIONS', 'SUPPLIERS', 'PRODUCTS', 'INVENTORY', 'STOCK_MOVEMENTS', 'SALES_HISTORY'];
        for (const table of tables) {
            try {
                const rows = await conn.query(`SELECT COUNT(*) as count FROM \`${table}\``);
                console.log(`- Table '${table}' count:`, rows[0].count);
            } catch (err) {
                console.error(`- Table '${table}' error:`, err.message);
            }
        }
    } catch (err) {
        console.error('Error connecting to tenant_primary:', err.message);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

check();
