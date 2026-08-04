const { pool } = require('../config/db');

// Add purchase (Entrada)
exports.addPurchase = async (req, res) => {
  const { material_id, quantity, purchase_date, provider_id } = req.body;

  if (!material_id || !quantity || !purchase_date || !provider_id) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }

  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ message: 'La cantidad debe ser mayor que cero.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check if material exists
    const [materials] = await connection.query('SELECT id, current_stock FROM materials WHERE id = ?', [material_id]);
    if (materials.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Material no encontrado.' });
    }

    // Resolve supplier name
    let providerName = 'Proveedor Desconocido';
    const [suppliers] = await connection.query('SELECT name FROM suppliers WHERE id = ?', [provider_id]);
    if (suppliers.length > 0) {
      providerName = suppliers[0].name;
    }

    // Insert purchase
    await connection.query(
      'INSERT INTO purchases (material_id, quantity, purchase_date, provider_id, provider, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [material_id, qty, purchase_date, provider_id, providerName, req.user.id]
    );

    // Update material stock
    await connection.query(
      'UPDATE materials SET current_stock = current_stock + ? WHERE id = ?',
      [qty, material_id]
    );

    await connection.commit();
    res.status(201).json({ message: 'Compra registrada con éxito y stock actualizado.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Error al registrar la compra.' });
  } finally {
    connection.release();
  }
};

// Register usage (Salida / Gasto)
exports.addUsage = async (req, res) => {
  const { material_id, quantity, usage_date, responsible, project_id } = req.body;

  if (!material_id || !quantity || !usage_date || !responsible || !project_id) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios (incluido proyecto).' });
  }

  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ message: 'La cantidad debe ser mayor que cero.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check material and stock
    const [materials] = await connection.query('SELECT id, current_stock, name FROM materials WHERE id = ?', [material_id]);
    if (materials.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Material no encontrado.' });
    }

    const material = materials[0];
    if (parseFloat(material.current_stock) < qty) {
      await connection.rollback();
      return res.status(400).json({ 
        message: `Stock insuficiente. Stock actual de ${material.name}: ${material.current_stock}` 
      });
    }

    // Verify project exists and is active
    const [projects] = await connection.query('SELECT id, name, status FROM projects WHERE id = ?', [project_id]);
    if (projects.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }
    if (projects[0].status !== 'active') {
      await connection.rollback();
      return res.status(400).json({ message: `El proyecto "${projects[0].name}" no está activo (estado: ${projects[0].status}).` });
    }

    // Insert usage
    await connection.query(
      'INSERT INTO usages (material_id, quantity, usage_date, responsible, project_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [material_id, qty, usage_date, responsible, project_id, req.user.id]
    );

    // Update stock
    await connection.query(
      'UPDATE materials SET current_stock = current_stock - ? WHERE id = ?',
      [qty, material_id]
    );

    await connection.commit();
    res.status(201).json({ message: 'Gasto registrado con éxito y stock actualizado.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Error al registrar el gasto de material.' });
  } finally {
    connection.release();
  }
};

// Unified transaction history
exports.getHistory = async (req, res) => {
  try {
    const query = `
      SELECT 
        'compra' AS type,
        p.id,
        p.purchase_date AS date,
        p.quantity,
        p.provider AS details,
        m.name AS material_name,
        m.unit,
        u.name AS user_name,
        p.created_at,
        NULL AS project_name
      FROM purchases p
      JOIN materials m ON p.material_id = m.id
      LEFT JOIN users u ON p.user_id = u.id
      
      UNION ALL
      
      SELECT 
        'gasto' AS type,
        g.id,
        g.usage_date AS date,
        g.quantity,
        g.responsible AS details,
        m.name AS material_name,
        m.unit,
        u.name AS user_name,
        g.created_at,
        pr.name AS project_name
      FROM usages g
      JOIN materials m ON g.material_id = m.id
      LEFT JOIN users u ON g.user_id = u.id
      LEFT JOIN projects pr ON g.project_id = pr.id
      
      ORDER BY date DESC, created_at DESC
      LIMIT 100;
    `;

    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el historial de transacciones.' });
  }
};

// Get Dashboard summary stats
exports.getDashboardSummary = async (req, res) => {
  try {
    // Total materials
    const [[{ total_materials }]] = await pool.query('SELECT COUNT(*) as total_materials FROM materials');
    
    // Low stock materials count (excluding 0 stock)
    const [[{ low_stock }]] = await pool.query('SELECT COUNT(*) as low_stock FROM materials WHERE current_stock <= min_stock AND current_stock > 0');
    
    // Out of stock materials count
    const [[{ out_of_stock }]] = await pool.query('SELECT COUNT(*) as out_of_stock FROM materials WHERE current_stock = 0');

    // Total registered purchases and usages count
    const [[{ total_purchases }]] = await pool.query('SELECT COUNT(*) as total_purchases FROM purchases');
    const [[{ total_usages }]] = await pool.query('SELECT COUNT(*) as total_usages FROM usages');

    // Total valuation
    const [[{ total_valuation }]] = await pool.query('SELECT COALESCE(SUM(current_stock * unit_price), 0) as total_valuation FROM materials');

    res.json({
      total_materials,
      low_stock,
      out_of_stock,
      total_purchases,
      total_usages,
      total_valuation: parseFloat(total_valuation)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el resumen del dashboard.' });
  }
};
