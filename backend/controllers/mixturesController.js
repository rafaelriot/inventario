const { pool } = require('../config/db');

// Get all mixtures with their components
exports.getMixtures = async (req, res) => {
  try {
    const [mixtures] = await pool.query(`
      SELECT m.*, u.name AS creator_name
      FROM mixtures m
      LEFT JOIN users u ON m.created_by = u.id
      ORDER BY m.name ASC
    `);

    // Fetch components for each mixture
    for (const mixture of mixtures) {
      const [components] = await pool.query(`
        SELECT mc.id, mc.material_id, mc.percentage,
               mat.name AS material_name, mat.unit AS material_unit, mat.current_stock
        FROM mixture_components mc
        JOIN materials mat ON mc.material_id = mat.id
        WHERE mc.mixture_id = ?
        ORDER BY mc.percentage DESC
      `, [mixture.id]);
      mixture.components = components;
    }

    res.json(mixtures);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener las mezclas.' });
  }
};

// Get a single mixture by ID with components and stock info
exports.getMixtureById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT m.*, u.name AS creator_name
      FROM mixtures m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Mezcla no encontrada.' });
    }

    const mixture = rows[0];

    const [components] = await pool.query(`
      SELECT mc.id, mc.material_id, mc.percentage,
             mat.name AS material_name, mat.unit AS material_unit, mat.current_stock
      FROM mixture_components mc
      JOIN materials mat ON mc.material_id = mat.id
      WHERE mc.mixture_id = ?
      ORDER BY mc.percentage DESC
    `, [id]);

    mixture.components = components;

    res.json(mixture);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener la mezcla.' });
  }
};

// Create a new mixture with components
exports.createMixture = async (req, res) => {
  const { name, unit, description, components } = req.body;

  if (!name || !unit || !components || !Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ message: 'Nombre, unidad y al menos un componente son obligatorios.' });
  }

  // Validate percentages sum to 100
  const totalPercentage = components.reduce((sum, c) => sum + parseFloat(c.percentage || 0), 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    return res.status(400).json({ message: `Los porcentajes deben sumar 100%. Suma actual: ${totalPercentage.toFixed(2)}%` });
  }

  // Validate no duplicate materials
  const materialIds = components.map(c => c.material_id);
  if (new Set(materialIds).size !== materialIds.length) {
    return res.status(400).json({ message: 'No se puede agregar el mismo material más de una vez.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check name uniqueness
    const [existing] = await connection.query('SELECT id FROM mixtures WHERE name = ?', [name]);
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Ya existe una mezcla con ese nombre.' });
    }

    // Validate all materials exist
    for (const comp of components) {
      const [mat] = await connection.query('SELECT id FROM materials WHERE id = ?', [comp.material_id]);
      if (mat.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: `Material con ID ${comp.material_id} no encontrado.` });
      }
    }

    // Insert mixture
    const [result] = await connection.query(
      'INSERT INTO mixtures (name, unit, description, created_by) VALUES (?, ?, ?, ?)',
      [name, unit, description || null, req.user.id]
    );

    const mixtureId = result.insertId;

    // Insert components
    for (const comp of components) {
      await connection.query(
        'INSERT INTO mixture_components (mixture_id, material_id, percentage) VALUES (?, ?, ?)',
        [mixtureId, comp.material_id, parseFloat(comp.percentage)]
      );
    }

    await connection.commit();
    res.status(201).json({ id: mixtureId, message: 'Mezcla creada exitosamente.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Error al crear la mezcla.' });
  } finally {
    connection.release();
  }
};

// Update a mixture and its components
exports.updateMixture = async (req, res) => {
  const { id } = req.params;
  const { name, unit, description, components } = req.body;

  if (!name || !unit || !components || !Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ message: 'Nombre, unidad y al menos un componente son obligatorios.' });
  }

  // Validate percentages sum to 100
  const totalPercentage = components.reduce((sum, c) => sum + parseFloat(c.percentage || 0), 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    return res.status(400).json({ message: `Los porcentajes deben sumar 100%. Suma actual: ${totalPercentage.toFixed(2)}%` });
  }

  // Validate no duplicate materials
  const materialIds = components.map(c => c.material_id);
  if (new Set(materialIds).size !== materialIds.length) {
    return res.status(400).json({ message: 'No se puede agregar el mismo material más de una vez.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check mixture exists
    const [mixtureRows] = await connection.query('SELECT id FROM mixtures WHERE id = ?', [id]);
    if (mixtureRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Mezcla no encontrada.' });
    }

    // Check name uniqueness excluding current
    const [existing] = await connection.query('SELECT id FROM mixtures WHERE name = ? AND id != ?', [name, id]);
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Ya existe otra mezcla con ese nombre.' });
    }

    // Update mixture info
    await connection.query(
      'UPDATE mixtures SET name = ?, unit = ?, description = ? WHERE id = ?',
      [name, unit, description || null, id]
    );

    // Delete old components and re-insert
    await connection.query('DELETE FROM mixture_components WHERE mixture_id = ?', [id]);

    for (const comp of components) {
      await connection.query(
        'INSERT INTO mixture_components (mixture_id, material_id, percentage) VALUES (?, ?, ?)',
        [id, comp.material_id, parseFloat(comp.percentage)]
      );
    }

    await connection.commit();
    res.json({ message: 'Mezcla actualizada exitosamente.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar la mezcla.' });
  } finally {
    connection.release();
  }
};

