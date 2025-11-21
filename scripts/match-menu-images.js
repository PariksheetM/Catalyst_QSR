const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { query } = require('../db')

// Mapping of menu item names to image filenames
const imageMapping = {
  // Exact matches and close matches
  'Veg Sandwich': 'VEG SANDWICH.jpg',
  'Salad': 'Salad.jpg',
  'VFG PASTA OF THE DAY': 'VEG PASTA OF THE DAY.jpg',
  'ORIENTAL DISH RICE': 'ORIENTAL DISH RICE.jpg',
  'ALL DAY DISH': 'ALL DAY DISH (4 EGG OMLETTE + FRENCH FRIES + BREAD).jpg',
  'CHICKEN HOT DOG': 'CHICKEN HOT DOG.jpg',
  'VFG PUFF': 'VEG PUFF.jpg',
  'CHICKEN FRANKIE': 'CHICKEN FRANKIE.jpg',
  'CHICKEN NOODLES': 'CHICKEN NOODLES.jpg',
  'VEG NOODLES': 'VEG NOODLES.jpg',
  'EGG CURRY': 'EGG CURRY.jpg',
  'FRENCH FRIES': 'FRENCH FRIES.jpg',
  'OMLETTE SANDWICH': 'OMLETTE SANDWICH.jpg',
  'PARATHA SUBJI': 'PARATHA SUBJI.jpg',
  'VEG PIZZA': 'VEG PIZZA.jpg',
  'VFG BURGER': 'VEG BURGER.jpg',
  'PARATHA -SINGLE / PICKLE / CURD': 'PARATHA -SINGLE PICKLE CURD.jpg',
  'PARATHA - DOUBLE / PICKLE / CURD': 'PARATHA -DOUBLE PICKLE CURD.jpg',
  'PASTRIES': 'PASTRIES.jpg',
  'PLAIN DOUGHNUT': 'PLAIN DOUGNUT.jpg',
  'CHOCOLATE DOUGHNUT': 'CHOCOLATE DOUGHNUT.jpg',
  'DRY FRUIT CAKE': 'DRY FRUIT CAKE.jpg',
  'PINEAPPLE PASTRY': 'PINEAPPLE PASTRY.jpg',
  'BLACK FORESTPASTRY': 'BLACK FORESTPASTRY.jpg',
  'CHICKEN BURGER': 'CHICKEN BURGER.jpg',
  'CHAT VARIETY': 'CHAT VARIETY.jpg',
  'CHICKEN NUGGETES': 'CHICKEN NUGGETES.jpg',
  'WALNUT PASTRY': 'WALNUT PASTRY.jpg',
  'SWEET ITEMS ( RASGULLA , RASMALAI ETC.)': 'SWEET ITEMS ( RASGULLA . RASMALAI ETC.).jpg',
  'VFG CROISSANT': 'VEG CROISSANT.jpg',
  'COOKED TEA': 'TEA.jpg',
  'COOKED COFFEE': 'COFFEE.jpg',
  'SOUP OF THE DAY': 'SOUP OF THE DAY.jpg',
  'SAMOSA CHAT': 'SAMOSA CHATKACHORI CHAT.jpg',
  'MATKI BHEL': 'MATKI BHEL.jpg',
  'CHICKEN CURRY WITH PARATHA (2 NOS)': 'CHICKEN CURRY WITH PARATHA ( 2 NOS).jpg',
  'CHICKEN PIZZA': 'CHICKEN PIZZA.jpg',
  'FRUIT SALAD': 'FRUIT SALAD.jpg',
  'CHICKEN PUFF': 'CHICKEN PUFF.jpg',
  'CHICKEN SANDWICH': 'CHICKEN SANDWICH.jpg',
  'VEG CUTLET': 'VEG CUTLET.jpg',
  'PLAIN MUFFINS': 'PLAIN MUFFINS.jpg',
  'CHOCOLATE MUFFINS': 'CHOCOLATE MUFFINS.jpg',
  'CELEBERATION CAKE - WITHOUT CHOCOLATE BASE': 'CELEBRATION CAKE - WITHOUT CHOCOLATE BASE.jpg',
  'CELEBERATION CAKE - CHOCOLATE BASE': 'CELEBRATION CAKE - CHOCOLATE BASE.jpg',
  'PLAIN PARATHA - SINGLE': 'PLAIN PARATHA - SINGLE.jpg',
  'SMALL BREAD': 'small-bread.jpg',
  'EXTRA BUTTER': 'EXTRA BUTTER.jpg',
  'EXTRA CHEESE': 'EXTRA CHEESE.jpg',
  'PLUM CAKE': 'PLUM CAKE.jpg',
  'EGG PUFF': 'EGG PUFF.jpg',
  'OMLETTE MAGGIE': 'OMLETTE MAGGIE.jpg',
  'MAGGIE': 'MAGGIE.jpg',
  'BREAD & OMLETTE': 'BREAD & OMLETTE.jpg',
  'CHEESE CHILLY TOAST': 'CHEESE CHILLY TOAST.jpg',
  'CHOCOLATE WALNUT CAKE': 'CHOCOLATE WALNUT CAKE.jpg',
  'CHOCOLATE WALBUT CAKE': 'CHOCOLATE WALNUT CAKE.jpg',
  'EGG OMLETTE': 'EGG OMLETTE.jpg',
  'MINERAL WATER BOTTLE': 'MINERAL WATER BOTTLE.jpg',
  'RED BULL': 'RED BULL.jpg',
  'COLD DRINKS': 'COLD DRINKS.jpg',
  'Ice Cream Variety / Kulfi': 'ICE CREAM VARIETYKULFI.jpg',
  'BREAD BUTTER': 'BREAD BUTTER.jpg',
  'TOPPINGS': 'TOPPINGS.jpg',
  'EXTRA SAUSAGE': 'EXTRA SAUSAGE.jpg',
  'EGG BIRYANI': null, // No matching image found
  'CHICKEN CROISSANT': null // Using VEG CROISSANT as fallback could work
}

