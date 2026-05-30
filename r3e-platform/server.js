/**
 * R3E Platform — Express API v3.0
 * Database : PostgreSQL via pg Pool (Render PostgreSQL)
 * Auth     : bcrypt password hashing (never plain-text)
 * Env      : DATABASE_URL  (set automatically by Render)
 *            PORT          (set automatically by Render)
 */
'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const { Pool }      = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;
const PUB  = path.join(__dirname, 'public');

/* ════════════════════════════════════════════════
   DATABASE CONNECTION
   Render sets DATABASE_URL automatically.
   ssl: rejectUnauthorized:false is required for
   Render's internal PostgreSQL service.
════════════════════════════════════════════════ */
if (!process.env.DATABASE_URL) {
  console.error('\n❌  DATABASE_URL environment variable is not set.');
  console.error('    On Render: add it in Environment → DATABASE_URL\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,              // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/* ── Auto-create ALL tables on startup ── */
pool.query('SELECT NOW()').then(async () => {
  console.log('✅  PostgreSQL connected');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT 'England', created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS system_users (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, first_name TEXT NOT NULL,
        last_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL, phone TEXT DEFAULT '', status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS user_locations (
        user_id TEXT REFERENCES system_users(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, location_id)
      );
      CREATE TABLE IF NOT EXISTS merchants (
        id TEXT PRIMARY KEY, business_name TEXT NOT NULL, brand_name TEXT NOT NULL,
        category TEXT DEFAULT '', contact_fname TEXT DEFAULT '', contact_lname TEXT DEFAULT '',
        email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, phone TEXT DEFAULT '',
        address TEXT DEFAULT '', town TEXT DEFAULT '', county TEXT DEFAULT '',
        postcode TEXT DEFAULT '', location_id TEXT REFERENCES locations(id),
        status TEXT DEFAULT 'pending', whatsapp_num TEXT, engine_on BOOLEAN DEFAULT FALSE,
        wa_token TEXT, wa_phone_id TEXT, wa_biz_id TEXT, wa_template TEXT,
        wa_send_time TEXT DEFAULT 'business_hours',
        auto_weekly BOOLEAN DEFAULT FALSE, auto_birthday BOOLEAN DEFAULT FALSE,
        auto_welcome BOOLEAN DEFAULT FALSE, auto_reengage BOOLEAN DEFAULT FALSE,
        qr_id TEXT, reg_cert TEXT DEFAULT '', council_cert TEXT DEFAULT '',
        tc_agree BOOLEAN DEFAULT FALSE, approved_by TEXT, approved_at TIMESTAMPTZ,
        rejected_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS merchant_managers (
        id TEXT PRIMARY KEY, merchant_id TEXT REFERENCES merchants(id) ON DELETE CASCADE,
        first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL, phone TEXT DEFAULT '', status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT, merchant_id TEXT REFERENCES merchants(id) ON DELETE CASCADE,
        first_name TEXT DEFAULT '', last_name TEXT DEFAULT '', whatsapp TEXT NOT NULL,
        email TEXT, dob_month TEXT, town TEXT, tc_agree BOOLEAN DEFAULT TRUE,
        subscribed BOOLEAN DEFAULT TRUE, source TEXT DEFAULT 'manual',
        rotation_group TEXT DEFAULT 'A', redemption_count INT DEFAULT 0,
        registered_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (id), UNIQUE (merchant_id, whatsapp)
      );
      CREATE TABLE IF NOT EXISTS discounts (
        merchant_id TEXT REFERENCES merchants(id) ON DELETE CASCADE,
        tier TEXT NOT NULL, day_of_week TEXT NOT NULL,
        pct_min NUMERIC DEFAULT 0, pct_max NUMERIC DEFAULT 0,
        PRIMARY KEY (merchant_id, tier, day_of_week)
      );
      CREATE TABLE IF NOT EXISTS working_hours (
        merchant_id TEXT REFERENCES merchants(id) ON DELETE CASCADE,
        day_of_week TEXT NOT NULL, is_open BOOLEAN DEFAULT FALSE,
        start_time TEXT, end_time TEXT,
        PRIMARY KEY (merchant_id, day_of_week)
      );
      CREATE TABLE IF NOT EXISTS flyers (
        merchant_id TEXT REFERENCES merchants(id) ON DELETE CASCADE,
        slot_index INT NOT NULL, data_url TEXT DEFAULT '',
        uploaded_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (merchant_id, slot_index)
      );
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY, merchant_id TEXT REFERENCES merchants(id) ON DELETE CASCADE,
        campaign_date DATE NOT NULL, tier TEXT NOT NULL, channel TEXT DEFAULT 'whatsapp',
        sent_count INT DEFAULT 0, opened_count INT DEFAULT 0, redeemed_count INT DEFAULT 0,
        status TEXT DEFAULT 'completed', created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY, action TEXT NOT NULL, performed_by TEXT NOT NULL,
        target TEXT DEFAULT '', detail TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY, email TEXT NOT NULL, otp_hash TEXT NOT NULL,
        token_hash TEXT NOT NULL DEFAULT '', expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_prt_email ON password_reset_tokens(LOWER(email));
      CREATE TABLE IF NOT EXISTS social_accounts (
        id             SERIAL PRIMARY KEY,
        merchant_id    TEXT REFERENCES merchants(id) ON DELETE CASCADE,
        platform       TEXT NOT NULL,
        access_token   TEXT,
        refresh_token  TEXT,
        token_expires_at TIMESTAMPTZ,
        account_id     TEXT,
        account_name   TEXT,
        page_id        TEXT,
        page_name      TEXT,
        ig_user_id     TEXT,
        permissions    TEXT DEFAULT '[]',
        connected_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(merchant_id, platform)
      );
    `);
    console.log('✅  All tables ready');

    /* Drop FK constraints that cause issues with email-based approvals */
    await pool.query(`
      ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_approved_by_fkey;
      ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_location_id_fkey;
    `).catch(() => {}); /* ignore if already dropped */

    /* Seed a default super-admin if system_users is empty */
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM system_users');
    if (parseInt(rows[0].n) === 0) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('Admin@R3E2025!', 10);
      await pool.query(
        `INSERT INTO system_users (id,type,first_name,last_name,email,password_hash,phone)
         VALUES ('su_default','superadmin','Super','Admin','admin@r3e.platform',$1,'')
         ON CONFLICT DO NOTHING`,
        [hash]
      );
      console.log('✅  Default super-admin seeded: admin@r3e.platform / Admin@R3E2025!');
    }
  } catch(e) {
    console.error('⚠️  Table migration error:', e.message);
  }
}).catch(err => {
  console.error('❌  PostgreSQL connection failed:', err.message);
  process.exit(1);
});

/* Shorthand query helpers */
const q   = (sql, params=[]) => pool.query(sql, params);
const one = async (sql, params=[]) => { const r = await pool.query(sql, params); return r.rows[0] || null; };
const all = async (sql, params=[]) => { const r = await pool.query(sql, params); return r.rows; };
const run = async (sql, params=[]) => { await pool.query(sql, params); };

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(PUB));

/* ── Helpers ── */
function genId(prefix) {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

async function addLog(action, by='system', target='', detail='') {
  try {
    await run(
      `INSERT INTO audit_logs (action,performed_by,target,detail) VALUES ($1,$2,$3,$4)`,
      [action, by, target, detail]
    );
  } catch (_) { /* non-critical — don't crash on log failure */ }
}

function sanitizeMerchant(m) {
  if (!m) return null;
  return {
    id:           m.id,
    businessName: m.business_name,
    brandName:    m.brand_name,
    category:     m.category,
    contactFName: m.contact_fname,
    contactLName: m.contact_lname,
    email:        m.email,
    phone:        m.phone,
    address:      m.address,
    town:         m.town,
    county:       m.county,
    postcode:     m.postcode,
    location:     m.location_id,
    location_id:  m.location_id,
    status:       m.status,
    whatsappNum:  m.whatsapp_num,
    engineOn:     m.engine_on === true,
    engine_on:    m.engine_on === true,
    waToken:      m.wa_token ? '***configured***' : null,
    waPhoneId:    m.wa_phone_id,
    waBizId:      m.wa_biz_id,
    waTemplate:   m.wa_template,
    waSendTime:   m.wa_send_time,
    autoWeekly:   m.auto_weekly,
    autoBirthday: m.auto_birthday,
    autoWelcome:  m.auto_welcome,
    autoReengage: m.auto_reengage,
    qrId:         m.qr_id,
    regCert:      m.reg_cert,
    councilCert:  m.council_cert,
    approvedBy:   m.approved_by,
    approvedAt:   m.approved_at,
    rejectedAt:   m.rejected_at,
    createdAt:    m.created_at,
  };
}

function sanitizeUser(u, locations=[]) {
  if (!u) return null;
  return {
    id:        u.id,
    type:      u.type,
    firstName: u.first_name,
    lastName:  u.last_name,
    email:     u.email,
    phone:     u.phone,
    status:    u.status,
    createdAt: u.created_at,
    locations,
  };
}

/* Global error handler for async routes */
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════ */
app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  const lc = email.trim().toLowerCase();

  /* 1. System users */
  const su = await one(`SELECT * FROM system_users WHERE LOWER(email)=$1`, [lc]);
  if (su && bcrypt.compareSync(password, su.password_hash)) {
    if (su.status === 'inactive') return res.status(403).json({ error: 'Account deactivated. Contact your administrator.' });
    const locRows = await all(`SELECT location_id FROM user_locations WHERE user_id=$1`, [su.id]);
    const locations = locRows.map(r => r.location_id);
    await addLog('User Login', su.email, `${su.first_name} ${su.last_name}`, `Role: ${su.type}`);
    return res.json({ user: { id:su.id, userType:su.type, subRole:null, email:su.email, firstName:su.first_name, lastName:su.last_name, phone:su.phone, status:su.status, locations } });
  }

  /* 2. Merchant owners */
  const m = await one(`SELECT * FROM merchants WHERE LOWER(email)=$1`, [lc]);
  if (m && bcrypt.compareSync(password, m.password_hash)) {
    await addLog('Merchant Login', m.email, m.brand_name, 'Owner login');
    return res.json({ user: { id:m.id, userType:'merchant', subRole:'owner', email:m.email, firstName:m.contact_fname, lastName:m.contact_lname, merchantId:m.id, brandName:m.brand_name, status:m.status } });
  }

  /* 3. Merchant managers */
  const mm = await one(`SELECT * FROM merchant_managers WHERE LOWER(email)=$1`, [lc]);
  if (mm && bcrypt.compareSync(password, mm.password_hash)) {
    if (mm.status === 'inactive') return res.status(403).json({ error: 'Account deactivated. Contact the merchant owner.' });
    const merchant = await one(`SELECT brand_name FROM merchants WHERE id=$1`, [mm.merchant_id]);
    await addLog('Manager Login', mm.email, merchant?.brand_name, 'Manager login');
    return res.json({ user: { id:mm.id, userType:'merchant', subRole:'manager', email:mm.email, firstName:mm.first_name, lastName:mm.last_name, merchantId:mm.merchant_id, brandName:merchant?.brand_name } });
  }

  /* Delay prevents brute-force timing attacks */
  await new Promise(r => setTimeout(r, 400));
  res.status(401).json({ error: 'Invalid email or password.' });
}));

/* ════════════════════════════════════════════════
   SYSTEM USERS
════════════════════════════════════════════════ */
app.get('/api/users', wrap(async (req, res) => {
  const users = await all(`
    SELECT su.*, ARRAY_AGG(ul.location_id) FILTER (WHERE ul.location_id IS NOT NULL) AS locations
    FROM system_users su
    LEFT JOIN user_locations ul ON su.id = ul.user_id
    GROUP BY su.id ORDER BY su.created_at DESC`);
  res.json(users.map(u => sanitizeUser(u, u.locations || [])));
}));

app.post('/api/users', wrap(async (req, res) => {
  const { type, firstName, lastName, email, password, phone, locations=[], createdBy } = req.body;
  if (!type||!firstName||!lastName||!email||!password) return res.status(400).json({ error:'Missing required fields.' });
  const exists = await one(`SELECT id FROM system_users WHERE LOWER(email)=$1`, [email.toLowerCase()]);
  if (exists) return res.status(409).json({ error:'Email already exists.' });
  const id   = genId('su');
  const hash = bcrypt.hashSync(password, 10);
  await run(`INSERT INTO system_users (id,type,first_name,last_name,email,password_hash,phone) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id,type,firstName,lastName,email.toLowerCase(),hash,phone||'']);
  for (const lid of locations) {
    await run(`INSERT INTO user_locations (user_id,location_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id,lid]);
  }
  await addLog(`${type} Created`, createdBy||'system', `${firstName} ${lastName}`, `Email: ${email}`);
  const u = await one(`SELECT * FROM system_users WHERE id=$1`, [id]);
  res.status(201).json(sanitizeUser(u, locations));
}));

app.put('/api/users/:id', wrap(async (req, res) => {
  const { firstName, lastName, phone, status, locations, updatedBy } = req.body;
  const u = await one(`SELECT * FROM system_users WHERE id=$1`, [req.params.id]);
  if (!u) return res.status(404).json({ error:'User not found.' });
  if (firstName) await run(`UPDATE system_users SET first_name=$1 WHERE id=$2`, [firstName, req.params.id]);
  if (lastName)  await run(`UPDATE system_users SET last_name=$1  WHERE id=$2`, [lastName,  req.params.id]);
  if (phone)     await run(`UPDATE system_users SET phone=$1       WHERE id=$2`, [phone,     req.params.id]);
  if (status)    await run(`UPDATE system_users SET status=$1      WHERE id=$2`, [status,    req.params.id]);
  if (locations) {
    await run(`DELETE FROM user_locations WHERE user_id=$1`, [req.params.id]);
    for (const lid of locations) await run(`INSERT INTO user_locations (user_id,location_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id,lid]);
  }
  await addLog('User Updated', updatedBy||'system', `${u.first_name} ${u.last_name}`, '');
  res.json({ success:true });
}));

app.put('/api/users/:id/password', wrap(async (req, res) => {
  const u = await one(`SELECT * FROM system_users WHERE id=$1`, [req.params.id]);
  if (!u) return res.status(404).json({ error:'User not found.' });
  const { currentPassword, newPassword } = req.body;
  if (currentPassword && !bcrypt.compareSync(currentPassword, u.password_hash)) return res.status(400).json({ error:'Current password is incorrect.' });
  if (!newPassword||newPassword.length<8) return res.status(400).json({ error:'New password must be at least 8 characters.' });
  await run(`UPDATE system_users SET password_hash=$1 WHERE id=$2`, [bcrypt.hashSync(newPassword,10), req.params.id]);
  await addLog('Password Changed', u.email, `${u.first_name} ${u.last_name}`, 'Self-service change');
  res.json({ success:true });
}));

app.put('/api/users/:id/reset-password', wrap(async (req, res) => {
  const u = await one(`SELECT * FROM system_users WHERE id=$1`, [req.params.id]);
  if (!u) return res.status(404).json({ error:'User not found.' });
  const { newPassword, resetBy } = req.body;
  if (!newPassword||newPassword.length<6) return res.status(400).json({ error:'Password must be at least 6 characters.' });
  await run(`UPDATE system_users SET password_hash=$1 WHERE id=$2`, [bcrypt.hashSync(newPassword,10), req.params.id]);
  await addLog('Password Reset', resetBy||'admin', `${u.first_name} ${u.last_name}`, 'Admin reset');
  res.json({ success:true });
}));

/* ════════════════════════════════════════════════
   LOCATIONS
════════════════════════════════════════════════ */
app.get('/api/locations', wrap(async (req, res) => {
  res.json(await all(`SELECT * FROM locations ORDER BY name`));
}));

app.post('/api/locations', wrap(async (req, res) => {
  const { name, region, country='England', createdBy } = req.body;
  if (!name||!region) return res.status(400).json({ error:'Name and region required.' });
  const id = genId('l');
  await run(`INSERT INTO locations (id,name,region,country) VALUES ($1,$2,$3,$4)`, [id,name,region,country]);
  await addLog('Location Created', createdBy||'admin', name, region);
  res.status(201).json({ id, name, region, country });
}));

app.put('/api/locations/:id', wrap(async (req, res) => {
  const { name, region } = req.body;
  await run(`UPDATE locations SET name=COALESCE($1,name), region=COALESCE($2,region) WHERE id=$3`, [name||null,region||null,req.params.id]);
  res.json({ success:true });
}));

/* ════════════════════════════════════════════════
   MERCHANTS
════════════════════════════════════════════════ */
app.get('/api/merchants', wrap(async (req, res) => {
  let sql = `SELECT * FROM merchants WHERE 1=1`;
  const params = [];
  if (req.query.location) { params.push(req.query.location); sql += ` AND location_id=$${params.length}`; }
  if (req.query.status)   { params.push(req.query.status);   sql += ` AND status=$${params.length}`; }
  sql += ` ORDER BY created_at DESC`;
  const rows = await all(sql, params);
  res.json(rows.map(sanitizeMerchant));
}));

app.get('/api/merchants/:id', wrap(async (req, res) => {
  const m = await one(`SELECT * FROM merchants WHERE id=$1`, [req.params.id]);
  if (!m) return res.status(404).json({ error:'Merchant not found.' });
  res.json(sanitizeMerchant(m));
}));

app.post('/api/merchants', wrap(async (req, res) => {
  const { businessName,brandName,category,contactFName,contactLName,email,password,phone,address,town,county,postcode,regCert,councilCert,tcAgree } = req.body;
  if (!email||!password||!businessName||!brandName) return res.status(400).json({ error:'Missing required fields.' });
  const exists = await one(`SELECT id FROM merchants WHERE LOWER(email)=$1`, [email.toLowerCase()]);
  if (exists) return res.status(409).json({ error:'Email already registered.' });
  const id = genId('m');
  await run(`INSERT INTO merchants (id,business_name,brand_name,category,contact_fname,contact_lname,email,password_hash,phone,address,town,county,postcode,reg_cert,council_cert,tc_agree) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [id,businessName,brandName,category||'',contactFName||'',contactLName||'',email.toLowerCase(),bcrypt.hashSync(password,10),phone||'',address||'',town||'',county||'',postcode||'',regCert||'',councilCert||'',tcAgree?true:false]);
  await addLog('Merchant Registered', email, brandName, 'Self-registration');
  const newM = await one(`SELECT * FROM merchants WHERE id=$1`, [id]);
  /* Send submission confirmation email */
  sendApplicationSubmittedEmail(
    email.toLowerCase(),
    brandName,
    `${contactFName||''} ${contactLName||''}`.trim() || brandName
  );
  res.status(201).json(sanitizeMerchant(newM));
}));

app.put('/api/merchants/:id', wrap(async (req, res) => {
  const fieldMap = { brandName:'brand_name', contactFName:'contact_fname', contactLName:'contact_lname', whatsappNum:'whatsapp_num', locationId:'location_id', phone:'phone', address:'address', town:'town', county:'county', postcode:'postcode', status:'status', category:'category', waToken:'wa_token', waPhoneId:'wa_phone_id', waBizId:'wa_biz_id', waTemplate:'wa_template', waSendTime:'wa_send_time', autoWeekly:'auto_weekly', autoBirthday:'auto_birthday', autoWelcome:'auto_welcome', autoReengage:'auto_reengage' };
  const sets = [], vals = [];
  Object.entries(req.body).forEach(([k,v]) => {
    const col = fieldMap[k] || k;
    if (Object.values(fieldMap).includes(col)) { sets.push(`${col}=$${vals.length+1}`); vals.push(v); }
  });
  if (!sets.length) return res.status(400).json({ error:'No valid fields to update.' });
  vals.push(req.params.id);
  await run(`UPDATE merchants SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  await addLog('Merchant Updated', req.body.updatedBy||'admin', req.params.id, sets.join(', '));
  res.json(sanitizeMerchant(await one(`SELECT * FROM merchants WHERE id=$1`, [req.params.id])));
}));

app.put('/api/merchants/:id/approve', wrap(async (req, res) => {
  const m = await one(`SELECT * FROM merchants WHERE id=$1`, [req.params.id]);
  if (!m) return res.status(404).json({ error:'Not found.' });
  const safeName = (m.brand_name||'MER').replace(/[^A-Za-z0-9]/g,'').substring(0,3).toUpperCase() || 'MER';
  const qrId = safeName + '-QR-' + Math.floor(1000+Math.random()*9000);
  await run(
    `UPDATE merchants SET status='approved', approved_by=$1, approved_at=NOW(), qr_id=$2 WHERE id=$3`,
    [req.body.approvedBy||'admin', qrId, req.params.id]
  );
  await addLog('Merchant Approved', req.body.approvedBy||'admin', m.brand_name, 'Documents verified');
  /* Send approval confirmation email */
  sendApplicationApprovedEmail(
    m.email,
    m.brand_name,
    `${m.contact_fname||''} ${m.contact_lname||''}`.trim() || m.brand_name,
    qrId
  );
  res.json({ success:true, qrId });
}));

app.put('/api/merchants/:id/reject', wrap(async (req, res) => {
  const m = await one(`SELECT brand_name, email, contact_fname, contact_lname FROM merchants WHERE id=$1`, [req.params.id]);
  if (!m) return res.status(404).json({ error: 'Merchant not found.' });
  await run(`UPDATE merchants SET status='rejected', rejected_at=NOW() WHERE id=$1`, [req.params.id]);
  await addLog('Merchant Rejected', req.body.rejectedBy||'admin', m.brand_name||req.params.id, req.body.reason||'');
  /* Send rejection email with reason */
  sendApplicationRejectedEmail(
    m.email,
    m.brand_name,
    `${m.contact_fname||''} ${m.contact_lname||''}`.trim() || m.brand_name,
    req.body.reason || ''
  );
  res.json({ success:true });
}));

app.put('/api/merchants/:id/engine', wrap(async (req, res) => {
  const m = await one(`SELECT brand_name FROM merchants WHERE id=$1`, [req.params.id]);
  const on = req.body.engineOn ? true : false;
  await run(`UPDATE merchants SET engine_on=$1 WHERE id=$2`, [on, req.params.id]);
  await addLog(on ? 'Engine Activated' : 'Engine Deactivated', req.body.updatedBy||'merchant', m?.brand_name||req.params.id, '');
  res.json({ engineOn: on });
}));

app.put('/api/merchants/:id/reset-password', wrap(async (req, res) => {
  const { newPassword, resetBy } = req.body;
  if (!newPassword||newPassword.length<8) return res.status(400).json({ error:'Password must be at least 8 characters.' });
  const m = await one(`SELECT brand_name FROM merchants WHERE id=$1`, [req.params.id]);
  await run(`UPDATE merchants SET password_hash=$1 WHERE id=$2`, [bcrypt.hashSync(newPassword,10), req.params.id]);
  await addLog('Merchant Password Reset', resetBy||'admin', m?.brand_name||req.params.id, '');
  res.json({ success:true });
}));

/* ════════════════════════════════════════════════
   MERCHANT MANAGERS
════════════════════════════════════════════════ */
app.get('/api/managers/:mid', wrap(async (req, res) => {
  res.json(await all(`SELECT id,merchant_id,first_name,last_name,email,phone,status,created_at FROM merchant_managers WHERE merchant_id=$1 ORDER BY created_at`, [req.params.mid]));
}));

app.post('/api/managers/:mid', wrap(async (req, res) => {
  const { firstName,lastName,email,password,phone,createdBy } = req.body;
  if (!firstName||!lastName||!email||!password) return res.status(400).json({ error:'Missing required fields.' });
  const exists = await one(`SELECT id FROM merchant_managers WHERE LOWER(email)=$1`, [email.toLowerCase()]);
  if (exists) return res.status(409).json({ error:'Email already exists.' });
  const id = genId('mm');
  await run(`INSERT INTO merchant_managers (id,merchant_id,first_name,last_name,email,password_hash,phone) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id,req.params.mid,firstName,lastName,email.toLowerCase(),bcrypt.hashSync(password,10),phone||'']);
  const m = await one(`SELECT brand_name FROM merchants WHERE id=$1`, [req.params.mid]);
  await addLog('Manager Registered', createdBy||'owner', `${firstName} ${lastName}`, m?.brand_name||'');
  res.status(201).json({ id, merchant_id:req.params.mid, first_name:firstName, last_name:lastName, email, phone, status:'active' });
}));

app.put('/api/managers/:id', wrap(async (req, res) => {
  if (req.body.status) await run(`UPDATE merchant_managers SET status=$1 WHERE id=$2`, [req.body.status, req.params.id]);
  res.json({ success:true });
}));

app.put('/api/managers/:id/reset-password', wrap(async (req, res) => {
  const { newPassword, resetBy } = req.body;
  if (!newPassword||newPassword.length<6) return res.status(400).json({ error:'Password too short.' });
  const mm = await one(`SELECT first_name,last_name FROM merchant_managers WHERE id=$1`, [req.params.id]);
  await run(`UPDATE merchant_managers SET password_hash=$1 WHERE id=$2`, [bcrypt.hashSync(newPassword,10), req.params.id]);
  await addLog('Manager Password Reset', resetBy||'owner', `${mm?.first_name} ${mm?.last_name}`, '');
  res.json({ success:true });
}));

/* ════════════════════════════════════════════════
   CUSTOMERS
════════════════════════════════════════════════ */
app.get('/api/customers/:mid', wrap(async (req, res) => {
  let sql = `SELECT * FROM customers WHERE merchant_id=$1`;
  const params = [req.params.mid];
  if (req.query.search) {
    const s = `%${req.query.search.toLowerCase()}%`;
    sql += ` AND (LOWER(first_name||' '||last_name) LIKE $${params.length+1} OR whatsapp LIKE $${params.length+2} OR LOWER(COALESCE(email,'')) LIKE $${params.length+3})`;
    params.push(s,s,s);
  }
  if (req.query.source) { params.push(req.query.source); sql += ` AND source=$${params.length}`; }
  if (req.query.group)  { params.push(req.query.group);  sql += ` AND rotation_group=$${params.length}`; }
  sql += ` ORDER BY registered_at DESC`;
  const rows = await all(sql, params);
  res.json(rows.map(c => ({
    id:             c.id,
    merchantId:     c.merchant_id,
    firstName:      c.first_name,
    lastName:       c.last_name,
    whatsapp:       c.whatsapp,
    email:          c.email,
    dobMonth:       c.dob_month,
    town:           c.town,
    tcAgree:        c.tc_agree,
    subscribed:     c.subscribed,
    source:         c.source,
    group:          c.rotation_group,
    redemptionCount:c.redemption_count,
    registeredAt:   c.registered_at,
  })));
}));

app.post('/api/customers/:mid', wrap(async (req, res) => {
  const mid = req.params.mid;
  const incoming = Array.isArray(req.body) ? req.body : [req.body];
  const GROUPS = ['A','B','C','D','E','F','G'];
  const countRow = await one(`SELECT COUNT(*) AS n FROM customers WHERE merchant_id=$1`, [mid]);
  let count = parseInt(countRow.n);
  let added = 0;

  const ins = `INSERT INTO customers (id,merchant_id,first_name,last_name,whatsapp,email,dob_month,town,tc_agree,subscribed,source,rotation_group,registered_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (merchant_id,whatsapp) DO NOTHING`;

  for (const c of incoming) {
    if (!c.whatsapp) continue;
    const custId = 'C' + String(count + added + 1).padStart(4,'0');
    const result = await pool.query(ins, [
      custId, mid, c.firstName||c.first_name||'', c.lastName||c.last_name||'',
      c.whatsapp, c.email||null, c.dobMonth||c.dob_month||null, c.town||null,
      c.tcAgree!==false, c.subscribed!==false,
      c.source||'manual', GROUPS[(count+added) % 7],
      c.registeredAt || new Date().toISOString(),
    ]);
    if (result.rowCount > 0) added++;
  }
  if (added) await addLog('Customers Added', req.body?.uploadedBy||'merchant', mid, `${added} new customers`);
  res.status(201).json({ added });
}));

/* ════════════════════════════════════════════════
   DISCOUNTS
════════════════════════════════════════════════ */
app.get('/api/discounts/:mid', wrap(async (req, res) => {
  const rows = await all(`SELECT * FROM discounts WHERE merchant_id=$1 ORDER BY tier,day_of_week`, [req.params.mid]);
  const result = { tier1:[], tier2:[], tier3:[] };
  rows.forEach(r => result[r.tier].push({ day:r.day_of_week, pct:parseFloat(r.pct_min), pctMax:parseFloat(r.pct_max) }));
  res.json(result);
}));

app.put('/api/discounts/:mid', wrap(async (req, res) => {
  const mid = req.params.mid;
  const upsert = `INSERT INTO discounts (merchant_id,tier,day_of_week,pct_min,pct_max) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (merchant_id,tier,day_of_week) DO UPDATE SET pct_min=EXCLUDED.pct_min, pct_max=EXCLUDED.pct_max`;
  const del = `DELETE FROM discounts WHERE merchant_id=$1 AND tier=$2 AND day_of_week=$3`;
  for (const tier of ['tier1','tier2','tier3']) {
    for (const item of (req.body[tier]||[])) {
      if (item.pct > 0) await run(upsert, [mid,tier,item.day,item.pct,item.pctMax||item.pct]);
      else              await run(del, [mid,tier,item.day]);
    }
  }
  await addLog('Discounts Updated', req.body.updatedBy||'merchant', mid, '');
  res.json({ success:true });
}));

/* ════════════════════════════════════════════════
   WORKING HOURS
════════════════════════════════════════════════ */
app.get('/api/hours/:mid', wrap(async (req, res) => {
  const rows = await all(`SELECT * FROM working_hours WHERE merchant_id=$1`, [req.params.mid]);
  const result = {};
  rows.forEach(r => { result[r.day_of_week] = { open:r.is_open, start:r.start_time||'', end:r.end_time||'' }; });
  res.json(result);
}));

app.put('/api/hours/:mid', wrap(async (req, res) => {
  const upsert = `INSERT INTO working_hours (merchant_id,day_of_week,is_open,start_time,end_time) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (merchant_id,day_of_week) DO UPDATE SET is_open=EXCLUDED.is_open, start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time`;
  for (const [day, val] of Object.entries(req.body)) {
    if (['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(day))
      await run(upsert, [req.params.mid, day, val.open?true:false, val.start||null, val.end||null]);
  }
  await addLog('Working Hours Updated', req.body.updatedBy||'merchant', req.params.mid, '');
  res.json({ success:true });
}));

/* ════════════════════════════════════════════════
   FLYERS
════════════════════════════════════════════════ */
app.get('/api/flyers/:mid', wrap(async (req, res) => {
  const rows = await all(`SELECT slot_index,data_url FROM flyers WHERE merchant_id=$1 ORDER BY slot_index`, [req.params.mid]);
  const result = ['','','','','','',''];
  rows.forEach(r => { if (r.slot_index >= 0 && r.slot_index <= 6) result[r.slot_index] = r.data_url||''; });
  res.json(result);
}));

app.put('/api/flyers/:mid', wrap(async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error:'Expected array of 7 data URLs.' });
  const upsert = `INSERT INTO flyers (merchant_id,slot_index,data_url,uploaded_at) VALUES ($1,$2,$3,NOW())
    ON CONFLICT (merchant_id,slot_index) DO UPDATE SET data_url=EXCLUDED.data_url, uploaded_at=NOW()`;
  for (let i = 0; i < 7; i++) await run(upsert, [req.params.mid, i, req.body[i]||'']);
  res.json({ success:true });
}));

/* ════════════════════════════════════════════════
   CAMPAIGNS
════════════════════════════════════════════════ */
app.get('/api/campaigns', wrap(async (req, res) => {
  let sql = `SELECT * FROM campaigns WHERE 1=1`;
  const params = [];
  if (req.query.merchantId) { params.push(req.query.merchantId); sql += ` AND merchant_id=$${params.length}`; }
  sql += ` ORDER BY campaign_date DESC`;
  const rows = await all(sql, params);
  res.json(rows.map(c => ({ id:c.id, merchantId:c.merchant_id, date:c.campaign_date, tier:c.tier, channel:c.channel, sent:c.sent_count, opened:c.opened_count, redeemed:c.redeemed_count, status:c.status, createdAt:c.created_at })));
}));

app.post('/api/campaigns', wrap(async (req, res) => {
  const { merchantId, date, tier, channel='whatsapp', sent=0, opened=0, redeemed=0 } = req.body;
  const id = genId('c');
  await run(`INSERT INTO campaigns (id,merchant_id,campaign_date,tier,channel,sent_count,opened_count,redeemed_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id,merchantId,date,tier,channel,sent,opened,redeemed]);
  res.status(201).json({ id });
}));

/* ════════════════════════════════════════════════
   AUDIT LOGS
════════════════════════════════════════════════ */
app.get('/api/logs', wrap(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit)||100, 500);
  const rows  = await all(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
  res.json(rows.map(l => ({ id:l.id, action:l.action, user:l.performed_by, target:l.target, detail:l.detail, ts:l.created_at })));
}));

/* ════════════════════════════════════════════════
   STATS
════════════════════════════════════════════════ */
app.get('/api/stats/system', wrap(async (req, res) => {
  const [ms, sus, tc, cs] = await Promise.all([
    all(`SELECT status, COUNT(*) AS n FROM merchants GROUP BY status`),
    all(`SELECT type,   COUNT(*) AS n FROM system_users GROUP BY type`),
    one(`SELECT COUNT(*) AS n FROM customers`),
    one(`SELECT COALESCE(SUM(sent_count),0) AS s, COALESCE(SUM(redeemed_count),0) AS r, COUNT(*) AS t FROM campaigns`),
  ]);
  const mmap = {}; ms.forEach(r => mmap[r.status]=parseInt(r.n));
  const smap = {}; sus.forEach(r => smap[r.type]=parseInt(r.n));
  res.json({
    merchants:   { total:ms.reduce((a,r)=>a+parseInt(r.n),0), approved:mmap.approved||0, pending:mmap.pending||0, rejected:mmap.rejected||0 },
    systemUsers: { admins:smap.admin||0, support:smap.support||0 },
    customers:   { total:parseInt(tc.n) },
    campaigns:   { total:parseInt(cs.t), sent:parseInt(cs.s), redeemed:parseInt(cs.r), rate:cs.s>0?Math.round(cs.r/cs.s*100):0 },
  });
}));

app.get('/api/stats/merchant/:id', wrap(async (req, res) => {
  const [tc, cs] = await Promise.all([
    one(`SELECT COUNT(*) AS t, SUM(CASE WHEN subscribed THEN 1 ELSE 0 END) AS sub, SUM(CASE WHEN source='qr' THEN 1 ELSE 0 END) AS qr, SUM(CASE WHEN source='upload' THEN 1 ELSE 0 END) AS up FROM customers WHERE merchant_id=$1`, [req.params.id]),
    one(`SELECT COALESCE(SUM(sent_count),0) AS s, COALESCE(SUM(redeemed_count),0) AS r, COUNT(*) AS t FROM campaigns WHERE merchant_id=$1`, [req.params.id]),
  ]);
  res.json({ customers:{ total:parseInt(tc.t), subscribed:parseInt(tc.sub||0), viaQR:parseInt(tc.qr||0), viaUpload:parseInt(tc.up||0) }, campaigns:{ total:parseInt(cs.t), sent:parseInt(cs.s), redeemed:parseInt(cs.r), rate:cs.s>0?Math.round(cs.r/cs.s*100):0 } });
}));

/* ════════════════════════════════════════════════
   HEALTH CHECK (Render uses this)
════════════════════════════════════════════════ */
app.get('/api/health', wrap(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status:'ok', db:'connected', ts: new Date().toISOString() });
}));


