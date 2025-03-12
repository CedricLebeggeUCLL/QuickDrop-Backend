-- Drop the database if it exists to start fresh
DROP DATABASE IF EXISTS quickdrop_db;

-- Create the database
CREATE DATABASE quickdrop_db;

-- Use the database
USE quickdrop_db;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS deliveries;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS couriers;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS postal_codes;
DROP TABLE IF EXISTS users;

-- Postal_codes table
CREATE TABLE postal_codes (
  code VARCHAR(20) PRIMARY KEY,
  city VARCHAR(50) NOT NULL,
  country VARCHAR(50) NOT NULL
);

-- Addresses table
CREATE TABLE addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  street_name VARCHAR(100) NOT NULL,
  house_number VARCHAR(20) NOT NULL,
  extra_info VARCHAR(50),
  postal_code VARCHAR(20) NOT NULL,
  lat DECIMAL(10, 7) DEFAULT NULL,
  lng DECIMAL(10, 7) DEFAULT NULL,
  FOREIGN KEY (postal_code) REFERENCES postal_codes(code) ON DELETE RESTRICT ON UPDATE CASCADE
);

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
  pickup_address_id INT NOT NULL,
  dropoff_address_id INT NOT NULL,
  status ENUM('pending', 'assigned', 'in_transit', 'delivered') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pickup_address_id) REFERENCES addresses(id) ON DELETE RESTRICT,
  FOREIGN KEY (dropoff_address_id) REFERENCES addresses(id) ON DELETE RESTRICT
);

-- Couriers table
CREATE TABLE couriers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  current_address_id INT,
  start_address_id INT NOT NULL,
  destination_address_id INT NOT NULL,
  pickup_radius FLOAT DEFAULT 5.0,
  dropoff_radius FLOAT DEFAULT 5.0,
  availability BOOLEAN DEFAULT TRUE,
  itsme_code VARCHAR(50),
  license_number VARCHAR(50),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (current_address_id) REFERENCES addresses(id) ON DELETE SET NULL,
  FOREIGN KEY (start_address_id) REFERENCES addresses(id) ON DELETE RESTRICT,
  FOREIGN KEY (destination_address_id) REFERENCES addresses(id) ON DELETE RESTRICT
);

-- Deliveries table
CREATE TABLE deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  courier_id INT NOT NULL,
  pickup_address_id INT NOT NULL,
  dropoff_address_id INT NOT NULL,
  pickup_time DATETIME,
  delivery_time DATETIME,
  status ENUM('assigned', 'picked_up', 'in_transit', 'delivered') DEFAULT 'assigned',
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE,
  FOREIGN KEY (pickup_address_id) REFERENCES addresses(id) ON DELETE RESTRICT,
  FOREIGN KEY (dropoff_address_id) REFERENCES addresses(id) ON DELETE RESTRICT
);

-- Insert sample postal_codes
INSERT INTO postal_codes (code, city, country) VALUES
('1000', 'Brussels', 'Belgium'),
('1910', 'Kampenhout', 'Belgium'),
('2000', 'Antwerp', 'Belgium'),
('3300', 'Tienen', 'Belgium');

-- Insert sample addresses with coordinates
INSERT INTO addresses (street_name, house_number, extra_info, postal_code, lat, lng) VALUES
('Rue de la Loi', '100', NULL, '1000', 50.8442333, 4.375933), -- Brussels
('Meir', '50', NULL, '2000', 51.2182, 4.4051), -- Antwerp (vervanging voor Antwerpseweg)
('Boulevard Anspach', '20', 'Apt 5', '1000', 50.847647, 4.350648), -- Brussels
('Beemdstraat', '8', NULL, '1910', 50.9546577, 4.5623148), -- Kampenhout
('Sliksteenvest', '5', NULL, '3300', 50.8111583, 4.944302), -- Tienen
('Beemdstraat', '20', NULL, '1910', 50.9544901, 4.5650759), -- Kampenhout
('Sliksteenvest', '20', NULL, '3300', 50.8106101, 4.947437), -- Tienen
('Beemdstraat', '30', NULL, '1910', 50.95382, 4.5666648); -- Kampenhout

