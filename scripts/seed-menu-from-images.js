const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { query } = require('../db')

function titleCase(s) {
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

function inferVeg(filename) {
  const f = filename.toLowerCase()
  return f.includes('veg') || f.includes('paneer') || f.includes('salad')
}

async function main() {
  const repoRoot = path.join(__dirname, '..', '..')
  const imagesDir = path.join(repoRoot, 'public', 'images')
  if (!fs.existsSync(imagesDir)) {
    console.error('Images folder not found:', imagesDir)
    process.exit(1)
  }

  const entries = fs.readdirSync(imagesDir)
    .filter(f => /\.(png|jpe?g|webp|svg)$/i.test(f))

  if (entries.length === 0) {
    console.log('No images found in', imagesDir)
    return
  }

  const stores = await query('SELECT id, name FROM stores ORDER BY name')
  if (!stores.length) {
    console.log('No stores found. Seed stores first.')
    return
  }

  const defaultPrice = Number(process.env.SEED_DEFAULT_PRICE || 179)
  const category = 'General'

  let totalInserted = 0
  for (const store of stores) {
    for (const file of entries) {
      const name = titleCase(file.replace(/\.[^.]+$/, ''))
      const veg = inferVeg(file) ? 1 : 0
      const imageUrl = `/images/${file}`
      const existing = await query('SELECT id FROM menu_items WHERE store_id = ? AND name = ? LIMIT 1', [store.id, name])
      if (existing.length) continue
      await query(
        'INSERT INTO menu_items (store_id, name, price, veg, category, image_url, tax_exempt, active) VALUES (?,?,?,?,?,?,0,1)',
        [store.id, name, defaultPrice, veg, category, imageUrl]
      )
      totalInserted++
      console.log(`Inserted: [${store.id}] ${name}`)
    }
  }

  console.log(`Seeding complete. Inserted ${totalInserted} item(s).`)
}

main().catch(err => { console.error('Seeding failed:', err.message); process.exit(1) })
