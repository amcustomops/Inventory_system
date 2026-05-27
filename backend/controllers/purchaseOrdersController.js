const pool = require('../db');
const { sendPurchaseOrderEmail } = require('../utils/mailer');

exports.getAllPurchaseOrders = async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(`
      SELECT po.*, s.name as supplier_name, u.name as created_by_name 
      FROM PURCHASE_ORDERS po
      JOIN SUPPLIERS s ON po.supplier_id = s.id
      LEFT JOIN USERS u ON po.created_by = u.id
      ORDER BY po.created_at DESC
    `);
        res.json(rows.map(r => ({
            ...r,
            id: r.id.toString(),
            supplier_id: r.supplier_id.toString(),
            total_amount: Number(r.total_amount)
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving POs' });
    } finally {
        if (conn) conn.release();
    }
};

exports.getPurchaseOrderById = async (req, res) => {
    const poId = req.params.id;
    let conn;
    try {
        conn = await pool.getConnection();
        const poRows = await conn.query(`
            SELECT po.*, s.name as supplier_name 
            FROM PURCHASE_ORDERS po
            JOIN SUPPLIERS s ON po.supplier_id = s.id
            WHERE po.id = ?
        `, [poId]);

        if (poRows.length === 0) {
            return res.status(404).json({ message: 'Purchase order not found' });
        }

        const po = poRows[0];

        const itemRows = await conn.query(`
            SELECT poi.*, p.name 
            FROM PURCHASE_ORDER_ITEMS poi
            JOIN PRODUCTS p ON poi.product_id = p.id
            WHERE poi.purchase_order_id = ?
        `, [poId]);

        res.json({
            ...po,
            id: po.id.toString(),
            supplier_id: po.supplier_id.toString(),
            total_amount: Number(po.total_amount),
            items: itemRows.map(item => ({
                ...item,
                product_id: item.product_id.toString(),
                quantity: Number(item.ordered_quantity),
                unit_price: Number(item.cost_price),
                tax_percentage: Number(item.tax_percentage)
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving PO details' });
    } finally {
        if (conn) conn.release();
    }
};

exports.createPurchaseOrder = async (req, res) => {
    const { supplier_id, po_number, po_date, valid_from, valid_to, shipping_address, total_amount, items, status } = req.body;
    if (!supplier_id) {
        return res.status(400).json({ message: 'Missing required field: supplier_id' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const poStatus = status || 'PENDING';

        const poResult = await conn.query(
            `INSERT INTO PURCHASE_ORDERS 
            (supplier_id, po_number, po_date, valid_from, valid_to, shipping_address, status, total_amount, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [supplier_id, po_number || null, po_date || null, valid_from || null, valid_to || null, shipping_address || null, poStatus, total_amount || 0, req.user.id]
        );

        const poId = poResult.insertId;

        if (items && items.length > 0) {
            for (let item of items) {
                await conn.query(
                    'INSERT INTO PURCHASE_ORDER_ITEMS (purchase_order_id, product_id, ordered_quantity, cost_price, tax_percentage) VALUES (?, ?, ?, ?, ?)',
                    [poId, item.product_id, item.ordered_quantity, item.cost_price, item.tax_percentage || 0]
                );
            }
        }

        await conn.commit();
        
        // Trigger email notification asynchronously
        sendPurchaseOrderEmail(poId).catch(err => console.error('Error sending PO email:', err));

        res.status(201).json({ message: 'Purchase Order created', id: poId.toString() });
    } catch (err) {
        console.error(err);
        if (conn) await conn.rollback();
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
};

exports.updatePurchaseOrder = async (req, res) => {
    const poId = req.params.id;
    const { po_number, po_date, valid_from, valid_to, shipping_address, total_amount, status } = req.body;

    let conn;
    try {
        conn = await pool.getConnection();

        let updateFields = [];
        let params = [];

        if (total_amount !== undefined) {
            updateFields.push('total_amount = ?');
            params.push(total_amount);
        }

        if (status !== undefined) {
            updateFields.push('status = ?');
            params.push(status);
        }

        if (po_number !== undefined) {
            updateFields.push('po_number = ?');
            params.push(po_number);
        }

        if (po_date !== undefined) {
            updateFields.push('po_date = ?');
            params.push(po_date);
        }

        if (valid_from !== undefined) {
            updateFields.push('valid_from = ?');
            params.push(valid_from);
        }

        if (valid_to !== undefined) {
            updateFields.push('valid_to = ?');
            params.push(valid_to);
        }

        if (shipping_address !== undefined) {
            updateFields.push('shipping_address = ?');
            params.push(shipping_address);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }

        params.push(poId);

        const result = await conn.query(
            `UPDATE PURCHASE_ORDERS SET ${updateFields.join(', ')} WHERE id = ?`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Purchase order not found' });
        }

        res.json({ message: 'Purchase order updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error updating PO' });
    } finally {
        if (conn) conn.release();
    }
};

exports.autoGeneratePO = async (req, res) => {
    const { product_id, recommended_qty, expected_demand, confidence } = req.body;

    if (!product_id || recommended_qty === undefined) {
        return res.status(400).json({ message: 'Missing product or quantity for auto-generation' });
    }

    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Get product details (supplier, cost)
        const productRows = await conn.query('SELECT supplier_id, cost_price FROM PRODUCTS WHERE id = ?', [product_id]);

        if (productRows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const product = productRows[0];
        if (!product.supplier_id) {
            return res.status(400).json({ message: 'Product has no assigned supplier. Cannot auto-generate PO.' });
        }

        const total_amount = Number(product.cost_price) * Number(recommended_qty);

        await conn.beginTransaction();

        // 2. Create the drafted PO
        const notes = `Auto-generated by Smart Inventory Assistant.\nExpected 14-day demand: ${expected_demand || 'Unknown'}\nML Confidence: ${confidence || 'Unknown'}`;

        // We might not have a notes field in the schema, so we just use the status. 
        // Real systems would have a notes/remarks column.
        const poResult = await conn.query(
            'INSERT INTO PURCHASE_ORDERS (supplier_id, status, total_amount, created_by) VALUES (?, ?, ?, ?)',
            [product.supplier_id, 'PENDING', total_amount, req.user.id] // req.user.id from authMiddleware
        );

        const poId = poResult.insertId;

        // 3. Add the line item
        await conn.query(
            'INSERT INTO PURCHASE_ORDER_ITEMS (purchase_order_id, product_id, ordered_quantity, cost_price) VALUES (?, ?, ?, ?)',
            [poId, product_id, recommended_qty, product.cost_price]
        );

        await conn.commit();
        
        // Trigger email notification asynchronously
        sendPurchaseOrderEmail(poId).catch(err => console.error('Error sending auto PO email:', err));

        res.status(201).json({
            message: 'Purchase Order auto-generated successfully',
            po_id: poId.toString()
        });

    } catch (err) {
        console.error('Error auto-generating PO:', err);
        if (conn) await conn.rollback();
        res.status(500).json({ message: 'Server error generating PO' });
    } finally {
        if (conn) conn.release();
    }
};

exports.deletePurchaseOrder = async (req, res) => {
    const poId = req.params.id;
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Check status
        const [po] = await conn.query('SELECT status FROM PURCHASE_ORDERS WHERE id = ?', [poId]);
        if (!po) {
            return res.status(404).json({ message: 'Purchase order not found' });
        }

        if (po.status === 'RECEIVED' || po.status === 'APPROVED') {
            return res.status(400).json({ message: 'Cannot delete an approved or received purchase order to prevent inventory corruption.' });
        }

        await conn.beginTransaction();

        // 2. Delete line items first (if no cascade)
        await conn.query('DELETE FROM PURCHASE_ORDER_ITEMS WHERE purchase_order_id = ?', [poId]);

        // 3. Delete PO itself
        await conn.query('DELETE FROM PURCHASE_ORDERS WHERE id = ?', [poId]);

        await conn.commit();
        res.json({ message: 'Purchase order deleted successfully' });
    } catch (err) {
        console.error('Error deleting PO:', err);
        if (conn) await conn.rollback();
        res.status(500).json({ message: 'Server error deleting PO' });
    } finally {
        if (conn) conn.release();
    }
};
