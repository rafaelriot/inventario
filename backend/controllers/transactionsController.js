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

// Get Dashboard summary for a specific project
exports.getProjectDashboardSummary = async (req, res) => {
  const { projectId } = req.params;

  try {
    // Verify project
    const [projRows] = await pool.query('SELECT id, name, status FROM projects WHERE id = ?', [projectId]);
    if (projRows.length === 0) {
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }

    const project = projRows[0];

    // Count distinct materials used by this project
    const [[{ total_materials_used }]] = await pool.query(
      'SELECT COUNT(DISTINCT material_id) as total_materials_used FROM usages WHERE project_id = ?',
      [projectId]
    );

    // Count usage records
    const [[{ total_usage_records }]] = await pool.query(
      'SELECT COUNT(*) as total_usage_records FROM usages WHERE project_id = ?',
      [projectId]
    );

    // Count mixture usage records
    const [[{ total_mixture_records }]] = await pool.query(
      'SELECT COUNT(*) as total_mixture_records FROM mixture_usages WHERE project_id = ?',
      [projectId]
    );

    // Top materials consumed with cost estimate
    const [topMaterials] = await pool.query(`
      SELECT 
        m.name,
        m.unit,
        m.unit_price,
        SUM(u.quantity) AS total_qty,
        SUM(u.quantity * m.unit_price) AS cost
      FROM usages u
      JOIN materials m ON u.material_id = m.id
      WHERE u.project_id = ?
      GROUP BY u.material_id, m.name, m.unit, m.unit_price
      ORDER BY cost DESC
    `, [projectId]);

    // Total estimated cost
    const estimated_cost = topMaterials.reduce((sum, m) => sum + parseFloat(m.cost || 0), 0);

    res.json({
      project_name: project.name,
      project_status: project.status,
      total_materials_used,
      total_usage_records,
      total_mixture_records,
      estimated_cost,
      top_materials: topMaterials.map(m => ({
        name: m.name,
        total_qty: parseFloat(m.total_qty),
        unit: m.unit,
        cost: parseFloat(m.cost || 0)
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el resumen del proyecto.' });
  }
};

// Advanced Dashboard — consolidated data endpoint
exports.getAdvancedDashboard = async (req, res) => {
  const { project_id, start_date, end_date } = req.query;

  try {
    // ─── 1. Inventory: all materials with semaphore status ───────
    const [materials] = await pool.query(
      'SELECT id, name, unit, current_stock, min_stock, unit_price, category FROM materials ORDER BY name ASC'
    );

    const inventory = materials.map(m => {
      const stock = parseFloat(m.current_stock);
      const min = parseFloat(m.min_stock);
      let status = 'normal';
      if (stock === 0) status = 'out';
      else if (stock <= min) status = 'low';
      return {
        id: m.id,
        name: m.name,
        unit: m.unit,
        current_stock: stock,
        min_stock: min,
        unit_price: parseFloat(m.unit_price),
        category: m.category || 'Otros',
        value: stock * parseFloat(m.unit_price),
        status
      };
    });

    // ─── 2. Build WHERE clauses for date/project filtering ──────
    const usageWhere = [];
    const usageParams = [];
    const mixtureWhere = [];
    const mixtureParams = [];

    if (project_id) {
      usageWhere.push('u.project_id = ?');
      usageParams.push(project_id);
      mixtureWhere.push('mu.project_id = ?');
      mixtureParams.push(project_id);
    }
    if (start_date) {
      usageWhere.push('u.usage_date >= ?');
      usageParams.push(start_date);
      mixtureWhere.push('mu.usage_date >= ?');
      mixtureParams.push(start_date);
    }
    if (end_date) {
      usageWhere.push('u.usage_date <= ?');
      usageParams.push(end_date);
      mixtureWhere.push('mu.usage_date <= ?');
      mixtureParams.push(end_date);
    }

    const usageWhereSQL = usageWhere.length > 0 ? 'WHERE ' + usageWhere.join(' AND ') : '';
    const mixtureWhereSQL = mixtureWhere.length > 0 ? 'WHERE ' + mixtureWhere.join(' AND ') : '';

    // ─── 3. KPIs ────────────────────────────────────────────────
    // Usage KPIs
    const [[usageKpis]] = await pool.query(`
      SELECT 
        COUNT(*) AS total_usage_records,
        COUNT(DISTINCT u.material_id) AS distinct_materials_used,
        COALESCE(SUM(u.quantity * m.unit_price), 0) AS estimated_cost
      FROM usages u
      JOIN materials m ON u.material_id = m.id
      ${usageWhereSQL}
    `, usageParams);

    // Mixture/Shipment KPIs
    const [[mixtureKpis]] = await pool.query(`
      SELECT 
        COUNT(*) AS total_shipments,
        COALESCE(SUM(mu.total_quantity), 0) AS total_mixture_quantity
      FROM mixture_usages mu
      ${mixtureWhereSQL}
    `, mixtureParams);

    // Inventory-level KPIs (always global, not filtered by date/project)
    const totalMaterials = inventory.length;
    const lowStockCount = inventory.filter(m => m.status === 'low').length;
    const outOfStockCount = inventory.filter(m => m.status === 'out').length;
    const totalValuation = inventory.reduce((sum, m) => sum + m.value, 0);

    const kpis = {
      total_materials: totalMaterials,
      low_stock: lowStockCount,
      out_of_stock: outOfStockCount,
      total_valuation: totalValuation,
      total_usage_records: usageKpis.total_usage_records,
      distinct_materials_used: usageKpis.distinct_materials_used,
      estimated_cost: parseFloat(usageKpis.estimated_cost),
      total_shipments: mixtureKpis.total_shipments,
      total_mixture_quantity: parseFloat(mixtureKpis.total_mixture_quantity)
    };

    // ─── 4. Consumption detail ──────────────────────────────────
    const [consumption] = await pool.query(`
      SELECT 
        u.id,
        u.quantity,
        u.usage_date,
        u.responsible,
        m.name AS material_name,
        m.unit,
        m.unit_price,
        (u.quantity * m.unit_price) AS line_cost,
        p.name AS project_name,
        usr.name AS user_name
      FROM usages u
      JOIN materials m ON u.material_id = m.id
      LEFT JOIN projects p ON u.project_id = p.id
      LEFT JOIN users usr ON u.user_id = usr.id
      ${usageWhereSQL}
      ORDER BY u.usage_date DESC, u.created_at DESC
      LIMIT 200
    `, usageParams);

    // ─── 5. Top materials consumed (aggregated) ─────────────────
    const [topMaterials] = await pool.query(`
      SELECT 
        m.id AS material_id,
        m.name,
        m.unit,
        m.unit_price,
        SUM(u.quantity) AS total_qty,
        SUM(u.quantity * m.unit_price) AS total_cost,
        COUNT(*) AS record_count
      FROM usages u
      JOIN materials m ON u.material_id = m.id
      ${usageWhereSQL}
      GROUP BY m.id, m.name, m.unit, m.unit_price
      ORDER BY total_qty DESC
      LIMIT 15
    `, usageParams);

    // ─── 6. Shipments (mixture_usages) ──────────────────────────
    const [shipments] = await pool.query(`
      SELECT 
        mu.id,
        mu.total_quantity,
        mu.usage_date,
        mu.responsible,
        mu.notes,
        mx.name AS mixture_name,
        mx.unit AS mixture_unit,
        p.name AS project_name,
        usr.name AS user_name
      FROM mixture_usages mu
      JOIN mixtures mx ON mu.mixture_id = mx.id
      LEFT JOIN projects p ON mu.project_id = p.id
      LEFT JOIN users usr ON mu.user_id = usr.id
      ${mixtureWhereSQL}
      ORDER BY mu.usage_date DESC, mu.created_at DESC
      LIMIT 200
    `, mixtureParams);

    // ─── 7. Project info (if filtered) ──────────────────────────
    let projectInfo = null;
    if (project_id) {
      const [projRows] = await pool.query('SELECT id, name, status, location FROM projects WHERE id = ?', [project_id]);
      if (projRows.length > 0) {
        projectInfo = projRows[0];
      }
    }

    res.json({
      inventory,
      kpis,
      consumption,
      top_materials: topMaterials.map(m => ({
        material_id: m.material_id,
        name: m.name,
        unit: m.unit,
        total_qty: parseFloat(m.total_qty),
        total_cost: parseFloat(m.total_cost),
        record_count: m.record_count
      })),
      shipments: shipments.map(s => ({
        id: s.id,
        quantity: parseFloat(s.total_quantity),
        date: s.usage_date,
        responsible: s.responsible,
        notes: s.notes,
        mixture_name: s.mixture_name,
        mixture_unit: s.mixture_unit,
        project_name: s.project_name,
        user_name: s.user_name
      })),
      project: projectInfo,
      filters: {
        project_id: project_id || null,
        start_date: start_date || null,
        end_date: end_date || null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener datos del dashboard avanzado.' });
  }
};
