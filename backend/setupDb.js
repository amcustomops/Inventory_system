const mariadb = require('mariadb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
    let conn;
    try {
        conn = await mariadb.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });

        console.log('Connected to MariaDB server. Creating database...');
        const dbName = process.env.DB_NAME || 'smart_inventory';
        await conn.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
        await conn.query(`USE ${dbName}`);

        console.log('Executing schema.sql...');
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

        // Split queries by semicolon to execute them properly if driver has issues with large chunks
        const queries = schemaSql.split(';').filter(q => q.trim() !== '');
        for (let q of queries) {
            if (q.trim()) {
                await conn.query(q);
            }
        }

        console.log('Database and tables created successfully.');
    } catch (err) {
        console.error('Error setting up database:', err);
    } finally {
        if (conn) conn.end();
    }
}

setup();
