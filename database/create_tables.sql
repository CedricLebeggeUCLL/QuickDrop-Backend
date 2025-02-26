-- Controleer of de database al bestaat en verwijder deze indien nodig
DROP DATABASE IF EXISTS quickdrop_db;

-- Maak de database aan
CREATE DATABASE quickdrop_db;

-- Selecteer de database
USE quickdrop_db;

-- Drop tabellen als ze al bestaan, zodat we het script veilig kunnen herhalen
DROP TABLE IF EXISTS deliveries;
DROP TABLE IF EXISTS couriers;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS users;

-- Tabel voor gebruikers
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'courier', 'admin') DEFAULT 'user'
);

-- Tabel voor pakketten
CREATE TABLE packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  description TEXT,
  status ENUM('pending', 'in_transit', 'delivered') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabel voor koeriers (gebruikers die ook als koerier fungeren)
CREATE TABLE couriers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  current_location JSON, -- Wijzig naar JSON voor [latitude, longitude]
  destination JSON,      -- Wijzig naar JSON voor [latitude, longitude]
  availability BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabel voor leveringen (koppeling tussen pakketten en koeriers)
CREATE TABLE deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  courier_id INT NOT NULL,
  pickup_time DATETIME,
  delivery_time DATETIME DEFAULT NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (courier_id) REFERENCES couriers(id) ON DELETE CASCADE
);

-- Voeg standaard testdata toe voor gebruikers
INSERT INTO users (username, email, password, role) VALUES 
('johndoe', 'john@example.com', 'hashed_password1', 'user'),
('janedoe', 'jane@example.com', 'hashed_password2', 'user'),
('bobsmith', 'bob@example.com', 'hashed_password3', 'courier'),
('adminuser', 'admin@quickdrop.com', 'hashed_password4', 'admin');

-- Voeg standaard testdata toe voor pakketten
INSERT INTO packages (user_id, description, status) VALUES 
(1, 'Een cadeau voor mijn vriend', 'pending'),
(2, 'Boeken voor studie', 'in_transit'),
(1, 'Elektronica reparatie', 'pending');

-- Haal de user_id op voor de koeriers
SET @bobsmith_id = (SELECT id FROM users WHERE username = 'bobsmith');
SET @adminuser_id = (SELECT id FROM users WHERE username = 'adminuser');

-- Voeg standaard testdata toe voor koeriers
-- Converteer POINT naar JSON-arrays [latitude, longitude]
INSERT INTO couriers (user_id, current_location, destination, availability) VALUES 
(@bobsmith_id, '[50.8503, 4.3517]', '[51.2178, 4.4203]', TRUE),
(@adminuser_id, '[51.2178, 4.4203]', '[50.8503, 4.3517]', TRUE);

-- Haal de courier_id op voor de leveringen
SET @bobsmith_courier_id = (SELECT id FROM couriers WHERE user_id = @bobsmith_id);
SET @adminuser_courier_id = (SELECT id FROM couriers WHERE user_id = @adminuser_id);

-- Voeg standaard testdata toe voor leveringen
INSERT INTO deliveries (package_id, courier_id, pickup_time, delivery_time) VALUES 
(1, @bobsmith_courier_id, '2023-10-01 10:00:00', NULL),
(2, @adminuser_courier_id, '2023-10-01 12:30:00', '2023-10-01 14:00:00');

-- Controleer of alles correct is aangemaakt
SELECT * FROM users;
SELECT * FROM packages;
SELECT * FROM couriers;
SELECT * FROM deliveries;