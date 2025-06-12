-- Drop the database if it exists to start fresh
DROP DATABASE IF EXISTS quickdrop_db;

-- Create the database
CREATE DATABASE quickdrop_db;

-- Use the database
USE quickdrop_db;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS deliveries;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS courier_details;
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
  role ENUM('user', 'courier', 'admin') DEFAULT 'user',
  refreshToken VARCHAR(255) DEFAULT NULL,
  refreshTokenExpiry DATETIME DEFAULT NULL,
  resetToken VARCHAR(255) DEFAULT NULL,
  resetTokenExpiry DATETIME DEFAULT NULL
);

-- Courier_details table (for sensitive personal data)
CREATE TABLE courier_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  birth_date DATE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  encrypted_national_number VARCHAR(255) NOT NULL,
  nationality VARCHAR(50) NOT NULL,
  itsme_verified BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Couriers table
CREATE TABLE couriers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  start_address_id INT,
  destination_address_id INT,
  pickup_radius FLOAT DEFAULT 5.0,
  dropoff_radius FLOAT DEFAULT 5.0,
  availability BOOLEAN DEFAULT TRUE,
  current_lat DECIMAL(10, 7),
  current_lng DECIMAL(10, 7),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (start_address_id) REFERENCES addresses(id) ON DELETE SET NULL,
  FOREIGN KEY (destination_address_id) REFERENCES addresses(id) ON DELETE SET NULL
);

-- Packages table
CREATE TABLE packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  description TEXT,
  pickup_address_id INT NOT NULL,
  dropoff_address_id INT NOT NULL,
  action_type ENUM('send', 'receive') NOT NULL,
  category ENUM('package') DEFAULT 'package',
  size ENUM('small', 'medium', 'large') DEFAULT 'medium',
  status ENUM('pending', 'assigned', 'in_transit', 'delivered') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pickup_address_id) REFERENCES addresses(id) ON DELETE RESTRICT,
  FOREIGN KEY (dropoff_address_id) REFERENCES addresses(id) ON DELETE RESTRICT
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
('3300', 'Tienen', 'Belgium'),
('3001', 'Leuven', 'Belgium'),
('3000', 'Leuven', 'Belgium');

-- Insert sample addresses with coordinates
INSERT INTO addresses (street_name, house_number, extra_info, postal_code, lat, lng) VALUES
('Rue de la Loi', '100', NULL, '1000', 50.8442333, 4.375933),
('Meir', '50', NULL, '2000', 51.2182, 4.4051),
('Boulevard Anspach', '20', 'Apt 5', '1000', 50.847647, 4.350648),
('Beemdstraat', '8', NULL, '1910', 50.9546577, 4.5623148),
('Sliksteenvest', '5', NULL, '3300', 50.8111583, 4.944302),
('Beemdstraat', '20', NULL, '1910', 50.9544901, 4.5650759),
('Sliksteenvest', '20', NULL, '3300', 50.8106101, 4.947437),
('Beemdstraat', '30', NULL, '1910', 50.95382, 4.5666648);

-- Insert sample users with bcrypt-hashed passwords
INSERT INTO users (username, email, password, role, refreshToken, refreshTokenExpiry) VALUES
('johndoe', 'john@example.com', '$2b$10$kAy0Kxw5493cEH9sau8zg.ABKWDQ8yWtI0q7Ta2za9n7H00LKgK9y', 'user', NULL, NULL),
('janedoe', 'jane@example.com', '$2b$10$eKOUnYWvM9dF4Uo9krWScON3ZXMUn/aIMTyO4d7ARfPhBRIlSenUG', 'user', NULL, NULL),
('bobsmith', 'bob@example.com', '$2b$10$fMoOTioPa.esGnYX0daOKekCp.aTutJzq3oZssoUIJSd51gxe6t.C', 'courier', NULL, NULL),
('adminuser', 'admin@quickdrop.com', '$2b$10$rXlsB9m8zl.yYcgujJg48OZMm.kVdZItHiPxyjB.PElMDo1mCVB0m', 'admin', NULL, NULL),
('cedric', 'cedric@example.com', '$2b$10$P2PcEmK.HXjnYnIso5qBt.zHfNruztJUY/OWh6XhuAdwgN9Gq9DFu', 'user', NULL, NULL);

