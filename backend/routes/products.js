const express = require('express');
const router = express.Router();
const multer = require('multer');
const productsController = require('../controllers/productsController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken); // Protect all product routes

router.get('/', productsController.getAllProducts);
// Only owner and manager can create/delete/update products
router.post('/', authorizeRole('owner', 'manager'), productsController.createProduct);
router.post('/import', authorizeRole('owner', 'manager'), upload.single('file'), productsController.importProducts);
router.put('/:id', authorizeRole('owner', 'manager'), productsController.updateProduct);
router.delete('/:id', authorizeRole('owner', 'manager'), productsController.deleteProduct);

module.exports = router;
