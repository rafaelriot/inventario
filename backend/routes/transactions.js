const express = require('express');
const router = express.Router();
const transactionsController = require('../controllers/transactionsController');
const { authenticateToken } = require('../middleware/auth');

router.post('/purchases', authenticateToken, transactionsController.addPurchase);
router.post('/usages', authenticateToken, transactionsController.addUsage);
router.get('/history', authenticateToken, transactionsController.getHistory);
router.get('/dashboard-summary', authenticateToken, transactionsController.getDashboardSummary);

module.exports = router;