-- Insert sample courier_details
INSERT INTO courier_details (user_id, first_name, last_name, birth_date, phone_number, encrypted_national_number, nationality, itsme_verified)
SELECT id, 'Bob', 'Smith', '1985-05-15', '+32123456789', 'encrypted_national_number', 'Belgium', TRUE
FROM users WHERE username = 'bobsmith';

-- Insert sample couriers
INSERT INTO couriers (user_id, start_address_id, destination_address_id, pickup_radius, dropoff_radius, availability, current_lat, current_lng)
SELECT u.id, a1.id, a2.id, 10.0, 15.0, TRUE, NULL, NULL
FROM users u
JOIN addresses a1 ON a1.street_name = 'Rue de la Loi' AND a1.house_number = '100'
JOIN addresses a2 ON a2.street_name = 'Meir' AND a2.house_number = '50'
WHERE u.username = 'bobsmith';

INSERT INTO couriers (user_id, start_address_id, destination_address_id, pickup_radius, dropoff_radius, availability, current_lat, current_lng)
SELECT u.id, a1.id, a2.id, 5.0, 5.0, TRUE, NULL, NULL
FROM users u
JOIN addresses a1 ON a1.street_name = 'Meir' AND a1.house_number = '50'
JOIN addresses a2 ON a2.street_name = 'Rue de la Loi' AND a2.house_number = '100'
WHERE u.username = 'adminuser';

-- Insert sample packages (original)
SET @pickup_addr_id1 = (SELECT id FROM addresses WHERE street_name = 'Rue de la Loi' AND house_number = '100');
SET @dropoff_addr_id1 = (SELECT id FROM addresses WHERE street_name = 'Meir' AND house_number = '50');
SET @pickup_addr_id2 = (SELECT id FROM addresses WHERE street_name = 'Beemdstraat' AND house_number = '8');
SET @dropoff_addr_id2 = (SELECT id FROM addresses WHERE street_name = 'Sliksteenvest' AND house_number = '5');
SET @pickup_addr_id3 = (SELECT id FROM addresses WHERE street_name = 'Sliksteenvest' AND house_number = '5');
SET @dropoff_addr_id3 = (SELECT id FROM addresses WHERE street_name = 'Beemdstraat' AND house_number = '30');

INSERT INTO packages (user_id, description, pickup_address_id, dropoff_address_id, action_type, category, size, status, created_at) VALUES
(1, 'Gift for friend - Jane Doe, Weight: 2 kg', @pickup_addr_id1, @dropoff_addr_id1, 'send', 'package', 'medium', 'pending', CURRENT_TIMESTAMP),
(2, 'Study books - John Smith, Weight: 3 kg', @dropoff_addr_id1, @pickup_addr_id1, 'send', 'package', 'medium', 'assigned', CURRENT_TIMESTAMP),
(3, 'Books - Cedric Lebegge, Weight: 5 kg', @pickup_addr_id2, @dropoff_addr_id2, 'send', 'package', 'medium', 'pending', CURRENT_TIMESTAMP),
(4, 'Toys - Piet, Weight: 1 kg', @pickup_addr_id2, @dropoff_addr_id2, 'send', 'package', 'small', 'pending', CURRENT_TIMESTAMP),
(5, 'TV - Cedric Lebegge, Weight: 10 kg', @pickup_addr_id3, @dropoff_addr_id3, 'send', 'package', 'large', 'pending', CURRENT_TIMESTAMP);