async function main() {
  console.log('Starting image matching process...\n')

  // Get all menu items
  const menuItems = await query('SELECT id, name, store_id FROM menu_items ORDER BY name')
  
  console.log(`Found ${menuItems.length} menu items across all stores\n`)

  let matched = 0
  let notMatched = 0
  const notMatchedItems = []

  for (const item of menuItems) {
    const imageFile = imageMapping[item.name]
    
    if (imageFile) {
      const imageUrl = `/images/${imageFile}`
      await query('UPDATE menu_items SET image_url = ? WHERE id = ?', [imageUrl, item.id])
      matched++
      console.log(`✓ Matched: ${item.name} → ${imageFile}`)
    } else {
      notMatched++
      if (!notMatchedItems.includes(item.name)) {
        notMatchedItems.push(item.name)
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Image Matching Summary:`)
  console.log(`${'='.repeat(60)}`)
  console.log(`✓ Matched: ${matched} menu items`)
  console.log(`✗ Not matched: ${notMatched} menu items`)
  
  if (notMatchedItems.length > 0) {
    console.log(`\nMenu items without matching images:`)
    notMatchedItems.forEach(name => console.log(`  - ${name}`))
  }

  // Verify by checking a few items
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Sample verification (first 5 items with images):`)
  console.log(`${'='.repeat(60)}`)
  const samples = await query(`
    SELECT name, image_url 
    FROM menu_items 
    WHERE image_url IS NOT NULL 
    LIMIT 5
  `)
  samples.forEach(s => console.log(`  ${s.name} → ${s.image_url}`))
}

main()
  .then(() => {
    console.log('\n✓ Image matching completed successfully!')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n✗ Image matching failed:', err.message)
    console.error(err.stack)
    process.exit(1)
  })
