CREATE DATABASE IF NOT EXISTS restaurant_management;
USE restaurant_management;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('customer', 'manager', 'admin') DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INT DEFAULT 0,
  status ENUM('available', 'low_stock', 'out_of_stock') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_number VARCHAR(20) NOT NULL UNIQUE,
  seats INT NOT NULL,
  status ENUM('available', 'reserved', 'occupied') DEFAULT 'available',
  zone VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  table_id INT NOT NULL,
  guest_count INT NOT NULL,
  reservation_time DATETIME NOT NULL,
  status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  table_id INT,
  total_amount DECIMAL(10,2) DEFAULT 0,
  status ENUM('pending', 'preparing', 'served', 'completed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

INSERT INTO users (name, email, password, role) VALUES
('Restaurant Admin', 'admin@restaurant.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin'),
('Floor Manager', 'manager@restaurant.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'manager')
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO menu_items (name, category, description, price, stock_quantity, status) VALUES
('Truffle Pasta', 'Main Course', 'Creamy pasta with parmesan and truffle oil.', 18.50, 15, 'available'),
('Smoked Burger', 'Main Course', 'Beef patty with cheddar, onions, and house sauce.', 14.00, 8, 'available'),
('Signature Mojito', 'Beverages', 'Mint, citrus, and sparkling refreshment.', 7.50, 20, 'available'),
('Molten Lava Cake', 'Desserts', 'Warm chocolate cake with vanilla cream.', 9.00, 4, 'low_stock');

INSERT INTO restaurant_tables (table_number, seats, status, zone) VALUES
('T1', 2, 'available', 'Window'),
('T2', 4, 'available', 'Center'),
('T3', 6, 'available', 'Private'),
('T4', 4, 'available', 'Garden')
ON DUPLICATE KEY UPDATE table_number = VALUES(table_number);
