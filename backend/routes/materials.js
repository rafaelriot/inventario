const express = require('express');
const router = express.Router();
const materialsController = require('../controllers/materialsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, materialsController.getMaterials);
router.get('/:id', authenticateToken, materialsController.getMaterialById);
router.post('/', authenticateToken, materialsController.createMaterial);
router.put('/:id', authenticateToken, materialsController.updateMaterial);
router.delete('/:id', authenticateToken, requireAdmin, materialsController.deleteMaterial); // Delete is admin-only

module.exports = router;
