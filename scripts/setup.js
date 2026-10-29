// One-time setup: "npm run setup"
//  1. creates the database named in .env and the tables from database/schema.sql
//  2. creates the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD in .env
//  3. (if SEED_DEMO=true) inserts demo students, sample listings and sample requests
// Safe to run more than once: nothing is duplicated.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { passwordProblem, isValidEmail } = require('../src/utils/validate');
const { getDbOptions } = require('../src/config/dbOptions');

const DEMO_PASSWORD = 'Demo@1234'; // for the SAMPLE students only; never use this style of password for real accounts

async function main() {
  const dbName = process.env.DB_NAME || 'reusehub';
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME may only contain letters, numbers and underscores.');

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (!isValidEmail(adminEmail)) throw new Error('Set a valid ADMIN_EMAIL in .env before running setup.');
  const problem = passwordProblem(adminPassword);
  if (problem) throw new Error('ADMIN_PASSWORD in .env is not acceptable: ' + problem);

  const conn = await mysql.createConnection({ ...getDbOptions(), multipleStatements: true });

  // 1. Database + tables (we drop the CREATE DATABASE / USE lines from the file and use DB_NAME instead)
  // Cloud providers often create the database for you and do not allow CREATE DATABASE; that is fine.
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4`);
  } catch (err) {
    console.log('Could not create the database (' + err.code + '). Assuming "' + dbName + '" already exists.');
  }
  await conn.query(`USE \`${dbName}\``);
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8')
    .replace(/^\s*(CREATE DATABASE|USE)\b.*$/gim, '');
  await conn.query(schema);
  console.log('Tables are ready in database "' + dbName + '".');

  // 2. Administrator
  const [admins] = await conn.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
  if (admins.length) {
    console.log('Admin account already exists (' + adminEmail + '), left unchanged.');
  } else {
    const hash = await bcrypt.hash(adminPassword, 10);
    await conn.query(
      "INSERT INTO users (full_name, email, department, password_hash, role) VALUES (?, ?, 'Administration', ?, 'admin')",
      [(process.env.ADMIN_NAME || 'Platform Admin').slice(0, 100), adminEmail, hash]
    );
    console.log('Admin account created: ' + adminEmail);
  }

  // 3. Demo data
  if (String(process.env.SEED_DEMO).toLowerCase() === 'true') {
    await seedDemo(conn);
  } else {
    console.log('SEED_DEMO is not "true": demo data skipped.');
  }

  await conn.end();
  console.log('Setup finished. Start the site with: npm start');
}

async function seedDemo(conn) {
  const [already] = await conn.query("SELECT id FROM users WHERE email = 'asha@demo.reusehub.local'");
  if (already.length) { console.log('Demo data already present, skipped.'); return; }

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const students = [
    ['Asha Verma', 'asha@demo.reusehub.local', 'Computer Science'],
    ['Rohan Mehta', 'rohan@demo.reusehub.local', 'Mechanical Engineering'],
    ['Priya Nair', 'priya@demo.reusehub.local', 'Chemistry'],
    ['Kabir Singh', 'kabir@demo.reusehub.local', 'Electronics']
  ];
  const ids = [];
  for (const s of students) {
    const [r] = await conn.query("INSERT INTO users (full_name, email, department, password_hash, role) VALUES (?, ?, ?, ?, 'student')", [...s, hash]);
    ids.push(r.insertId);
  }

  // Sample listings (is_sample = 1 so they are never counted as real student activity)
  // [owner index, name, category, description, condition, type, price]
  const items = [
    [0, 'Data Structures and Algorithms Textbook', 'Books', 'Second-year DSA textbook with light pencil notes in two chapters. Cover is intact.', 'Good', 'Exchange', null],
    [1, 'Engineering Mathematics Handwritten Notes', 'Books', 'Neatly handwritten notes covering all five units, with solved previous-year problems.', 'Good', 'Give Away', null],
    [2, 'Lab Coat (Size M)', 'Lab Essentials', 'White cotton lab coat, size medium, washed and ironed. Used for one semester only.', 'Like New', 'Give Away', null],
    [3, 'Scientific Calculator (fx-991)', 'Stationery', 'Works perfectly and has fresh batteries. Includes the original cover.', 'Good', 'Sell', 450],
    [0, 'Drawing Board and T-Square Set', 'Stationery', 'A2 drawing board with a T-square and two set squares. Suitable for engineering graphics.', 'Fair', 'Sell', 300],
    [1, 'Organic Chemistry Reference Book', 'Books', 'Standard organic chemistry reference. Spine is slightly worn but all pages are intact.', 'Fair', 'Exchange', null],
    [2, 'Laptop Backpack', 'Other', 'Navy backpack with a padded laptop compartment. Zips all work.', 'Like New', 'Sell', 600],
    [3, 'Safety Goggles (pack of 2)', 'Lab Essentials', 'Two unused polycarbonate safety goggles, still sealed in the original packaging.', 'New', 'Give Away', null]
  ];
  const itemIds = [];
  for (const it of items) {
    const [r] = await conn.query(
      `INSERT INTO items (owner_id, name, category, description, item_condition, listing_type, price, is_sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [ids[it[0]], it[1], it[2], it[3], it[4], it[5], it[6]]
    );
    itemIds.push(r.insertId);
  }

  // Two sample pending requests so the Requests page is not empty on first run
  await conn.query('INSERT INTO exchange_requests (item_id, requester_id, message, offered_item) VALUES (?, ?, ?, ?)',
    [itemIds[0], ids[1], 'Hi! I need this for next semester. I can offer my Operating Systems notes in exchange.', 'Operating Systems handwritten notes']);
  await conn.query('INSERT INTO exchange_requests (item_id, requester_id, message) VALUES (?, ?, ?)',
    [itemIds[2], ids[3], 'I start chemistry labs next month and need a lab coat. Could I collect it this week?']);

  console.log('Demo data added: 4 sample students (password: ' + DEMO_PASSWORD + '), 8 sample listings, 2 sample requests.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
