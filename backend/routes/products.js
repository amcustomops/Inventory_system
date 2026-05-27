const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

router.use(authenticateToken); // Protect all product routes

router.get('/', productsController.getAllProducts);
// Only owner and manager can create/delete/update products
router.post('/', authorizeRole('owner', 'manager'), productsController.createProduct);
router.put('/:id', authorizeRole('owner', 'manager'), productsController.updateProduct);
router.delete('/:id', authorizeRole('owner', 'manager'), productsController.deleteProduct);

module.exports = router;
