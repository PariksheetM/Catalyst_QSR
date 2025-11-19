-- Database should be created via hPanel before importing this file
-- USE your_database_name;

-- Stores
CREATE TABLE IF stores (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(120) NOT NULL
);

-- Orders
CREATE TABLE orders (
  id VARCHAR(50) PRIMARY KEY,
  store_id VARCHAR(50) NOT NULL,
  customer VARCHAR(120) NOT NULL,
  status ENUM('Pending','Preparing','Ready','Completed') NOT NULL DEFAULT 'Pending',
  total DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_orders_store FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Order Items
CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  name VARCHAR(160) NOT NULL,
  qty INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id)
);



-- Branches (new)
CREATE TABLE  branches (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(120) NOT NULL
);

-- Add branch_id column directly (MySQL 8+ supports IF NOT EXISTS)
ALTER TABLE stores ADD COLUMN VARCHAR(50) NULL AFTER id;
-- Add foreign key (run once; will error if already exists on subsequent runs)
ALTER TABLE stores ADD CONSTRAINT fk_store_branch FOREIGN KEY (branch_id) REFERENCES branches(id);

-- Seed branches
-- INSERT IGNORE INTO branches (id, name) VALUES
-- ('branch-1','Main Campus'),
-- ('branch-2','City Center');

-- Assign existing stores to a default branch if none
UPDATE stores SET branch_id = 'branch-1' WHERE branch_id IS NULL;

-- Users (for auth)
CREATE TABLE  users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer','super','store') NOT NULL,
  store_id VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Ensure enum includes 'customer' for existing installations
ALTER TABLE users MODIFY role ENUM('customer','super','store') NOT NULL;

-- Add payment-related columns directly (MySQL 8+)
ALTER TABLE orders ADD COLUMN  payment_method ENUM('cod','upi','card') NULL AFTER customer;
ALTER TABLE orders ADD COLUMN  payment_status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending' AFTER status;
ALTER TABLE orders ADD COLUMN  razorpay_order_id VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN  razorpay_payment_id VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN  razorpay_signature VARCHAR(255) NULL;

-- Menu items per canteen/store
CREATE TABLE menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  store_id VARCHAR(50) NOT NULL,
  name VARCHAR(160) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  veg TINYINT(1) NOT NULL DEFAULT 1,
  category VARCHAR(120) NULL,
  image_url VARCHAR(255) NULL,
  tax_exempt TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_store FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Seed sample menu items (ignore if already present)
INSERT IGNORE INTO menu_items (store_id, name, price, veg, category, image_url) VALUES
('store-1','Family Pack Oats Modak (11 Pcs)',341.00,1,'Today\'s Special','/images/modak.png'),
('store-1','Greek Salad',110.00,1,'Salads','/images/greek-salad.svg'),
('store-1','Special Meal-NV',189.00,0,'Today\'s Special','/images/special-meal-nv.svg'),
('store-2','Chicken Alfredo',150.00,0,'Pasta','/images/chicken-alfredo.svg'),
('store-2','Chicken Caesar Salad',140.00,0,'Salads','/images/chicken-caesar-salad.svg');
