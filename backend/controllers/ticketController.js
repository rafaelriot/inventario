const crypto = require('crypto');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const { pool } = require('../config/db');

// Create Ticket
exports.createTicket = async (req, res) => {
  const { material_id, quantity, num_trucks } = req.body;
  const authorized_by = req.user.id; // Admin or supervisor creating it

  if (!material_id || !quantity || !num_trucks) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }

  const trucksCount = parseInt(num_trucks);
  if (isNaN(trucksCount) || trucksCount <= 0) {
    return res.status(400).json({ message: 'La cantidad de volteos debe ser mayor a cero.' });
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

    const totalQuantity = parseFloat(quantity) * trucksCount;
    if (parseFloat(material.current_stock) < totalQuantity) {
      return res.status(400).json({ 
        message: `Stock insuficiente. Requerido: ${totalQuantity} ${material.unit}. Disponible: ${material.current_stock} ${material.unit}.` 
      });
    }

    const ticketIds = [];
    const batch_token = crypto.randomUUID();

    for (let i = 1; i <= trucksCount; i++) {
      const qr_token = crypto.randomUUID();
      const vehicle_info = `Volteo ${i} de ${trucksCount}`;

      const [insertResult] = await pool.query(
        'INSERT INTO tickets (material_id, quantity, vehicle_info, authorized_by, status, qr_token, batch_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [material_id, quantity, vehicle_info, authorized_by, 'pending', qr_token, batch_token]
      );
      ticketIds.push(insertResult.insertId);
    }

    const query = `
      SELECT 
        t.id, t.quantity, t.vehicle_info, t.status, t.created_at, t.qr_token, t.batch_token,
        m.name AS material_name, m.unit AS material_unit,
        u_auth.name AS authorized_by_name
      FROM tickets t
      JOIN materials m ON t.material_id = m.id
      LEFT JOIN users u_auth ON t.authorized_by = u_auth.id
      WHERE t.id IN (?)
    `;
    const [createdTickets] = await pool.query(query, [ticketIds]);

    res.status(201).json({
      message: `${trucksCount} tickets de carga generados con éxito.`,
      tickets: createdTickets
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
        t.id, t.quantity, t.vehicle_info, t.truck_number, t.license_plate, t.status, t.created_at, t.received_at, t.qr_token, t.batch_token,
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
  const { truck_number, license_plate } = req.body;
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
      'UPDATE tickets SET status = "received", received_by = ?, received_at = CURRENT_TIMESTAMP, truck_number = ?, license_plate = ? WHERE id = ?',
      [received_by, truck_number || null, license_plate || null, ticket.id]
    );

    // Create usages entry (Salida / Gasto)
    const usage_date = new Date().toISOString().split('T')[0];
    const responsible = `Vehículo: ${ticket.vehicle_info}${truck_number ? ` | Camión: ${truck_number}` : ''}${license_plate ? ` | Placa: ${license_plate}` : ''}`;
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
        t.id, t.quantity, t.vehicle_info, t.truck_number, t.license_plate, t.status, t.created_at, t.received_at, t.qr_token, t.batch_token,
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

// Helper function to render tickets in a Letter size page utilizing a 2x5 grid (10 tickets per page max)
const renderTicketsLetterGrid = async (doc, tickets) => {
  const ticketWidth = 276;
  const ticketHeight = 142;
  const gapX = 16;
  const gapY = 10;

  for (let index = 0; index < tickets.length; index++) {
    const ticket = tickets[index];
    const pageIndex = index % 10;

    if (index > 0 && pageIndex === 0) {
      doc.addPage();
    }

    const col = pageIndex % 2;
    const row = Math.floor(pageIndex / 2);

    const x = 20 + col * (ticketWidth + gapX);
    const y = 20 + row * (ticketHeight + gapY);

    // Draw card border
    doc.roundedRect(x, y, ticketWidth, ticketHeight, 8)
       .lineWidth(1)
       .strokeColor('#E2E8F0')
       .stroke();

    // Card Header background (dark navy slate-900)
    doc.fillColor('#0F172A')
       .roundedRect(x + 1, y + 1, ticketWidth - 2, 22, 7)
       .fill();
    // Overlap to make bottom corners flat
    doc.fillColor('#0F172A')
       .rect(x + 1, y + 12, ticketWidth - 2, 11)
       .fill();

    // Header Title
    doc.fillColor('#FFFFFF')
       .fontSize(8)
       .font('Helvetica-Bold')
       .text('TICKET DE DESPACHO', x + 8, y + 7, { width: ticketWidth - 16, align: 'left' });
    
    // Header Folio
    doc.fillColor('#94A3B8')
       .fontSize(7.5)
       .font('Helvetica-Bold')
       .text(`FOLIO: TK-${String(ticket.id).padStart(5, '0')}`, x + 8, y + 7, { width: ticketWidth - 16, align: 'right' });

    // Generate QR code buffer
    const qrSize = 80;
    const qrX = x + ticketWidth - qrSize - 8;
    const qrY = y + 28;

    // QR Code border card
    doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 4)
       .lineWidth(1)
       .strokeColor('#F1F5F9')
       .stroke();

    const qrCodeBuffer = await QRCode.toBuffer(ticket.qr_token, { type: 'png', margin: 0, width: qrSize });
    doc.image(qrCodeBuffer, qrX, qrY, { width: qrSize });

    // Unique QR text under it
    doc.fillColor('#64748B')
       .fontSize(5)
       .font('Helvetica-Bold')
       .text(`QR ÚNICO: ${ticket.qr_token.substring(0, 8).toUpperCase()}...`, qrX - 10, qrY + qrSize + 6, { width: qrSize + 20, align: 'center' });

    // Rows
    let detailY = y + 28;
    const drawRow = (label, value, isBlue = false) => {
      doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold').text(label, x + 8, detailY);
      doc.fillColor(isBlue ? '#2563EB' : '#0F172A')
         .fontSize(7.5)
         .font('Helvetica-Bold')
         .text(value, x + 50, detailY, { width: 125 });
      detailY += 13;
    };

    drawRow('Material:', ticket.material_name);
    drawRow('Cantidad:', `${parseFloat(ticket.quantity).toFixed(2)} ${ticket.material_unit}`, true);
    drawRow('Vehículo:', ticket.vehicle_info);
    drawRow('Autorizó:', ticket.authorized_by_name || 'Desconocido');
    
    if (ticket.truck_number) {
      drawRow('Camión:', `${ticket.truck_number} | Placa: ${ticket.license_plate || ''}`);
    } else {
      let stateText = 'PENDIENTE EN RUTA';
      let stateColor = '#F59E0B';
      if (ticket.status === 'received') {
        stateText = 'VALIDADO Y ENTREGADO';
        stateColor = '#10B981';
      } else if (ticket.status === 'cancelled') {
        stateText = 'CANCELADO';
        stateColor = '#EF4444';
      }
      doc.fillColor(stateColor)
         .fontSize(7.5)
         .font('Helvetica-Bold')
         .text(stateText, x + 8, detailY);
    }
  }
};

// Generate Ticket PDF with embedded QR Code
exports.exportTicketPDF = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        t.id, t.quantity, t.vehicle_info, t.truck_number, t.license_plate, t.status, t.created_at, t.received_at, t.qr_token,
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
    const doc = new PDFDocument({ size: 'letter', margin: 20 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Ticket_${ticket.id}.pdf`
    );

    doc.pipe(res);
    await renderTicketsLetterGrid(doc, [ticket]);
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al generar el PDF del ticket.' });
  }
};

// Generate printable PDF with multiple pages, each page is a ticket grid (matching letter grid format)
exports.printTicketsPDF = async (req, res) => {
  const { ids } = req.query; // comma-separated ids e.g. "1,2,3"
  if (!ids) {
    return res.status(400).json({ message: 'Se requieren IDs de tickets.' });
  }

  const idList = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
  if (idList.length === 0) {
    return res.status(400).json({ message: 'IDs de tickets inválidos.' });
  }

  try {
    const query = `
      SELECT 
        t.id, t.quantity, t.vehicle_info, t.truck_number, t.license_plate, t.status, t.created_at, t.received_at, t.qr_token, t.batch_token,
        m.name AS material_name, m.unit AS material_unit,
        u_auth.name AS authorized_by_name,
        u_rec.name AS received_by_name
      FROM tickets t
      JOIN materials m ON t.material_id = m.id
      LEFT JOIN users u_auth ON t.authorized_by = u_auth.id
      LEFT JOIN users u_rec ON t.received_by = u_rec.id
      WHERE t.id IN (?)
      ORDER BY t.id ASC
    `;
    
    const [tickets] = await pool.query(query, [idList]);
    if (tickets.length === 0) {
      return res.status(404).json({ message: 'No se encontraron tickets.' });
    }

    const doc = new PDFDocument({ size: 'letter', margin: 20 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Tickets_Impresion.pdf');
    doc.pipe(res);
    await renderTicketsLetterGrid(doc, tickets);
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al generar el PDF de impresión.' });
  }
};

// Bulk validate and receive offline scanned tickets
exports.bulkReceiveTickets = async (req, res) => {
  const { scans } = req.body; // Array of { qr_token, truck_number, license_plate, scanned_at }
  const received_by = req.user.id;

  if (!scans || !Array.isArray(scans) || scans.length === 0) {
    return res.status(400).json({ message: 'No se enviaron datos de escaneo.' });
  }

  const results = [];
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const scan of scans) {
      const { qr_token, truck_number, license_plate, scanned_at } = scan;

      try {
        // Find ticket
        const [ticketRows] = await connection.query(
          'SELECT * FROM tickets WHERE qr_token = ? FOR UPDATE',
          [qr_token]
        );

        if (ticketRows.length === 0) {
          results.push({ qr_token, success: false, message: 'Ticket no encontrado.' });
          continue;
        }

        const ticket = ticketRows[0];

        if (ticket.status === 'received') {
          results.push({ qr_token, success: true, ticket_id: ticket.id, message: 'Ya recibido anteriormente.' });
          continue;
        }

        if (ticket.status === 'cancelled') {
          results.push({ qr_token, success: false, message: 'Ticket cancelado e inválido.' });
          continue;
        }

        // Check stock
        const [materialRows] = await connection.query(
          'SELECT * FROM materials WHERE id = ? FOR UPDATE',
          [ticket.material_id]
        );
        const material = materialRows[0];

        if (parseFloat(material.current_stock) < parseFloat(ticket.quantity)) {
          results.push({ 
            qr_token, 
            success: false, 
            message: `Stock insuficiente en almacén central (${material.current_stock} ${material.unit}).` 
          });
          continue;
        }

        // Deduct stock
        await connection.query(
          'UPDATE materials SET current_stock = current_stock - ? WHERE id = ?',
          [ticket.quantity, ticket.material_id]
        );

        // Update ticket
        const receivedTime = scanned_at ? new Date(scanned_at) : new Date();
        await connection.query(
          'UPDATE tickets SET status = "received", received_by = ?, received_at = ?, truck_number = ?, license_plate = ? WHERE id = ?',
          [received_by, receivedTime, truck_number || null, license_plate || null, ticket.id]
        );

        // Record usage
        const usage_date = receivedTime.toISOString().split('T')[0];
        const responsible = `Vehículo: ${ticket.vehicle_info}${truck_number ? ` | Camión: ${truck_number}` : ''}${license_plate ? ` | Placa: ${license_plate}` : ''}`;
        await connection.query(
          'INSERT INTO usages (material_id, quantity, usage_date, responsible, user_id) VALUES (?, ?, ?, ?, ?)',
          [ticket.material_id, ticket.quantity, usage_date, responsible, received_by]
        );

        results.push({ qr_token, success: true, ticket_id: ticket.id, message: 'Validado con éxito.' });
      } catch (err) {
        console.error(`Error processing bulk scan for ${qr_token}:`, err);
        results.push({ qr_token, success: false, message: 'Error de servidor procesando este ticket.' });
      }
    }

    await connection.commit();
    res.json({
      message: 'Procesamiento de lote offline completado.',
      results
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Error general en el servidor procesando el lote.' });
  } finally {
    connection.release();
  }
};