/* ════════════════════════════════════════════════
   EMAIL / OTP HELPERS
════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════
   EMAIL — Resend API (HTTP, works on Render free)
   No SMTP needed. Render blocks SMTP (port 587/465).
   
   Setup: https://resend.com (free — 3,000 emails/month)
   Env vars needed:
     RESEND_API_KEY  — from resend.com dashboard
     EMAIL_FROM      — verified sender address
                       e.g. "R3E Platform <noreply@yourdomain.com>"
                       (use resend.dev domain for testing)
   
   Dev mode: if RESEND_API_KEY not set → OTP logged to console.
════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════
   EMAIL — Brevo (primary, free) + Resend (fallback)
   Brevo: https://app.brevo.com → API Keys (free, 300/day, no domain needed)
   Resend: https://resend.com → API Keys (free but needs domain for others)
════════════════════════════════════════════════ */

async function sendEmail(to, subject, html, devLabel = 'EMAIL') {
  const brevoKey  = process.env.BREVO_API_KEY  || '';
  const resendKey = process.env.RESEND_API_KEY || '';

  if (!brevoKey && !resendKey) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  📧  ${devLabel} (dev — no email key set)`);
    console.log(`  To: ${to} | Subject: ${subject}`);
    console.log(`${'─'.repeat(50)}\n`);
    return;
  }

  /* ── Brevo (recommended — works with any recipient) ── */
  if (brevoKey) {
    try {
      const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || 'noreply@r3eplatform.com';
      const senderName  = 'R3E Platform';
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender:      { name: senderName, email: senderEmail },
          to:          [{ email: to }],
          subject:     subject,
          htmlContent: html,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`  ✉️  [Brevo] Sent → ${to}`);
        return;
      }
      console.error(`  ❌  Brevo error: ${JSON.stringify(data)}`);
    } catch (e) { console.error(`  ❌  Brevo exception: ${e.message}`); }
  }

  /* ── Resend fallback ── */
  if (resendKey) {
    try {
      const from = process.env.EMAIL_FROM || `R3E Platform <onboarding@resend.dev>`;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      const data = await res.json();
      if (res.ok) console.log(`  ✉️  [Resend] Sent → ${to}`);
      else console.error(`  ❌  Resend error: ${JSON.stringify(data)}`);
    } catch (e) { console.error(`  ❌  Resend exception: ${e.message}`); }
  }
}

/* ── Email template wrapper ── */
function emailWrap(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#0B0B0B;font-family:Georgia,serif">
  <div style="max-width:520px;margin:0 auto;background:#111;border:1px solid rgba(201,163,78,0.25);border-radius:8px;overflow:hidden">
    <div style="height:2px;background:linear-gradient(90deg,transparent,#C9A34E,transparent)"></div>
    <div style="padding:28px 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06)">
      <div style="display:inline-block;padding:7px 14px;background:rgba(201,163,78,0.08);border:1px solid rgba(201,163,78,0.2);border-radius:4px;margin-bottom:12px">
        <span style="font-size:12px;font-weight:800;letter-spacing:2px;color:#C9A34E">R3E PLATFORM</span>
      </div>
      <div style="font-size:11px;color:#7A7060;letter-spacing:1.5px;text-transform:uppercase">Customer Retention Engine</div>
    </div>
    <div style="padding:32px">
      <div style="font-size:20px;font-weight:700;color:#F0EDE8;margin-bottom:20px">${title}</div>
      ${bodyHtml}
      <div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#4A4438;line-height:1.7">
        Automated message from R3E Platform. Do not reply.<br/>© ${new Date().getFullYear()} R3E Platform.
      </div>
    </div>
    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,163,78,0.3),transparent)"></div>
  </div></body></html>`;
}

