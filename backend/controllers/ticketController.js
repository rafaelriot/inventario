const crypto = require('crypto');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const { pool } = require('../config/db');

// Create Ticket
exports.createTicket = async (req, res) => {
  const { material_id, quantity, vehicle_info } = req.body;
  const authorized_by = req.user.id; // Admin or supervisor creating it

  if (!material_id || !quantity || !vehicle_info) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }

  if (parseFloat(quantity) <= 0) {
    return res.status(400).json({ message: 'La cantidad debe ser mayor a cero.' });
  }

  try {
    // Check if material exists and has enough stock
    const [materialRows] = await pool.query('SELECT * FROM materials WHERE id = ?', [material_id]);
    if (materialRows.length === 0) {
      return res.status(404).json({ message: 'Material no encontrado.' });
    }
    const material = materialRows[0];

    if (parseFloat(material.current_stock) < parseFloat(quantity)) {
      return res.status(400).json({ 
        message: `Stock insuficiente. Disponible: ${material.current_stock} ${material.unit}.` 
      });
    }

    const qr_token = crypto.randomUUID();

    await pool.query(
      'INSERT INTO tickets (material_id, quantity, vehicle_info, authorized_by, status, qr_token) VALUES (?, ?, ?, ?, ?, ?)',
      [material_id, quantity, vehicle_info, authorized_by, 'pending', qr_token]
    );

    res.status(201).json({
      message: 'Ticket de carga generado con éxito.',
      qr_token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor al generar el ticket.' });
  }
};

// Get Ticket by Token (for scanning/reception screen preview)
exports.getTicketByToken = async (req, res) => {
  const { token } = req.params;

  try {
    const query = `
      SELECT 
        t.id, t.quantity, t.vehicle_info, t.status, t.created_at, t.received_at, t.qr_token,
        m.name AS material_name, m.unit AS material_unit,
        u_auth.name AS authorized_by_name,
        u_rec.name AS received_by_name
      FROM tickets t
      JOIN materials m ON t.material_id = m.id
      LEFT JOIN users u_auth ON t.authorized_by = u_auth.id
      LEFT JOIN users u_rec ON t.received_by = u_rec.id
      WHERE t.qr_token = ?
    `;
    const [rows] = await pool.query(query, [token]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Ticket no encontrado o inválido.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor al obtener el ticket.' });
  }
};

// Validate and Receive Ticket in Work Site (Scanned)
exports.receiveTicket = async (req, res) => {
  const { token } = req.params;
  const received_by = req.user.id; // Supervisor scanning

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Fetch ticket details
    const [ticketRows] = await connection.query(
      'SELECT * FROM tickets WHERE qr_token = ? FOR UPDATE',
      [token]
    );

    if (ticketRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Ticket no encontrado.' });
    }

    const ticket = ticketRows[0];

    if (ticket.status === 'received') {
      await connection.rollback();
      return res.status(400).json({ message: 'Este ticket ya fue recibido anteriormente.' });
    }

    if (ticket.status === 'cancelled') {
      await connection.rollback();
      return res.status(400).json({ message: 'Este ticket fue cancelado y no es válido.' });
    }

    // Check stock one more time
    const [materialRows] = await connection.query(
      'SELECT * FROM materials WHERE id = ? FOR UPDATE',
      [ticket.material_id]
    );
    const material = materialRows[0];

    if (parseFloat(material.current_stock) < parseFloat(ticket.quantity)) {
      await connection.rollback();
      return res.status(400).json({ 
        message: `No se puede validar. Stock insuficiente en almacén central (${material.current_stock} ${material.unit}).` 
      });
    }

    // Update stock
    await connection.query(
      'UPDATE materials SET current_stock = current_stock - ? WHERE id = ?',
      [ticket.quantity, ticket.material_id]
    );

    // Update ticket
    await connection.query(
      'UPDATE tickets SET status = "received", received_by = ?, received_at = CURRENT_TIMESTAMP WHERE id = ?',
      [received_by, ticket.id]
    );

    // Create usages entry (Salida / Gasto)
    const usage_date = new Date().toISOString().split('T')[0];
    const responsible = `Carga en Volteo: ${ticket.vehicle_info}`;
    await connection.query(
      'INSERT INTO usages (material_id, quantity, usage_date, responsible, user_id) VALUES (?, ?, ?, ?, ?)',
      [ticket.material_id, ticket.quantity, usage_date, responsible, received_by]
    );

    await connection.commit();
    res.json({ message: 'Material recibido e inventario actualizado con éxito.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor al recibir el material.' });
  } finally {
    connection.release();
  }
};

// Cancel Ticket
exports.cancelTicket = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT status FROM tickets WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Ticket no encontrado.' });
    }

    if (rows[0].status !== 'pending') {
      return res.status(400).json({ message: 'Solo se pueden cancelar tickets que estén pendientes.' });
    }

    await pool.query('UPDATE tickets SET status = "cancelled" WHERE id = ?', [id]);
    res.json({ message: 'Ticket cancelado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al cancelar el ticket.' });
  }
};

