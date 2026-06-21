const { pool } = require('../config/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Export Excel report
exports.exportExcel = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Inventory
    const sheet1 = workbook.addWorksheet('Inventario Actual');
    sheet1.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nombre del Material', key: 'name', width: 30 },
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'Unidad', key: 'unit', width: 15 },
      { header: 'Stock Actual', key: 'current_stock', width: 15 },
      { header: 'Precio Unitario', key: 'unit_price', width: 15 },
      { header: 'Valor Inventario', key: 'total_value', width: 18 },
      { header: 'Stock Mínimo Alerta', key: 'min_stock', width: 20 },
      { header: 'Estado', key: 'status', width: 15 }
    ];

    const [materials] = await pool.query('SELECT * FROM materials ORDER BY name ASC');
    materials.forEach(m => {
      let status = 'Normal';
      if (parseFloat(m.current_stock) === 0) {
        status = 'Agotado';
      } else if (parseFloat(m.current_stock) <= parseFloat(m.min_stock)) {
        status = 'Stock Bajo';
      }
      sheet1.addRow({
        id: m.id,
        name: m.name,
        category: m.category || 'Otros',
        unit: m.unit,
        current_stock: parseFloat(m.current_stock),
        unit_price: parseFloat(m.unit_price),
        total_value: parseFloat(m.current_stock) * parseFloat(m.unit_price),
        min_stock: parseFloat(m.min_stock),
        status: status
      });
    });

    // Style headers
    sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheet1.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E3A8A' } // Dark blue
    };

    // Sheet 2: History
    const sheet2 = workbook.addWorksheet('Historial de Movimientos');
    sheet2.columns = [
      { header: 'Fecha', key: 'date', width: 15 },
      { header: 'Tipo', key: 'type', width: 12 },
      { header: 'Material', key: 'material_name', width: 30 },
      { header: 'Cantidad', key: 'quantity', width: 12 },
      { header: 'Unidad', key: 'unit', width: 12 },
      { header: 'Detalle (Proveedor/Responsable)', key: 'details', width: 35 },
      { header: 'Registrado Por', key: 'user_name', width: 20 }
    ];

    const historyQuery = `
      SELECT 
        p.purchase_date AS date,
        'Compra' AS type,
        m.name AS material_name,
        p.quantity,
        m.unit,
        p.provider AS details,
        u.name AS user_name
      FROM purchases p
      JOIN materials m ON p.material_id = m.id
      LEFT JOIN users u ON p.user_id = u.id
      
      UNION ALL
      
      SELECT 
        g.usage_date AS date,
        'Gasto' AS type,
        m.name AS material_name,
        g.quantity,
        m.unit,
        g.responsible AS details,
        u.name AS user_name
      FROM usages g
      JOIN materials m ON g.material_id = m.id
      LEFT JOIN users u ON g.user_id = u.id
      
      ORDER BY date DESC;
    `;

    const [history] = await pool.query(historyQuery);
    history.forEach(h => {
      // format date to YYYY-MM-DD
      const dateFormatted = new Date(h.date).toISOString().split('T')[0];
      sheet2.addRow({
        date: dateFormatted,
        type: h.type,
        material_name: h.material_name,
        quantity: parseFloat(h.quantity),
        unit: h.unit,
        details: h.details,
        user_name: h.user_name || 'N/A'
      });
    });

    sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheet2.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '10B981' } // Green emerald
    };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Reporte_Inventario_Construccion.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al generar reporte de Excel.' });
  }
};

// Export PDF report
exports.exportPDF = async (req, res) => {
  try {
    const [materials] = await pool.query('SELECT * FROM materials ORDER BY name ASC');

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Reporte_Inventario.pdf'
    );

    doc.pipe(res);

    // Header
    doc
      .fillColor('#1E3A8A')
      .fontSize(20)
      .text('CONSTRUCTORA - REPORTE DE INVENTARIO', { align: 'center' });
    
    doc
      .fillColor('#4B5563')
      .fontSize(10)
      .text(`Fecha de generación: ${new Date().toLocaleString()}`, { align: 'center' });
    
    doc.moveDown(2);

    // Table Header
    const tableTop = 150;
    doc.fillColor('#1F2937').fontSize(10).font('Helvetica-Bold');
    doc.text('Material', 50, tableTop);
    doc.text('Unidad', 200, tableTop);
    doc.text('Stock Act.', 270, tableTop, { width: 70, align: 'right' });
    doc.text('P. Unitario', 350, tableTop, { width: 80, align: 'right' });
    doc.text('Valor Total', 440, tableTop, { width: 100, align: 'right' });
    
    doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;
    doc.font('Helvetica');

    materials.forEach(m => {
      // Check pagination
      if (y > 700) {
        doc.addPage();
        y = 50;
        
        // Redraw headers on new page
        doc.fillColor('#1F2937').fontSize(10).font('Helvetica-Bold');
        doc.text('Material', 50, y);
        doc.text('Unidad', 200, y);
        doc.text('Stock Act.', 270, y, { width: 70, align: 'right' });
        doc.text('P. Unitario', 350, y, { width: 80, align: 'right' });
        doc.text('Valor Total', 440, y, { width: 100, align: 'right' });
        doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(50, y + 15).lineTo(550, y + 15).stroke();
        y += 25;
        doc.font('Helvetica');
      }

      // Check alert status colors
      const isLow = parseFloat(m.current_stock) <= parseFloat(m.min_stock);
      const isOut = parseFloat(m.current_stock) === 0;

      const stockVal = parseFloat(m.current_stock);
      const priceVal = parseFloat(m.unit_price);
      const totalVal = stockVal * priceVal;

      // Draw names/badges with alert colors
      if (isOut) {
        doc.fillColor('#EF4444');
      } else if (isLow) {
        doc.fillColor('#F59E0B');
      } else {
        doc.fillColor('#1F2937');
      }

      doc.fontSize(10).text(m.name, 50, y);
      
      // Secondary values in default charcoal
      doc.fillColor('#1F2937');
      doc.text(m.unit, 200, y);
      doc.text(stockVal.toFixed(2), 270, y, { width: 70, align: 'right' });
      doc.text(`$${priceVal.toFixed(2)}`, 350, y, { width: 80, align: 'right' });
      doc.text(`$${totalVal.toFixed(2)}`, 440, y, { width: 100, align: 'right' });

      // Draw category in small muted font
      doc.fillColor('#9CA3AF').fontSize(8).text(m.category || 'Otros', 50, y + 11);

      // Draw thin separator
      doc.strokeColor('#E5E7EB').lineWidth(0.5).moveTo(50, y + 22).lineTo(550, y + 22).stroke();

      y += 28;
    });

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error al generar reporte de PDF.' });
    }
  }
};
