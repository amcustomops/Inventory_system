const pool = require('../db');
const xlsx = require('xlsx');
const { logToCentral } = require('../utils/auditLogger');

exports.getAllSuppliers = async (req, res) => {
    let conn;
    try {
        conn = await req.db.getConnection();
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
        conn = await req.db.getConnection();
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
        conn = await req.db.getConnection();
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
        conn = await req.db.getConnection();
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

exports.importSuppliers = async (req, res) => {
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

            const name = findValue(row, ['name', 'suppliername', 'supplier_name', 'vendor']);
            const emailVal = findValue(row, ['email', 'emailaddress', 'supplier_email', 'mail']);
            const phoneVal = findValue(row, ['phone', 'phonenumber', 'phone_number', 'mobile', 'contact']);
            const addressVal = findValue(row, ['address', 'supplier_address', 'location']);

            if (!name || !String(name).trim()) {
                errorCount++;
                errors.push({
                    row: rowNumber,
                    name: 'N/A',
                    reason: 'Supplier Name is required'
                });
                continue;
            }

            const cleanName = String(name).trim();
            const email = emailVal ? String(emailVal).trim() : null;
            const phone = phoneVal ? String(phoneVal).trim() : null;
            const address = addressVal ? String(addressVal).trim() : null;

            // Check if name already exists case-insensitively
            const duplicateCheck = await conn.query('SELECT id, email, phone, address FROM SUPPLIERS WHERE LOWER(name) = LOWER(?)', [cleanName]);
            if (duplicateCheck.length > 0) {
                const existing = duplicateCheck[0];
                
                // Merge/update fields (overwrite with spreadsheet values if provided, otherwise preserve DB values)
                const updatedEmail = email !== null && email !== undefined && String(email).trim() !== '' ? String(email).trim() : existing.email;
                const updatedPhone = phone !== null && phone !== undefined && String(phone).trim() !== '' ? String(phone).trim() : existing.phone;
                const updatedAddress = address !== null && address !== undefined && String(address).trim() !== '' ? String(address).trim() : existing.address;

                await conn.query(
                    'UPDATE SUPPLIERS SET email = ?, phone = ?, address = ?, name = ? WHERE id = ?',
                    [updatedEmail, updatedPhone, updatedAddress, cleanName, existing.id]
                );
                successCount++;
                continue;
            }

            // Insert Supplier
            await conn.query(
                'INSERT INTO SUPPLIERS (name, email, phone, address) VALUES (?, ?, ?, ?)',
                [cleanName, email, phone, address]
            );

            successCount++;
        }

        await conn.commit();

        // Log central audit trail
        await logToCentral(
            req.tenant.company_id,
            req.user.userId,
            req.user.email,
            'IMPORT_SUPPLIERS',
            'suppliers',
            null,
            null,
            { successCount, errorCount }
        );

        res.json({
            message: `Suppliers import complete. Succeeded: ${successCount}, Failed: ${errorCount}`,
            successCount,
            errorCount,
            errors
        });

    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch (rb) {}
        }
        console.error('[IMPORT] Suppliers catalog import transaction failed:', err);
        res.status(500).json({ message: 'Internal server error processing supplier data' });
    } finally {
        if (conn) conn.release();
    }
};
