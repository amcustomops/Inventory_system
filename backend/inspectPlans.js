const centralPool = require('./db');

async function inspect() {
    let conn;
    try {
        conn = await centralPool.centralPool.getConnection();
        const rows = await conn.query('SELECT * FROM plans');
        console.log('PLANS ROWS:', rows);
        
        const countRows = await conn.query('SELECT COUNT(*) as count FROM plans');
        console.log('PLANS COUNT:', countRows);
    } catch (err) {
        console.error('Inspect error:', err);
    } finally {
        if (conn) conn.release();
        await centralPool.end();
    }
}

inspect();
