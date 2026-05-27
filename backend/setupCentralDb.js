const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'smart_inventory',
  connectionLimit: 2,
  multipleStatements: true,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupCentral() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('Connected to Master Database. Initializing central platform tables...');

        // 1. Companies Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                tenant_id VARCHAR(100) UNIQUE NOT NULL,
                db_name VARCHAR(100) UNIQUE NOT NULL,
                status ENUM('ACTIVE', 'SUSPENDED', 'INACTIVE') DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        console.log('- companies table initialized.');

        // 2. Plans Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                billing_cycle ENUM('MONTHLY', 'ANNUAL') DEFAULT 'MONTHLY',
                max_users INT DEFAULT 5,
                max_locations INT DEFAULT 3,
                max_products INT DEFAULT 500,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        console.log('- plans table initialized.');

        // Seed default plans if they do not exist
        const planRows = await conn.query('SELECT COUNT(*) as count FROM plans');
        if (Number(planRows[0].count) === 0) {
            await conn.query(`
                INSERT INTO plans (name, price, max_users, max_locations, max_products) VALUES
                ('Basic Starter', 29.00, 3, 2, 100),
                ('Professional Growth', 79.00, 10, 5, 1000),
                ('Enterprise Core', 199.00, 100, 20, 10000);
            `);
            console.log('  Seeded default subscription plans.');
        }

        // 3. Subscriptions Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT UNIQUE NOT NULL,
                plan_id INT NOT NULL,
                status ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED') DEFAULT 'TRIAL',
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP NULL,
                trial_ends_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (plan_id) REFERENCES plans(id)
            ) ENGINE=InnoDB;
        `);
        console.log('- subscriptions table initialized.');

        // 4. Platform Users Table (Super Admins)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS platform_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('SUPER_ADMIN', 'SUPPORT') NOT NULL DEFAULT 'SUPER_ADMIN',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        console.log('- platform_users table initialized.');

        // Seed a default Super Admin if none exists (password: AdminSecurePassword2026!)
        const adminRows = await conn.query('SELECT COUNT(*) as count FROM platform_users');
        if (Number(adminRows[0].count) === 0) {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const hashedPwd = await bcrypt.hash('AdminSecurePassword2026!', salt);
            await conn.query(
                'INSERT INTO platform_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                ['Super Admin', 'admin@smartinventory.com', hashedPwd, 'SUPER_ADMIN']
            );
            console.log('  Seeded default Super Admin user: admin@smartinventory.com');
        }

        // 5. Central platform_audit_logs Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS platform_audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NULL,
                user_id INT NULL,
                user_email VARCHAR(255) NOT NULL,
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(100) NOT NULL,
                entity_id INT NOT NULL,
                old_value JSON NULL,
                new_value JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        console.log('- platform_audit_logs table initialized.');

        console.log('All central platform tables initialized successfully.');
    } catch (err) {
        console.error('Error during central DB setup:', err);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

setupCentral();
