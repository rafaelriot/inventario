CREATE DATABASE IF NOT EXISTS inventario_obra;
USE inventario_obra;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'supervisor') NOT NULL DEFAULT 'supervisor',
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Materials table
CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  unit VARCHAR(20) NOT NULL,
  current_stock DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  min_stock DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  category VARCHAR(50) NOT NULL DEFAULT 'Otros',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  contact VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table (Obras/Construcciones)
CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  location VARCHAR(200),
  status ENUM('active', 'paused', 'completed') NOT NULL DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Purchases table (Entradas)
CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  purchase_date DATE NOT NULL,
  provider VARCHAR(150) NOT NULL,
  provider_id INT DEFAULT NULL,
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (provider_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- Usages table (Salidas / Gastos)
CREATE TABLE IF NOT EXISTS usages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  usage_date DATE NOT NULL,
  responsible VARCHAR(100) NOT NULL,
  project_id INT DEFAULT NULL,
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Mixtures table (recipes/formulas)
CREATE TABLE IF NOT EXISTS mixtures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  unit VARCHAR(20) NOT NULL,
  description TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Mixture Components table
CREATE TABLE IF NOT EXISTS mixture_components (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mixture_id INT NOT NULL,
  material_id INT NOT NULL,
  percentage DECIMAL(5, 2) NOT NULL,
  FOREIGN KEY (mixture_id) REFERENCES mixtures(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  UNIQUE KEY unique_mixture_material (mixture_id, material_id)
);

-- Mixture Usages table (shipment/usage history)
CREATE TABLE IF NOT EXISTS mixture_usages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mixture_id INT NOT NULL,
  total_quantity DECIMAL(10, 2) NOT NULL,
  usage_date DATE NOT NULL,
  responsible VARCHAR(100) NOT NULL,
  project_id INT DEFAULT NULL,
  user_id INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mixture_id) REFERENCES mixtures(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
