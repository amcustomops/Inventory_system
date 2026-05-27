const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Tenant Resolver Middleware
const tenantResolver = require('./middlewares/tenantResolver');

// Initialize background queue worker
require('./jobs/worker');

// Middleware
app.use(cors());
app.use(express.json());
app.use(tenantResolver);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/products', require('./routes/products'));
app.use('/api/users', require('./routes/users'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/stock-movements', require('./routes/stock-movements'));
app.use('/api/purchase-orders', require('./routes/purchase-orders'));
app.use('/api/analytics', require('./routes/analytics'));

// Health Check Endpoint for Cron-job
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

// ML Service Status Endpoint
app.get('/api/ml-status', (req, res) => {
    res.json({ isRunning: isMlServiceRunning });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const PORT = process.env.PORT || 5000;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

let isMlServiceRunning = null;

const checkMlService = async () => {
    try {
        await axios.get(ML_SERVICE_URL);
        if (isMlServiceRunning !== true) {
            console.log('✅ ML service is running.');
            isMlServiceRunning = true;
        }
    } catch (error) {
        if (isMlServiceRunning !== false) {
            console.log('❌ ML service is not running. Start the ML service or wait for a few minutes.');
            isMlServiceRunning = false;
        }
    }
};

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Initial check and periodic polling
    checkMlService();
    setInterval(checkMlService, 10000);
});
