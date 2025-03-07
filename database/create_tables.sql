-- Drop the database if it exists to start fresh
DROP DATABASE IF EXISTS quickdrop_db;

-- Create the database
CREATE DATABASE quickdrop_db;

-- Use the database
USE quickdrop_db;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS deliveries;
DROP TABLE IF EXISTS couriers;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'courier', 'admin') DEFAULT 'user'
);

-- Packages table
CREATE TABLE packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  description TEXT,
  pickup_location JSON NOT NULL,
  dropoff_location JSON NOT NULL,
  pickup_address TEXT,
  dropoff_address TEXT,
  status ENUM('pending', 'assigned', 'in_transit', 'delivered') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Couriers table
CREATE TABLE couriers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  current_location JSON,
  destination JSON,
  pickup_radius FLOAT DEFAULT 5.0, -- in km
  dropoff_radius FLOAT DEFAULT 5.0, -- in km
  availability BOOLEAN DEFAULT TRUE,
  itsme_code VARCHAR(50), -- Nieuwe kolom voor Itsme-verificatiecode
  license_number VARCHAR(50), -- Nieuwe kolom voor rijbewijs/ID-nummer
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Deliveries table
CREATE TABLE deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  courier_id INT NOT NULL,
  pickup_location JSON NOT NULL,
  dropoff_location JSON NOT NULL,
  pickup_time DATETIME,
  delivery_time DATETIME,
  status ENUM('assigned', 'picked_up', 'in_transit', 'delivered') DEFAULT 'assigned',
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE
);

-- Insert sample users
INSERT INTO users (username, email, password, role) VALUES 
('johndoe', 'john@example.com', 'hashed_password1', 'user'),
('janedoe', 'jane@example.com', 'hashed_password2', 'user'),
('bobsmith', 'bob@example.com', 'hashed_password3', 'courier'),
('adminuser', 'admin@quickdrop.com', 'hashed_password4', 'admin');

-- Insert sample packages
INSERT INTO packages (user_id, description, pickup_location, dropoff_location, pickup_address, dropoff_address, status) VALUES 
(1, 'Gift for friend', '[50.8503, 4.3517]', '[51.2178, 4.4203]', 'Brussels Central', 'Antwerp Central', 'pending'),
(2, 'Study books', '[51.2178, 4.4203]', '[50.8503, 4.3517]', 'Antwerp Central', 'Brussels Central', 'assigned');

-- Get user IDs for couriers
SET @bobsmith_id = (SELECT id FROM users WHERE username = 'bobsmith');
SET @adminuser_id = (SELECT id FROM users WHERE username = 'adminuser');

-- Insert sample couriers met de nieuwe velden
INSERT INTO couriers (user_id, current_location, destination, pickup_radius, dropoff_radius, availability, itsme_code, license_number) VALUES 
(@bobsmith_id, '[50.8503, 4.3517]', '[51.2178, 4.4203]', 10.0, 15.0, TRUE, 'ITSME123', 'ABC123456'), -- Voorbeeldwaarden
(@adminuser_id, '[51.2178, 4.4203]', NULL, 5.0, 5.0, TRUE, 'ITSME456', NULL); -- license_number is optioneel

-- Get courier IDs for deliveries
SET @bobsmith_courier_id = (SELECT id FROM couriers WHERE user_id = @bobsmith_id);
SET @adminuser_courier_id = (SELECT id FROM couriers WHERE user_id = @adminuser_id);

-- Insert sample deliveries
INSERT INTO deliveries (package_id, courier_id, pickup_location, dropoff_location, pickup_time, delivery_time, status) VALUES 
(2, @bobsmith_courier_id, '[51.2178, 4.4203]', '[50.8503, 4.3517]', '2023-10-01 12:00:00', NULL, 'picked_up');