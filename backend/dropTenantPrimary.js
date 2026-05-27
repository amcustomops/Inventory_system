const centralPool = require('./db');

async function run() {
    let conn;
    try {
        conn = await centralPool.centralPool.getConnection();
        await conn.query('DROP DATABASE IF EXISTS tenant_primary');
        await conn.query("DELETE FROM companies WHERE tenant_id = 'primary'");
        console.log('Database tenant_primary dropped successfully.');
    } catch(e) {
        console.error(e);
    } finally {
        if (conn) conn.release();
        await centralPool.end();
    }
}
run();
