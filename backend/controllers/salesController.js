const xlsx = require('xlsx');
const { logToCentral } = require('../utils/auditLogger');


// Retrieve all sales records
exports.getAllSales = async (req, res) => {
    let conn;
    try {
        conn = await req.db.getConnection();
        const query = `
            SELECT sh.*, p.name as product_name, p.sku as product_sku, l.name as location_name
            FROM SALES_HISTORY sh
            JOIN PRODUCTS p ON sh.product_id = p.id
            JOIN LOCATIONS l ON sh.location_id = l.id
            ORDER BY sh.sale_date DESC, sh.id DESC
        `;
        const rows = await conn.query(query);
        const sanitizedRows = rows.map(r => ({
            ...r,
            id: r.id.toString(),
            product_id: r.product_id.toString(),
            location_id: r.location_id.toString(),
            quantity_sold: Number(r.quantity_sold)
        }));
        res.json(sanitizedRows);
    } catch (err) {
        console.error('[SALES] Error retrieving sales history:', err);
        res.status(500).json({ message: 'Server error retrieving sales history' });
    } finally {
        if (conn) conn.release();
    }
};

// Create a single sales record
exports.createSale = async (req, res) => {
    const { product_id, location_id, quantity_sold, sale_date } = req.body;

    if (!product_id || !location_id || !quantity_sold || !sale_date) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const qty = parseInt(quantity_sold, 10);
    if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ message: 'Quantity sold must be a positive number' });
    }

    // Validate sale_date is not in the future
    const inputDate = new Date(sale_date);
    if (isNaN(inputDate.getTime())) {
        return res.status(400).json({ message: 'Invalid sale date format' });
    }
    const today = new Date();
    inputDate.setHours(0, 0, 0, 0);
    today.setHours(23, 59, 59, 999);
    if (inputDate > today) {
        return res.status(400).json({ message: 'Future sale dates are not allowed' });
    }

    let conn;
    try {
        conn = await req.db.getConnection();
        await conn.beginTransaction();

        // 1. Assert sufficient stock
        const invRows = await conn.query(
            'SELECT id, quantity FROM INVENTORY WHERE product_id = ? AND location_id = ? FOR UPDATE',
            [product_id, location_id]
        );

        if (invRows.length === 0 || invRows[0].quantity < qty) {
            await conn.rollback();
            return res.status(400).json({ message: 'Insufficient stock in the selected location' });
        }

        const invId = invRows[0].id;
        const newQty = invRows[0].quantity - qty;

        // 2. Decrement stock
        await conn.query('UPDATE INVENTORY SET quantity = ? WHERE id = ?', [newQty, invId]);

        // 3. Insert sales record
        const formattedDate = sale_date.split('T')[0];
        await conn.query(
            'INSERT INTO SALES_HISTORY (product_id, location_id, quantity_sold, sale_date) VALUES (?, ?, ?, ?)',
            [product_id, location_id, qty, formattedDate]
        );

        // 4. Log stock movement
        const userId = req.user?.id || null;
        await conn.query(
            `INSERT INTO STOCK_MOVEMENTS (product_id, location_id, type, quantity, reference_type, performed_by)
             VALUES (?, ?, 'OUT', ?, 'SALE', ?)`,
            [product_id, location_id, qty, userId]
        );

        await conn.commit();
        res.status(201).json({ message: 'Sales record registered successfully' });
    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch (rb) {}
        }
        console.error('[SALES] Error creating sale:', err);
        res.status(500).json({ message: 'Server error registering sale' });
    } finally {
        if (conn) conn.release();
    }
};