async function sendOTPEmail(toEmail, otp, mins=10) {
  const html = emailWrap('Password Reset Code', `
    <p style="font-size:14px;color:#C8C0B0;line-height:1.75;margin-bottom:22px">
      Use the code below to reset your password — valid for <strong style="color:#C9A34E">${mins} minutes</strong>, single use only.
    </p>
    <div style="background:rgba(201,163,78,0.06);border:1px solid rgba(201,163,78,0.25);border-radius:6px;padding:26px;text-align:center;margin-bottom:20px">
      <div style="font-size:10px;color:#7A7060;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Verification Code</div>
      <div style="font-size:46px;font-weight:800;letter-spacing:14px;color:#C9A34E;font-family:monospace">${otp}</div>
    </div>
    <p style="font-size:13px;color:#7A7060;line-height:1.7">If you did not request this, ignore this email. Never share this code.</p>`);
  await sendEmail(toEmail, 'Your R3E Password Reset Code', html, 'OTP');
}

async function sendApplicationSubmittedEmail(toEmail, brandName, contactName) {
  const html = emailWrap('Application Received', `
    <p style="font-size:14px;color:#C8C0B0;line-height:1.75;margin-bottom:18px">Dear <strong style="color:#F0EDE8">${contactName}</strong>,</p>
    <p style="font-size:14px;color:#C8C0B0;line-height:1.75;margin-bottom:18px">
      Thank you for submitting your application for <strong style="color:#C9A34E">${brandName}</strong>.
    </p>
    <div style="background:rgba(201,163,78,0.06);border-left:3px solid #C9A34E;padding:14px 18px;margin-bottom:20px;border-radius:0 4px 4px 0">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#C9A34E;margin-bottom:8px">What happens next</div>
      <ul style="margin:0;padding-left:16px;font-size:13px;color:#C8C0B0;line-height:2">
        <li>Our team will review your documents</li>
        <li>Review takes <strong style="color:#F0EDE8">up to 24 business hours</strong></li>
        <li>You will receive an email with the decision</li>
      </ul>
    </div>`);
  await sendEmail(toEmail, '✅ R3E — Application Received', html, 'SUBMISSION');
}

