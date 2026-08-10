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
const mixturesRoutes = require('./routes/mixtures');
const projectsRoutes = require('./routes/projects');

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/mixtures', mixturesRoutes);
app.use('/api/projects', projectsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Serve frontend static export if present or root fallback route
const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');
const frontendOutDir = path.join(__dirname, '../frontend/out');

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else if (fs.existsSync(frontendOutDir)) {
  app.use(express.static(frontendOutDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) return next();
    res.sendFile(path.join(frontendOutDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('<h1>API de Inventario de Obra</h1><p>El servidor Backend está activo. Para ver la interfaz web, sube los archivos compilados del frontend a la carpeta public_html de Hostinger.</p>');
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
