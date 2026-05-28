const pool = require('../db');
const xlsx = require('xlsx');
const { logToCentral } = require('../utils/auditLogger');

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

exports.importInventory = async (req, res) => {
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

        const findValue = (row, keys) => {
            const rowKeys = Object.keys(row);
            const foundKey = rowKeys.find(rk => 
                keys.some(k => rk.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, ''))
            );
            return foundKey ? row[foundKey] : undefined;
        };

        for (let idx = 0; idx < rows.length; idx++) {
            const row = rows[idx];
            const rowNumber = idx + 2;

            const prodIdVal = findValue(row, ['product_id', 'productid', 'productId']);
            const locIdVal = findValue(row, ['location_id', 'locationid', 'locationId']);
            const qtyVal = findValue(row, ['quantity', 'qty', 'amount']);

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
            if (isNaN(qty) || qty < 0) {
                errorCount++;
                errors.push({ row: rowNumber, productId, reason: 'Quantity must be a non-negative integer' });
                continue;
            }

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

            // Fetch current stock from INVENTORY
            const invRows = await conn.query(
                'SELECT id, quantity FROM INVENTORY WHERE product_id = ? AND location_id = ? FOR UPDATE',
                [productId, locationId]
            );

            let currentQty = 0;
            let invId = null;
            if (invRows.length > 0) {
                currentQty = Number(invRows[0].quantity);
                invId = invRows[0].id;
            }

            const delta = qty - currentQty;
            let movementType = 'ADJUSTMENT';
            let movementQty = 0;

            if (delta > 0) {
                movementType = 'IN';
                movementQty = delta;
            } else if (delta < 0) {
                movementType = 'OUT';
                movementQty = Math.abs(delta);
            }

            // Update/Insert inventory record
            if (invId) {
                await conn.query('UPDATE INVENTORY SET quantity = ? WHERE id = ?', [qty, invId]);
            } else {
                await conn.query('INSERT INTO INVENTORY (product_id, location_id, quantity) VALUES (?, ?, ?)', [productId, locationId, qty]);
            }

            // Log stock movement
            if (movementQty > 0 || movementType === 'ADJUSTMENT') {
                const userId = req.user?.id || null;
                await conn.query(
                    `INSERT INTO STOCK_MOVEMENTS (product_id, location_id, type, quantity, reference_type, performed_by)
                     VALUES (?, ?, ?, ?, 'EXCEL_ADJUSTMENT', ?)`,
                    [productId, locationId, movementType, movementQty, userId]
                );
            }

            successCount++;
        }

        await conn.commit();

        // Log central audit trail for the bulk import action
        await logToCentral(
            req.tenant.company_id,
            req.user.userId,
            req.user.email,
            'IMPORT_INVENTORY',
            'inventory',
            null,
            null,
            { successCount, errorCount }
        );

        res.json({
            message: `Inventory adjustments completed. Succeeded: ${successCount}, Failed: ${errorCount}`,
            successCount,
            errorCount,
            errors
        });

    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch (rb) {}
        }
        console.error('[IMPORT] Inventory import transaction failed:', err);
        res.status(500).json({ message: 'Internal server error processing inventory spreadsheet' });
    } finally {
        if (conn) conn.release();
    }
};

