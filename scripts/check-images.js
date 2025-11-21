const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { query } = require('../db')

async function main() {
  console.log('Checking items without images...\n')

  const noImages = await query(`
    SELECT DISTINCT name 
    FROM menu_items 
    WHERE image_url IS NULL OR image_url = ''
    ORDER BY name
  `)
  
  console.log(`Items without images: ${noImages.length}`)
  noImages.forEach(item => console.log(`  - ${item.name}`))

  console.log('\n' + '='.repeat(60))
  console.log('Checking items WITH images...\n')

  const withImages = await query(`
    SELECT COUNT(*) as count
    FROM menu_items 
    WHERE image_url IS NOT NULL AND image_url != ''
  `)
  
  console.log(`Items with images: ${withImages[0].count}`)

  // Sample items with images
  console.log('\nSample items with images:')
  const samples = await query(`
    SELECT name, image_url 
    FROM menu_items 
    WHERE image_url IS NOT NULL AND image_url != ''
    AND store_id = 'store-1'
    ORDER BY name
    LIMIT 10
  `)
  samples.forEach(s => console.log(`  ✓ ${s.name} → ${s.image_url}`))
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
