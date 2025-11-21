const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { query } = require('../db')

// Menu data extracted from Excel sheets
// Items 1-26 from first sheet (page 1)
// Items 27-44 from second sheet (continued)
// Items 45-70 from third sheet (final items)
const menuItems = [
  // First Sheet - Items 1-26
  { id: 1, name: 'Veg Sandwich', description: '150gm- 4pieces + Waffers', price: 75.00, veg: true, category: 'Sandwiches & Snacks' },
  { id: 2, name: 'Salad', description: '160gm', price: 75.00, veg: true, category: 'Salads' },
  { id: 3, name: 'VFG PASTA OF THE DAY', description: '220gm', price: 110.00, veg: true, category: 'Pasta' },
  { id: 4, name: 'ORIENTAL DISH RICE', description: '220gm', price: 100.00, veg: true, category: 'Rice & Mains' },
  { id: 5, name: 'ALL DAY DISH', description: '180gm', price: 80.00, veg: true, category: 'All Day' },
  { id: 6, name: 'CHICKEN HOT DOG', description: '120gm / 1 Pcs', price: 75.00, veg: false, category: 'Hot Dogs' },
  { id: 7, name: 'VFG PUFF', description: '45gm / 1 Pcs', price: 15.00, veg: true, category: 'Puffs & Pastries' },
  { id: 8, name: 'CHICKEN FRANKIE', description: '120gm / 1frankie + Waffers', price: 80.00, veg: false, category: 'Frankies' },
  { id: 9, name: 'CHICKEN NOODLES', description: '220gm', price: 100.00, veg: false, category: 'Noodles' },
  { id: 10, name: 'VEG NOODLES', description: '220gm', price: 80.00, veg: true, category: 'Noodles' },
  { id: 11, name: 'EGG CURRY', description: '200gm', price: 80.00, veg: false, category: 'Curries' },
  { id: 12, name: 'FRENCH FRIES', description: '100gm', price: 40.00, veg: true, category: 'Sides' },
  { id: 13, name: 'OMLETTE SANDWICH', description: '150gm / double egg omellette & 2 slice bread', price: 75.00, veg: false, category: 'Sandwiches & Snacks' },
  { id: 14, name: 'PARATHA SUBJI', description: '180gm / 2paratha 1bowl subji onion pickle', price: 50.00, veg: true, category: 'Parathas' },
  { id: 15, name: 'EGG BIRYANI', description: '220gm / 2eggs, rice, raita', price: 85.00, veg: false, category: 'Biryani' },
  { id: 16, name: 'VEG PIZZA', description: 'Whole portion,80gm / Cut pieces as per requirement', price: 40.00, veg: true, category: 'Pizza' },
  { id: 17, name: 'VFG BURGER', description: '150gm / 1 number & french fries', price: 100.00, veg: true, category: 'Burgers' },
  { id: 18, name: 'PARATHA -SINGLE / PICKLE / CURD', description: '80gm / Stuffed Paratha+curd+butter+pickle', price: 25.00, veg: true, category: 'Parathas' },
  { id: 19, name: 'PARATHA - DOUBLE / PICKLE / CURD', description: '150gm / Stuffed Paratha+curd+butter+pickle', price: 40.00, veg: true, category: 'Parathas' },
  { id: 20, name: 'PASTRIES', description: '45gm / 1 Pcs', price: 40.00, veg: true, category: 'Puffs & Pastries' },
  { id: 21, name: 'TOPPINGS', description: '', price: 20.00, veg: true, category: 'Add-ons' },
  { id: 22, name: 'EXTRA PARATHA', description: '40GM / 1 Pcs', price: 15.00, veg: true, category: 'Add-ons' },
  { id: 23, name: 'EXTRA SAUSAGE', description: '', price: 30.00, veg: false, category: 'Add-ons' },
  { id: 24, name: 'PLAIN DOUGHNUT', description: '45gm / 1 Pcs', price: 20.00, veg: true, category: 'Puffs & Pastries' },
  { id: 25, name: 'CHOCOLATE DOUGHNUT', description: '45gm / 1 Pcs', price: 25.00, veg: true, category: 'Puffs & Pastries' },
  { id: 26, name: 'DRY FRUIT CAKE', description: '45gm / 1 Pcs', price: 45.00, veg: true, category: 'Cakes' },

  // Second Sheet - Items 27-44
  { id: 27, name: 'PINEAPPLE PASTRY', description: '45gm', price: 35.00, veg: true, category: 'Puffs & Pastries' },
  { id: 28, name: 'BLACK FORESTPASTRY', description: '45gm', price: 45.00, veg: true, category: 'Puffs & Pastries' },
  { id: 29, name: 'CHICKEN BURGER', description: '150gm / 1 Pcs', price: 125.00, veg: false, category: 'Burgers' },
  { id: 30, name: 'CHAT VARIETY', description: '120gm', price: 40.00, veg: true, category: 'Chaat' },
  { id: 31, name: 'CHICKEN NUGGETES', description: '10pieces', price: 100.00, veg: false, category: 'Snacks' },
  { id: 32, name: 'WALNUT PASTRY', description: '45 GMS', price: 65.00, veg: true, category: 'Puffs & Pastries' },
  { id: 33, name: 'SWEET ITEMS ( RASGULLA , RASMALAI ETC.)', description: '100 Gms', price: 35.00, veg: true, category: 'Desserts' },
  { id: 34, name: 'VFG CROISSANT', description: '1 PCS / 80 GMS', price: 40.00, veg: true, category: 'Puffs & Pastries' },
  { id: 35, name: 'CHICKEN CROISSANT', description: '1 PCS / 80 GMS', price: 40.00, veg: false, category: 'Puffs & Pastries' },
  { id: 36, name: 'COOKED TEA', description: '100 ML', price: 14.00, veg: true, category: 'Beverages' },
  { id: 37, name: 'COOKED COFFEE', description: '100 ML', price: 16.00, veg: true, category: 'Beverages' },
  { id: 38, name: 'SOUP OF THE DAY', description: '150 ML', price: 40.00, veg: true, category: 'Soups' },
  { id: 39, name: 'SAMOSA CHAT', description: '120 GMS', price: 40.00, veg: true, category: 'Chaat' },
  { id: 40, name: 'MATKI BHEL', description: '120 GMS', price: 40.00, veg: true, category: 'Chaat' },
  { id: 41, name: 'CHICKEN CURRY WITH PARATHA (2 NOS)', description: '150 GMS', price: 120.00, veg: false, category: 'Curries' },
  { id: 42, name: 'CHICKEN PIZZA', description: 'Whole portion,80gm / Cut pieces as per requirement', price: 75.00, veg: false, category: 'Pizza' },
  { id: 43, name: 'FRUIT SALAD', description: '100 GMS', price: 40.00, veg: true, category: 'Salads' },
  { id: 44, name: 'CHICKEN PUFF', description: '80 GMS / 1 PC', price: 30.00, veg: false, category: 'Puffs & Pastries' },

  // Third Sheet - Items 45-70
  { id: 45, name: 'CHICKEN SANDWICH', description: '150gm- 4pieces + Waffers', price: 90.00, veg: false, category: 'Sandwiches & Snacks' },
  { id: 46, name: 'VEG CUTLET', description: '2 PC / 60 GMS', price: 40.00, veg: true, category: 'Snacks' },
  { id: 47, name: 'PLAIN MUFFINS', description: '50 GMS', price: 25.00, veg: true, category: 'Puffs & Pastries' },
  { id: 48, name: 'CHOCOLATE MUFFINS', description: '50 GMS', price: 30.00, veg: true, category: 'Puffs & Pastries' },
  { id: 49, name: 'CELEBERATION CAKE - WITHOUT CHOCOLATE BASE', description: '500 GMS', price: 350.00, veg: true, category: 'Cakes' },
  { id: 50, name: 'CELEBERATION CAKE - CHOCOLATE BASE', description: '500 GMS', price: 400.00, veg: true, category: 'Cakes' },
  { id: 51, name: 'CELEBERATION CAKE - WITHOUT CHOCOLATE BASE', description: '1 KG', price: 600.00, veg: true, category: 'Cakes' },
  { id: 52, name: 'CELEBERATION CAKE - CHOCOLATE BASE', description: '1 KG', price: 700.00, veg: true, category: 'Cakes' },
  { id: 53, name: 'PLAIN PARATHA - SINGLE', description: '1 PC', price: 15.00, veg: true, category: 'Parathas' },
  { id: 54, name: 'SMALL BREAD', description: '2 PC / SLICE', price: 10.00, veg: true, category: 'Breads' },
  { id: 55, name: 'EXTRA BUTTER', description: '', price: 10.00, veg: true, category: 'Add-ons' },
  { id: 56, name: 'EXTRA CHEESE', description: '', price: 15.00, veg: true, category: 'Add-ons' },
  { id: 57, name: 'PLUM CAKE', description: '90 GMS', price: 45.00, veg: true, category: 'Cakes' },
  { id: 58, name: 'EGG PUFF', description: '90 GMS', price: 15.00, veg: false, category: 'Puffs & Pastries' },
  { id: 59, name: 'OMLETTE MAGGIE', description: '1 egg / 120 gms maggie', price: 50.00, veg: false, category: 'Snacks' },
  { id: 60, name: 'MAGGIE', description: '120 gms', price: 40.00, veg: true, category: 'Snacks' },
  { id: 61, name: 'BREAD & OMLETTE', description: '2 eggs / 2 Slice', price: 40.00, veg: false, category: 'Breakfast' },
  { id: 62, name: 'CHEESE CHILLY TOAST', description: '2 Slice', price: 50.00, veg: true, category: 'Toast' },
  { id: 63, name: 'CHOCOLATE WALNUT CAKE', description: '1 KG', price: 800.00, veg: true, category: 'Cakes' },
  { id: 64, name: 'CHOCOLATE WALBUT CAKE', description: '500 GMS', price: 400.00, veg: true, category: 'Cakes' },
  { id: 65, name: 'EGG OMLETTE', description: '2 eggs', price: 30.00, veg: false, category: 'Breakfast' },
  { id: 66, name: 'MINERAL WATER BOTTLE', description: '500 ml / 1 Ltr', price: 0, veg: true, category: 'Beverages' }, // MRP
  { id: 67, name: 'RED BULL', description: '', price: 0, veg: true, category: 'Beverages' }, // MRP
  { id: 68, name: 'COLD DRINKS', description: '', price: 0, veg: true, category: 'Beverages' }, // MRP
  { id: 69, name: 'Ice Cream Variety / Kulfi', description: '', price: 0, veg: true, category: 'Desserts' }, // MRP
  { id: 70, name: 'BREAD BUTTER', description: '', price: 20.00, veg: true, category: 'Breads' }
]