// Bulk Import Sales History using Excel/CSV
exports.importSales = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No spreadsheet file uploaded' });
    }

    let conn;
    try {
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

        // Helper to map case-insensitive keys
        const findValue = (row, keys) => {
            const rowKeys = Object.keys(row);
            const foundKey = rowKeys.find(rk => 
                keys.some(k => rk.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, ''))
            );
            return foundKey ? row[foundKey] : undefined;
        };

        // Helper to parse Excel dates (which might be numeric serial values or strings)
        const parseExcelDate = (val) => {
            if (!val) return null;
            if (typeof val === 'number') {
                // Convert Excel serial number date
                const date = new Date((val - 25569) * 86400 * 1000);
                return isNaN(date.getTime()) ? null : date;
            }
            const date = new Date(val);
            return isNaN(date.getTime()) ? null : date;
        };

        for (let idx = 0; idx < rows.length; idx++) {
            const row = rows[idx];
            const rowNumber = idx + 2;

            const prodIdVal = findValue(row, ['product_id', 'productid', 'productId']);
            const locIdVal = findValue(row, ['location_id', 'locationid', 'locationId']);
            const qtyVal = findValue(row, ['quantity_sold', 'quantitysold', 'quantity', 'qty', 'amount_sold']);
            const dateVal = findValue(row, ['sale_date', 'saledate', 'date', 'transaction_date']);

            // Validate Product ID presence
            if (prodIdVal === undefined || prodIdVal === null || String(prodIdVal).trim() === '') {
                errorCount++;
                errors.push({ row: rowNumber, productId: 'N/A', reason: 'Product ID is required' });
                continue;
            }
            const productId = parseInt(prodIdVal, 10);
            if (isNaN(productId)) {
                errorCount++;
                errors.push({ row: rowNumber, productId: prodIdVal, reason: 'Product ID must be an integer' });
                continue;
            }

            // Validate Location ID presence
            if (locIdVal === undefined || locIdVal === null || String(locIdVal).trim() === '') {
                errorCount++;
                errors.push({ row: rowNumber, productId, reason: 'Location ID is required' });
                continue;
            }
            const locationId = parseInt(locIdVal, 10);
            if (isNaN(locationId)) {
                errorCount++;
                errors.push({ row: rowNumber, productId, reason: 'Location ID must be an integer' });
                continue;
            }

            // Validate Quantity
            const qty = parseInt(qtyVal, 10);
            if (isNaN(qty) || qty <= 0) {
                errorCount++;
                errors.push({ row: rowNumber, productId, reason: 'Quantity Sold must be a positive integer' });
                continue;
            }

            // Validate Date
            const parsedDate = parseExcelDate(dateVal);
            if (!parsedDate) {
                errorCount++;
                errors.push({ row: rowNumber, productId, reason: 'Invalid or missing Sale Date format' });
                continue;
            }

            // Enforce date not in future
            const today = new Date();
            const compareDate = new Date(parsedDate);
            compareDate.setHours(0, 0, 0, 0);
            today.setHours(23, 59, 59, 999);
            if (compareDate > today) {
                errorCount++;
                errors.push({ row: rowNumber, productId, reason: 'Future sale dates are not allowed' });
                continue;
            }
            const formattedDate = parsedDate.toISOString().split('T')[0];

            // Resolve/Validate Product ID
            const prodRows = await conn.query('SELECT id FROM PRODUCTS WHERE id = ?', [productId]);
            if (prodRows.length === 0) {
                errorCount++;
                errors.push({ row: rowNumber, productId, reason: `Product ID '${productId}' does not exist` });
                continue;
            }

            // Resolve/Validate Location ID
            const locRows = await conn.query('SELECT id FROM LOCATIONS WHERE id = ?', [locationId]);
            if (locRows.length === 0) {
                errorCount++;
                errors.push({ row: rowNumber, productId, reason: `Location ID '${locationId}' does not exist` });
                continue;
            }

            // Assert sufficient stock
            const invRows = await conn.query(
                'SELECT id, quantity FROM INVENTORY WHERE product_id = ? AND location_id = ? FOR UPDATE',
                [productId, locationId]
            );

            if (invRows.length === 0 || invRows[0].quantity < qty) {
                errorCount++;
                errors.push({ row: rowNumber, productId, reason: `Insufficient stock at location ID '${locationId}' (Available: ${invRows.length > 0 ? invRows[0].quantity : 0})` });
                continue;
            }

            // Decrement Stock
            await conn.query(
                'UPDATE INVENTORY SET quantity = ? WHERE id = ?',
                [invRows[0].quantity - qty, invRows[0].id]
            );

            // Record Sale
            await conn.query(
                'INSERT INTO SALES_HISTORY (product_id, location_id, quantity_sold, sale_date) VALUES (?, ?, ?, ?)',
                [productId, locationId, qty, formattedDate]
            );

            // Log stock movement
            const userId = req.user?.id || null;
            await conn.query(
                `INSERT INTO STOCK_MOVEMENTS (product_id, location_id, type, quantity, reference_type, performed_by)
                 VALUES (?, ?, 'OUT', ?, 'SALE', ?)`,
                [productId, locationId, qty, userId]
            );

            successCount++;
        }

        await conn.commit();

        // Log central audit trail
        await logToCentral(
            req.tenant.company_id,
            req.user.userId,
            req.user.email,
            'IMPORT_SALES',
            'sales',
            null,
            null,
            { successCount, errorCount }
        );

        res.json({
            message: `Sales history import complete. Succeeded: ${successCount}, Failed: ${errorCount}`,
            successCount,
            errorCount,
            errors
        });

    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch (rb) {}
        }
        console.error('[IMPORT] Sales import transaction failed:', err);
        res.status(500).json({ message: 'Internal server error processing sales history' });
    } finally {
        if (conn) conn.release();
    }
};
