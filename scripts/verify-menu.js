const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { query } = require('../db')

async function main() {
  console.log('Verifying menu items...\n')

  // Count total items
  const counts = await query(`
    SELECT 
      COUNT(*) as total,
      SUM(veg=1) as veg_count,
      SUM(veg=0) as nonveg_count
    FROM menu_items 
    WHERE store_id = 'store-1'
  `)
  
  console.log('Total items for store-1:', counts[0].total)
  console.log('Veg items:', counts[0].veg_count)
  console.log('Non-veg items:', counts[0].nonveg_count)

  // Show some non-veg items
  console.log('\nSample Non-Veg Items:')
  const nonVeg = await query(`
    SELECT name, description, price, category 
    FROM menu_items 
    WHERE store_id = 'store-1' AND veg = 0 
    LIMIT 10
  `)
  nonVeg.forEach(item => {
    console.log(`  - ${item.name} (${item.description}) - ₹${item.price} [${item.category}]`)
  })

  // Show categories
  console.log('\nCategories:')
  const categories = await query(`
    SELECT DISTINCT category, COUNT(*) as count
    FROM menu_items 
    WHERE store_id = 'store-1'
    GROUP BY category
    ORDER BY count DESC
  `)
  categories.forEach(cat => {
    console.log(`  - ${cat.category}: ${cat.count} items`)
  })
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