-- Insert additional delivered packages for janedoe and bobsmith
-- January 2025: 3 packages (2 for janedoe, 1 for bobsmith)
INSERT INTO packages (user_id, description, pickup_address_id, dropoff_address_id, action_type, category, size, status, created_at) VALUES
(2, 'Clothes - Jane Doe, Weight: 1 kg', @pickup_addr_id1, @dropoff_addr_id2, 'send', 'package', 'small', 'delivered', '2025-01-05 10:00:00'),
(2, 'Electronics - Jane Doe, Weight: 4 kg', @pickup_addr_id2, @dropoff_addr_id1, 'send', 'package', 'medium', 'delivered', '2025-01-15 14:30:00'),
(3, 'Documents - Bob Smith, Weight: 0.5 kg', @pickup_addr_id3, @dropoff_addr_id2, 'send', 'package', 'small', 'delivered', '2025-01-20 09:00:00');

-- February 2025: 6 packages (3 for janedoe, 3 for bobsmith)
INSERT INTO packages (user_id, description, pickup_address_id, dropoff_address_id, action_type, category, size, status, created_at) VALUES
(2, 'Books - Jane Doe, Weight: 3 kg', @pickup_addr_id1, @dropoff_addr_id3, 'send', 'package', 'medium', 'delivered', '2025-02-03 11:00:00'),
(2, 'Gift box - Jane Doe, Weight: 2 kg', @pickup_addr_id2, @dropoff_addr_id1, 'send', 'package', 'medium', 'delivered', '2025-02-10 13:00:00'),
(2, 'Shoes - Jane Doe, Weight: 1.5 kg', @pickup_addr_id3, @dropoff_addr_id2, 'send', 'package', 'small', 'delivered', '2025-02-20 15:00:00'),
(3, 'Tools - Bob Smith, Weight: 5 kg', @pickup_addr_id1, @dropoff_addr_id2, 'send', 'package', 'large', 'delivered', '2025-02-05 08:30:00'),
(3, 'Clothing - Bob Smith, Weight: 2 kg', @pickup_addr_id2, @dropoff_addr_id3, 'send', 'package', 'medium', 'delivered', '2025-02-12 10:00:00'),
(3, 'Accessories - Bob Smith, Weight: 1 kg', @pickup_addr_id3, @dropoff_addr_id1, 'send', 'package', 'small', 'delivered', '2025-02-25 14:00:00');

-- March 2025: 4 packages (2 for janedoe, 2 for bobsmith)
INSERT INTO packages (user_id, description, pickup_address_id, dropoff_address_id, action_type, category, size, status, created_at) VALUES
(2, 'Furniture - Jane Doe, Weight: 10 kg', @pickup_addr_id1, @dropoff_addr_id2, 'send', 'package', 'large', 'delivered', '2025-03-07 09:00:00'),
(2, 'Toys - Jane Doe, Weight: 1 kg', @pickup_addr_id2, @dropoff_addr_id3, 'send', 'package', 'small', 'delivered', '2025-03-15 12:00:00'),
(3, 'Books - Bob Smith, Weight: 4 kg', @pickup_addr_id3, @dropoff_addr_id1, 'send', 'package', 'medium', 'delivered', '2025-03-10 10:00:00'),
(3, 'Electronics - Bob Smith, Weight: 3 kg', @pickup_addr_id1, @dropoff_addr_id2, 'send', 'package', 'medium', 'delivered', '2025-03-20 11:00:00');

-- April 2025: 5 packages (3 for janedoe, 2 for bobsmith) - Corrected user_id 15 to 2
INSERT INTO packages (user_id, description, pickup_address_id, dropoff_address_id, action_type, category, size, status, created_at) VALUES
(2, 'Kitchenware - Jane Doe, Weight: 6 kg', @pickup_addr_id2, @dropoff_addr_id1, 'send', 'package', 'large', 'delivered', '2025-04-05 14:00:00'),
(2, 'Clothes - Jane Doe, Weight: 2 kg', @pickup_addr_id3, @dropoff_addr_id2, 'send', 'package', 'medium', 'delivered', '2025-04-12 09:30:00'),
(2, 'Documents - Jane Doe, Weight: 0.5 kg', @pickup_addr_id1, @dropoff_addr_id3, 'send', 'package', 'small', 'delivered', '2025-04-20 11:00:00'),
(3, 'Gadgets - Bob Smith, Weight: 3 kg', @pickup_addr_id2, @dropoff_addr_id1, 'send', 'package', 'medium', 'delivered', '2025-04-08 10:00:00'),
(3, 'Books - Bob Smith, Weight: 2 kg', @pickup_addr_id3, @dropoff_addr_id2, 'send', 'package', 'medium', 'delivered', '2025-04-15 13:00:00');

