const bcrypt = require('bcryptjs');
const { logToCentral } = require('../utils/auditLogger');
const { emailQueue } = require('../utils/queue');

exports.getUsers = async (req, res) => {
    let conn;
    try {
        conn = await req.db.getConnection();
        const rows = await conn.query(`
            SELECT u.id, u.name, u.email, u.status, u.created_at, r.name as role_name 
            FROM users u
            JOIN roles r ON u.role_id = r.id
            ORDER BY u.created_at DESC
        `);
        // Map database BIGINT and standard types, converting ID safely to string to prevent JSON serialization errors
        res.json(rows.map(r => ({
            ...r,
            id: r.id.toString()
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving users list' });
    } finally {
        if (conn) conn.release();
    }
};

exports.inviteUser = async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Missing required invite fields' });
    }

    let conn;
    try {
        conn = await req.db.getConnection();
        
        // Check duplicate
        const existing = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const roles = await conn.query('SELECT id FROM roles WHERE name = ?', [role]);
        if (roles.length === 0) {
            return res.status(400).json({ message: `Role '${role}' does not exist` });
        }
        const roleId = roles[0].id;

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const result = await conn.query(
            'INSERT INTO users (name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, ?)',
            [name, email, password_hash, roleId, 'ACTIVE']
        );
        const newUserId = result.insertId.toString();

        // Queue invitation email
        const tenantId = req.tenant.tenant_id;
        const companyName = req.tenant.name || tenantId.toUpperCase();
        const loginUrl = `${req.headers.origin || 'http://localhost:5173'}/login?tenantId=${tenantId}`;

        await emailQueue.add('invite-user', {
            email,
            name,
            companyName,
            temporaryPassword: password,
            role,
            loginUrl
        });

        // Log central audit trail
        await logToCentral(
            req.tenant.company_id,
            req.user.userId,
            req.user.email,
            'INVITE_USER',
            'users',
            newUserId,
            null,
            { name, email, role }
        );

        res.status(201).json({ message: 'User invited successfully', userId: newUserId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error creating user' });
    } finally {
        if (conn) conn.release();
    }
};

exports.toggleStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVE', 'INACTIVE', 'SUSPENDED'

    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }

    if (id.toString() === req.user.userId.toString()) {
        return res.status(400).json({ message: 'Cannot modify your own user account status' });
    }

    let conn;
    try {
        conn = await req.db.getConnection();
        const check = await conn.query('SELECT name, email, status FROM users WHERE id = ?', [id]);
        if (check.length === 0) return res.status(404).json({ message: 'User not found' });

        await conn.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);

        // Central audit logging
        await logToCentral(
            req.tenant.company_id,
            req.user.userId,
            req.user.email,
            'UPDATE_USER_STATUS',
            'users',
            id,
            { status: check[0].status },
            { status }
        );

        res.json({ message: `User status set to ${status.toLowerCase()}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error changing status' });
    } finally {
        if (conn) conn.release();
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    if (id.toString() === req.user.userId.toString()) {
        return res.status(400).json({ message: 'Cannot delete your own user account' });
    }

    let conn;
    try {
        conn = await req.db.getConnection();
        const check = await conn.query('SELECT name, email FROM users WHERE id = ?', [id]);
        if (check.length === 0) return res.status(404).json({ message: 'User not found' });

        await conn.query('DELETE FROM users WHERE id = ?', [id]);

        // Central audit logging
        await logToCentral(
            req.tenant.company_id,
            req.user.userId,
            req.user.email,
            'DELETE_USER',
            'users',
            id,
            { name: check[0].name, email: check[0].email },
            null
        );

        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error deleting user' });
    } finally {
        if (conn) conn.release();
    }
};
