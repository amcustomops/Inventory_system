const centralPool = require('./db');
const tenantDbManager = require('./utils/tenantDbManager');
const tenantContext = require('./utils/context');
const onboardingService = require('./services/onboardingService');
const mariadb = require('mariadb');
require('dotenv').config();

async function runTests() {
    console.log('=== STARTING TENANT ISOLATION INTEGRATION TESTS ===');
    
    const tenantA = 'tenant-alpha';
    const tenantB = 'tenant-beta';

    try {
        // 1. Onboard two distinct tenants
        console.log('\n[Test 1] Provisioning Tenant Alpha and Tenant Beta...');
        
        const detailsA = await onboardingService.onboardCompany({
            companyName: 'Alpha Corporation',
            tenantId: tenantA,
            ownerName: 'Alpha Admin',
            ownerEmail: 'admin@alpha.com',
            password: 'PasswordAlpha2026!',
            planId: 1
        });
        console.log(`  Tenant Alpha Database created: ${detailsA.dbName}`);

        const detailsB = await onboardingService.onboardCompany({
            companyName: 'Beta Systems',
            tenantId: tenantB,
            ownerName: 'Beta Admin',
            ownerEmail: 'admin@beta.com',
            password: 'PasswordBeta2026!',
            planId: 1
        });
        console.log(`  Tenant Beta Database created: ${detailsB.dbName}`);

        // 2. Validate DB pools
        console.log('\n[Test 2] Resolving Connection Pools...');
        const poolA = await tenantDbManager.getTenantPool(tenantA, detailsA.dbName);
        const poolB = await tenantDbManager.getTenantPool(tenantB, detailsB.dbName);

        if (poolA === poolB) {
            throw new Error('FAIL: Connection manager returned the same pool for different tenants!');
        }
        console.log('  SUCCESS: Connection manager resolved distinct connection pools.');

        // 3. Test isolation under AsyncLocalStorage context
        console.log('\n[Test 3] Verifying AsyncLocalStorage Isolation Context...');
        
        let connA, connB;

        // Context Alpha
        await tenantContext.run(poolA, async () => {
            // Retrieve pool from context proxy (centralPool/db exports the wrapper)
            const currentPool = require('./db');
            connA = await currentPool.getConnection();
            
            // Insert product into Alpha
            await connA.query(
                "INSERT INTO PRODUCTS (name, sku, cost_price, selling_price, reorder_level) VALUES (?, ?, ?, ?, ?)",
                ['Alpha Product', 'SKU-ALPHA-101', 10.00, 20.00, 5]
            );
            console.log('  Inserted product in Alpha context.');
        });

        // Context Beta
        await tenantContext.run(poolB, async () => {
            const currentPool = require('./db');
            connB = await currentPool.getConnection();
            
            // Insert product into Beta
            await connB.query(
                "INSERT INTO PRODUCTS (name, sku, cost_price, selling_price, reorder_level) VALUES (?, ?, ?, ?, ?)",
                ['Beta Product', 'SKU-BETA-202', 15.00, 30.00, 10]
            );
            console.log('  Inserted product in Beta context.');
        });

        // 4. Assert isolation
        console.log('\n[Test 4] Asserting Data Isolation boundaries...');
        
        const alphaDbConn = await poolA.getConnection();
        const betaDbConn = await poolB.getConnection();

        const alphaProducts = await alphaDbConn.query("SELECT * FROM PRODUCTS");
        const betaProducts = await betaDbConn.query("SELECT * FROM PRODUCTS");

        alphaDbConn.release();
        betaDbConn.release();

        console.log(`  Alpha products: ${alphaProducts.map(p => p.sku).join(', ')}`);
        console.log(`  Beta products: ${betaProducts.map(p => p.sku).join(', ')}`);

        const alphaHasBeta = alphaProducts.some(p => p.sku === 'SKU-BETA-202');
        const betaHasAlpha = betaProducts.some(p => p.sku === 'SKU-ALPHA-101');

        if (alphaHasBeta || betaHasAlpha) {
            throw new Error('FAIL: Cross-tenant data leakage detected!');
        }

        console.log('  SUCCESS: Complete data segregation verified. No data leaked.');

        // Clean up test databases
        console.log('\n[Test 5] Cleaning up test databases...');
        let centralConn;
        try {
            centralConn = await centralPool.centralPool.getConnection();
            await centralConn.query(`DROP DATABASE IF EXISTS \`${detailsA.dbName}\``);
            await centralConn.query(`DROP DATABASE IF EXISTS \`${detailsB.dbName}\``);
            await centralConn.query("DELETE FROM companies WHERE tenant_id IN (?, ?)", [tenantA, tenantB]);
            console.log('  SUCCESS: Test databases dropped and central catalog cleaned.');
        } finally {
            if (centralConn) centralConn.release();
        }

        console.log('\n=== ALL ISOLATION TESTS PASSED SUCCESSFULLY ===');

    } catch (err) {
        console.error('\n❌ TEST SUITE FAILED:', err);
    } finally {
        await tenantDbManager.shutdownAll();
        await centralPool.end();
    }
}

runTests();
