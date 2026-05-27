const pool = require('../db');

exports.getInventory = async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const query = `
      SELECT i.*, p.name as product_name, p.sku, l.name as location_name 
      FROM INVENTORY i
      JOIN PRODUCTS p ON i.product_id = p.id
      JOIN LOCATIONS l ON i.location_id = l.id
    `;
        const rows = await conn.query(query);
        const sanitizedRows = rows.map(r => ({
            ...r,
            id: r.id.toString(),
            product_id: r.product_id.toString(),
            location_id: r.location_id.toString()
        }));
        res.json(sanitizedRows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving inventory' });
    } finally {
        if (conn) conn.release();
    }
};

exports.transferStock = async (req, res) => {
    const { product_id, from_location_id, to_location_id, quantity } = req.body;

    if (!product_id || !from_location_id || !to_location_id || !quantity || quantity <= 0) {
        return res.status(400).json({ message: 'Missing required fields or invalid quantity' });
    }

    if (from_location_id === to_location_id) {
        return res.status(400).json({ message: 'Source and destination locations must be different' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Check if from_location has enough stock
        const fromStockRows = await conn.query(
            'SELECT id, quantity FROM INVENTORY WHERE product_id = ? AND location_id = ? FOR UPDATE',
            [product_id, from_location_id]
        );

        if (fromStockRows.length === 0 || fromStockRows[0].quantity < quantity) {
            await conn.rollback();
            return res.status(400).json({ message: 'Insufficient stock in source location' });
        }

        const fromInvId = fromStockRows[0].id;
        const newFromQty = fromStockRows[0].quantity - quantity;
        await conn.query('UPDATE INVENTORY SET quantity = ? WHERE id = ?', [newFromQty, fromInvId]);

        // Add to to_location
        const toStockRows = await conn.query(
            'SELECT id, quantity FROM INVENTORY WHERE product_id = ? AND location_id = ? FOR UPDATE',
            [product_id, to_location_id]
        );

        if (toStockRows.length > 0) {
            const toInvId = toStockRows[0].id;
            const newToQty = toStockRows[0].quantity + quantity;
            await conn.query('UPDATE INVENTORY SET quantity = ? WHERE id = ?', [newToQty, toInvId]);
        } else {
            await conn.query('INSERT INTO INVENTORY (product_id, location_id, quantity) VALUES (?, ?, ?)', [product_id, to_location_id, quantity]);
        }

        // Log Movements
        const userId = req.user?.id; // Assuming authMiddleware sets this
        await conn.query(
            `INSERT INTO STOCK_MOVEMENTS (product_id, location_id, type, quantity, reference_type, performed_by) 
             VALUES (?, ?, 'OUT', ?, 'TRANSFER', ?)`,
            [product_id, from_location_id, quantity, userId]
        );
        await conn.query(
            `INSERT INTO STOCK_MOVEMENTS (product_id, location_id, type, quantity, reference_type, performed_by) 
             VALUES (?, ?, 'IN', ?, 'TRANSFER', ?)`,
            [product_id, to_location_id, quantity, userId]
        );

        await conn.commit();
        res.status(200).json({ message: 'Stock transferred successfully' });

    } catch (err) {
        console.error(err);
        if (conn) await conn.rollback();
        res.status(500).json({ message: 'Server error during transfer' });
    } finally {
        if (conn) conn.release();
    }
};

exports.adjustStock = async (req, res) => {
    const { product_id, location_id, adjustment_type, quantity } = req.body;

    // adjustment_type can be 'IN', 'OUT', or 'ADJUSTMENT' (set exact amount)
    if (!product_id || !location_id || !adjustment_type || quantity === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    // For 'IN' or 'OUT', quantity should be positive, for 'ADJUSTMENT' it can be any valid number but usually >= 0
    if (quantity < 0) {
        return res.status(400).json({ message: 'Quantity must be non-negative' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

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

        let newQty = currentQty;
        let movementType = adjustment_type;
        let movementQty = 0;

        if (adjustment_type === 'IN') {
            newQty = currentQty + quantity;
            movementQty = quantity;
        } else if (adjustment_type === 'OUT') {
            if (currentQty < quantity) {
                await conn.rollback();
                return res.status(400).json({ message: 'Insufficient stock to remove' });
            }
            newQty = currentQty - quantity;
            movementQty = quantity;
        } else if (adjustment_type === 'ADJUSTMENT') {
            newQty = quantity;
            if (newQty > currentQty) {
                movementType = 'IN';
                movementQty = newQty - currentQty;
            } else if (newQty < currentQty) {
                movementType = 'OUT';
                movementQty = currentQty - newQty;
            } else {
                movementType = 'ADJUSTMENT';
                movementQty = 0; // No change
            }
        } else {
            await conn.rollback();
            return res.status(400).json({ message: 'Invalid adjustment type' });
        }

        if (invId) {
            await conn.query('UPDATE INVENTORY SET quantity = ? WHERE id = ?', [newQty, invId]);
        } else {
            await conn.query('INSERT INTO INVENTORY (product_id, location_id, quantity) VALUES (?, ?, ?)', [product_id, location_id, newQty]);
        }

        // Log Movement
        if (movementQty > 0 || movementType === 'ADJUSTMENT') { // Log even if no diff for 'ADJUSTMENT' to track manual checks
            const userId = req.user?.id;
            await conn.query(
                `INSERT INTO STOCK_MOVEMENTS (product_id, location_id, type, quantity, reference_type, performed_by) 
                  VALUES (?, ?, ?, ?, 'MANUAL_ADJUSTMENT', ?)`,
                [product_id, location_id, movementType, movementQty, userId]
            );
        }

        await conn.commit();
        res.status(200).json({ message: 'Stock adjusted successfully', current_quantity: newQty });

    } catch (err) {
        console.error(err);
        if (conn) await conn.rollback();
        res.status(500).json({ message: 'Server error during adjustment' });
    } finally {
        if (conn) conn.release();
    }
};
