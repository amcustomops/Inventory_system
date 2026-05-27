const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticateToken, authorizeRole } = require('../middlewares/authMiddleware');

router.use(authenticateToken);
router.use(authorizeRole('owner', 'manager'));

router.get('/', usersController.getUsers);
router.post('/', usersController.inviteUser);
router.put('/:id/status', usersController.toggleStatus);
router.delete('/:id', usersController.deleteUser);

module.exports = router;
