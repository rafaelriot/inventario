const { pool } = require('../config/db');

// Get all projects (with optional status filter)
exports.getProjects = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT p.*, u.name AS creator_name
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.name ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener los proyectos.' });
  }
};

// Get a single project by ID
exports.getProjectById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT p.*, u.name AS creator_name
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el proyecto.' });
  }
};

// Create a new project
exports.createProject = async (req, res) => {
  const { name, description, location, status } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'El nombre del proyecto es obligatorio.' });
  }

  try {
    // Check uniqueness
    const [existing] = await pool.query('SELECT id FROM projects WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Ya existe un proyecto con ese nombre.' });
    }

    const [result] = await pool.query(
      'INSERT INTO projects (name, description, location, status, created_by) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, location || null, status || 'active', req.user.id]
    );

    res.status(201).json({ id: result.insertId, message: 'Proyecto creado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear el proyecto.' });
  }
};

// Update a project
exports.updateProject = async (req, res) => {
  const { id } = req.params;
  const { name, description, location, status } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'El nombre del proyecto es obligatorio.' });
  }

  try {
    // Check exists
    const [rows] = await pool.query('SELECT id FROM projects WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }

    // Check uniqueness excluding current
    const [existing] = await pool.query('SELECT id FROM projects WHERE name = ? AND id != ?', [name, id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Ya existe otro proyecto con ese nombre.' });
    }

    await pool.query(
      'UPDATE projects SET name = ?, description = ?, location = ?, status = ? WHERE id = ?',
      [name, description || null, location || null, status || 'active', id]
    );

    res.json({ message: 'Proyecto actualizado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el proyecto.' });
  }
};

// Delete a project
exports.deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM projects WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }
    res.json({ message: 'Proyecto eliminado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar el proyecto.' });
  }
};

// Get consumption report for a project
exports.getProjectConsumption = async (req, res) => {
  const { id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    // Verify project exists
    const [project] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (project.length === 0) {
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }

    // Get direct material usages for this project
    let usageQuery = `
      SELECT 
        u.id,
        u.quantity,
        u.usage_date,
        u.responsible,
        m.name AS material_name,
        m.unit,
        usr.name AS user_name,
        'material' AS source_type,
        NULL AS mixture_name
      FROM usages u
      JOIN materials m ON u.material_id = m.id
      LEFT JOIN users usr ON u.user_id = usr.id
      WHERE u.project_id = ?
    `;
    const params = [id];

    if (start_date) {
      usageQuery += ' AND u.usage_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      usageQuery += ' AND u.usage_date <= ?';
      params.push(end_date);
    }

    usageQuery += ' ORDER BY u.usage_date DESC, u.created_at DESC';

    const [usages] = await pool.query(usageQuery, params);

    // Get mixture usages for this project
    let mixtureQuery = `
      SELECT 
        mu.id,
        mu.total_quantity AS quantity,
        mu.usage_date,
        mu.responsible,
        mx.name AS material_name,
        mx.unit,
        usr.name AS user_name,
        'mixture' AS source_type,
        mx.name AS mixture_name
      FROM mixture_usages mu
      JOIN mixtures mx ON mu.mixture_id = mx.id
      LEFT JOIN users usr ON mu.user_id = usr.id
      WHERE mu.project_id = ?
    `;
    const mixParams = [id];

    if (start_date) {
      mixtureQuery += ' AND mu.usage_date >= ?';
      mixParams.push(start_date);
    }
    if (end_date) {
      mixtureQuery += ' AND mu.usage_date <= ?';
      mixParams.push(end_date);
    }

    mixtureQuery += ' ORDER BY mu.usage_date DESC, mu.created_at DESC';

    const [mixtureUsages] = await pool.query(mixtureQuery, mixParams);

    // Combine and sort
    const allConsumption = [...usages, ...mixtureUsages].sort((a, b) => {
      const dateA = new Date(a.usage_date);
      const dateB = new Date(b.usage_date);
      return dateB - dateA;
    });

    res.json({
      project: project[0],
      consumption: allConsumption,
      totals: {
        material_records: usages.length,
        mixture_records: mixtureUsages.length,
        total_records: allConsumption.length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el consumo del proyecto.' });
  }
};