-- May 2025: 2 packages (1 for janedoe, 1 for bobsmith)
INSERT INTO packages (user_id, description, pickup_address_id, dropoff_address_id, action_type, category, size, status, created_at) VALUES
(2, 'Jewelry - Jane Doe, Weight: 0.2 kg', @pickup_addr_id1, @dropoff_addr_id2, 'send', 'package', 'small', 'delivered', '2025-05-10 12:00:00'),
(3, 'Tools - Bob Smith, Weight: 5 kg', @pickup_addr_id2, @dropoff_addr_id3, 'send', 'package', 'large', 'delivered', '2025-05-15 09:00:00');

-- June 2025: 3 packages (2 for janedoe, 1 for bobsmith)
INSERT INTO packages (user_id, description, pickup_address_id, dropoff_address_id, action_type, category, size, status, created_at) VALUES
(2, 'Books - Jane Doe, Weight: 3 kg', @pickup_addr_id3, @dropoff_addr_id1, 'send', 'package', 'medium', 'delivered', '2025-06-05 10:00:00'),
(2, 'Clothes - Jane Doe, Weight: 1.5 kg', @pickup_addr_id1, @dropoff_addr_id2, 'send', 'package', 'small', 'delivered', '2025-06-10 14:00:00'),
(3, 'Electronics - Bob Smith, Weight: 2 kg', @pickup_addr_id2, @dropoff_addr_id3, 'send', 'package', 'medium', 'delivered', '2025-06-07 11:00:00');

-- Insert sample deliveries (original)
SET @bobsmith_courier_id = (SELECT id FROM couriers WHERE user_id = (SELECT id FROM users WHERE username = 'bobsmith'));
INSERT INTO deliveries (package_id, courier_id, pickup_address_id, dropoff_address_id, pickup_time, status) VALUES
(2, @bobsmith_courier_id, @dropoff_addr_id1, @pickup_addr_id1, '2025-01-10 12:00:00', 'picked_up');

-- Insert additional delivered deliveries for bobsmith
-- January 2025: 3 deliveries
INSERT INTO deliveries (package_id, courier_id, pickup_address_id, dropoff_address_id, pickup_time, delivery_time, status) VALUES
(6, @bobsmith_courier_id, @pickup_addr_id1, @dropoff_addr_id2, '2025-01-05 10:30:00', '2025-01-05 12:00:00', 'delivered'),
(7, @bobsmith_courier_id, @pickup_addr_id2, @dropoff_addr_id1, '2025-01-15 15:00:00', '2025-01-15 16:30:00', 'delivered'),
(8, @bobsmith_courier_id, @pickup_addr_id3, @dropoff_addr_id2, '2025-01-20 09:30:00', '2025-01-20 11:00:00', 'delivered');

-- February 2025: 6 deliveries
INSERT INTO deliveries (package_id, courier_id, pickup_address_id, dropoff_address_id, pickup_time, delivery_time, status) VALUES
(9, @bobsmith_courier_id, @pickup_addr_id1, @dropoff_addr_id3, '2025-02-03 11:30:00', '2025-02-03 13:00:00', 'delivered'),
(10, @bobsmith_courier_id, @pickup_addr_id2, @dropoff_addr_id1, '2025-02-10 13:30:00', '2025-02-10 15:00:00', 'delivered'),
(11, @bobsmith_courier_id, @pickup_addr_id3, @dropoff_addr_id2, '2025-02-20 15:30:00', '2025-02-20 17:00:00', 'delivered'),
(12, @bobsmith_courier_id, @pickup_addr_id1, @dropoff_addr_id2, '2025-02-05 09:00:00', '2025-02-05 10:30:00', 'delivered'),
(13, @bobsmith_courier_id, @pickup_addr_id2, @dropoff_addr_id3, '2025-02-12 10:30:00', '2025-02-12 12:00:00', 'delivered'),
(14, @bobsmith_courier_id, @pickup_addr_id3, @dropoff_addr_id1, '2025-02-25 14:30:00', '2025-02-25 16:00:00', 'delivered');

