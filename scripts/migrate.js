const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://zssyltbskjvaeqxpiipl.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzc3lsdGJza2p2YWVxeHBpaXBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk0ODI0MCwiZXhwIjoyMDk2NTI0MjQwfQ.ohPwF0FY4VQk-LVFHyFIX7YBQAa15RfJdASQF9P7a9U';
const DB_PASSWORD = 'A7YvVMFQhwRHzLhV';
const PROJECT_REF = 'zssyltbskjvaeqxpiipl';

async function tryManagementAPI(sql) {
  // Try Supabase Management API (uses service role as bearer)
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return response;
}

async function tryProjectSQL(sql) {
  // Try project-level SQL endpoint
  const response = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ query: sql }),
  });
  return response;
}

async function tryDirectPg(statements) {
  const { Client } = require('pg');
  const configs = [
    // IPv6 direct
    `postgresql://postgres:${DB_PASSWORD}@[2600:1f16:1482:9400:f22d:e57e:3c0a:7809]:5432/postgres`,
    // Pooler different regions
    `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-east-2.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  ];

  for (const connStr of configs) {
    const host = connStr.match(/@([^:]+)/)?.[1] ?? connStr;
    try {
      console.log(`  Trying: ${host}...`);
      const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
      await client.connect();
      console.log(`  ✓ Connected via ${host}`);
      for (const stmt of statements) {
        const preview = stmt.replace(/\s+/g, ' ').slice(0, 60);
        try {
          await client.query(stmt);
          console.log(`    ✓ ${preview}...`);
        } catch (err) {
          if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            console.log(`    ~ ${preview}... (skipped, already exists)`);
          } else {
            console.error(`    ✗ ${preview}...\n      ${err.message}`);
          }
        }
      }
      await client.end();
      return true;
    } catch (err) {
      console.log(`  ✗ ${host}: ${err.message}`);
    }
  }
  return false;
}

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/schema.sql'), 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`\n── Kin schema migration ──\n`);

  // 1. Try Management API
  console.log('→ Trying Supabase Management API...');
  try {
    const res = await tryManagementAPI('SELECT 1');
    const text = await res.text();
    if (res.ok) {
      console.log('  ✓ Management API reachable — running full schema...\n');
      let ok = 0, skip = 0, fail = 0;
      for (const stmt of statements) {
        const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
        const r = await tryManagementAPI(stmt);
        const t = await r.json().catch(() => ({}));
        if (r.ok) {
          console.log(`  ✓ ${preview}...`); ok++;
        } else if (t?.message?.includes('already exists') || t?.code === '42P07') {
          console.log(`  ~ ${preview}... (skipped)`); skip++;
        } else {
          console.error(`  ✗ ${preview}...\n    ${JSON.stringify(t)}`); fail++;
        }
      }
      console.log(`\nDone — ${ok} ok, ${skip} skipped, ${fail} failed.`);
      return;
    } else {
      console.log(`  ✗ ${res.status}: ${text.slice(0, 120)}`);
    }
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
  }

  // 2. Try project pg endpoint
  console.log('\n→ Trying project /pg/query endpoint...');
  try {
    const res = await tryProjectSQL('SELECT 1');
    const text = await res.text();
    if (res.ok) {
      console.log('  ✓ pg endpoint reachable');
    } else {
      console.log(`  ✗ ${res.status}: ${text.slice(0, 120)}`);
    }
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
  }

  // 3. Try direct pg connections
  console.log('\n→ Trying direct PostgreSQL connections...');
  const ok = await tryDirectPg(statements);

  if (!ok) {
    console.log('\n──────────────────────────────────────────────────────');
    console.log('Could not connect automatically. Quick manual alternative:');
    console.log('1. Open: https://supabase.com/dashboard/project/zssyltbskjvaeqxpiipl/sql/new');
    console.log('2. Paste the contents of supabase/schema.sql');
    console.log('3. Click Run');
    console.log('──────────────────────────────────────────────────────\n');
    process.exit(1);
  }
}

run();
