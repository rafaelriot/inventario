const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliersController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, suppliersController.getSuppliers);
router.get('/:id', authenticateToken, suppliersController.getSupplierById);
router.post('/', authenticateToken, suppliersController.createSupplier);
router.put('/:id', authenticateToken, suppliersController.updateSupplier);
router.delete('/:id', authenticateToken, requireAdmin, suppliersController.deleteSupplier); // Delete is admin-only

module.exports = router;
