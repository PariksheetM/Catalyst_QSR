require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { query } = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { getRazorpayInstance } = require('./razorpay');
const fs = require('fs');
const path = require('path');
// Simple admin access configuration
const ADMIN_PASS = process.env.ADMIN_DASH_PASSWORD || 'admin123';
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASS || 'super123';
const ADMIN_JWT_SECRET = process.env.JWT_ADMIN_SECRET || 'dev_admin_secret';

const app = express();

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://192.168.1.7:5173',
      process.env.FRONTEND_URL, // Add your Hostinger domain in Render env vars
    ].filter(Boolean); // Remove undefined values
    
    // Allow any origin in development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('.hostinger.') || origin.includes('.onrender.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
// Increase JSON body limit to support larger pasted images (base64 inflates size)
app.use(express.json({ limit: '50mb' }));
// Serve uploaded images
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));
// Simple JWT helpers
function signToken(payload) {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '8h' });
}
function authOptional(req, _res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try {
      const token = h.slice(7);
      req.user = jwt.verify(token, ADMIN_JWT_SECRET);
    } catch (_) { /* ignore invalid */ }
  }
  next();
}
app.use(authOptional);
function requireSuper(req, res, next) {
  if (!req.user || req.user.role !== 'super') return res.status(403).json({ error: 'super admin only' });
  next();
}
function requireStoreOrSuper(req, res, next) {
  if (!req.user) return res.status(403).json({ error: 'unauthorized' });
  if (req.user.role === 'super') return next();
  if (req.user.role === 'store') return next();
  return res.status(403).json({ error: 'not allowed' });
}

