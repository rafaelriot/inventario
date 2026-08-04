const express = require('express');
const router = express.Router();
const projectsController = require('../controllers/projectsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, projectsController.getProjects);
router.get('/:id', authenticateToken, projectsController.getProjectById);
router.post('/', authenticateToken, projectsController.createProject);
router.put('/:id', authenticateToken, projectsController.updateProject);
router.delete('/:id', authenticateToken, projectsController.deleteProject);
router.get('/:id/consumption', authenticateToken, projectsController.getProjectConsumption);

module.exports = router;
