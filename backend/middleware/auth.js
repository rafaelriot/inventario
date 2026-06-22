const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token; // Format: Bearer TOKEN or ?token=...

  if (!token) {
    return res.status(401).json({ message: 'Token de acceso no proporcionado.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'super_secret_construction_key_123', async (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido o expirado.' });
    }

    try {
      // Confirm the token is still the active session token in the database
      const [rows] = await pool.query('SELECT session_token FROM users WHERE id = ?', [user.id]);
      if (rows.length === 0 || rows[0].session_token !== token) {
        return res.status(403).json({ message: 'Sesión invalidada. Se ha iniciado sesión en otro dispositivo.' });
      }

      // Update last activity to extend session
      await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

      req.user = user;
      next();
    } catch (dbErr) {
      console.error('Error verifying session in middleware:', dbErr);
      return res.status(500).json({ message: 'Error en el servidor al verificar la sesión.' });
    }
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin
};
