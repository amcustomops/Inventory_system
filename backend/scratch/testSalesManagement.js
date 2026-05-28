const mariadb = require('mariadb');
const xlsx = require('xlsx');
const salesController = require('../controllers/salesController');
require('dotenv').config();

// Simple mock helper for Express Response
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
    console.log('=== STARTING SALES HISTORY MANAGEMENT INTEGRATION TESTS ===');

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

        // 1. Get initial inventory level for product RICE-5001 (id = 1) at Main Warehouse (id = 1)
        const initialInv = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 1 AND location_id = 1');
        const initialQty = initialInv.length > 0 ? Number(initialInv[0].quantity) : 0;
        console.log(`Initial stock for RICE-5001 at Main Warehouse: ${initialQty}`);

        // Mock req object
        const mockReq = {
            db: {
                async getConnection() {
                    return pool.getConnection();
                }
            },
            user: { id: 1, email: 'owner@enterprise.com', role: 'owner' }
        };

        // -------------------------------------------------------------
        // Test 1: Retrieve Sales History
        // -------------------------------------------------------------
        console.log('\n--- Test 1: Fetching Sales History ---');
        const res1 = createMockRes();
        await salesController.getAllSales(mockReq, res1);
        console.log(`Status code: ${res1.statusCode}`);
        console.log(`Sales count retrieved: ${res1.jsonPayload?.length || 0}`);
        if (res1.statusCode !== 200) {
            throw new Error('Test 1 failed: Could not retrieve sales history');
        }

        // -------------------------------------------------------------
        // Test 2: Create valid sale transaction
        // -------------------------------------------------------------
        console.log('\n--- Test 2: Create Valid Sale (RICE-5001, 5 units) ---');
        const saleQty = 5;
        const res2 = createMockRes();
        mockReq.body = {
            product_id: 1,
            location_id: 1,
            quantity_sold: saleQty,
            sale_date: new Date().toISOString().split('T')[0]
        };
        await salesController.createSale(mockReq, res2);
        console.log(`Status code: ${res2.statusCode}`);
        console.log(`Response payload:`, res2.jsonPayload);

        if (res2.statusCode !== 201) {
            throw new Error(`Test 2 failed with status ${res2.statusCode}`);
        }

        // Assert quantity decremented
        const afterInv = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 1 AND location_id = 1');
        const afterQty = Number(afterInv[0].quantity);
        console.log(`Stock after sale: ${afterQty}`);
        if (afterQty !== initialQty - saleQty) {
            throw new Error(`Test 2 failed: expected ${initialQty - saleQty} stock, found ${afterQty}`);
        }

        // Assert stock movement logged
        const mv = await conn.query("SELECT * FROM STOCK_MOVEMENTS WHERE product_id = 1 AND location_id = 1 ORDER BY id DESC LIMIT 1");
        console.log('Stock movement logged:', mv[0]);
        if (!mv.length || mv[0].type !== 'OUT' || mv[0].reference_type !== 'SALE' || Number(mv[0].quantity) !== saleQty) {
            throw new Error('Test 2 failed: stock movement log mismatch');
        }

        // -------------------------------------------------------------
        // Test 3: Attempt sale with future date
        // -------------------------------------------------------------
        console.log('\n--- Test 3: Create Sale with Future Date (Should Fail) ---');
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 2); // 2 days in the future
        const res3 = createMockRes();
        mockReq.body = {
            product_id: 1,
            location_id: 1,
            quantity_sold: 2,
            sale_date: futureDate.toISOString().split('T')[0]
        };
        await salesController.createSale(mockReq, res3);
        console.log(`Status code: ${res3.statusCode}`);
        console.log(`Response payload:`, res3.jsonPayload);
        if (res3.statusCode !== 400 || !res3.jsonPayload?.message.includes('Future sale dates')) {
            throw new Error('Test 3 failed: future sale dates were not blocked');
        }

        // -------------------------------------------------------------
        // Test 4: Attempt sale with insufficient stock
        // -------------------------------------------------------------
        console.log('\n--- Test 4: Create Sale Exceeding Stock (Should Fail) ---');
        const res4 = createMockRes();
        mockReq.body = {
            product_id: 1,
            location_id: 1,
            quantity_sold: afterQty + 100, // exceeds current stock
            sale_date: new Date().toISOString().split('T')[0]
        };
        await salesController.createSale(mockReq, res4);
        console.log(`Status code: ${res4.statusCode}`);
        console.log(`Response payload:`, res4.jsonPayload);
        if (res4.statusCode !== 400 || !res4.jsonPayload?.message.includes('Insufficient stock')) {
            throw new Error('Test 4 failed: insufficient stock checks not triggered');
        }

        // -------------------------------------------------------------
        // Test 5: Excel Bulk Upload parser
        // -------------------------------------------------------------
        console.log('\n--- Test 5: Excel Bulk Upload parser ---');
        
        // Let's retrieve another product's stock levels to test clean inserts
        const prod2Inv = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 2 AND location_id = 1');
        const prod2Qty = prod2Inv.length > 0 ? Number(prod2Inv[0].quantity) : 0;
        console.log(`Initial stock for OIL-1001: ${prod2Qty}`);

        // Construct mock spreadsheet workbook
        const headers = ['product_id', 'location_id', 'quantity_sold', 'sale_date'];
        const dataRows = [
            // Row 1: Valid
            ['2', '1', '3', '2026-05-27'],
            // Row 2: Future Date (fails)
            ['2', '1', '2', futureDate.toISOString().split('T')[0]],
            // Row 3: Insufficient stock (fails)
            ['1', '1', (afterQty + 500).toString(), '2026-05-27'],
            // Row 4: Non-existent product ID (fails)
            ['9999', '1', '1', '2026-05-27'],
            // Row 5: Non-existent location ID (fails)
            ['2', '9999', '1', '2026-05-27']
        ];

        const sheetData = [headers, ...dataRows];
        const ws = xlsx.utils.aoa_to_sheet(sheetData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Sales');
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const mockImportReq = {
            db: {
                async getConnection() {
                    return pool.getConnection();
                }
            },
            file: { buffer: buf },
            tenant: { company_id: 1 },
            user: { userId: 1, email: 'owner@enterprise.com', role: 'owner' }
        };

        const res5 = createMockRes();
        await salesController.importSales(mockImportReq, res5);
        console.log(`Status code: ${res5.statusCode}`);
        console.log(`Response payload messages:`, res5.jsonPayload?.message);
        console.log(`Success count: ${res5.jsonPayload?.successCount}`);
        console.log(`Error count: ${res5.jsonPayload?.errorCount}`);
        console.log(`Errors log:`, res5.jsonPayload?.errors);

        if (res5.statusCode !== 200) {
            throw new Error(`Test 5 failed: Bulk upload failed with status ${res5.statusCode}`);
        }
        if (res5.jsonPayload.successCount !== 1) {
            throw new Error(`Test 5 failed: expected 1 success, found ${res5.jsonPayload.successCount}`);
        }
        if (res5.jsonPayload.errorCount !== 4) {
            throw new Error(`Test 5 failed: expected 4 warnings, found ${res5.jsonPayload.errorCount}`);
        }

        // Verify stock updated for OIL-1001
        const prod2InvAfter = await conn.query('SELECT quantity FROM INVENTORY WHERE product_id = 2 AND location_id = 1');
        const prod2QtyAfter = Number(prod2InvAfter[0].quantity);
        console.log(`Stock for OIL-1001 after bulk import: ${prod2QtyAfter}`);
        if (prod2QtyAfter !== prod2Qty - 3) {
            throw new Error(`Test 5 failed: expected OIL-1001 stock ${prod2Qty - 3}, found ${prod2QtyAfter}`);
        }

        console.log('\n=== ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY ===');

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
