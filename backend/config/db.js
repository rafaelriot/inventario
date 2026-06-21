const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventario_obra',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database schema and default admin
async function initDatabase() {
  let connection;
  try {
    // Connect without database selected to create database if not exists
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    // Create database
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'inventario_obra'}\`;`);
    await connection.end();

    // Verify/create tables
    const conn = await pool.getConnection();
    try {
      // Create Users table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role ENUM('admin', 'supervisor') NOT NULL DEFAULT 'supervisor',
          name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create Materials table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS materials (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          unit VARCHAR(20) NOT NULL,
          current_stock DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          min_stock DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      // Create Suppliers table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(150) NOT NULL UNIQUE,
          phone VARCHAR(20),
          contact VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create Purchases table (Entradas)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS purchases (
          id INT AUTO_INCREMENT PRIMARY KEY,
          material_id INT NOT NULL,
          quantity DECIMAL(10, 2) NOT NULL,
          purchase_date DATE NOT NULL,
          provider VARCHAR(150) NOT NULL,
          user_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
      `);

      // Create Usages table (Salidas / Gastos)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS usages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          material_id INT NOT NULL,
          quantity DECIMAL(10, 2) NOT NULL,
          usage_date DATE NOT NULL,
          responsible VARCHAR(100) NOT NULL,
          user_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
      `);

      // Check if unit_price column exists (in case table was created earlier)
      const [columnsPrice] = await conn.query('SHOW COLUMNS FROM materials LIKE "unit_price"');
      if (columnsPrice.length === 0) {
        await conn.query('ALTER TABLE materials ADD COLUMN unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00');
        console.log('Database upgraded: added unit_price to materials table');
      }

      // Check if category column exists
      const [columnsCat] = await conn.query('SHOW COLUMNS FROM materials LIKE "category"');
      if (columnsCat.length === 0) {
        await conn.query('ALTER TABLE materials ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT "Otros"');
        console.log('Database upgraded: added category to materials table');
      }

      // Check if provider_id column exists in purchases
      const [columnsProv] = await conn.query('SHOW COLUMNS FROM purchases LIKE "provider_id"');
      if (columnsProv.length === 0) {
        await conn.query('ALTER TABLE purchases ADD COLUMN provider_id INT DEFAULT NULL, ADD FOREIGN KEY (provider_id) REFERENCES suppliers(id) ON DELETE SET NULL');
        console.log('Database upgraded: added provider_id to purchases table');
      }

      // Seed default admin if not exists
      const [adminRows] = await conn.query('SELECT id FROM users WHERE username = "admin"');
      if (adminRows.length === 0) {
        const hashedAdminPassword = await bcrypt.hash('admin123', 10);
        await conn.query(
          'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
          ['admin', hashedAdminPassword, 'admin', 'Administrador General']
        );
        console.log('Database initialized: default admin (admin/admin123) created');
      }
      
      // Seed default supervisor if not exists
      const [supervisorRows] = await conn.query('SELECT id FROM users WHERE username = "supervisor"');
      if (supervisorRows.length === 0) {
        const hashedSupervisorPassword = await bcrypt.hash('supervisor123', 10);
        await conn.query(
          'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
          ['supervisor', hashedSupervisorPassword, 'supervisor', 'Supervisor de Obra']
        );
        console.log('Database initialized: default supervisor (supervisor/supervisor123) created');
      }

        // Seed some initial suppliers if empty
        const [suppliersCount] = await conn.query('SELECT COUNT(*) as count FROM suppliers');
        if (suppliersCount[0].count === 0) {
          await conn.query(`
            INSERT INTO suppliers (name, phone, contact) VALUES 
            ('Cementos del Norte', '555-0199', 'Ing. Andrés M.'),
            ('Aceros y Perfiles Jalapa', '555-0245', 'Carlos Ruiz'),
            ('Canteadora El Camino', '555-0311', 'Doña María S.');
          `);
          console.log('Database seeded with initial suppliers');
        }

        // Seed some initial materials for demonstration if empty
        const [materialsCount] = await conn.query('SELECT COUNT(*) as count FROM materials');
        if (materialsCount[0].count === 0) {
          await conn.query(`
            INSERT INTO materials (name, unit, current_stock, min_stock, unit_price, category) VALUES 
            ('Cemento Gris', 'Sacos', 50.00, 10.00, 160.00, 'Cemento/Pegamentos'),
            ('Varilla de Acero 3/8', 'Piezas', 120.00, 20.00, 45.00, 'Metales/Aceros'),
            ('Arena de Río', 'Metros Cúbicos', 15.00, 5.00, 320.00, 'Áridos/Arenas'),
            ('Grava 3/4', 'Metros Cúbicos', 20.00, 5.00, 350.00, 'Áridos/Arenas'),
            ('Clavos de 3 pulgadas', 'Kilogramos', 8.00, 10.00, 28.50, 'Metales/Aceros'); -- Will trigger stock alert
          `);
          console.log('Database seeded with initial construction materials');
        }
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

module.exports = {
  pool,
  initDatabase
};
