require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { query } = require('../db');

async function seedStoreAdmin() {
  try {
    // Get first store
    const stores = await query('SELECT id, name FROM stores ORDER BY id LIMIT 1');
    if (!stores.length) {
      console.log('❌ No stores found. Please create stores first.');
      return;
    }
    
    const storeId = stores[0].id;
    const storeName = stores[0].name;
    
    // Check if store admin already exists
    const existing = await query('SELECT id FROM users WHERE email = ? AND role = ?', ['store@test.com', 'store']);
    if (existing.length) {
      console.log('✅ Store admin already exists: store@test.com');
      console.log(`   Store: ${storeName} (${storeId})`);
      return;
    }
    
    // Create store admin
    const passwordHash = await bcrypt.hash('store123', 10);
    await query(
      'INSERT INTO users (email, password_hash, role, store_id) VALUES (?, ?, ?, ?)',
      ['store@test.com', passwordHash, 'store', storeId]
    );
    
    console.log('✅ Store admin created successfully!');
    console.log(`   Email: store@test.com`);
    console.log(`   Password: store123`);
    console.log(`   Store: ${storeName} (${storeId})`);
  } catch (err) {
    console.error('❌ Error seeding store admin:', err);
  }
  process.exit(0);
}

seedStoreAdmin();
