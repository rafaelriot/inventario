const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initDatabase } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database structure and seed
initDatabase().then(() => {
  console.log('Database initialized successfully.');
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

// Import Routes
const authRoutes = require('./routes/auth');
const materialsRoutes = require('./routes/materials');
const transactionsRoutes = require('./routes/transactions');
const reportsRoutes = require('./routes/reports');
const suppliersRoutes = require('./routes/suppliers');
const ticketsRoutes = require('./routes/tickets');

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/tickets', ticketsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