async function sendApplicationApprovedEmail(toEmail, brandName, contactName, qrId) {
  const html = emailWrap('Application Approved! 🎉', `
    <p style="font-size:14px;color:#C8C0B0;line-height:1.75;margin-bottom:18px">Dear <strong style="color:#F0EDE8">${contactName}</strong>,</p>
    <p style="font-size:14px;color:#C8C0B0;line-height:1.75;margin-bottom:18px">
      Your application for <strong style="color:#C9A34E">${brandName}</strong> has been <strong style="color:#4ADE80">approved</strong>!
    </p>
    <div style="background:rgba(74,222,128,0.06);border-left:3px solid #4ADE80;padding:14px 18px;margin-bottom:20px;border-radius:0 4px 4px 0">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#4ADE80;margin-bottom:8px">Your account is active</div>
      <ul style="margin:0;padding-left:16px;font-size:13px;color:#C8C0B0;line-height:2">
        <li>QR Code ID: <strong style="color:#C9A34E;font-family:monospace">${qrId}</strong></li>
        <li>Log in to download your QR code and start campaigns</li>
      </ul>
    </div>`);
  await sendEmail(toEmail, '🎉 R3E — Application Approved', html, 'APPROVED');
}

async function sendApplicationRejectedEmail(toEmail, brandName, contactName, reason) {
  const html = emailWrap('Application Update', `
    <p style="font-size:14px;color:#C8C0B0;line-height:1.75;margin-bottom:18px">Dear <strong style="color:#F0EDE8">${contactName}</strong>,</p>
    <p style="font-size:14px;color:#C8C0B0;line-height:1.75;margin-bottom:18px">
      We are unable to approve your application for <strong style="color:#C9A34E">${brandName}</strong> at this time.
    </p>
    ${reason ? `<div style="background:rgba(248,113,113,0.06);border-left:3px solid #F87171;padding:14px 18px;margin-bottom:20px;border-radius:0 4px 4px 0">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#F87171;margin-bottom:6px">Reason</div>
      <div style="font-size:13px;color:#C8C0B0">${reason}</div>
    </div>` : ''}
    <p style="font-size:13px;color:#7A7060;line-height:1.7">Please address the above and resubmit. Contact support if you have questions.</p>`);
  await sendEmail(toEmail, 'R3E — Application Status Update', html, 'REJECTED');
}

