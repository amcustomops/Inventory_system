const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken, checkAiEnabled } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/predictions/:product_id', checkAiEnabled, analyticsController.getPrediction);
router.get('/forecast/:product_id', checkAiEnabled, analyticsController.getForecast);
router.get('/classifications', checkAiEnabled, analyticsController.getClassifications);
router.get('/dead-stock', checkAiEnabled, analyticsController.getDeadStock);
router.get('/expiry-risk', checkAiEnabled, analyticsController.getExpiryRisk);

module.exports = router;
