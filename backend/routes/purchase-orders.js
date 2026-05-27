const express = require('express');
const router = express.Router();
const purchaseOrdersController = require('../controllers/purchaseOrdersController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.get('/', purchaseOrdersController.getAllPurchaseOrders);
router.get('/:id', purchaseOrdersController.getPurchaseOrderById);
router.post('/', authorizeRole('owner', 'manager'), purchaseOrdersController.createPurchaseOrder);
router.post('/auto-generate', authorizeRole('owner', 'manager'), purchaseOrdersController.autoGeneratePO);
router.put('/:id', authorizeRole('owner', 'manager'), purchaseOrdersController.updatePurchaseOrder);
router.delete('/:id', authorizeRole('owner', 'manager'), purchaseOrdersController.deletePurchaseOrder);

module.exports = router;
