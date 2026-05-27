const pool = require('../db');

exports.getAllLocations = async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM LOCATIONS');
        res.json(rows.map(r => ({ ...r, id: r.id.toString() })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving locations' });
    } finally {
        if (conn) conn.release();
    }
};

exports.createLocation = async (req, res) => {
    const { name, address } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('INSERT INTO LOCATIONS (name, address) VALUES (?, ?)', [name, address]);
        res.status(201).json({ id: result.insertId.toString(), name, address });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
};
