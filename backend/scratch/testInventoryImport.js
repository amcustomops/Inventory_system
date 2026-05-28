const mariadb = require('mariadb');
const xlsx = require('xlsx');
const inventoryController = require('../controllers/inventoryController');
const centralPool = require('../db');
require('dotenv').config();

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        jsonPayload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.jsonPayload = payload;
            return this;
        }
    };
}

async function runTests() {
    console.log('=== STARTING INVENTORY EXCEL IMPORT INTEGRATION TESTS ===');

    const dbName = 'tenant_primary';
    const pool = mariadb.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 4000,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: dbName,
        ssl: { rejectUnauthorized: false }
    });

    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Get initial inventory levels
        // OIL-1001 (id = 2) at Main Warehouse (id = 1)
        const oilInv = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 2 AND location_id = 1');
        const oilQty = oilInv.length > 0 ? Number(oilInv[0].quantity) : 0;
        console.log(`Initial stock for OIL-1001: ${oilQty}`);

        // RICE-5001 (id = 1) at Main Warehouse (id = 1)
        const riceInv = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 1 AND location_id = 1');
        const riceQty = riceInv.length > 0 ? Number(riceInv[0].quantity) : 0;
        console.log(`Initial stock for RICE-5001: ${riceQty}`);

        // PRO-2001 (id = 3) at Main Warehouse (id = 1)
        const proInv = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 3 AND location_id = 1');
        const proQty = proInv.length > 0 ? Number(proInv[0].quantity) : 0;
        console.log(`Initial stock for PRO-2001: ${proQty}`);

        // Check if there's any record for RICE-5001 at Retail Store (id = 2). If not, we will test auto-create
        // Actually, checkDbState logged that product 1, location 2 has stock = 60.
        // Let's find if there is any product/location combination with ZERO records.
        // E.g., Organic Sugar (SUG-3001, id = 4) at Retail Store (id = 2)
        const sugarInv = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 4 AND location_id = 2');
        console.log(`Initial sugar stock records at Retail Store: ${sugarInv.length}`);
        // Let's delete this inventory record if it exists to test auto-create
        if (sugarInv.length > 0) {
            await conn.query('DELETE FROM INVENTORY WHERE product_id = 4 AND location_id = 2');
            console.log('Cleared initial sugar stock record for auto-create testing.');
        }

        // Construct mock spreadsheet workbook
        const headers = ['product_id', 'location_id', 'quantity'];
        const dataRows = [
            // Row 1: Valid increment (target: oilQty + 10)
            ['2', '1', (oilQty + 10).toString()],
            // Row 2: Valid decrement (target: riceQty - 5)
            ['1', '1', (riceQty - 5).toString()],
            // Row 3: Valid override (target: 50)
            ['3', '1', '50'],
            // Row 4: Valid create (target: 12)
            ['4', '2', '12'],
            // Row 5: Negative quantity (fails)
            ['1', '1', '-10'],
            // Row 6: Non-existent product ID (fails)
            ['9999', '1', '5'],
            // Row 7: Non-existent Location ID (fails)
            ['2', '9999', '5'],
            // Row 8: Invalid format for product_id (fails)
            ['abc', '1', '5']
        ];

        const sheetData = [headers, ...dataRows];
        const ws = xlsx.utils.aoa_to_sheet(sheetData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Inventory');
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const mockReq = {
            db: {
                async getConnection() {
                    return pool.getConnection();
                }
            },
            file: { buffer: buf },
            tenant: { company_id: 1, tenant_id: 'primary', name: 'Legacy Main Enterprise' },
            user: { userId: 1, email: 'owner@enterprise.com', role: 'owner' }
        };

        const mockRes = createMockRes();
        await inventoryController.importInventory(mockReq, mockRes);

        console.log(`Status code: ${mockRes.statusCode}`);
        console.log(`Response payload:`, mockRes.jsonPayload?.message);
        console.log(`Success count: ${mockRes.jsonPayload?.successCount}`);
        console.log(`Error count: ${mockRes.jsonPayload?.errorCount}`);
        console.log(`Errors log:`, mockRes.jsonPayload?.errors);

        if (mockRes.statusCode !== 200) {
            throw new Error(`Inventory import failed with status ${mockRes.statusCode}`);
        }
        if (mockRes.jsonPayload.successCount !== 4) {
            throw new Error(`Expected 4 successes, found ${mockRes.jsonPayload.successCount}`);
        }
        if (mockRes.jsonPayload.errorCount !== 4) {
            throw new Error(`Expected 4 failures/warnings, found ${mockRes.jsonPayload.errorCount}`);
        }

        // Verify stock updates in database
        // OIL-1001 should be oilQty + 10
        const oilInvAfter = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 2 AND location_id = 1');
        const oilQtyAfter = Number(oilInvAfter[0].quantity);
        console.log(`OIL-1001 after stock: ${oilQtyAfter}`);
        if (oilQtyAfter !== oilQty + 10) {
            throw new Error(`OIL-1001 stock mismatch: expected ${oilQty + 10}, found ${oilQtyAfter}`);
        }

        // RICE-5001 should be riceQty - 5 (note: riceQty was already decremented by 5 in sales test, so we compare with original riceQty)
        const riceInvAfter = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 1 AND location_id = 1');
        const riceQtyAfter = Number(riceInvAfter[0].quantity);
        console.log(`RICE-5001 after stock: ${riceQtyAfter}`);
        if (riceQtyAfter !== riceQty - 5) {
            throw new Error(`RICE-5001 stock mismatch: expected ${riceQty - 5}, found ${riceQtyAfter}`);
        }

        // PRO-2001 should be exactly 50
        const proInvAfter = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 3 AND location_id = 1');
        const proQtyAfter = Number(proInvAfter[0].quantity);
        console.log(`PRO-2001 after stock (adjustment override): ${proQtyAfter}`);
        if (proQtyAfter !== 50) {
            throw new Error(`PRO-2001 stock mismatch: expected 50, found ${proQtyAfter}`);
        }

        // SUG-3001 should be created with quantity 12
        const sugarInvAfter = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 4 AND location_id = 2');
        const sugarQtyAfter = sugarInvAfter.length > 0 ? Number(sugarInvAfter[0].quantity) : 0;
        console.log(`SUG-3001 after stock (auto-created): ${sugarQtyAfter}`);
        if (sugarQtyAfter !== 12) {
            throw new Error(`SUG-3001 stock mismatch: expected 12, found ${sugarQtyAfter}`);
        }

        // Check central audit log count or if a log was recorded for IMPORT_INVENTORY
        // We can query the platform_audit_logs table in central DB
        const centralConn = await centralPool.centralPool.getConnection();
        try {
            const auditLogs = await centralConn.query(
                "SELECT * FROM platform_audit_logs WHERE action = 'IMPORT_INVENTORY' ORDER BY id DESC LIMIT 1"
            );
            console.log('Central platform audit log recorded:', auditLogs[0]);
            if (auditLogs.length === 0 || Number(auditLogs[0].company_id) !== 1) {
                throw new Error('Central audit log not found or company_id mismatch');
            }
        } finally {
            if (centralConn) centralConn.release();
        }

        console.log('\n=== ALL INVENTORY IMPORT TESTS COMPLETED SUCCESSFULLY ===');

    } catch (e) {
        console.error('\n❌ TEST RUN FAILED:', e.message);
        console.error(e);
        process.exit(1);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

runTests();
