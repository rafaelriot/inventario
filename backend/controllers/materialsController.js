const { pool } = require('../config/db');

exports.getMaterials = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT *, (current_stock <= min_stock AND current_stock > 0) AS is_low_stock, (current_stock = 0) AS is_out_of_stock FROM materials ORDER BY name ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener los materiales.' });
  }
};

exports.getMaterialById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM materials WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Material no encontrado.' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el material.' });
  }
};

exports.createMaterial = async (req, res) => {
  const { name, unit, min_stock, current_stock, unit_price, category } = req.body;

  if (!name || !unit) {
    return res.status(400).json({ message: 'El nombre y la unidad son obligatorios.' });
  }

  const initialStock = current_stock ? parseFloat(current_stock) : 0;
  const alertStock = min_stock ? parseFloat(min_stock) : 0;
  const price = unit_price ? parseFloat(unit_price) : 0;

  try {
    // Check uniqueness
    const [existing] = await pool.query('SELECT id FROM materials WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Ya existe un material con ese nombre.' });
    }

    const [result] = await pool.query(
      'INSERT INTO materials (name, unit, current_stock, min_stock, unit_price, category) VALUES (?, ?, ?, ?, ?, ?)',
      [name, unit, initialStock, alertStock, price, category || 'Otros']
    );

    // If initial stock is > 0, we can also register this as an initial purchase/entry
    if (initialStock > 0) {
      await pool.query(
        'INSERT INTO purchases (material_id, quantity, purchase_date, provider, user_id) VALUES (?, ?, CURDATE(), ?, ?)',
        [result.insertId, initialStock, 'Inventario Inicial', req.user.id]
      );
    }

    res.status(201).json({ id: result.insertId, message: 'Material creado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear el material.' });
  }
};

exports.updateMaterial = async (req, res) => {
  const { id } = req.params;
  const { name, unit, min_stock, unit_price, category } = req.body;

  if (!name || !unit) {
    return res.status(400).json({ message: 'El nombre y la unidad son obligatorios.' });
  }

  try {
    // Check uniqueness excluding current
    const [existing] = await pool.query('SELECT id FROM materials WHERE name = ? AND id != ?', [name, id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Ya existe otro material con ese nombre.' });
    }

    await pool.query(
      'UPDATE materials SET name = ?, unit = ?, min_stock = ?, unit_price = ?, category = ? WHERE id = ?',
      [name, unit, min_stock || 0, unit_price || 0, category || 'Otros', id]
    );

    res.json({ message: 'Material actualizado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el material.' });
  }
};

exports.deleteMaterial = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM materials WHERE id = ?', [id]);
    res.json({ message: 'Material eliminado exitosamente del inventario.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar el material.' });
  }
};