// Delete a mixture (admin only)
exports.deleteMixture = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM mixtures WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Mezcla no encontrada.' });
    }
    res.json({ message: 'Mezcla eliminada exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar la mezcla.' });
  }
};

// Register a mixture usage/shipment — atomic stock deduction
exports.registerMixtureUsage = async (req, res) => {
  const { id } = req.params;
  const { total_quantity, usage_date, responsible, notes } = req.body;

  if (!total_quantity || !usage_date || !responsible) {
    return res.status(400).json({ message: 'Cantidad, fecha y responsable son obligatorios.' });
  }

  const totalQty = parseFloat(total_quantity);
  if (isNaN(totalQty) || totalQty <= 0) {
    return res.status(400).json({ message: 'La cantidad debe ser mayor que cero.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get mixture and its components
    const [mixtureRows] = await connection.query('SELECT * FROM mixtures WHERE id = ?', [id]);
    if (mixtureRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Mezcla no encontrada.' });
    }

    const mixture = mixtureRows[0];

    const [components] = await connection.query(`
      SELECT mc.material_id, mc.percentage,
             mat.name AS material_name, mat.current_stock, mat.unit AS material_unit
      FROM mixture_components mc
      JOIN materials mat ON mc.material_id = mat.id
      WHERE mc.mixture_id = ?
    `, [id]);

    if (components.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'La mezcla no tiene componentes definidos.' });
    }

    // Calculate required quantities and validate stock
    const deductions = [];
    const insufficientStock = [];

    for (const comp of components) {
      const requiredQty = parseFloat((totalQty * (comp.percentage / 100)).toFixed(2));
      const currentStock = parseFloat(comp.current_stock);

      deductions.push({
        material_id: comp.material_id,
        material_name: comp.material_name,
        material_unit: comp.material_unit,
        percentage: comp.percentage,
        required_qty: requiredQty,
        current_stock: currentStock
      });

      if (currentStock < requiredQty) {
        insufficientStock.push({
          material: comp.material_name,
          required: requiredQty,
          available: currentStock,
          unit: comp.material_unit
        });
      }
    }

    if (insufficientStock.length > 0) {
      await connection.rollback();
      const details = insufficientStock.map(s =>
        `${s.material}: necesita ${s.required} ${s.unit}, disponible ${s.available} ${s.unit}`
      ).join('; ');
      return res.status(400).json({
        message: `Stock insuficiente en los siguientes materiales: ${details}`,
        insufficient: insufficientStock
      });
    }

    // Insert mixture usage record
    await connection.query(
      'INSERT INTO mixture_usages (mixture_id, total_quantity, usage_date, responsible, user_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [id, totalQty, usage_date, responsible, req.user.id, notes || null]
    );

    // Deduct stock from each component material and register in usages table
    for (const ded of deductions) {
      // Insert into general usages table for history visibility
      await connection.query(
        'INSERT INTO usages (material_id, quantity, usage_date, responsible, user_id) VALUES (?, ?, ?, ?, ?)',
        [ded.material_id, ded.required_qty, usage_date, `Mezcla: ${mixture.name} — ${responsible}`, req.user.id]
      );

      // Deduct stock
      await connection.query(
        'UPDATE materials SET current_stock = current_stock - ? WHERE id = ?',
        [ded.required_qty, ded.material_id]
      );
    }

    await connection.commit();
    res.status(201).json({
      message: `Envío de ${totalQty} ${mixture.unit} de "${mixture.name}" registrado exitosamente.`,
      deductions
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Error al registrar el envío de la mezcla.' });
  } finally {
    connection.release();
  }
};

// Get mixture usage history
exports.getMixtureHistory = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT mu.*, u.name AS user_name, m.name AS mixture_name, m.unit AS mixture_unit
      FROM mixture_usages mu
      LEFT JOIN users u ON mu.user_id = u.id
      JOIN mixtures m ON mu.mixture_id = m.id
      WHERE mu.mixture_id = ?
      ORDER BY mu.usage_date DESC, mu.created_at DESC
      LIMIT 100
    `, [id]);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el historial de envíos.' });
  }
};
