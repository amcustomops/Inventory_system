const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categoriesController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.get('/', categoriesController.getAllCategories);
router.post('/', authorizeRole('owner', 'manager'), categoriesController.createCategory);

module.exports = router;
