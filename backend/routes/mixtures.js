const express = require('express');
const router = express.Router();
const mixturesController = require('../controllers/mixturesController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, mixturesController.getMixtures);
router.get('/:id', authenticateToken, mixturesController.getMixtureById);
router.post('/', authenticateToken, mixturesController.createMixture);
router.put('/:id', authenticateToken, mixturesController.updateMixture);
router.delete('/:id', authenticateToken, requireAdmin, mixturesController.deleteMixture);
router.post('/:id/usage', authenticateToken, mixturesController.registerMixtureUsage);
router.get('/:id/history', authenticateToken, mixturesController.getMixtureHistory);

module.exports = router;
