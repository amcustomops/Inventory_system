const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const centralPool = require('../db'); // Central DB pool
const { logToCentral } = require('../utils/auditLogger');

/**
 * Tenant user registration (scoped to req.db)
 */
exports.register = async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!req.db) {
        return res.status(400).json({ message: 'Tenant database context is missing' });
    }

    const roleName = role || 'staff'; // default to staff role if not specified

    let conn;
    try {
        conn = await req.db.getConnection();

        // 1. Check if user already exists (prevents auto-increment skip on duplicate error)
        const existing = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'User already exists in this tenant workspace' });
        }

        // 2. Fetch role ID by name
        const roles = await conn.query('SELECT id FROM roles WHERE name = ?', [roleName]);
        if (roles.length === 0) {
            return res.status(400).json({ message: `Role '${roleName}' does not exist` });
        }
        const roleId = roles[0].id;

        // 3. Hash password and insert user
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const result = await conn.query(
            'INSERT INTO users (name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, ?)',
            [name, email, password_hash, roleId, 'ACTIVE']
        );

        const newUserId = result.insertId.toString();

        // 4. Log to central audit trail
        await logToCentral(
            req.tenant.company_id,
            newUserId,
            email,
            'REGISTER_USER',
            'users',
            newUserId,
            null,
            { name, email, role: roleName }
        );

        res.status(201).json({ message: 'User registered successfully', userId: newUserId });
    } catch (err) {
        console.error('Error during tenant registration:', err);
        res.status(500).json({ message: 'Server error during registration' });
    } finally {
        if (conn) conn.release();
    }
};

/**
 * Tenant user login (scoped to req.db)
 */
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!req.db || !req.tenant) {
        return res.status(400).json({ message: 'Tenant context is missing from request headers' });
    }

    let conn;
    try {
        conn = await req.db.getConnection();

        // 1. Fetch user and their role name
        const rows = await conn.query(
            `SELECT u.*, r.name as role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.email = ?`,
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = rows[0];

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ message: `Your user account status is ${user.status.toLowerCase()}` });
        }

        // 2. Validate password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 3. Resolve permissions (Role permissions + Custom overrides)
        const rolePerms = await conn.query(
            `SELECT p.key_name 
             FROM permissions p 
             JOIN role_permissions rp ON p.id = rp.permission_id 
             WHERE rp.role_id = ?`,
            [user.role_id]
        );

        const overrides = await conn.query(
            `SELECT p.key_name, up.is_grant 
             FROM permissions p 
             JOIN user_permissions up ON p.id = up.permission_id 
             WHERE up.user_id = ?`,
            [user.id]
        );

        // Compile permission keys
        const permissions = new Set();
        rolePerms.forEach(p => permissions.add(p.key_name));
        overrides.forEach(ov => {
            if (ov.is_grant) {
                permissions.add(ov.key_name);
            } else {
                permissions.delete(ov.key_name);
            }
        });

        const mergedPermissions = Array.from(permissions);

        // 4. Issue JWT with full tenant metadata context
        const payload = {
            userId: user.id.toString(),
            email: user.email,
            role: user.role_name,
            companyId: req.tenant.company_id.toString(),
            tenantId: req.tenant.tenant_id,
            permissions: mergedPermissions
        };

        // Strict 30-minute session for owners and managers, 1 day for others
        const expiresIn = (user.role_name === 'owner' || user.role_name === 'manager') ? '30m' : '1d';

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your_jwt_secret_key_here',
            { expiresIn }
        );

        // Log successful login
        await logToCentral(
            req.tenant.company_id,
            user.id.toString(),
            email,
            'USER_LOGIN',
            'users',
            user.id,
            null,
            { status: 'success' }
        );

        res.json({
            token,
            user: {
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                role: user.role_name,
                tenantId: req.tenant.tenant_id,
                permissions: mergedPermissions,
                aiEnabled: req.tenant.ai_enabled !== false
            }
        });

    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error during login' });
    } finally {
        if (conn) conn.release();
    }
};

/**
 * Super Admin Login (queries central platform_users table)
 */
exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    let conn;
    try {
        conn = await centralPool.centralPool.getConnection();
        const rows = await conn.query('SELECT * FROM platform_users WHERE email = ?', [email]);
        
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        const admin = rows[0];
        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        // Issue token scoped to the central platform administration
        const payload = {
            userId: admin.id.toString(),
            email: admin.email,
            role: admin.role, // 'SUPER_ADMIN' or 'SUPPORT'
            tenantId: 'platform', // system level
            permissions: ['*'] // global access
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your_jwt_secret_key_here',
            { expiresIn: '2h' }
        );

        await logToCentral(
            null,
            admin.id.toString(),
            email,
            'ADMIN_LOGIN',
            'platform_users',
            admin.id,
            null,
            { status: 'success' }
        );

        res.json({
            token,
            user: {
                id: admin.id.toString(),
                name: admin.name,
                email: admin.email,
                role: admin.role,
                tenantId: 'platform',
                permissions: ['*']
            }
        });

    } catch (err) {
        console.error('Error during admin login:', err);
        res.status(500).json({ message: 'Server error during admin login' });
    } finally {
        if (conn) conn.release();
    }
};
