const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/excel', authenticateToken, reportsController.exportExcel);
router.get('/pdf', authenticateToken, reportsController.exportPDF);

module.exports = router;
