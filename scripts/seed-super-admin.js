require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { query } = require('../db');

async function seedSuperAdmin() {
  try {
    // Check if super admin already exists
    const existing = await query('SELECT id, email FROM users WHERE role = ?', ['super']);
    if (existing.length) {
      console.log('✅ Super admin already exists:');
      console.log(`   Email: ${existing[0].email}`);
      console.log(`   To change password, use the Profile page in Super Admin dashboard`);
      return;
    }
    
    // Create super admin
    const email = 'super@admin.com';
    const password = 'super123';
    const passwordHash = await bcrypt.hash(password, 10);
    
    await query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, passwordHash, 'super']
    );
    
    console.log('✅ Super admin created successfully!');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Access: /superadmin`);
  } catch (err) {
    console.error('❌ Error seeding super admin:', err);
  }
  process.exit(0);
}

seedSuperAdmin();