async function sendPasswordResetConfirmEmail(toEmail, name) {
  const html = emailWrap('Password Successfully Reset', `
    <p style="font-size:14px;color:#C8C0B0;line-height:1.75;margin-bottom:18px">Dear <strong style="color:#F0EDE8">${name||'User'}</strong>,</p>
    <div style="background:rgba(74,222,128,0.06);border-left:3px solid #4ADE80;padding:14px 18px;margin-bottom:20px;border-radius:0 4px 4px 0">
      <div style="font-size:13px;color:#C8C0B0">Your password was successfully reset on <strong style="color:#F0EDE8">${new Date().toLocaleString('en-GB',{dateStyle:'long',timeStyle:'short'})}</strong>.</div>
    </div>
    <div style="background:rgba(248,113,113,0.06);border-left:3px solid #F87171;padding:14px 18px;border-radius:0 4px 4px 0">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#F87171;margin-bottom:6px">⚠ Didn't do this?</div>
      <div style="font-size:13px;color:#C8C0B0">Contact our support team immediately.</div>
    </div>`);
  await sendEmail(toEmail, '✅ R3E — Password Successfully Reset', html, 'PWD CONFIRM');
}

/* ════════════════════════════════════════════════
   FORGOT PASSWORD — OTP ROUTES
════════════════════════════════════════════════ */

/* POST /api/auth/forgot-password
   Looks up the email in all user tables, generates a 6-digit OTP,
   bcrypt-hashes it, stores it with a 10-min expiry, and sends the email. */
app.post('/api/auth/forgot-password', wrap(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const lc = email.trim().toLowerCase();

  /* Check the email exists in any user table */
  const su = await one(`SELECT id FROM system_users       WHERE LOWER(email)=$1`, [lc]);
  const m  = await one(`SELECT id FROM merchants          WHERE LOWER(email)=$1`, [lc]);
  const mm = await one(`SELECT id FROM merchant_managers  WHERE LOWER(email)=$1`, [lc]);

  if (!su && !m && !mm) {
    /* Return success even for unknown emails — prevents email enumeration */
    return res.json({ success: true });
  }

  /* Invalidate any existing unused tokens for this email */
  await run(`UPDATE password_reset_tokens SET used=TRUE
             WHERE LOWER(email)=$1 AND used=FALSE`, [lc]);

  /* Generate 6-digit OTP */
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash   = bcrypt.hashSync(otp, 10);
  /* Generate a secure server-side token (returned after OTP verified) */
  const token     = require('crypto').randomBytes(32).toString('hex');
  const tokenHash = bcrypt.hashSync(token, 10);

  await run(
    `INSERT INTO password_reset_tokens (email, otp_hash, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
    [lc, otpHash, tokenHash]
  );

  await addLog('Password Reset Requested', lc, lc, 'OTP sent');

  /* Send email (or log to console in dev) */
  try {
    await sendOTPEmail(lc, otp);
  } catch (emailErr) {
    console.error('Email send failed:', emailErr.message);
    /* Don't fail the request — still respond success */
  }

  res.json({ success: true });
}));

/* POST /api/auth/verify-otp
   Validates the 6-digit OTP. If correct, marks it as used and returns
   a one-time reset token the client uses in the next step. */
app.post('/api/auth/verify-otp', wrap(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });
  const lc = email.trim().toLowerCase();

  /* Get the most recent unused, unexpired token for this email */
  const record = await one(
    `SELECT * FROM password_reset_tokens
     WHERE LOWER(email)=$1 AND used=FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [lc]
  );

  if (!record) {
    return res.status(400).json({ error: 'Code has expired or already been used. Please request a new one.' });
  }

  if (!bcrypt.compareSync(otp, record.otp_hash)) {
    return res.status(400).json({ error: 'Incorrect code. Please check and try again.' });
  }

  /* OTP is valid — generate a short-lived reset token */
  const token     = require('crypto').randomBytes(32).toString('hex');
  const tokenHash = bcrypt.hashSync(token, 10);

  /* Mark OTP as used and store new token hash (expires same time) */
  await run(
    `UPDATE password_reset_tokens
     SET used=TRUE, token_hash=$1
     WHERE id=$2`,
    [tokenHash, record.id]
  );

  /* Insert a fresh "verified" record so the reset step can validate */
  await run(
    `INSERT INTO password_reset_tokens (email, otp_hash, token_hash, expires_at, used)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', FALSE)`,
    [lc, record.otp_hash, tokenHash]
  );

  await addLog('OTP Verified', lc, lc, 'Reset token issued');
  res.json({ success: true, token });
}));

/* POST /api/auth/reset-password
   Validates the reset token, updates the password in the correct table,
   and invalidates the token. */
