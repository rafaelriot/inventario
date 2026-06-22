const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/register', authenticateToken, requireAdmin, authController.register); // Only admins can create users
router.get('/profile', authenticateToken, authController.getProfile);
router.get('/users', authenticateToken, requireAdmin, authController.getUsers);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
