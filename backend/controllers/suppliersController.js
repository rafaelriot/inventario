const { pool } = require('../config/db');

exports.getSuppliers = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener los proveedores.' });
  }
};

exports.getSupplierById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el proveedor.' });
  }
};

exports.createSupplier = async (req, res) => {
  const { name, phone, contact } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'El nombre del proveedor es obligatorio.' });
  }

  try {
    // Check uniqueness
    const [existing] = await pool.query('SELECT id FROM suppliers WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Ya existe un proveedor con ese nombre.' });
    }

    const [result] = await pool.query(
      'INSERT INTO suppliers (name, phone, contact) VALUES (?, ?, ?)',
      [name, phone || null, contact || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Proveedor creado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar el proveedor.' });
  }
};

exports.updateSupplier = async (req, res) => {
  const { id } = req.params;
  const { name, phone, contact } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'El nombre del proveedor es obligatorio.' });
  }

  try {
    // Check uniqueness excluding current
    const [existing] = await pool.query('SELECT id FROM suppliers WHERE name = ? AND id != ?', [name, id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Ya existe otro proveedor con ese nombre.' });
    }

    await pool.query(
      'UPDATE suppliers SET name = ?, phone = ?, contact = ? WHERE id = ?',
      [name, phone || null, contact || null, id]
    );

    res.json({ message: 'Proveedor actualizado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el proveedor.' });
  }
};

exports.deleteSupplier = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
    res.json({ message: 'Proveedor eliminado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar el proveedor.' });
  }
};
