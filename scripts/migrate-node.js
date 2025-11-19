const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

async function main() {
  const DB_USER = process.env.DB_USER || 'root'
  const DB_PASSWORD = process.env.DB_PASSWORD || ''
  const DB_HOST = process.env.DB_HOST || 'localhost'
  const DB_PORT = Number(process.env.DB_PORT || 3306)

  const sqlPath = path.join(__dirname, '..', 'migrations.sql')
  if (!fs.existsSync(sqlPath)) {
    console.error('migrations.sql not found at', sqlPath)
    process.exit(1)
  }
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  })

  try {
    console.log('Running migrations via mysql2...')
    await conn.query(sql)
    console.log('Migrations completed successfully.')
  } finally {
    await conn.end()
  }
}

main().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
