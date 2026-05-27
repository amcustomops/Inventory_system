const pool = require('../db');

exports.getAllProducts = async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const query = `
      SELECT p.*, c.name as category_name, s.name as supplier_name 
      FROM PRODUCTS p 
      LEFT JOIN CATEGORIES c ON p.category_id = c.id 
      LEFT JOIN SUPPLIERS s ON p.supplier_id = s.id
    `;
        const rows = await conn.query(query);
        const sanitizedRows = rows.map(r => ({
            ...r,
            id: r.id.toString(),
            category_id: r.category_id?.toString() || null,
            supplier_id: r.supplier_id?.toString() || null,
            cost_price: Number(r.cost_price),
            selling_price: Number(r.selling_price)
        }));
        res.json(sanitizedRows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving products' });
    } finally {
        if (conn) conn.release();
    }
};

exports.createProduct = async (req, res) => {
    const { name, sku, category_id, supplier_id, cost_price, selling_price, reorder_level, track_expiry, track_batch, ordering_cost, holding_cost } = req.body;
    if (!name || !sku || cost_price === undefined || selling_price === undefined) {
        return res.status(400).json({ message: 'Required fields missing' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(`
      INSERT INTO PRODUCTS 
      (name, sku, category_id, supplier_id, cost_price, selling_price, reorder_level, track_expiry, track_batch, ordering_cost, holding_cost) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, sku, category_id || null, supplier_id || null, cost_price, selling_price, reorder_level || 0, track_expiry || false, track_batch || false, ordering_cost !== undefined ? ordering_cost : 50.00, holding_cost !== undefined ? holding_cost : 2.00]);

        res.status(201).json({ message: 'Product created', id: result.insertId.toString() });
    } catch (err) {
        console.error('Error creating product:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Product SKU already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
};

exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('DELETE FROM PRODUCTS WHERE id = ?', [id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
};

exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, sku, category_id, supplier_id, cost_price, selling_price, reorder_level, track_expiry, track_batch, ordering_cost, holding_cost } = req.body;

    if (!name || !sku || cost_price === undefined || selling_price === undefined) {
        return res.status(400).json({ message: 'Required fields missing' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            UPDATE PRODUCTS 
            SET name = ?, sku = ?, category_id = ?, supplier_id = ?, cost_price = ?, selling_price = ?, reorder_level = ?, track_expiry = ?, track_batch = ?, ordering_cost = ?, holding_cost = ?
            WHERE id = ?`,
            [name, sku, category_id || null, supplier_id || null, cost_price, selling_price, reorder_level || 0, track_expiry || false, track_batch || false, ordering_cost !== undefined ? ordering_cost : 50.00, holding_cost !== undefined ? holding_cost : 2.00, id]
        );

        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        console.error('Error updating product:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Product SKU already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
};
