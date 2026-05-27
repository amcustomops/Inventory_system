const pool = require('../db');

exports.getAllSuppliers = async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT * FROM SUPPLIERS');
        res.json(rows.map(r => ({ ...r, id: r.id.toString() })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving suppliers' });
    } finally {
        if (conn) conn.release();
    }
};

exports.createSupplier = async (req, res) => {
    const { name, email, phone, address } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            'INSERT INTO SUPPLIERS (name, email, phone, address) VALUES (?, ?, ?, ?)',
            [name, email, phone, address]
        );
        res.status(201).json({ id: result.insertId.toString(), name, email, phone, address });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
};

exports.updateSupplier = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;

    if (!name) return res.status(400).json({ message: 'Name is required' });

    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            'UPDATE SUPPLIERS SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
            [name, email, phone, address, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Supplier not found' });
        }
        res.json({ id, name, email, phone, address });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error updating supplier' });
    } finally {
        if (conn) conn.release();
    }
};

exports.deleteSupplier = async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('DELETE FROM SUPPLIERS WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Supplier not found' });
        }
        res.json({ message: 'Supplier deleted successfully' });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ message: 'Cannot delete supplier because they are associated with existing products or purchase orders.' });
        }
        res.status(500).json({ message: 'Server error deleting supplier' });
    } finally {
        if (conn) conn.release();
    }
};