-- Insert sample users
INSERT INTO users (username, email, password, role) VALUES
('johndoe', 'john@example.com', 'hashed_password1', 'user'),
('janedoe', 'jane@example.com', 'hashed_password2', 'user'),
('bobsmith', 'bob@example.com', 'hashed_password3', 'courier'),
('adminuser', 'admin@quickdrop.com', 'hashed_password4', 'admin'),
('cedric', 'cedric@example.com', 'hashed_password5', 'user');

-- Insert sample packages
SET @pickup_addr_id1 = (SELECT id FROM addresses WHERE street_name = 'Rue de la Loi' AND house_number = '100');
SET @dropoff_addr_id1 = (SELECT id FROM addresses WHERE street_name = 'Meir' AND house_number = '50'); -- Gewijzigd naar Meir
SET @pickup_addr_id2 = (SELECT id FROM addresses WHERE street_name = 'Beemdstraat' AND house_number = '8');
SET @dropoff_addr_id2 = (SELECT id FROM addresses WHERE street_name = 'Sliksteenvest' AND house_number = '5');
SET @pickup_addr_id3 = (SELECT id FROM addresses WHERE street_name = 'Sliksteenvest' AND house_number = '5');
SET @dropoff_addr_id3 = (SELECT id FROM addresses WHERE street_name = 'Beemdstraat' AND house_number = '30');

INSERT INTO packages (user_id, description, pickup_address_id, dropoff_address_id, status) VALUES
(1, 'Gift for friend', @pickup_addr_id1, @dropoff_addr_id1, 'pending'),
(2, 'Study books', @dropoff_addr_id1, @pickup_addr_id1, 'assigned'),
(3, 'Boeken - Ontvanger: Cedric Lebegge, Gewicht: 5 kg', @pickup_addr_id2, @dropoff_addr_id2, 'pending'),
(4, 'Speelgoed - Ontvanger: Piet, Gewicht: 1 kg', @pickup_addr_id2, @dropoff_addr_id2, 'pending'),
(5, 'TV - Ontvanger: Cedric Lebegge, Gewicht: 1 kg', @pickup_addr_id3, @dropoff_addr_id3, 'pending');

-- Get user IDs for couriers
SET @bobsmith_id = (SELECT id FROM users WHERE username = 'bobsmith');
SET @adminuser_id = (SELECT id FROM users WHERE username = 'adminuser');

-- Get address IDs for couriers
SET @current_addr_id = (SELECT id FROM addresses WHERE street_name = 'Boulevard Anspach' AND house_number = '20');
SET @start_addr_id = (SELECT id FROM addresses WHERE street_name = 'Rue de la Loi' AND house_number = '100');
SET @dest_addr_id = (SELECT id FROM addresses WHERE street_name = 'Meir' AND house_number = '50'); -- Gewijzigd naar Meir

-- Insert sample couriers
INSERT INTO couriers (user_id, current_address_id, start_address_id, destination_address_id, pickup_radius, dropoff_radius, availability, itsme_code, license_number) VALUES
(@bobsmith_id, @current_addr_id, @start_addr_id, @dest_addr_id, 10.0, 15.0, TRUE, 'ITSME123', 'ABC123456'),
(@adminuser_id, @dest_addr_id, @dest_addr_id, @start_addr_id, 5.0, 5.0, TRUE, 'ITSME456', NULL);

-- Get courier IDs for deliveries
SET @bobsmith_courier_id = (SELECT id FROM couriers WHERE user_id = @bobsmith_id);

-- Insert sample deliveries
INSERT INTO deliveries (package_id, courier_id, pickup_address_id, dropoff_address_id, pickup_time, status) VALUES
(2, @bobsmith_courier_id, @dropoff_addr_id1, @pickup_addr_id1, '2023-10-01 12:00:00', 'picked_up');