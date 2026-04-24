-- Run this in MySQL Workbench before starting the server
-- ============================================================

CREATE DATABASE IF NOT EXISTS event_system;
USE event_system;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  event_date DATETIME NOT NULL,
  capacity INT DEFAULT 100,
  organizer_id INT,
  status ENUM('active', 'cancelled', 'completed') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  status ENUM('confirmed', 'cancelled') DEFAULT 'confirmed',
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_registration (user_id, event_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ============================================================
-- Sample seed data (optional)
-- ============================================================

-- Note: password below is hashed "admin123" using bcrypt
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@events.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin'),
('Jane Doe', 'jane@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'user');

INSERT INTO events (title, description, location, event_date, capacity, organizer_id) VALUES
('Tech Summit 2025', 'Annual technology conference covering AI, Web Dev and more.', 'Karachi Convention Center', '2025-09-15 09:00:00', 200, 1),
('Web Dev Workshop', 'Hands-on Node.js and React workshop for beginners.', 'Online - Zoom', '2025-08-10 14:00:00', 50, 1),
('Startup Pitch Night', 'Present your startup idea to investors and mentors.', 'Lahore Tech Hub', '2025-10-01 18:00:00', 80, 1);
