const pool = require('../db');

exports.createMovement = async (req, res) => {
    const { product_id, location_id, type, quantity, reference_type, reference_id } = req.body;

    if (!product_id || !location_id || !type || quantity === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        await conn.query(
            `INSERT INTO STOCK_MOVEMENTS (product_id, location_id, type, quantity, reference_type, reference_id, performed_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [product_id, location_id, type, quantity, reference_type || null, reference_id || null, req.user.id]
        );

        const invRows = await conn.query(
            'SELECT id, quantity FROM INVENTORY WHERE product_id = ? AND location_id = ? FOR UPDATE',
            [product_id, location_id]
        );

        let currentQty = 0;
        let invId = null;
        if (invRows.length > 0) {
            currentQty = invRows[0].quantity;
            invId = invRows[0].id;
        }

        let diff = 0;
        if (type === 'IN') diff = quantity;
        else if (type === 'OUT') diff = -quantity;
        else if (type === 'ADJUSTMENT') diff = quantity - currentQty;

        const newQty = currentQty + diff;

        if (invId) {
            await conn.query('UPDATE INVENTORY SET quantity = ? WHERE id = ?', [newQty, invId]);
        } else {
            await conn.query('INSERT INTO INVENTORY (product_id, location_id, quantity) VALUES (?, ?, ?)', [product_id, location_id, newQty]);
        }

        await conn.commit();
        res.status(201).json({ message: 'Movement recorded and inventory updated' });
    } catch (err) {
        console.error(err);
        if (conn) await conn.rollback();
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
};

exports.getMovements = async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(`
      SELECT m.*, p.name as product_name, l.name as location_name, u.name as user_name
      FROM STOCK_MOVEMENTS m
      JOIN PRODUCTS p ON m.product_id = p.id
      JOIN LOCATIONS l ON m.location_id = l.id
      LEFT JOIN USERS u ON m.performed_by = u.id
      ORDER BY m.created_at DESC
      LIMIT 100
    `);

        res.json(rows.map(r => ({
            ...r,
            id: r.id.toString(),
            product_id: r.product_id.toString(),
            location_id: r.location_id.toString()
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
};