// List Tickets with filters
exports.getTickets = async (req, res) => {
  try {
    const query = `
      SELECT 
        t.id, t.quantity, t.vehicle_info, t.status, t.created_at, t.received_at, t.qr_token,
        m.name AS material_name, m.unit AS material_unit,
        u_auth.name AS authorized_by_name,
        u_rec.name AS received_by_name
      FROM tickets t
      JOIN materials m ON t.material_id = m.id
      LEFT JOIN users u_auth ON t.authorized_by = u_auth.id
      LEFT JOIN users u_rec ON t.received_by = u_rec.id
      ORDER BY t.created_at DESC
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener listado de tickets.' });
  }
};

// Generate Ticket PDF with embedded QR Code
exports.exportTicketPDF = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        t.id, t.quantity, t.vehicle_info, t.status, t.created_at, t.received_at, t.qr_token,
        m.name AS material_name, m.unit AS material_unit,
        u_auth.name AS authorized_by_name,
        u_rec.name AS received_by_name
      FROM tickets t
      JOIN materials m ON t.material_id = m.id
      LEFT JOIN users u_auth ON t.authorized_by = u_auth.id
      LEFT JOIN users u_rec ON t.received_by = u_rec.id
      WHERE t.id = ?
    `;
    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Ticket no encontrado.' });
    }

    const ticket = rows[0];

    // Generate QR code buffer (using JSON content or the validation URL)
    // The validation URL points to the validation flow
    const qrData = ticket.qr_token;
    const qrCodeBuffer = await QRCode.toBuffer(qrData, { type: 'png', margin: 1, width: 200 });

    const doc = new PDFDocument({ size: [300, 500], margin: 20 }); // Ticket size format
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Ticket_${ticket.id}.pdf`
    );

    doc.pipe(res);

    // Design layout
    doc
      .fillColor('#1E3A8A')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('TICKET DE CARGA', { align: 'center' });
    
    doc
      .fillColor('#4B5563')
      .fontSize(8)
      .font('Helvetica')
      .text('CONTROL DE INVENTARIO DE OBRA', { align: 'center' })
      .moveDown(1);

    // Decorative line
    doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(20, doc.y).lineTo(280, doc.y).stroke();
    doc.moveDown(1);

    // Details table-like info
    doc.fontSize(10);
    doc.fillColor('#1F2937').font('Helvetica-Bold').text('Folio: ', 20, doc.y, { continued: true })
       .font('Helvetica').text(`TK-${String(ticket.id).padStart(5, '0')}`);
    
    doc.font('Helvetica-Bold').text('Material: ', { continued: true })
       .font('Helvetica').text(ticket.material_name);
    
    doc.font('Helvetica-Bold').text('Cantidad: ', { continued: true })
       .font('Helvetica').text(`${parseFloat(ticket.quantity).toFixed(2)} ${ticket.material_unit}`);
    
    doc.font('Helvetica-Bold').text('Vehículo: ', { continued: true })
       .font('Helvetica').text(ticket.vehicle_info);
    
    doc.font('Helvetica-Bold').text('Autorizó: ', { continued: true })
       .font('Helvetica').text(ticket.authorized_by_name || 'Desconocido');
    
    doc.font('Helvetica-Bold').text('Fecha Carga: ', { continued: true })
       .font('Helvetica').text(new Date(ticket.created_at).toLocaleString());
    
    doc.font('Helvetica-Bold').text('Estado: ', { continued: true });
    if (ticket.status === 'received') {
      doc.fillColor('#10B981').text('ENTREGADO');
    } else if (ticket.status === 'cancelled') {
      doc.fillColor('#EF4444').text('CANCELADO');
    } else {
      doc.fillColor('#F59E0B').text('PENDIENTE EN RUTA');
    }
    doc.fillColor('#1F2937'); // reset color

    if (ticket.status === 'received' && ticket.received_at) {
      doc.font('Helvetica-Bold').text('Recibió: ', { continued: true })
         .font('Helvetica').text(ticket.received_by_name || 'Desconocido');
      doc.font('Helvetica-Bold').text('Fecha Recibió: ', { continued: true })
         .font('Helvetica').text(new Date(ticket.received_at).toLocaleString());
    }

    doc.moveDown(1);

    // Decorative line
    doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(20, doc.y).lineTo(280, doc.y).stroke();
    doc.moveDown(1);

    // Add QR Code
    if (ticket.status === 'pending') {
      doc.image(qrCodeBuffer, 50, doc.y, { width: 200 });
    } else {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#10B981').text('VALIDADO Y ENTREGADO', { align: 'center' });
      doc.fontSize(8).font('Helvetica').fillColor('#6B7280').text('Este ticket ya no es válido para recepción.', { align: 'center' });
    }

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al generar el PDF del ticket.' });
  }
};
