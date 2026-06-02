/**
 * R3E Platform — PostgreSQL Seeder v3.0
 * Run once after deploy: npm run seed
 * Reads DATABASE_URL from environment (set by Render)
 */
'use strict';

/* Load .env file for local development only (optional — Render sets env vars automatically).
   This uses Node's built-in fs so no dotenv package is needed. */
try {
  const fs2  = require('fs');
  const path2 = require('path');
  const envPath = path2.join(__dirname, '../.env');
  if (fs2.existsSync(envPath)) {
    fs2.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [key, ...vals] = line.split('=');
      if (key && key.trim() && !key.trim().startsWith('#')) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    });
    console.log('✅  Loaded .env file (local development)');
  }
} catch (_) { /* ignore — env vars set externally */ }

const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');

if (!process.env.DATABASE_URL) {
  console.error('\n❌  DATABASE_URL is not set.\n');
  console.error('  ── To run locally on Windows ─────────────────────────────');
  console.error('  1. Create a file called  .env  in the r3e-platform folder');
  console.error('     (same folder as server.js)');
  console.error('  2. Add this line to it (replace with your actual Render URL):');
  console.error('     DATABASE_URL=postgres://user:pass@host/dbname?sslmode=require');
  console.error('  3. Run from the ROOT folder (not the database folder):');
  console.error('     cd ..   (if you are in the database folder)');
  console.error('     npm run seed');
  console.error('');
  console.error('  ── On Render ────────────────────────────────────────────');
  console.error('  DATABASE_URL is set automatically. Run:  npm run seed');
  console.error('  from the Render Shell tab.\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

const h = pw => bcrypt.hashSync(pw, 10);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const rnd  = (a, b) => a + Math.floor(Math.random() * (b - a));
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };

async function run() {
  const client = await pool.connect();
  console.log('✅  Connected to PostgreSQL\n');

  try {
    await client.query('BEGIN');

    /* ── Apply schema ── */
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅  Schema applied');

    /* ── Wipe existing seed data (idempotent re-runs) ── */
    /* Tables are dropped and recreated by schema.sql above — no separate TRUNCATE needed */

    /* ════════════════ LOCATIONS ════════════════ */
    const LOCS = [
      ['l1','London Central','Greater London','England'],
      ['l2','Manchester North','Greater Manchester','England'],
      ['l3','Birmingham East','West Midlands','England'],
      ['l4','Leeds West','West Yorkshire','England'],
      ['l5','Bristol South','Avon','England'],
    ];
    for (const [id,name,region,country] of LOCS)
      await client.query(`INSERT INTO locations (id,name,region,country) VALUES ($1,$2,$3,$4)`, [id,name,region,country]);
    console.log(`  Locations     : ${LOCS.length}`);

    /* ════════════════ SYSTEM USERS ════════════════ */
    const SYS = [
      { id:'su1', type:'superadmin', fn:'Sarah',  ln:'Mitchell', email:'admin@r3e.platform',    pw:'Admin@R3E2025!',   phone:'+44 7700 100001', locs:['l1','l2','l3','l4','l5'] },
      { id:'su2', type:'admin',      fn:'James',  ln:'Collins',  email:'james.c@r3e.platform',  pw:'Admin@James25',    phone:'+44 7700 100002', locs:['l1','l2'] },
      { id:'su3', type:'admin',      fn:'Priya',  ln:'Sharma',   email:'priya.s@r3e.platform',  pw:'Admin@Priya25',    phone:'+44 7700 100003', locs:['l3','l4'] },
      { id:'su4', type:'support',    fn:'Tom',    ln:'Baker',    email:'tom.b@r3e.platform',    pw:'Support@Tom25',    phone:'+44 7700 100004', locs:['l1'] },
      { id:'su5', type:'support',    fn:'Aisha',  ln:'Khan',     email:'aisha.k@r3e.platform',  pw:'Support@Aisha25',  phone:'+44 7700 100005', locs:['l2'] },
      { id:'su6', type:'admin',      fn:'Laura',  ln:'Spencer',  email:'laura.sp@r3e.platform', pw:'Admin@Laura25',    phone:'+44 7700 100006', locs:['l5'] },
    ];
    for (const u of SYS) {
      await client.query(
        `INSERT INTO system_users (id,type,first_name,last_name,email,password_hash,phone,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'active')`,
        [u.id,u.type,u.fn,u.ln,u.email.toLowerCase(),h(u.pw),u.phone]
      );
      for (const lid of u.locs)
        await client.query(`INSERT INTO user_locations (user_id,location_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [u.id,lid]);
    }
    console.log(`  System users  : ${SYS.length}`);

    /* ════════════════ MERCHANTS ════════════════ */
    const MERCHANTS = [
      { id:'m1', bizName:'Spice Palace Ltd',    brand:'Spice Palace',    cat:'Restaurant',        fn:'Raj',   ln:'Patel',   email:'owner@spicepalace.test', pw:'Spice@Owner25!',  phone:'+44 7700 200001', addr:'12 Curry Lane',   town:'London',     county:'Greater London',      pc:'EC1A 1BB', loc:'l1', status:'approved', wa:'+44 7700 200001', engine:true,  qr:'SPI-QR-4821', cert1:'spice_company_reg.pdf', cert2:'spice_council.pdf', approvedBy:'su2', approvedAt:'2024-02-03T14:30:00.000Z' },
      { id:'m2', bizName:'Burger House Ltd',    brand:'The Burger House', cat:'Fast Food',         fn:'Mike',  ln:'Johnson', email:'owner@burgerhouse.test', pw:'Burger@Owner25!', phone:'+44 7700 200002', addr:'45 High Street',  town:'Manchester', county:'Greater Manchester', pc:'M1 1AD',  loc:'l2', status:'approved', wa:'+44 7700 200002', engine:true,  qr:'BUR-QR-7293', cert1:'burger_reg.pdf',        cert2:'burger_council.pdf', approvedBy:'su2', approvedAt:'2024-02-07T11:00:00.000Z' },
      { id:'m3', bizName:'Sakura Sushi Ltd',    brand:'Sakura Sushi',    cat:'Restaurant',        fn:'Yuki',  ln:'Tanaka',  email:'owner@sakurasushi.test', pw:'Sakura@Owner25!', phone:'+44 7700 200003', addr:'8 Japan Street',  town:'Birmingham', county:'West Midlands',      pc:'B1 1BB',  loc:'l3', status:'pending',  wa:'',              engine:false, qr:'',         cert1:'sakura_reg.pdf',        cert2:'',                  approvedBy:null, approvedAt:null },
      { id:'m4', bizName:'Bella Italia Ltd',    brand:'Bella Italia',    cat:'Restaurant',        fn:'Marco', ln:'Rossi',   email:'owner@bellaitalia.test',  pw:'Bella@Owner25!',  phone:'+44 7700 200004', addr:'22 Roma Road',    town:'Birmingham', county:'West Midlands',      pc:'B2 2CC',  loc:'l3', status:'approved', wa:'+44 7700 200004', engine:false, qr:'BEL-QR-5512', cert1:'bella_reg.pdf',         cert2:'bella_council.pdf', approvedBy:'su3', approvedAt:'2024-02-18T10:00:00.000Z' },
      { id:'m5', bizName:'Green Leaf Cafe Ltd', brand:'Green Leaf Café', cat:'Café / Coffee Shop',fn:'Emma',  ln:'Clarke',  email:'owner@greenleaf.test',    pw:'Green@Owner25!',  phone:'+44 7700 200005', addr:'5 Park Avenue',   town:'Leeds',      county:'West Yorkshire',     pc:'LS1 1AA', loc:'l4', status:'rejected', wa:'',              engine:false, qr:'',         cert1:'',                      cert2:'',                  approvedBy:null, approvedAt:null },
    ];
    for (const m of MERCHANTS) {
      await client.query(
        `INSERT INTO merchants (id,business_name,brand_name,category,contact_fname,contact_lname,email,password_hash,phone,address,town,county,postcode,location_id,status,whatsapp_num,engine_on,qr_id,reg_cert,council_cert,tc_agree,approved_by,approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [m.id,m.bizName,m.brand,m.cat,m.fn,m.ln,m.email.toLowerCase(),h(m.pw),m.phone,m.addr,m.town,m.county,m.pc,m.loc,m.status,m.wa,m.engine,m.qr,m.cert1,m.cert2,true,m.approvedBy,m.approvedAt]
      );
    }
    console.log(`  Merchants     : ${MERCHANTS.length}`);

    /* ════════════════ MANAGERS ════════════════ */
    const MGRS = [
      { id:'mm1', mid:'m1', fn:'Anita',   ln:'Singh',  email:'manager@spicepalace.test', pw:'Spice@Mgr25!',  phone:'+44 7700 300001', status:'active'   },
      { id:'mm2', mid:'m2', fn:'Chris',   ln:'Evans',  email:'manager@burgerhouse.test', pw:'Burger@Mgr25!', phone:'+44 7700 300002', status:'active'   },
      { id:'mm3', mid:'m4', fn:'Sofia',   ln:'Marino', email:'manager@bellaitalia.test', pw:'Bella@Mgr25!',  phone:'+44 7700 300003', status:'active'   },
    ];
    for (const m of MGRS)
      await client.query(`INSERT INTO merchant_managers (id,merchant_id,first_name,last_name,email,password_hash,phone,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [m.id,m.mid,m.fn,m.ln,m.email.toLowerCase(),h(m.pw),m.phone,m.status]);
    console.log(`  Managers      : ${MGRS.length}`);

    /* ════════════════ WORKING HOURS ════════════════ */
    const HOURS = {
      m1: { Mon:[true,'11:00','22:00'],Tue:[true,'11:00','22:00'],Wed:[true,'11:00','22:00'],Thu:[true,'11:00','22:00'],Fri:[true,'11:00','23:00'],Sat:[true,'10:00','23:00'],Sun:[true,'12:00','21:00'] },
      m2: { Mon:[true,'10:00','23:00'],Tue:[true,'10:00','23:00'],Wed:[true,'10:00','23:00'],Thu:[true,'10:00','23:00'],Fri:[true,'10:00','00:00'],Sat:[true,'09:00','00:00'],Sun:[false,null,null] },
      m3: { Mon:[false,null,null],Tue:[false,null,null],Wed:[false,null,null],Thu:[false,null,null],Fri:[false,null,null],Sat:[false,null,null],Sun:[false,null,null] },
      m4: { Mon:[false,null,null],Tue:[true,'12:00','22:00'],Wed:[true,'12:00','22:00'],Thu:[true,'12:00','22:00'],Fri:[true,'12:00','23:00'],Sat:[true,'11:00','23:00'],Sun:[true,'12:00','21:00'] },
      m5: { Mon:[false,null,null],Tue:[false,null,null],Wed:[false,null,null],Thu:[false,null,null],Fri:[false,null,null],Sat:[false,null,null],Sun:[false,null,null] },
    };
    for (const [mid,days] of Object.entries(HOURS))
      for (const [day,[open,start,end]] of Object.entries(days))
        await client.query(`INSERT INTO working_hours (merchant_id,day_of_week,is_open,start_time,end_time) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [mid,day,open,start,end]);

    /* ════════════════ DISCOUNTS ════════════════ */
    const DISC = {
      m1: { tier1:{Mon:[8,12],Tue:[10,15],Wed:[12,18],Thu:[8,12],Fri:[18,25],Sat:[22,30],Sun:[15,22]}, tier2:{Mon:[12,18],Tue:[15,20],Wed:[18,25],Thu:[12,18],Fri:[22,30],Sat:[27,35],Sun:[18,26]}, tier3:{Mon:[18,24],Fri:[28,35],Sat:[32,40]} },
      m2: { tier1:{Mon:[3,7],Tue:[3,7],Wed:[8,12],Thu:[3,7],Fri:[12,18],Sat:[18,25]},                  tier2:{Mon:[6,10],Fri:[16,22],Sat:[20,28]},                                                    tier3:{Fri:[20,26],Sat:[25,32]} },
      m4: { tier1:{Tue:[8,12],Wed:[10,14],Thu:[8,12],Fri:[16,22],Sat:[20,28],Sun:[12,18]},             tier2:{Fri:[20,26],Sat:[25,32],Sun:[16,22]},                                                    tier3:{Fri:[25,32],Sat:[30,38]} },
    };
    for (const [mid,tiers] of Object.entries(DISC))
      for (const [tier,days] of Object.entries(tiers))
        for (const [day,range] of Object.entries(days))
          await client.query(`INSERT INTO discounts (merchant_id,tier,day_of_week,pct_min,pct_max) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [mid,tier,day,range[0],range[1]]);

    /* ════════════════ CUSTOMERS ════════════════ */
    const FM = ['James','Oliver','Harry','Noah','Ethan','Lucas','Mohammed','Ahmed','Raj','Arjun','Wei','Daniel','Charlie','Thomas','George','Leo','Alfie','Liam','Marcus','Ryan'];
    const FF = ['Sophia','Olivia','Amelia','Isabella','Emma','Fatima','Aisha','Priya','Anita','Kavya','Mei','Grace','Lily','Emily','Mia','Freya','Isla','Ruby','Chloe','Elena'];
    const FL = ['Smith','Jones','Taylor','Brown','Williams','Khan','Ali','Ahmed','Patel','Sharma','Singh','Chen','Wang','Robinson','Wright','Evans','Walker','Green','Hall','Davis'];
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const TOWNS  = { m1:['London','Islington','Camden','Hackney','Southwark','Lambeth'], m2:['Manchester','Salford','Stockport','Bolton','Bury','Stretford'], m3:['Birmingham','Solihull','Erdington','Handsworth'], m4:['Birmingham','Solihull','Coventry','Dudley'], m5:[] };
    const GROUPS = ['A','B','C','D','E','F','G'];
    const COUNTS = { m1:122, m2:114, m3:108, m4:96, m5:0 };
    let totalCusts = 0;
    let globalOffset = 0;

    for (const [mid, count] of Object.entries(COUNTS)) {
      for (let i = 0; i < count; i++) {
        const fn  = Math.random() > .5 ? pick(FM) : pick(FF);
        const ln  = pick(FL);
        const idx = globalOffset + i;
        const custId = 'C' + String(idx + 1).padStart(4,'0');
        const wa  = '+44 7' + String(700000000 + idx).toString().padStart(9,'0');
        await client.query(
          `INSERT INTO customers (id,merchant_id,first_name,last_name,whatsapp,email,dob_month,town,tc_agree,subscribed,source,rotation_group,registered_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
          [ custId, mid, fn, ln, wa,
            `${fn.toLowerCase()}.${ln.toLowerCase()}${idx}@${pick(['gmail','yahoo','hotmail'])}.com`,
            pick(MONTHS), pick(TOWNS[mid]||['Town']),
            true, Math.random() > 0.1, Math.random() > 0.42 ? 'qr' : 'upload',
            GROUPS[idx % 7], daysAgo(rnd(1,180)) ]
        );
        totalCusts++;
      }
      globalOffset += count;
    }
    console.log(`  Customers     : ${totalCusts}`);

    /* ════════════════ CAMPAIGNS ════════════════ */
    let campCount = 0;
    for (const [mid, n] of [['m1',22],['m2',18],['m4',12]]) {
      for (let i = 0; i < n; i++) {
        const d = new Date(); d.setDate(d.getDate() - i * 4);
        const dateStr = d.toISOString().split('T')[0];
        const sent = rnd(40,120), opened = Math.floor(sent*(0.55+Math.random()*0.3)), redeemed = Math.floor(opened*(0.25+Math.random()*0.35));
        await client.query(`INSERT INTO campaigns (id,merchant_id,campaign_date,tier,channel,sent_count,opened_count,redeemed_count,status) VALUES ($1,$2,$3,$4,'whatsapp',$5,$6,$7,'completed')`,
          [`c-${mid}-${i}`, mid, dateStr, pick(['tier1','tier2','tier3']), sent, opened, redeemed]);
        campCount++;
      }
    }
    console.log(`  Campaigns     : ${campCount}`);

    /* ════════════════ AUDIT LOGS ════════════════ */
    const LOGS = [
      ['System Initialised',      'system',              'R3E Platform v3.0', 'Database seeded with PostgreSQL'],
      ['Merchant Approved',       'james.c@r3e.platform','Spice Palace',      'Documents verified'],
      ['Merchant Approved',       'james.c@r3e.platform','The Burger House',  'Documents verified'],
      ['Merchant Approved',       'priya.s@r3e.platform','Bella Italia',      'Documents verified'],
      ['Merchant Rejected',       'priya.s@r3e.platform','Green Leaf Café',   'Incomplete council certificate'],
      ['Engine Activated',        'owner@spicepalace.test','Spice Palace',     'Campaign engine enabled'],
      ['Engine Activated',        'owner@burgerhouse.test','The Burger House', 'Campaign engine enabled'],
      ['Customers Imported',      'owner@spicepalace.test','Spice Palace',     '122 customers imported via CSV'],
      ['Manager Registered',      'owner@spicepalace.test','Anita Singh',      'New manager created'],
      ['Working Hours Set',       'owner@spicepalace.test','Spice Palace',     'Mon-Sun hours configured'],
    ];
    for (const [action,by,target,detail] of LOGS)
      await client.query(`INSERT INTO audit_logs (action,performed_by,target,detail) VALUES ($1,$2,$3,$4)`, [action,by,target,detail]);
    console.log(`  Audit logs    : ${LOGS.length}`);

    await client.query('COMMIT');
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   ✅  Database seeded successfully!        ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('Test accounts saved to: database/CREDENTIALS.md\n');

    /* Write credentials file (never served by Express) */
    fs.writeFileSync(path.join(__dirname, 'CREDENTIALS.md'), `# R3E Test Credentials
> ⚠️  KEEP PRIVATE — never commit to version control

## System Users
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@r3e.platform | Admin@R3E2025! |
| Admin (London/Manchester) | james.c@r3e.platform | Admin@James25 |
| Admin (Birmingham/Leeds) | priya.s@r3e.platform | Admin@Priya25 |
| Support (London) | tom.b@r3e.platform | Support@Tom25 |
| Support (Manchester) | aisha.k@r3e.platform | Support@Aisha25 |

## Merchant Owners
| Merchant | Email | Password |
|----------|-------|----------|
| Spice Palace (Approved, engine ON) | owner@spicepalace.test | Spice@Owner25! |
| The Burger House (Approved, engine ON) | owner@burgerhouse.test | Burger@Owner25! |
| Sakura Sushi (Pending) | owner@sakurasushi.test | Sakura@Owner25! |
| Bella Italia (Approved) | owner@bellaitalia.test | Bella@Owner25! |
| Green Leaf Café (Rejected) | owner@greenleaf.test | Green@Owner25! |

## Managers
| Manager | Email | Password |
|---------|-------|----------|
| Anita Singh (Spice Palace) | manager@spicepalace.test | Spice@Mgr25! |
| Chris Evans (Burger House) | manager@burgerhouse.test | Burger@Mgr25! |
| Sofia Marino (Bella Italia) | manager@bellaitalia.test | Bella@Mgr25! |
`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