app.post('/api/auth/reset-password', wrap(async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword)
    return res.status(400).json({ error: 'Email, token, and new password are required.' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const lc = email.trim().toLowerCase();

  /* Find the valid (unused, unexpired) token record */
  const record = await one(
    `SELECT * FROM password_reset_tokens
     WHERE LOWER(email)=$1 AND used=FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [lc]
  );

  if (!record || !bcrypt.compareSync(token, record.token_hash)) {
    return res.status(400).json({ error: 'Reset session has expired. Please start over.' });
  }

  /* Invalidate the token immediately (single-use) */
  await run(`UPDATE password_reset_tokens SET used=TRUE WHERE id=$1`, [record.id]);

  /* Also invalidate ALL older tokens for this email */
  await run(`UPDATE password_reset_tokens SET used=TRUE WHERE LOWER(email)=$1`, [lc]);

  const newHash = bcrypt.hashSync(newPassword, 10);

  /* Update password in whichever table the email belongs to */
  const suRow = await one(`SELECT id FROM system_users      WHERE LOWER(email)=$1`, [lc]);
  const mRow  = await one(`SELECT id FROM merchants         WHERE LOWER(email)=$1`, [lc]);
  const mmRow = await one(`SELECT id FROM merchant_managers WHERE LOWER(email)=$1`, [lc]);

  if (suRow) {
    await run(`UPDATE system_users SET password_hash=$1 WHERE id=$2`, [newHash, suRow.id]);
  } else if (mRow) {
    await run(`UPDATE merchants SET password_hash=$1 WHERE id=$2`, [newHash, mRow.id]);
  } else if (mmRow) {
    await run(`UPDATE merchant_managers SET password_hash=$1 WHERE id=$2`, [newHash, mmRow.id]);
  } else {
    return res.status(404).json({ error: 'Account not found.' });
  }

  await addLog('Password Reset Complete', lc, lc, 'Via OTP flow');

  /* Send password reset confirmation email */
  let displayName = lc;
  if (suRow) {
    const u2 = await one(`SELECT first_name, last_name FROM system_users WHERE id=$1`, [suRow.id]);
    if (u2) displayName = `${u2.first_name} ${u2.last_name}`.trim();
  } else if (mRow) {
    const m2 = await one(`SELECT contact_fname, contact_lname, brand_name FROM merchants WHERE id=$1`, [mRow.id]);
    if (m2) displayName = `${m2.contact_fname||''} ${m2.contact_lname||''}`.trim() || m2.brand_name;
  } else if (mmRow) {
    const mm2 = await one(`SELECT first_name, last_name FROM merchant_managers WHERE id=$1`, [mmRow.id]);
    if (mm2) displayName = `${mm2.first_name} ${mm2.last_name}`.trim();
  }
  sendPasswordResetConfirmEmail(lc, displayName);

  res.json({ success: true });
}));


/* ════════════════════════════════════════════════
   AI CHATBOT — Claude API
   Env: ANTHROPIC_API_KEY
════════════════════════════════════════════════ */
app.post('/api/chat', wrap(async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message || message.trim().length === 0)
    return res.status(400).json({ error: 'Message is required.' });

  const apiKey = process.env.GROQ_API_KEY || '';
  if (!apiKey) {
    return res.json({
      reply: "Hi! I'm the R3E assistant. R3E is a customer retention platform for local merchants — automated WhatsApp campaigns, QR code registration, smart scheduling and real-time analytics. Feel free to explore the site or register your business for a free trial!"
    });
  }

  const SYSTEM = `You are the R3E Platform assistant — a helpful, professional AI for R3E, a premium customer retention platform for local SME merchants.

Key facts:
- Automated WhatsApp campaigns (98% open rate vs 20% email)
- QR code customer registration — no app needed
- Smart scheduling engine — personalised offers, prevents fatigue
- Plans: Starter £49/month (500 customers), Growth £129/month (2,500), Enterprise custom
- 14-day free trial, no credit card, GDPR compliant
- Industries: restaurants, cafés, bakeries, grocery, retail, beauty

Keep replies under 120 words. Be warm, professional, and concise.
Guide visitors toward signing up. Never reveal internal business logic.`;

  const messages = [
    ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message.trim() }
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:      'llama3-8b-8192',
        max_tokens: 400,
        temperature: 0.7,
        messages:   [{ role: 'system', content: SYSTEM }, ...messages],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Groq API error:', err);
      return res.status(502).json({ error: 'AI service temporarily unavailable.' });
    }

    const data  = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat service error. Please try again.' });
  }
}));

/* ════════════════════════════════════════════════
   CHATBOT PROXY → Python FastAPI service
   Set CHATBOT_SERVICE_URL in Render env vars
════════════════════════════════════════════════ */
app.post('/api/chatbot', wrap(async (req, res) => {
  const url = process.env.CHATBOT_SERVICE_URL || '';
  if (!url) {
    return res.json({ reply: "AI assistant not configured. Set CHATBOT_SERVICE_URL in Render environment variables." });
  }
  try {
    const r = await fetch(`${url}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    console.error('Chatbot proxy error:', e.message);
    res.status(502).json({ reply: 'AI assistant unavailable. Please try again shortly.' });
  }
}));


/* ════════════════════════════════════════════════
   SOCIAL MEDIA — OAuth + Publishing
   Env vars needed:
     FB_APP_ID, FB_APP_SECRET          (from developers.facebook.com)
     GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (from console.cloud.google.com)
     APP_BASE_URL                       (e.g. https://r3e-platform.onrender.com)
════════════════════════════════════════════════ */

/* GET /api/social/accounts/:mid — list connected platforms */
app.get('/api/social/accounts/:mid', wrap(async (req, res) => {
  const rows = await all(
    `SELECT platform, account_name, page_name, ig_user_id,
            page_id, connected_at, updated_at
     FROM social_accounts WHERE merchant_id=$1`,
    [req.params.mid]
  );
  res.json(rows.map(r => ({
    platform:    r.platform,
    accountName: r.account_name,
    pageName:    r.page_name,
    igUserId:    r.ig_user_id,
    pageId:      r.page_id,
    connectedAt: r.connected_at,
    updatedAt:   r.updated_at,
  })));
}));

/* GET /api/social/connect/:platform?merchantId=xxx — start OAuth */
app.get('/api/social/connect/:platform', wrap(async (req, res) => {
  const { platform } = req.params;
  const { merchantId } = req.query;
  if (!merchantId) return res.status(400).json({ error: 'merchantId required.' });

  const BASE     = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  const redirect = `${BASE}/api/social/callback/${platform}`;
  const state    = Buffer.from(JSON.stringify({ merchantId })).toString('base64url');

  if (platform === 'facebook' || platform === 'instagram') {
    const appId = process.env.FB_APP_ID;
    if (!appId) return res.status(503).send(`
      <script>
        window.opener?.postMessage({ type:'social_error', platform:'${platform}',
          error:'Facebook App ID not configured. Add FB_APP_ID to Render environment.' }, '*');
        window.close();
      </script>`);
    const scope = 'pages_manage_posts,pages_read_engagement,pages_show_list,' +
                  'instagram_basic,instagram_content_publish,business_management';
    return res.redirect(
      `https://www.facebook.com/v19.0/dialog/oauth?` +
      `client_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}` +
      `&scope=${scope}&state=${state}&response_type=code`
    );
  }

  if (platform === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).send(`
      <script>
        window.opener?.postMessage({ type:'social_error', platform:'google',
          error:'Google Client ID not configured. Add GOOGLE_CLIENT_ID to Render environment.' }, '*');
        window.close();
      </script>`);
    const scope = encodeURIComponent(
      'https://www.googleapis.com/auth/business.manage ' +
      'https://www.googleapis.com/auth/userinfo.email'
    );
    return res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}` +
      `&scope=${scope}&state=${state}&response_type=code` +
      `&access_type=offline&prompt=consent`
    );
  }

  res.status(400).json({ error: 'Unknown platform.' });
}));

/* GET /api/social/callback/:platform — OAuth callback */
app.get('/api/social/callback/:platform', wrap(async (req, res) => {
  const { platform } = req.params;
  const { code, state, error: oauthError } = req.query;
  const BASE     = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  const redirect = `${BASE}/api/social/callback/${platform}`;

  const closeWith = (type, data) => res.send(`
    <!DOCTYPE html><html><body>
    <p style="font-family:sans-serif;color:#C9A34E;text-align:center;margin-top:60px">
      ${type === 'success' ? '✅ Connected! You can close this window.' : '❌ ' + data.error}
    </p>
    <script>
      window.opener?.postMessage(${JSON.stringify({ type: 'social_' + type, platform, ...data })}, '*');
      setTimeout(() => window.close(), 1500);
    </script></body></html>`);

  if (oauthError) return closeWith('error', { error: oauthError });

  let merchantId;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    merchantId = decoded.merchantId;
  } catch { return closeWith('error', { error: 'Invalid state parameter.' }); }

  /* ── Facebook / Instagram ── */
  if (platform === 'facebook' || platform === 'instagram') {
    const { FB_APP_ID: appId, FB_APP_SECRET: secret } = process.env;
    try {
      /* Exchange code for short-lived token */
      const tr = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `client_id=${appId}&client_secret=${secret}` +
        `&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`
      );
      const td = await tr.json();
      if (!td.access_token) return closeWith('error', { error: td.error?.message || 'Token exchange failed.' });

      /* Upgrade to long-lived token (60 days) */
      const lr = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&client_id=${appId}&client_secret=${secret}` +
        `&fb_exchange_token=${td.access_token}`
      );
      const ld = await lr.json();
      const userToken = ld.access_token || td.access_token;

      /* Get user profile */
      const ur = await fetch(`https://graph.facebook.com/me?access_token=${userToken}&fields=id,name`);
      const user = await ur.json();

      /* Get Pages + Instagram accounts */
      const pr = await fetch(
        `https://graph.facebook.com/me/accounts?access_token=${userToken}` +
        `&fields=id,name,access_token,instagram_business_account{id,username}`
      );
      const pd = await pr.json();
      const page = pd.data?.[0];

      if (platform === 'facebook') {
        if (!page) return closeWith('error', { error: 'No Facebook Page found. Please create a Facebook Page for your business first.' });
        await run(`
          INSERT INTO social_accounts
            (merchant_id, platform, access_token, account_id, account_name, page_id, page_name, connected_at, updated_at)
          VALUES ($1,'facebook',$2,$3,$4,$5,$6,NOW(),NOW())
          ON CONFLICT (merchant_id, platform) DO UPDATE SET
            access_token=EXCLUDED.access_token, account_id=EXCLUDED.account_id,
            account_name=EXCLUDED.account_name, page_id=EXCLUDED.page_id,
            page_name=EXCLUDED.page_name, updated_at=NOW()`,
          [merchantId, page.access_token, user.id, user.name, page.id, page.name]
        );
        await addLog('Facebook Connected', merchantId, user.name, `Page: ${page.name}`);
        return closeWith('success', { accountName: user.name, pageName: page.name });
      }

      if (platform === 'instagram') {
        const ig = page?.instagram_business_account;
        if (!ig) return closeWith('error', {
          error: 'No Instagram Business Account linked to your Facebook Page. ' +
                 'Please link an Instagram Professional account in Meta Business Suite first.'
        });
        const igr = await fetch(`https://graph.facebook.com/${ig.id}?fields=username,name&access_token=${page.access_token}`);
        const igd = await igr.json();
        await run(`
          INSERT INTO social_accounts
            (merchant_id, platform, access_token, account_id, account_name, page_id, ig_user_id, connected_at, updated_at)
          VALUES ($1,'instagram',$2,$3,$4,$5,$6,NOW(),NOW())
          ON CONFLICT (merchant_id, platform) DO UPDATE SET
            access_token=EXCLUDED.access_token, account_id=EXCLUDED.account_id,
            account_name=EXCLUDED.account_name, page_id=EXCLUDED.page_id,
            ig_user_id=EXCLUDED.ig_user_id, updated_at=NOW()`,
          [merchantId, page.access_token, user.id, igd.username || user.name, page.id, ig.id]
        );
        await addLog('Instagram Connected', merchantId, igd.username || user.name, `Page: ${page.name}`);
        return closeWith('success', { accountName: igd.username || user.name });
      }
    } catch (e) { return closeWith('error', { error: e.message }); }
  }

  /* ── Google Business ── */
  if (platform === 'google') {
    const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: secret } = process.env;
    try {
      const tr = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: clientId, client_secret: secret,
          redirect_uri: redirect, grant_type: 'authorization_code'
        })
      });
      const td = await tr.json();
      if (!td.access_token) return closeWith('error', { error: td.error_description || 'Google token exchange failed.' });

      /* Get user email */
      const ur = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo`, {
        headers: { Authorization: `Bearer ${td.access_token}` }
      });
      const user = await ur.json();

      /* Get Google Business account */
      const br = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${td.access_token}` }
      });
      const bd = await br.json();
      const bizAccount = bd.accounts?.[0];
      const expiresAt  = td.expires_in ? new Date(Date.now() + td.expires_in * 1000) : null;

      await run(`
        INSERT INTO social_accounts
          (merchant_id, platform, access_token, refresh_token, token_expires_at,
           account_id, account_name, page_id, connected_at, updated_at)
        VALUES ($1,'google',$2,$3,$4,$5,$6,$7,NOW(),NOW())
        ON CONFLICT (merchant_id, platform) DO UPDATE SET
          access_token=EXCLUDED.access_token, refresh_token=EXCLUDED.refresh_token,
          token_expires_at=EXCLUDED.token_expires_at, account_id=EXCLUDED.account_id,
          account_name=EXCLUDED.account_name, page_id=EXCLUDED.page_id, updated_at=NOW()`,
        [merchantId, td.access_token, td.refresh_token || null, expiresAt,
         user.id, user.email, bizAccount?.name || null]
      );
      await addLog('Google Business Connected', merchantId, user.email, bizAccount?.name || '');
      return closeWith('success', { accountName: user.email, bizName: bizAccount?.name });
    } catch (e) { return closeWith('error', { error: e.message }); }
  }

  closeWith('error', { error: 'Unknown platform.' });
}));

