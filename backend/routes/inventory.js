const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.get('/', inventoryController.getInventory);

// Only owner and manager can perform stock adjustments
router.post('/transfer', authorizeRole('owner', 'manager'), inventoryController.transferStock);
router.post('/adjust', authorizeRole('owner', 'manager'), inventoryController.adjustStock);

module.exports = router;
