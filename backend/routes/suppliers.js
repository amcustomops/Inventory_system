const express = require('express');
const router = express.Router();
const multer = require('multer');
const suppliersController = require('../controllers/suppliersController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

router.get('/', suppliersController.getAllSuppliers);
router.post('/', authorizeRole('owner', 'manager'), suppliersController.createSupplier);
router.post('/import', authorizeRole('owner', 'manager'), upload.single('file'), suppliersController.importSuppliers);
router.put('/:id', authorizeRole('owner', 'manager'), suppliersController.updateSupplier);
router.delete('/:id', authorizeRole('owner', 'manager'), suppliersController.deleteSupplier);

module.exports = router;