/* DELETE /api/social/disconnect/:mid/:platform */
app.delete('/api/social/disconnect/:mid/:platform', wrap(async (req, res) => {
  await run(
    `DELETE FROM social_accounts WHERE merchant_id=$1 AND platform=$2`,
    [req.params.mid, req.params.platform]
  );
  await addLog(`${req.params.platform} Disconnected`, req.params.mid, '', 'Social account removed');
  res.json({ success: true });
}));

/* POST /api/social/publish/:mid — publish flyer to connected platforms */
app.post('/api/social/publish/:mid', wrap(async (req, res) => {
  const { platforms, flyerDataUrl, caption = '' } = req.body;
  if (!flyerDataUrl) return res.status(400).json({ error: 'Flyer image required.' });
  const merchantId = req.params.mid;
  const results = {};

  for (const platform of (platforms || [])) {
    const acct = await one(
      `SELECT * FROM social_accounts WHERE merchant_id=$1 AND platform=$2`,
      [merchantId, platform]
    );
    if (!acct) { results[platform] = { success: false, error: 'Account not connected.' }; continue; }

    try {
      /* ── Facebook ── */
      if (platform === 'facebook') {
        const base64 = flyerDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buf    = Buffer.from(base64, 'base64');
        /* Build multipart form manually */
        const boundary = '----R3EBoundary' + Date.now();
        const header   = `--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="flyer.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
        const footer   = `\r\n--${boundary}--\r\n`;
        const msg      = `--${boundary}\r\nContent-Disposition: form-data; name="message"\r\n\r\n${caption}\r\n`;
        const token    = `--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${acct.access_token}\r\n`;
        const body     = Buffer.concat([
          Buffer.from(msg), Buffer.from(token),
          Buffer.from(header), buf, Buffer.from(footer)
        ]);
        const fbr = await fetch(`https://graph.facebook.com/v19.0/${acct.page_id}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          body
        });
        const fbd = await fbr.json();
        results[platform] = fbr.ok
          ? { success: true, postId: fbd.post_id || fbd.id, url: `https://www.facebook.com/${acct.page_id}` }
          : { success: false, error: fbd.error?.message || 'Facebook publish failed.' };
      }

      /* ── Instagram ── */
      else if (platform === 'instagram') {
        /* Instagram requires a public URL. Since flyers are base64, we upload
           to Facebook CDN via the linked page first, then use the media URL. */
        const igId = acct.ig_user_id;
        if (!igId) { results[platform] = { success: false, error: 'No Instagram Business account ID found.' }; continue; }

        /* Step 1: Upload image to Facebook for a public URL */
        const base64 = flyerDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buf    = Buffer.from(base64, 'base64');
        const boundary = '----R3EBoundaryIG' + Date.now();
        const body = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="flyer.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
          buf,
          Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="published"\r\n\r\nfalse\r\n`),
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${acct.access_token}\r\n`),
          Buffer.from(`--${boundary}--\r\n`)
        ]);
        const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${acct.page_id}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          body
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.id) { results[platform] = { success: false, error: 'Failed to upload image for Instagram.' }; continue; }

        /* Step 2: Get the image URL from the uploaded photo */
        const photoRes = await fetch(`https://graph.facebook.com/${uploadData.id}?fields=images&access_token=${acct.access_token}`);
        const photoData = await photoRes.json();
        const imageUrl = photoData.images?.[0]?.source;
        if (!imageUrl) { results[platform] = { success: false, error: 'Could not get public image URL.' }; continue; }

        /* Step 3: Create Instagram media container */
        const containerRes = await fetch(
          `https://graph.facebook.com/v19.0/${igId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${acct.access_token}`,
          { method: 'POST' }
        );
        const containerData = await containerRes.json();
        if (!containerData.id) { results[platform] = { success: false, error: containerData.error?.message || 'Instagram container creation failed.' }; continue; }

        /* Step 4: Publish */
        const pubRes = await fetch(
          `https://graph.facebook.com/v19.0/${igId}/media_publish?creation_id=${containerData.id}&access_token=${acct.access_token}`,
          { method: 'POST' }
        );
        const pubData = await pubRes.json();
        results[platform] = pubRes.ok
          ? { success: true, postId: pubData.id }
          : { success: false, error: pubData.error?.message || 'Instagram publish failed.' };
      }

      /* ── Google Business ── */
      else if (platform === 'google') {
        /* Refresh token if expired */
        let token = acct.access_token;
        if (acct.token_expires_at && new Date(acct.token_expires_at) < new Date() && acct.refresh_token) {
          const rr = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token', refresh_token: acct.refresh_token,
              client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET
            })
          });
          const rd = await rr.json();
          if (rd.access_token) {
            token = rd.access_token;
            const exp = rd.expires_in ? new Date(Date.now() + rd.expires_in * 1000) : null;
            await run(`UPDATE social_accounts SET access_token=$1, token_expires_at=$2, updated_at=NOW() WHERE merchant_id=$3 AND platform='google'`,
              [token, exp, merchantId]);
          }
        }

        /* Get accounts & locations */
        const ar = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const ad = await ar.json();
        const accountName = acct.page_id || ad.accounts?.[0]?.name;
        if (!accountName) { results[platform] = { success: false, error: 'No Google Business account found.' }; continue; }

        const lr = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const ld = await lr.json();
        const locationName = ld.locations?.[0]?.name;
        if (!locationName) { results[platform] = { success: false, error: 'No Google Business location found.' }; continue; }

        /* Create local post */
        const postRes = await fetch(`https://mybusiness.googleapis.com/v4/${locationName}/localPosts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            languageCode: 'en-US',
            summary: caption || 'New update from our business',
            callToAction: { actionType: 'LEARN_MORE' },
            media: [{ mediaFormat: 'PHOTO', sourceUrl: flyerDataUrl }],
            topicType: 'STANDARD'
          })
        });
        const postData = await postRes.json();
        results[platform] = postRes.ok
          ? { success: true, postName: postData.name }
          : { success: false, error: postData.error?.message || 'Google Business publish failed.' };
      }

    } catch (e) {
      results[platform] = { success: false, error: e.message };
    }
  }

  await addLog('Flyer Published', merchantId, platforms.join(', '),
    Object.entries(results).map(([p, r]) => `${p}:${r.success?'✅':'❌'}`).join(' '));
  res.json({ results });
}));



/* POST /api/engine/toggle/:id — toggle engine + trigger WhatsApp if turning ON */
app.post('/api/engine/toggle/:id', wrap(async (req, res) => {
  const { on, triggeredBy } = req.body;
  const m = await one(`SELECT * FROM merchants WHERE id=$1`, [req.params.id]);
  if (!m) return res.status(404).json({ error: 'Merchant not found.' });

  await run(`UPDATE merchants SET engine_on=$1 WHERE id=$2`, [on, req.params.id]);
  await addLog('Engine Toggle', triggeredBy||m.email, m.brand_name, on ? 'Engine started' : 'Engine stopped');

  let waResult = null;
  /* Auto-send WhatsApp to subscribers if engine just turned ON and WA configured */
  if (on && m.wa_token && m.wa_phone_id && m.wa_template) {
    try {
      const customers = await all(
        `SELECT * FROM customers WHERE merchant_id=$1 AND subscribed=TRUE LIMIT 500`,
        [req.params.id]
      );
      let sent = 0, failed = 0;
      for (const c of customers) {
        const msg = (m.wa_template||'')
          .replace(/{firstName}/g, c.first_name||'there')
          .replace(/{lastName}/g,  c.last_name||'')
          .replace(/{brandName}/g, m.brand_name||'')
          .replace(/{town}/g,      c.town||'');

        const phone = (c.whatsapp||'').replace(/\s+/g,'').replace(/^0/,'44').replace(/^\+/,'');
        if (!phone) { failed++; continue; }

        try {
          const r = await fetch(`https://graph.facebook.com/v19.0/${m.wa_phone_id}/messages`, {
            method:'POST',
            headers:{'Authorization':'Bearer '+m.wa_token,'Content-Type':'application/json'},
            body: JSON.stringify({
              messaging_product:'whatsapp', to: phone,
              type:'text', text:{ body: msg }
            })
          });
          const data = await r.json();
          if (r.ok && data.messages?.[0]?.id) sent++;
          else {
            failed++;
            const errMsg = data.error?.error_user_msg || data.error?.message || 'unknown';
            console.error('[WA BULK] Phone:', phone, 'Error:', errMsg);
          }
        } catch { failed++; }
        if (sent % 10 === 0 && sent > 0) await new Promise(r=>setTimeout(r,300));
      }
      waResult = { sent, failed, total: customers.length };
      await addLog('WhatsApp Auto-Send', m.email, m.brand_name, `Engine ON trigger: Sent:${sent} Failed:${failed}`);
    } catch(e) {
      waResult = { error: e.message };
    }
  }

  res.json({ success: true, engineOn: on, whatsapp: waResult });
}));

