require('dotenv').config()
const { query } = require('../db')

async function main() {
  process.stdout.write('Checking DB connectivity... ')
  try {
    const r = await query('SELECT 1 AS ok')
    if (Array.isArray(r) && r[0]?.ok === 1) {
      console.log('OK')
    } else {
      console.log('Unexpected response:', r)
    }
  } catch (err) {
    console.error('\nConnection failed:', err.message)
    process.exitCode = 1
    return
  }

  // Optional schema check
  try {
    const stores = await query('SELECT COUNT(*) AS cnt FROM stores')
    const cnt = stores?.[0]?.cnt ?? 0
    console.log(`Schema check: stores table found, ${cnt} row(s).`)
  } catch (err) {
    console.log('Schema check: connected, but tables missing (run migrations).')
  }

  // Menu items table + columns check
  try {
    const cols = await query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_items'`)
    const colNames = cols.map(c => c.COLUMN_NAME)
    const hasMenu = colNames.length > 0
    const hasDesc = colNames.includes('description')
    console.log('menu_items table:', hasMenu ? 'OK' : 'MISSING', '| columns:', colNames.join(','))
    if (!hasDesc) console.log('Note: description column missing; run npm run db:migrate:safe')
    const items = await query('SELECT COUNT(*) AS cnt FROM menu_items')
    console.log(`menu_items rows: ${items?.[0]?.cnt ?? 0}`)
  } catch (err) {
    console.log('menu_items check failed:', err.message)
  }
}

main().then(() => process.exit()).catch(() => process.exit(1))
