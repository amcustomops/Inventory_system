const pool = require('../db');

exports.getAllCategories = async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM CATEGORIES');
        res.json(rows.map(r => ({ ...r, id: r.id.toString() })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
};

exports.createCategory = async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('INSERT INTO CATEGORIES (name, description) VALUES (?, ?)', [name, description]);
        res.status(201).json({ id: result.insertId.toString(), name, description });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
};