-- March 2025: 4 deliveries
INSERT INTO deliveries (package_id, courier_id, pickup_address_id, dropoff_address_id, pickup_time, delivery_time, status) VALUES
(15, @bobsmith_courier_id, @pickup_addr_id1, @dropoff_addr_id2, '2025-03-07 09:30:00', '2025-03-07 11:00:00', 'delivered'),
(16, @bobsmith_courier_id, @pickup_addr_id2, @dropoff_addr_id3, '2025-03-15 12:30:00', '2025-03-15 14:00:00', 'delivered'),
(17, @bobsmith_courier_id, @pickup_addr_id3, @dropoff_addr_id1, '2025-03-10 10:30:00', '2025-03-10 12:00:00', 'delivered'),
(18, @bobsmith_courier_id, @pickup_addr_id1, @dropoff_addr_id2, '2025-03-20 11:30:00', '2025-03-20 13:00:00', 'delivered');

-- April 2025: 5 deliveries
INSERT INTO deliveries (package_id, courier_id, pickup_address_id, dropoff_address_id, pickup_time, delivery_time, status) VALUES
(19, @bobsmith_courier_id, @pickup_addr_id2, @dropoff_addr_id1, '2025-04-05 14:30:00', '2025-04-05 16:00:00', 'delivered'),
(20, @bobsmith_courier_id, @pickup_addr_id3, @dropoff_addr_id2, '2025-04-12 10:00:00', '2025-04-12 11:30:00', 'delivered'),
(21, @bobsmith_courier_id, @pickup_addr_id1, @dropoff_addr_id3, '2025-04-20 11:30:00', '2025-04-20 13:00:00', 'delivered'),
(22, @bobsmith_courier_id, @pickup_addr_id2, @dropoff_addr_id1, '2025-04-08 10:30:00', '2025-04-08 12:00:00', 'delivered'),
(23, @bobsmith_courier_id, @pickup_addr_id3, @dropoff_addr_id2, '2025-04-15 13:30:00', '2025-04-15 15:00:00', 'delivered');

-- May 2025: 2 deliveries
INSERT INTO deliveries (package_id, courier_id, pickup_address_id, dropoff_address_id, pickup_time, delivery_time, status) VALUES
(24, @bobsmith_courier_id, @pickup_addr_id1, @dropoff_addr_id2, '2025-05-10 12:30:00', '2025-05-10 14:00:00', 'delivered'),
(25, @bobsmith_courier_id, @pickup_addr_id2, @dropoff_addr_id3, '2025-05-15 09:30:00', '2025-05-15 11:00:00', 'delivered');

-- June 2025: 3 deliveries
INSERT INTO deliveries (package_id, courier_id, pickup_address_id, dropoff_address_id, pickup_time, delivery_time, status) VALUES
(26, @bobsmith_courier_id, @pickup_addr_id3, @dropoff_addr_id1, '2025-06-05 10:30:00', '2025-06-05 12:00:00', 'delivered'),
(27, @bobsmith_courier_id, @pickup_addr_id1, @dropoff_addr_id2, '2025-06-10 14:30:00', '2025-06-10 16:00:00', 'delivered'),
(28, @bobsmith_courier_id, @pickup_addr_id2, @dropoff_addr_id3, '2025-06-07 11:30:00', '2025-06-07 13:00:00', 'delivered');