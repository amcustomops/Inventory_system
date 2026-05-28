const express = require('express');
const router = express.Router();
const multer = require('multer');
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

router.get('/', inventoryController.getInventory);

// Only owner and manager can perform stock adjustments
router.post('/transfer', authorizeRole('owner', 'manager'), inventoryController.transferStock);
router.post('/adjust', authorizeRole('owner', 'manager'), inventoryController.adjustStock);
router.post('/import', authorizeRole('owner', 'manager'), upload.single('file'), inventoryController.importInventory);

module.exports = router;