/* ════════════════════════════════════════════════
   WHATSAPP BUSINESS API ROUTES
   Uses Meta WhatsApp Cloud API (free tier)
   Env: No extra env vars needed — credentials stored per merchant
════════════════════════════════════════════════ */

/* POST /api/whatsapp/test — send a test message */
app.post('/api/whatsapp/test', wrap(async (req, res) => {
  const { phoneId, token, to, message } = req.body;
  if (!phoneId || !token || !to) return res.status(400).json({ error: 'phoneId, token and to are required.' });

  try {
    /* Clean phone: remove spaces, leading +, ensure country code */
    const cleanPhone = to.replace(/\s+/g,'').replace(/^\+/,'').replace(/^0/,'44');

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: { body: message || 'Hello from R3E Platform! Your WhatsApp connection is working correctly.' }
    };

    console.log('[WA TEST] Sending to', cleanPhone, 'via phoneId', phoneId);
    const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    console.log('[WA TEST] Response:', JSON.stringify(data));

    if (r.ok && data.messages?.[0]?.id) {
      res.json({ success: true, messageId: data.messages[0].id });
    } else {
      const errMsg = data.error?.error_user_msg || data.error?.message || JSON.stringify(data);
      const hint = errMsg.includes('not a valid WhatsApp') ? ' — Tip: This number must have WhatsApp installed.'
        : errMsg.includes('Token') || errMsg.includes('token') ? ' — Tip: Check your API Access Token in Meta Business Suite.'
        : errMsg.includes('template') ? ' — Tip: Use a Meta-approved message template for outbound messages.'
        : errMsg.includes('(#131030)') ? ' — Tip: Add this number as a test recipient in Meta Developer Console first.'
        : '';
      res.status(400).json({ success: false, error: errMsg + hint });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}));

/* POST /api/whatsapp/send/:merchantId — bulk send to customers */
app.post('/api/whatsapp/send/:merchantId', wrap(async (req, res) => {
  const { segment = 'all', customMessage } = req.body;
  const merchantId = req.params.merchantId;

  const m = await one(`SELECT * FROM merchants WHERE id=$1`, [merchantId]);
  if (!m) return res.status(404).json({ error: 'Merchant not found.' });
  if (!m.wa_token || !m.wa_phone_id) return res.status(400).json({ error: 'WhatsApp not configured. Please set your API credentials first.' });

  /* Fetch target customers */
  let sql = `SELECT * FROM customers WHERE merchant_id=$1 AND subscribed=TRUE`;
  if (segment === 'qr')       sql += ` AND source='qr'`;
  if (segment === 'upload')   sql += ` AND source='upload'`;
  if (segment === 'birthday') sql += ` AND dob_month=$2`;
  const params = segment === 'birthday'
    ? [merchantId, new Date().toLocaleString('en-GB',{month:'long'})]
    : [merchantId];

  const customers = await all(sql, params);
  if (!customers.length) return res.json({ sent: 0, failed: 0, message: 'No matching customers found.' });

  const template = customMessage || m.wa_template ||
    `Hi {firstName}! ${m.brand_name} has a special offer for you today. Show this message at the counter for your exclusive discount.`;

  let sent = 0, failed = 0;

  for (const c of customers) {
    const msg = template
      .replace(/{firstName}/g, c.first_name || 'there')
      .replace(/{lastName}/g,  c.last_name  || '')
      .replace(/{brandName}/g, m.brand_name || '')
      .replace(/{town}/g,      c.town       || '');

    const phone = (c.whatsapp || '').replace(/\s+/g,'').replace(/^0/,'44');
    if (!phone) { failed++; continue; }

    try {
      const r = await fetch(`https://graph.facebook.com/v19.0/${m.wa_phone_id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${m.wa_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to:   phone,
          type: 'text',
          text: { body: msg }
        })
      });
      const data = await r.json();
      if (r.ok && data.messages?.[0]?.id) sent++;
      else failed++;
    } catch { failed++; }

    /* Rate limit: max 80 msgs/sec on free tier */
    if (sent % 10 === 0) await new Promise(r => setTimeout(r, 200));
  }

  await addLog('WhatsApp Bulk Send', m.email, m.brand_name,
    `Segment:${segment} Sent:${sent} Failed:${failed}`);
  res.json({ sent, failed, total: customers.length });
}));


/* ════════════════════════════════════════════════
   MERCHANT DELETE + CUSTOMER EDIT
════════════════════════════════════════════════ */

/* DELETE /api/merchants/:id — delete merchant + all data */
app.delete('/api/merchants/:id', wrap(async (req, res) => {
  const m = await one(`SELECT brand_name, email FROM merchants WHERE id=$1`, [req.params.id]);
  if (!m) return res.status(404).json({ error: 'Merchant not found.' });
  /* CASCADE deletes customers, discounts, campaigns etc via FK */
  await run(`DELETE FROM merchants WHERE id=$1`, [req.params.id]);
  await addLog('Merchant Deleted', req.body.deletedBy||'admin', m.brand_name, `Email: ${m.email}`);
  res.json({ success: true });
}));

/* PUT /api/customers/:id — update customer data */
app.put('/api/customers/:id', wrap(async (req, res) => {
  const { firstName, lastName, whatsapp, email, dobMonth, town, subscribed } = req.body;
  const existing = await one(`SELECT * FROM customers WHERE id=$1`, [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Customer not found.' });
  await run(`
    UPDATE customers SET
      first_name=$1, last_name=$2, whatsapp=$3,
      email=$4, dob_month=$5, town=$6, subscribed=$7
    WHERE id=$8`,
    [firstName||existing.first_name, lastName||existing.last_name,
     whatsapp||existing.whatsapp, email||existing.email||'',
     dobMonth||existing.dob_month||'', town||existing.town||'',
     subscribed !== undefined ? subscribed : existing.subscribed,
     req.params.id]
  );
  res.json({ success: true });
}));

/* DELETE /api/customers/:id — delete a single customer */
app.delete('/api/customers/:id', wrap(async (req, res) => {
  const c = await one(`SELECT merchant_id FROM customers WHERE id=$1`, [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Customer not found.' });
  await run(`DELETE FROM customers WHERE id=$1`, [req.params.id]);
  res.json({ success: true });
}));

/* GET /api/merchants/:id/document/:type — serve stored document */
app.get('/api/merchants/:id/document/:type', wrap(async (req, res) => {
  const { type } = req.params;
  const col = type === 'reg' ? 'reg_cert' : 'council_cert';
  const m = await one(`SELECT ${col} AS doc FROM merchants WHERE id=$1`, [req.params.id]);
  if (!m?.doc) return res.status(404).json({ error: 'Document not found.' });

  const dataUrl = m.doc;
  if (dataUrl.startsWith('data:')) {
    const [header, b64] = dataUrl.split(',');
    const mime = header.replace('data:','').replace(';base64','');
    const buf  = Buffer.from(b64, 'base64');
    const ext  = mime.includes('pdf') ? 'pdf' : mime.includes('png') ? 'png' : 'jpg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="document.${ext}"`);
    return res.send(buf);
  }
  /* Stored as filename only — return as text */
  res.json({ filename: dataUrl });
}));

/* ════════════════════════════════════════════════
   STATIC PAGE ROUTES
════════════════════════════════════════════════ */
const PAGES = {
  '/':               '/index.html',
  '/app':            '/app.html',
  '/features':       '/features.html',
  '/how-it-works':   '/how-it-works.html',
  '/industries':     '/industries.html',
  '/pricing':        '/pricing.html',
  '/faq':            '/faq.html',
};
Object.entries(PAGES).forEach(([route, file]) =>
  app.get(route, (_, res) => res.sendFile(path.join(PUB, file)))
);
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error:'Not found.' });
  res.sendFile(path.join(PUB, 'index.html'));
});

/* ════════════════════════════════════════════════
   GLOBAL ERROR HANDLER
════════════════════════════════════════════════ */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
});

/* ════════════════════════════════════════════════
   START
════════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   R3E Platform — v3.0 (PostgreSQL)   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`\n  🌐  http://localhost:${PORT}`);
  console.log(`  🗄️   PostgreSQL via DATABASE_URL\n`);
});
