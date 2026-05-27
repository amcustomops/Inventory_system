const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

// Global protection: Only authenticated users with role SUPER_ADMIN can hit these endpoints
router.use(authenticateToken);
router.use(authorizeRole('SUPER_ADMIN'));

router.get('/metrics', adminController.getPlatformMetrics);
router.get('/tenants', adminController.getTenants);
router.post('/tenants', adminController.createTenant);
router.put('/tenants/:id/status', adminController.toggleTenantStatus);
router.get('/logs', adminController.getPlatformLogs);

module.exports = router;
