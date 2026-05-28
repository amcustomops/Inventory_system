const pool = require('../db');
const xlsx = require('xlsx');
const { logToCentral } = require('../utils/auditLogger');

exports.getAllProducts = async (req, res) => {
    let conn;
    try {
        conn = await req.db.getConnection();
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
        conn = await req.db.getConnection();
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
        conn = await req.db.getConnection();
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
        conn = await req.db.getConnection();
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

exports.importProducts = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No spreadsheet file uploaded' });
    }

    let conn;
    try {
        // 1. Read Workbook buffer
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        conn = await req.db.getConnection();
        await conn.beginTransaction();

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // Helper to normalize and match keys
        const findValue = (row, keys) => {
            const rowKeys = Object.keys(row);
            const foundKey = rowKeys.find(rk => 
                keys.some(k => rk.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, ''))
            );
            return foundKey ? row[foundKey] : undefined;
        };

        for (let idx = 0; idx < rows.length; idx++) {
            const row = rows[idx];
            const rowNumber = idx + 2; // Row 1 is headers

            // Extract values supporting flexible header names
            const name = findValue(row, ['name', 'productname', 'itemname', 'product']);
            const sku = findValue(row, ['sku', 'productsku', 'itemsku', 'code']);
            const costPriceVal = findValue(row, ['costprice', 'cost_price', 'cost']);
            const sellingPriceVal = findValue(row, ['sellingprice', 'selling_price', 'price', 'retailprice']);
            
            const categoryName = findValue(row, ['category', 'categoryname', 'classification']);
            const supplierName = findValue(row, ['supplier', 'suppliername', 'vendor']);
            
            const reorderLevelVal = findValue(row, ['reorderlevel', 'reorder_level', 'minstock']);
            const trackExpiryVal = findValue(row, ['trackexpiry', 'track_expiry', 'expiry']);
            const trackBatchVal = findValue(row, ['trackbatch', 'track_batch', 'batch']);

            // Validate required fields
            if (!name || !sku || costPriceVal === undefined || sellingPriceVal === undefined) {
                errorCount++;
                errors.push({
                    row: rowNumber,
                    sku: sku || 'N/A',
                    reason: 'Missing required columns (Name, SKU, Cost Price, or Selling Price)'
                });
                continue;
            }

            const cost_price = Number(costPriceVal);
            const selling_price = Number(sellingPriceVal);
            const reorder_level = Number(reorderLevelVal || 0);
            const track_expiry = trackExpiryVal === true || String(trackExpiryVal).toLowerCase() === 'true' || String(trackExpiryVal).toLowerCase() === 'yes';
            const track_batch = trackBatchVal === true || String(trackBatchVal).toLowerCase() === 'true' || String(trackBatchVal).toLowerCase() === 'yes';

            // Verify SKU duplicate in DB
            const existingSku = await conn.query('SELECT id FROM PRODUCTS WHERE sku = ?', [sku]);
            if (existingSku.length > 0) {
                errorCount++;
                errors.push({
                    row: rowNumber,
                    sku,
                    reason: `SKU '${sku}' already exists in database`
                });
                continue;
            }

            // Resolve Category
            let categoryId = null;
            if (categoryName && String(categoryName).trim()) {
                const cleanCatName = String(categoryName).trim();
                const existingCat = await conn.query('SELECT id FROM CATEGORIES WHERE name = ?', [cleanCatName]);
                if (existingCat.length > 0) {
                    categoryId = existingCat[0].id;
                } else {
                    const insertCat = await conn.query('INSERT INTO CATEGORIES (name) VALUES (?)', [cleanCatName]);
                    categoryId = insertCat.insertId;
                }
            }

            // Resolve Supplier
            let supplierId = null;
            if (supplierName && String(supplierName).trim()) {
                const cleanSupName = String(supplierName).trim();
                const existingSup = await conn.query('SELECT id FROM SUPPLIERS WHERE name = ?', [cleanSupName]);
                if (existingSup.length > 0) {
                    supplierId = existingSup[0].id;
                } else {
                    const insertSup = await conn.query('INSERT INTO SUPPLIERS (name) VALUES (?)', [cleanSupName]);
                    supplierId = insertSup.insertId;
                }
            }

            // Insert Product
            await conn.query(`
                INSERT INTO PRODUCTS 
                (name, sku, category_id, supplier_id, cost_price, selling_price, reorder_level, track_expiry, track_batch, ordering_cost, holding_cost) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, sku, categoryId, supplierId, cost_price, selling_price, reorder_level, track_expiry, track_batch, 50.00, 2.00]
            );

            successCount++;
        }

        await conn.commit();

        // Log central audit trail
        await logToCentral(
            req.tenant.company_id,
            req.user.userId,
            req.user.email,
            'IMPORT_PRODUCTS',
            'products',
            null,
            null,
            { successCount, errorCount }
        );

        res.json({
            message: `Catalog import complete. Succeeded: ${successCount}, Failed: ${errorCount}`,
            successCount,
            errorCount,
            errors
        });

    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch (rb) {}
        }
        console.error('[IMPORT] Excel catalog import transaction failed:', err);
        res.status(500).json({ message: 'Internal server error processing Excel data' });
    } finally {
        if (conn) conn.release();
    }
};