async function main() {
  console.log('Starting menu update process...')

  // Get all stores
  const stores = await query('SELECT id, name FROM stores ORDER BY name')
  if (!stores.length) {
    console.log('No stores found. Please add stores first.')
    return
  }

  console.log(`Found ${stores.length} store(s):`)
  stores.forEach(s => console.log(`  - ${s.name} (${s.id})`))

  // Clear existing menu items
  console.log('\nClearing existing menu items...')
  const deleted = await query('DELETE FROM menu_items')
  console.log(`Deleted ${deleted.affectedRows || 0} existing menu items`)

  // Insert new menu items for each store
  let totalInserted = 0
  for (const store of stores) {
    console.log(`\nAdding menu items to ${store.name}...`)
    for (const item of menuItems) {
      try {
        await query(
          `INSERT INTO menu_items (store_id, name, price, veg, category, description, image_url, tax_exempt, active)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 1)`,
          [
            store.id,
            item.name,
            item.price,
            item.veg ? 1 : 0,
            item.category,
            item.description
          ]
        )
        totalInserted++
      } catch (err) {
        console.error(`  Failed to insert "${item.name}": ${err.message}`)
      }
    }
    console.log(`  Added ${menuItems.length} items to ${store.name}`)
  }

  console.log(`\n✓ Menu update complete!`)
  console.log(`  Total items inserted: ${totalInserted}`)
  console.log(`  Unique menu items: ${menuItems.length}`)
  console.log(`  Stores updated: ${stores.length}`)
  
  // Summary by category
  const categories = {}
  menuItems.forEach(item => {
    categories[item.category] = (categories[item.category] || 0) + 1
  })
  
  console.log(`\nMenu breakdown by category:`)
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      const vegCount = menuItems.filter(i => i.category === cat && i.veg).length
      const nonVegCount = count - vegCount
      console.log(`  ${cat}: ${count} items (${vegCount} veg, ${nonVegCount} non-veg)`)
    })
}

main()
  .then(() => {
    console.log('\n✓ Script completed successfully')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n✗ Script failed:', err.message)
    console.error(err.stack)
    process.exit(1)
  })
