const express = require('express');
const router = express.Router();
const stockMovementsController = require('../controllers/stockMovementsController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.get('/', stockMovementsController.getMovements);
router.post('/', authorizeRole('owner', 'manager', 'warehouse'), stockMovementsController.createMovement);

module.exports = router;