// Simple image upload (base64) for admin (store or super)
app.post('/api/uploads/image', requireStoreOrSuper, async (req, res) => {
  try {
    const { data, filename } = req.body || {}
    if (!data || typeof data !== 'string' || !data.startsWith('data:')) {
      return res.status(400).json({ error: 'Invalid data' })
    }
    const m = data.match(/^data:(.*?);base64,(.*)$/)
    if (!m) return res.status(400).json({ error: 'Invalid data URL' })
    const mime = m[1] || 'application/octet-stream'
    const ext = (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '')
    const base = m[2]
    const buf = Buffer.from(base, 'base64')
    const safeName = (filename && String(filename).replace(/[^a-z0-9._-]/gi, '')) || `img_${Date.now()}.${ext}`
    const finalName = `${Date.now()}_${Math.random().toString(36).slice(2,8)}_${safeName}`
    const filePath = path.join(uploadsDir, finalName)
    fs.writeFileSync(filePath, buf)
    const urlPath = `/uploads/${finalName}`
    res.status(201).json({ url: urlPath })
  } catch (err) {
    console.error('POST /api/uploads/image error', err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// Super admin login (no password required as requested)
app.post('/api/admin/super/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    const rows = await query('SELECT id, email, password_hash, role FROM users WHERE email = ? AND role = ?', [email, 'super']);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = signToken({ role: 'super' });
    res.json({ token, role: 'super' });
  } catch (err) {
    console.error('POST /api/admin/super/login error', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Create store admin (super only)
app.post('/api/admin/canteens/:id/admin', requireSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email & password required' });
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'email exists' });
    const hash = await bcrypt.hash(password, 10);
    await query('INSERT INTO users (email, password_hash, role, store_id) VALUES (?,?,?,?)', [email, hash, 'store', id]);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/canteens/:id/admin error', err);
    res.status(500).json({ error: 'failed to create admin' });
  }
});

// Store admin login (role store)
app.post('/api/admin/store/login', async (req, res) => {
  try {
    const { email, password, canteenId } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email & password required' });
    if (!canteenId) return res.status(400).json({ error: 'canteen selection required' });
    
    const rows = await query('SELECT id, email, password_hash, role, store_id FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'invalid credentials' });
    const u = rows[0];
    if (u.role !== 'store') return res.status(403).json({ error: 'not store admin' });
    
    // Verify the selected canteen matches user's assigned canteen (if they have one)
    // OR allow them to access the selected canteen if they don't have a specific assignment
    if (u.store_id && u.store_id !== canteenId) {
      return res.status(403).json({ error: 'You do not have access to this canteen' });
    }
    
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    
    const token = signToken({ role: 'store', storeId: canteenId });
    res.json({ token, role: 'store', storeId: canteenId });
  } catch (err) {
    console.error('POST /api/admin/store/login error', err);
    res.status(500).json({ error: 'login failed' });
  }
});

// Store admin change password
app.post('/api/admin/store/change-password', requireStoreOrSuper, async (req, res) => {
  try {
    const { currentPassword, newPassword, storeId } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    if (req.user.role !== 'store' || req.user.storeId !== storeId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const rows = await query('SELECT id, password_hash FROM users WHERE store_id = ? AND role = ?', [storeId, 'store']);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/store/change-password error', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Store admin change email
app.post('/api/admin/store/change-email', requireStoreOrSuper, async (req, res) => {
  try {
    const { newEmail, storeId } = req.body || {};
    if (!newEmail) return res.status(400).json({ error: 'New email required' });
    if (req.user.role !== 'store' || req.user.storeId !== storeId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = ?', [newEmail]);
    if (existing.length) return res.status(400).json({ error: 'Email already in use' });

    await query('UPDATE users SET email = ? WHERE store_id = ? AND role = ?', [newEmail, storeId, 'store']);

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/store/change-email error', err);
    res.status(500).json({ error: 'Failed to change email' });
  }
});

// Super admin change password
app.post('/api/admin/super/change-password', requireSuper, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });

    const rows = await query('SELECT id, password_hash FROM users WHERE role = ? LIMIT 1', ['super']);
    if (!rows.length) return res.status(404).json({ error: 'Super admin not found' });

    const user = rows[0];
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/super/change-password error', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Super admin change email
app.post('/api/admin/super/change-email', requireSuper, async (req, res) => {
  try {
    const { newEmail } = req.body || {};
    if (!newEmail) return res.status(400).json({ error: 'New email required' });

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = ? AND role != ?', [newEmail, 'super']);
    if (existing.length) return res.status(400).json({ error: 'Email already in use' });

    const rows = await query('SELECT id FROM users WHERE role = ? LIMIT 1', ['super']);
    if (!rows.length) return res.status(404).json({ error: 'Super admin not found' });

    await query('UPDATE users SET email = ? WHERE id = ?', [newEmail, rows[0].id]);

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/super/change-email error', err);
    res.status(500).json({ error: 'Failed to change email' });
  }
});

// Canteens list (alias of stores) public
app.get('/api/canteens', async (_req, res) => {
  try {
    const rows = await query('SELECT id, name FROM stores ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/canteens error', err);
    res.status(500).json({ error: 'Failed to fetch canteens' });
  }
});

// Branches list (public)
app.get('/api/branches', async (_req, res) => {
  try {
    const rows = await query('SELECT id, name FROM branches ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/branches error', err);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// Canteens by branch (public)
app.get('/api/branches/:id/canteens', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT id, name FROM stores WHERE branch_id = ? ORDER BY name', [id]);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/branches/:id/canteens error', err);
    res.status(500).json({ error: 'Failed to fetch canteens for branch' });
  }
});

// Create canteen (super admin only)
app.post('/api/canteens', requireSuper, async (req, res) => {
  try {
    const { name, id, branchId } = req.body || {};
    const canteenId = id || ('canteen-' + Math.random().toString(36).slice(2,8));
    if (!name) return res.status(400).json({ error: 'name required' });
    await query('INSERT INTO stores (id, name, branch_id) VALUES (?, ?, ?)', [canteenId, name, branchId || null]);
    res.status(201).json({ id: canteenId, name, branchId: branchId || null });
  } catch (err) {
    console.error('POST /api/canteens error', err);
    res.status(500).json({ error: 'Failed to create canteen' });
  }
});

// Create branch (super admin only)
app.post('/api/branches', requireSuper, async (req, res) => {
  try {
    const { name, id } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const branchId = id || ('branch-' + Math.random().toString(36).slice(2,8));
    await query('INSERT INTO branches (id, name) VALUES (?, ?)', [branchId, String(name).slice(0,120)]);
    res.status(201).json({ id: branchId, name: String(name).slice(0,120) });
  } catch (err) {
    console.error('POST /api/branches error', err);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Add canteen under a branch (super admin only)
app.post('/api/branches/:id/canteens', requireSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, canteenId } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const storeId = canteenId || ('canteen-' + Math.random().toString(36).slice(2,8));
    await query('INSERT INTO stores (id, name, branch_id) VALUES (?, ?, ?)', [storeId, String(name).slice(0,120), id]);
    res.status(201).json({ id: storeId, name: String(name).slice(0,120), branchId: id });
  } catch (err) {
    console.error('POST /api/branches/:id/canteens error', err);
    res.status(500).json({ error: 'Failed to create canteen under branch' });
  }
});

// Get menu items for canteen
app.get('/api/canteens/:id/menu', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT id, name, price, veg, category, description, image_url, tax_exempt FROM menu_items WHERE store_id = ? AND active = 1 ORDER BY id', [id]);
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      price: Number(r.price),
      veg: !!r.veg,
      category: r.category || null,
      description: r.description || null,
      imageUrl: r.image_url || null,
      taxExempt: !!r.tax_exempt
    })));
  } catch (err) {
    console.error('GET /api/canteens/:id/menu error', err);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// Add menu item (super or store admin for own canteen)
app.post('/api/canteens/:id/menu', requireStoreOrSuper, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'store' && req.user.storeId !== id) return res.status(403).json({ error: 'wrong canteen' });
    const { name, price, veg, category, description, imageUrl, taxExempt } = req.body || {};
    if (!name || price == null) return res.status(400).json({ error: 'name & price required' });
    await query('INSERT INTO menu_items (store_id, name, price, veg, category, description, image_url, tax_exempt) VALUES (?,?,?,?,?,?,?,?)', [
      id,
      String(name).slice(0,160),
      Number(price),
      veg ? 1 : 0,
      category || null,
      description || null,
      imageUrl || null,
      taxExempt ? 1 : 0
    ]);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/canteens/:id/menu error', err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Update menu item
app.patch('/api/menu-items/:itemId', requireStoreOrSuper, async (req, res) => {
  try {
    const { itemId } = req.params;
    const items = await query('SELECT id, store_id FROM menu_items WHERE id = ?', [itemId]);
    if (!items.length) return res.status(404).json({ error: 'Not found' });
    const storeId = items[0].store_id;
    if (req.user.role === 'store' && req.user.storeId !== storeId) return res.status(403).json({ error: 'wrong canteen' });
    const fields = ['name','price','veg','category','description','imageUrl','taxExempt','active'];
    const updates = [];
    const params = [];
    const body = req.body || {};
    if (body.name) { updates.push('name=?'); params.push(String(body.name).slice(0,160)); }
    if (body.price != null) { updates.push('price=?'); params.push(Number(body.price)); }
    if (body.veg != null) { updates.push('veg=?'); params.push(body.veg ? 1 : 0); }
    if (body.category !== undefined) { updates.push('category=?'); params.push(body.category || null); }
    if (body.imageUrl !== undefined) { updates.push('image_url=?'); params.push(body.imageUrl || null); }
    if (body.description !== undefined) { updates.push('description=?'); params.push(body.description || null); }
    if (body.taxExempt != null) { updates.push('tax_exempt=?'); params.push(body.taxExempt ? 1 : 0); }
    if (body.active != null) { updates.push('active=?'); params.push(body.active ? 1 : 0); }
    if (!updates.length) return res.status(400).json({ error: 'no fields to update' });
    params.push(itemId);
    await query(`UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/menu-items/:itemId error', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete menu item
app.delete('/api/menu-items/:itemId', requireStoreOrSuper, async (req, res) => {
  try {
    const { itemId } = req.params;
    const items = await query('SELECT id, store_id FROM menu_items WHERE id = ?', [itemId]);
    if (!items.length) return res.status(404).json({ error: 'Not found' });
    const storeId = items[0].store_id;
    if (req.user.role === 'store' && req.user.storeId !== storeId) return res.status(403).json({ error: 'wrong canteen' });
    await query('DELETE FROM menu_items WHERE id = ?', [itemId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/menu-items/:itemId error', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Cascade delete a single canteen (store) and related data (super only)
app.delete('/api/canteens/:id', requireSuper, async (req, res) => {
  try {
    const { id } = req.params;
    // Verify store exists
    const stores = await query('SELECT id FROM stores WHERE id = ?', [id]);
    if (!stores.length) return res.status(404).json({ error: 'canteen not found' });
    // Delete order items then orders
    const orderIdsRows = await query('SELECT id FROM orders WHERE store_id = ?', [id]);
    const orderIds = orderIdsRows.map(o => o.id);
    if (orderIds.length) {
      const placeholders = orderIds.map(()=>'?').join(',');
      await query(`DELETE FROM order_items WHERE order_id IN (${placeholders})`, orderIds);
      await query(`DELETE FROM orders WHERE id IN (${placeholders})`, orderIds);
    }
    // Delete menu items
    await query('DELETE FROM menu_items WHERE store_id = ?', [id]);
    // Delete store admins tied to this store
    await query('DELETE FROM users WHERE store_id = ?', [id]);
    // Delete the store itself
    await query('DELETE FROM stores WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/canteens/:id error', err);
    res.status(500).json({ error: 'Failed to delete canteen' });
  }
});

// Cascade delete a branch and all its canteens + related data (super only)
app.delete('/api/branches/:id', requireSuper, async (req, res) => {
  try {
    const { id } = req.params;
    const branches = await query('SELECT id FROM branches WHERE id = ?', [id]);
    if (!branches.length) return res.status(404).json({ error: 'branch not found' });
    // Get all stores under branch
    const storeRows = await query('SELECT id FROM stores WHERE branch_id = ?', [id]);
    const storeIds = storeRows.map(s => s.id);
    if (storeIds.length) {
      // Delete orders + order_items for these stores
      const orderRows = await query(`SELECT id FROM orders WHERE store_id IN (${storeIds.map(()=>'?').join(',')})`, storeIds);
      const orderIds = orderRows.map(o => o.id);
      if (orderIds.length) {
        const orderPh = orderIds.map(()=>'?').join(',');
        await query(`DELETE FROM order_items WHERE order_id IN (${orderPh})`, orderIds);
        await query(`DELETE FROM orders WHERE id IN (${orderPh})`, orderIds);
      }
      // Delete menu items
      await query(`DELETE FROM menu_items WHERE store_id IN (${storeIds.map(()=>'?').join(',')})`, storeIds);
      // Delete store admins
      await query(`DELETE FROM users WHERE store_id IN (${storeIds.map(()=>'?').join(',')})`, storeIds);
      // Delete stores
      await query(`DELETE FROM stores WHERE id IN (${storeIds.map(()=>'?').join(',')})`, storeIds);
    }
    // Finally delete branch
    await query('DELETE FROM branches WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/branches/:id error', err);
    res.status(500).json({ error: 'Failed to delete branch' });
  }
});

// Keep using helper from razorpay.js

// Root endpoint - API info
app.get('/', (req, res) => {
  res.json({
    name: 'Catalyst QSR API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      dbHealth: '/api/db-health',
      branches: '/api/branches',
      canteens: '/api/canteens',
      orders: '/api/orders',
      menu: '/api/canteens/:id/menu'
    },
    documentation: 'See API documentation for full endpoint list'
  });
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// DB Health
app.get('/api/db-health', async (req, res) => {
  try {
    const rows = await query('SELECT 1 AS db');
    const ok = Array.isArray(rows) && rows.length > 0 && rows[0].db === 1;
    res.json({ ok });
  } catch (err) {
    console.error('GET /api/db-health error', err);
    res.status(500).json({ ok: false, error: err?.message || 'DB check failed' });
  }
});

// Issue short-lived admin token without password (legacy public admin access)
app.post('/api/admin/access', (req, res) => {
  try {
    const token = jwt.sign({ admin: true }, ADMIN_JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to issue admin token' });
  }
});

// Stores
app.get('/api/stores', async (req, res) => {
  try {
    const rows = await query('SELECT id, name FROM stores ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/stores error', err);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Orders with role/store filters
// Admin protected orders listing
app.get('/api/orders', async (req, res) => {
  const role = String(req.query.role || '').toLowerCase();
  const store = String(req.query.store || '');

  try {
    let where = '';
    const params = [];
    if (role === 'store' && store) {
      where = 'WHERE o.store_id = ?';
      params.push(store);
    }

    const orders = await query(
      `SELECT o.id, o.store_id, o.customer, o.status, o.total, o.created_at, s.name as store_name
       FROM orders o JOIN stores s ON s.id = o.store_id
       ${where}
       ORDER BY o.created_at DESC`,
      params
    );

    const orderIds = orders.map(o => o.id);
    let items = [];
    if (orderIds.length) {
      const placeholders = orderIds.map(() => '?').join(',');
      items = await query(
        `SELECT order_id, name, qty, price FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id`,
        orderIds
      );
    }

    const itemsByOrder = items.reduce((acc, it) => {
      (acc[it.order_id] = acc[it.order_id] || []).push({
        name: it.name,
        qty: it.qty,
        price: Number(it.price)
      });
      return acc;
    }, {});

    const result = orders.map(o => ({
      id: o.id,
      storeId: o.store_id,
      storeName: o.store_name,
      customer: o.customer,
      status: o.status,
      total: Number(o.total),
      createdAt: o.created_at,
      items: itemsByOrder[o.id] || []
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /api/orders error', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const { storeId, customer, items, total, paymentMethod } = req.body || {}
    if (!storeId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'storeId and items are required' })
    }
    const cust = (customer && String(customer).trim()) || 'Guest'
    const safeItems = items.map(it => ({
      name: String(it.name || '').slice(0,160) || 'Item',
      qty: Math.max(1, Number(it.qty || it.quantity || 1)),
      price: Number(it.price || 0)
    }))

    const computedTotal = safeItems.reduce((s, it) => s + (it.price * it.qty), 0)
    const finalTotal = Number(total ?? computedTotal)

    // Basic ID generator
    const id = 'ORD-' + Math.random().toString(36).slice(2,8).toUpperCase()

    // Insert order
    await query(
      `INSERT INTO orders (id, store_id, customer, payment_method, status, payment_status, total, created_at)
       VALUES (?, ?, ?, ?, 'Pending', 'pending', ?, NOW())`,
      [id, storeId, cust, paymentMethod || null, finalTotal]
    )

    // Insert items
    for (const it of safeItems) {
      await query(
        `INSERT INTO order_items (order_id, name, qty, price) VALUES (?, ?, ?, ?)`,
        [id, it.name, it.qty, it.price]
      )
    }

    // Return created order
    res.status(201).json({
      id,
      storeId,
      customer: cust,
      status: 'Pending',
      paymentStatus: 'pending',
      paymentMethod: paymentMethod || null,
      total: finalTotal,
      createdAt: new Date().toISOString(),
      items: safeItems
    })
  } catch (err) {
    console.error('POST /api/orders error', err)
    res.status(500).json({ error: 'Failed to create order' })
  }
})

// Single order fetch (public)
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(`SELECT o.id, o.store_id, o.customer, o.status, o.total, o.created_at, o.payment_status, o.payment_method, s.name as store_name
      FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const items = await query(`SELECT name, qty, price FROM order_items WHERE order_id = ? ORDER BY id`, [id]);
    res.json({
      id: rows[0].id,
      storeId: rows[0].store_id,
      storeName: rows[0].store_name,
      customer: rows[0].customer,
      status: rows[0].status,
      total: Number(rows[0].total),
      createdAt: rows[0].created_at,
      paymentStatus: rows[0].payment_status,
      paymentMethod: rows[0].payment_method,
      items: items.map(it => ({ name: it.name, qty: it.qty, price: Number(it.price) }))
    });
  } catch (err) {
    console.error('GET /api/orders/:id error', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order status
// Update order status (admin only)
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body || {}
    const allowed = new Set(['Pending','Preparing','Ready','Completed'])
    if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid status' })

    const r = await query(`UPDATE orders SET status = ? WHERE id = ?`, [status, id])
    if (!r || !('affectedRows' in r) || r.affectedRows === 0) {
      return res.status(404).json({ error: 'Order not found' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/orders/:id/status error', err)
    res.status(500).json({ error: 'Failed to update status' })
  }
})

// Delete order (super admin only)
app.delete('/api/orders/:id', requireSuper, async (req, res) => {
  try {
    const { id } = req.params
    // delete items first due to FK
    await query('DELETE FROM order_items WHERE order_id = ?', [id])
    const r = await query('DELETE FROM orders WHERE id = ?', [id])
    if (!r || !('affectedRows' in r) || r.affectedRows === 0) {
      return res.status(404).json({ error: 'Order not found' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/orders/:id error', err)
    res.status(500).json({ error: 'Failed to delete order' })
  }
})

// Auth: Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })

    const existing = await query('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length) return res.status(409).json({ error: 'email already registered' })

    const hash = await bcrypt.hash(password, 10)
    // Force standard users to role 'customer'; no admin signup here
    const r = await query('INSERT INTO users (email, password_hash, role, store_id) VALUES (?, ?, ?, ?)', [email, hash, 'customer', null])
    const id = r.insertId
    const token = jwt.sign({ id, email, role: 'customer', storeId: null }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' })
    res.status(201).json({ token, user: { id, email, role: 'customer', storeId: null } })
  } catch (err) {
    console.error('POST /api/auth/signup error', err)
    res.status(500).json({ error: 'Signup failed' })
  }
})

// Auth: Sign In
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })
    const rows = await query('SELECT id, email, password_hash, role, store_id FROM users WHERE email = ?', [email])
    if (!rows.length) return res.status(401).json({ error: 'invalid credentials' })
    const u = rows[0]
    const ok = await bcrypt.compare(password, u.password_hash)
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })
    const token = jwt.sign({ id: u.id, email: u.email, role: u.role, storeId: u.store_id }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' })
    res.json({ token, user: { id: u.id, email: u.email, role: u.role, storeId: u.store_id } })
  } catch (err) {
    console.error('POST /api/auth/signin error', err)
    res.status(500).json({ error: 'Signin failed' })
  }
})

// Create Razorpay order and DB order (card payments)
app.post('/api/payments/razorpay/start', async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay keys not configured' })
    }
    const { storeId, customer, items, total } = req.body || {}
    if (!storeId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'storeId and non-empty items are required' })
    }
    // Create DB order first with payment_method card and pending
    const cust = (customer && String(customer).trim()) || 'Guest'
    const id = 'ORD-' + Math.random().toString(36).slice(2,8).toUpperCase()
    const safeItems = items.map(it => ({
      name: String(it.name || '').slice(0,160) || 'Item',
      qty: Math.max(1, Number(it.qty || it.quantity || 1)),
      price: Number(it.price || 0)
    }))
    const computedTotal = safeItems.reduce((s, it) => s + (it.price * it.qty), 0)
    const finalTotal = Number(total || computedTotal)
    if (!finalTotal || finalTotal <= 0) {
      return res.status(400).json({ error: 'Invalid total amount' })
    }

    await query(
      `INSERT INTO orders (id, store_id, customer, payment_method, status, payment_status, total, created_at)
       VALUES (?, ?, ?, 'card', 'Pending', 'pending', ?, NOW())`,
      [id, storeId, cust, Number(finalTotal)]
    )
    for (const it of safeItems) {
      await query(`INSERT INTO order_items (order_id, name, qty, price) VALUES (?, ?, ?, ?)`, [id, it.name, it.qty, it.price])
    }

    const amountPaise = Math.round(Number(finalTotal) * 100)
    const rp = getRazorpayInstance()
    if (!rp) return res.status(500).json({ error: 'Razorpay not available' })
    const rpOrder = await rp.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: id,
      notes: { storeId }
    })

    await query(`UPDATE orders SET razorpay_order_id = ? WHERE id = ?`, [rpOrder.id, id])

    res.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      razorpayOrderId: rpOrder.id,
      orderId: id,
      customer: cust,
      storeId
    })
  } catch (err) {
    console.error('POST /api/payments/razorpay/start error', err)
    res.status(500).json({ error: err?.message || 'Failed to start Razorpay payment' })
  }
})

