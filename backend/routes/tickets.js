const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, ticketController.createTicket);
router.get('/', authenticateToken, ticketController.getTickets);
router.get('/token/:token', authenticateToken, ticketController.getTicketByToken);
router.post('/token/:token/receive', authenticateToken, ticketController.receiveTicket);
router.post('/:id/cancel', authenticateToken, ticketController.cancelTicket);
router.get('/:id/pdf', authenticateToken, ticketController.exportTicketPDF);

module.exports = router;
