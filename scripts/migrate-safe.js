const mysql = require('mysql2/promise')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function ensureDatabase(conn, dbName) {
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
}

async function withDb() {
  const DB_USER = process.env.DB_USER || 'root'
  const DB_PASSWORD = process.env.DB_PASSWORD || ''
  const DB_HOST = process.env.DB_HOST || 'localhost'
  const DB_PORT = Number(process.env.DB_PORT || 3306)
  const DB_NAME = process.env.DB_NAME || 'paushtik_ahar'

  const server = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, multipleStatements: true })
  await ensureDatabase(server, DB_NAME)
  await server.end()

  return mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME })
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  )
  return rows.length > 0
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [table]
  )
  return rows.length > 0
}

async function fkExists(conn, table, constraintName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`,
    [table, constraintName]
  )
  return rows.length > 0
}

async function safeQuery(conn, sql, params = []) {
  await conn.query(sql, params)
}

async function main() {
  const conn = await withDb()
  try {
    console.log('Ensuring base tables...')
    await safeQuery(conn, `CREATE TABLE IF NOT EXISTS stores ( id VARCHAR(50) PRIMARY KEY, name VARCHAR(120) NOT NULL )`)
    await safeQuery(conn, `CREATE TABLE IF NOT EXISTS branches ( id VARCHAR(50) PRIMARY KEY, name VARCHAR(120) NOT NULL )`)

    const hasBranchCol = await columnExists(conn, 'stores', 'branch_id')
    if (!hasBranchCol) {
      console.log('Adding stores.branch_id...')
      await safeQuery(conn, `ALTER TABLE stores ADD COLUMN branch_id VARCHAR(50) NULL AFTER id`)
    }
    const hasFk = await fkExists(conn, 'stores', 'fk_store_branch')
    if (!hasFk) {
      console.log('Adding FK stores.branch_id -> branches.id ...')
      try {
        await safeQuery(conn, `ALTER TABLE stores ADD CONSTRAINT fk_store_branch FOREIGN KEY (branch_id) REFERENCES branches(id)`) 
      } catch (e) {
        console.log('FK add skipped:', e.message)
      }
    }

    await safeQuery(conn, `CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(50) PRIMARY KEY,
      store_id VARCHAR(50) NOT NULL,
      customer VARCHAR(120) NOT NULL,
      status ENUM('Pending','Preparing','Ready','Completed') NOT NULL DEFAULT 'Pending',
      total DECIMAL(10,2) NOT NULL,
      created_at DATETIME NOT NULL,
      CONSTRAINT fk_orders_store FOREIGN KEY (store_id) REFERENCES stores(id)
    )`)

    await safeQuery(conn, `CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(50) NOT NULL,
      name VARCHAR(160) NOT NULL,
      qty INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id)
    )`)

    await safeQuery(conn, `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('customer','super','store') NOT NULL,
      store_id VARCHAR(50) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)

    // Ensure payment-related columns
    const paymentCols = [
      { name: 'payment_method', ddl: `ALTER TABLE orders ADD COLUMN payment_method ENUM('cod','upi','card') NULL AFTER customer` },
      { name: 'payment_status', ddl: `ALTER TABLE orders ADD COLUMN payment_status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending' AFTER status` },
      { name: 'razorpay_order_id', ddl: `ALTER TABLE orders ADD COLUMN razorpay_order_id VARCHAR(255) NULL` },
      { name: 'razorpay_payment_id', ddl: `ALTER TABLE orders ADD COLUMN razorpay_payment_id VARCHAR(255) NULL` },
      { name: 'razorpay_signature', ddl: `ALTER TABLE orders ADD COLUMN razorpay_signature VARCHAR(255) NULL` },
    ]
    for (const c of paymentCols) {
      const exists = await columnExists(conn, 'orders', c.name)
      if (!exists) {
        console.log('Adding orders.' + c.name)
        await safeQuery(conn, c.ddl)
      }
    }

    // Menu items table
    const hasMenu = await tableExists(conn, 'menu_items')
    if (!hasMenu) {
      console.log('Creating table menu_items...')
      await safeQuery(conn, `CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        store_id VARCHAR(50) NOT NULL,
        name VARCHAR(160) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        veg TINYINT(1) NOT NULL DEFAULT 1,
        category VARCHAR(120) NULL,
        description TEXT NULL,
        image_url VARCHAR(255) NULL,
        tax_exempt TINYINT(1) NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_menu_store FOREIGN KEY (store_id) REFERENCES stores(id)
      )`)
    }
    // Ensure description column exists for existing installations
    const hasDesc = await columnExists(conn, 'menu_items', 'description')
    if (!hasDesc) {
      console.log('Adding menu_items.description...')
      await safeQuery(conn, `ALTER TABLE menu_items ADD COLUMN description TEXT NULL AFTER category`)
    }

    console.log('Seeding defaults (idempotent)...')
    await safeQuery(conn, `INSERT IGNORE INTO branches (id, name) VALUES ('branch-1','Main Campus'),('branch-2','City Center')`)
    await safeQuery(conn, `INSERT IGNORE INTO stores (id, name, branch_id) VALUES ('store-1','Store 1','branch-1'),('store-2','Store 2','branch-1')`)

    console.log('Migration safe complete.')
  } finally {
    await conn.end()
  }
}

main().catch(err => { console.error('Safe migration failed:', err.message); process.exit(1) })
