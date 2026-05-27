const express = require('express');
const router = express.Router();
const locationsController = require('../controllers/locationsController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.get('/', locationsController.getAllLocations);
router.post('/', authorizeRole('owner', 'manager'), locationsController.createLocation);

module.exports = router;
