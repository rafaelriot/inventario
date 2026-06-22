const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    // Check for concurrent active session (15 minutes activity check)
    const now = new Date();
    if (user.session_token && user.last_activity) {
      const lastActive = new Date(user.last_activity);
      const diffMinutes = (now - lastActive) / (1000 * 60);
      if (diffMinutes < 15) {
        return res.status(400).json({ 
          message: 'Este usuario ya tiene una sesión activa en otro dispositivo. Espera a que expire o cierra sesión en el otro equipo.' 
        });
      }
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'super_secret_construction_key_123',
      { expiresIn: '8h' }
    );

    // Save active session token
    await pool.query(
      'UPDATE users SET session_token = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
      [token, user.id]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión.' });
  }
};

exports.register = async (req, res) => {
  const { username, password, role, name } = req.body;

  if (!username || !password || !role || !name) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }

  try {
    // Check if username exists
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'El nombre de usuario ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, role, name]
    );

    res.status(201).json({ message: 'Usuario registrado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor al registrar usuario.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, role, name, created_at FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener perfil.' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, role, name, created_at FROM users ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener usuarios.' });
  }
};

exports.logout = async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET session_token = NULL, last_activity = NULL WHERE id = ?',
      [req.user.id]
    );
    res.json({ message: 'Sesión cerrada de forma segura.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al cerrar sesión.' });
  }
};
