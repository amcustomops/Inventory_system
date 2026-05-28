const express = require('express');
const router = express.Router();
const multer = require('multer');
const salesController = require('../controllers/salesController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

// All authenticated tenant users can view and record single sales transactions
router.get('/', salesController.getAllSales);
router.post('/', salesController.createSale);

// Bulk import is restricted to owners and managers
router.post('/import', authorizeRole('owner', 'manager'), upload.single('file'), salesController.importSales);

module.exports = router;
