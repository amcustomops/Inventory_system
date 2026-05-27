const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliersController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.get('/', suppliersController.getAllSuppliers);
router.post('/', authorizeRole('owner', 'manager'), suppliersController.createSupplier);
router.put('/:id', authorizeRole('owner', 'manager'), suppliersController.updateSupplier);
router.delete('/:id', authorizeRole('owner', 'manager'), suppliersController.deleteSupplier);

module.exports = router;