// Aliases matching requested naming (create order / verify payment)
app.post('/api/create-order', async (req, res) => {
  // delegate to the same logic as /api/payments/razorpay/start
  req.url = '/api/payments/razorpay/start'
  app._router.handle(req, res)
})

app.post('/api/verify-payment', async (req, res) => {
  // delegate to the same logic as /api/payments/razorpay/verify
  req.url = '/api/payments/razorpay/verify'
  app._router.handle(req, res)
})

// Optional: Razorpay Webhook to confirm payments server-to-server
// Note: needs raw body to compute signature
app.post('/api/razorpay/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) return res.status(500).json({ error: 'Webhook secret not configured' })
    const signature = req.headers['x-razorpay-signature']
    if (!signature) return res.status(400).json({ error: 'Missing signature header' })

    const body = req.body // Buffer
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
    if (expected !== signature) return res.status(400).json({ error: 'Invalid webhook signature' })

    const payload = JSON.parse(body.toString('utf8'))
    // Handle payment authorized/captured events
    if (payload?.payload?.payment?.entity) {
      const pay = payload.payload.payment.entity
      const orderId = payload?.payload?.order?.entity?.receipt // we set receipt to our order ID
      if (orderId && pay.status === 'captured') {
        await query(
          `UPDATE orders SET payment_status='paid', razorpay_payment_id=? WHERE id=?`,
          [pay.id, orderId]
        )
      }
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('POST /api/razorpay/webhook error', err)
    res.status(500).json({ error: err?.message || 'Webhook handling failed' })
  }
})

// Verify Razorpay signature and mark payment paid
app.post('/api/payments/razorpay/verify', async (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {}
    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing verification fields' })
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay secret not configured' })
    }

    // Optional: ensure the razorpay_order_id matches the one stored for our order
    const rows = await query('SELECT razorpay_order_id FROM orders WHERE id = ?', [orderId])
    if (!rows.length) return res.status(404).json({ error: 'Order not found' })
    const savedOrderId = rows[0].razorpay_order_id
    if (savedOrderId && savedOrderId !== razorpay_order_id) {
      return res.status(400).json({ error: 'Order mismatch' })
    }

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`)
    const digest = hmac.digest('hex')
    const valid = digest === razorpay_signature
    if (!valid) {
      await query(`UPDATE orders SET payment_status='failed' WHERE id = ?`, [orderId])
      return res.status(400).json({ ok: false, error: 'Invalid signature' })
    }

    await query(
      `UPDATE orders SET payment_status='paid', razorpay_payment_id=?, razorpay_signature=? WHERE id=?`,
      [razorpay_payment_id, razorpay_signature, orderId]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('POST /api/payments/razorpay/verify error', err)
    res.status(500).json({ error: err?.message || 'Verification failed' })
  }
})

const PORT = Number(process.env.PORT || 5174);
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
