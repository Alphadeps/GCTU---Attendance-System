/**
 * Copy every table from one Postgres database to another (e.g. Neon -> Supabase spare).
 *
 *   node scripts/copy-db.js --from <postgres-url> --to <postgres-url> [--replace]
 *   (or set FROM_DATABASE_URL and TO_DATABASE_URL)
 *
 * - Builds the schema on the target with the project's own migrations first.
 * - Copies inside one transaction: if anything fails, the target is left exactly as it was.
 * - Refuses to write into a target that already has data, unless --replace is given.
 * - Even with --replace, refuses when the target holds newer data than the source: that means
 *   the target has become the live database and overwriting it would lose real attendance.
 * - On Supabase, turns on row level security so the tables can't be read through Supabase's
 *   public Data API. The app connects as the table owner, which is not affected.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const BATCH = 500;
const SKIP_TABLES = new Set(['_prisma_migrations']);

function parseArgs(argv) {
  const args = { from: process.env.FROM_DATABASE_URL, to: process.env.TO_DATABASE_URL, replace: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') args.from = argv[++i];
    else if (argv[i] === '--to') args.to = argv[++i];
    else if (argv[i] === '--replace') args.replace = true;
  }
  return args;
}

function describe(url) {
  const u = new URL(url);
  return `${u.hostname}${u.pathname}`;
}

const q = (name) => `"${name.replace(/"/g, '""')}"`;

async function tablesIn(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  return rows.map(r => r.table_name).filter(t => !SKIP_TABLES.has(t));
}

async function columnsOf(client, table) {
  const { rows } = await client.query(
    `SELECT column_name, udt_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  return rows;
}

async function primaryKeyOf(client, table) {
  const { rows } = await client.query(
    `SELECT a.attname FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = $1::regclass AND i.indisprimary`,
    [`public.${q(table)}`]
  );
  return rows.map(r => r.attname);
}

// Parents before children, so foreign keys are satisfied while inserting
async function insertOrder(client, tables) {
  const { rows } = await client.query(
    `SELECT con.conrelid::regclass::text AS child, con.confrelid::regclass::text AS parent
     FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace
     WHERE con.contype = 'f' AND n.nspname = 'public'`
  );
  const clean = (t) => t.replace(/^public\./, '').replace(/^"|"$/g, '');
  const deps = new Map(tables.map(t => [t, new Set()]));
  for (const { child, parent } of rows) {
    const c = clean(child), p = clean(parent);
    if (deps.has(c) && deps.has(p) && c !== p) deps.get(c).add(p);
  }
  const ordered = [];
  const done = new Set();
  while (ordered.length < tables.length) {
    const ready = tables.filter(t => !done.has(t) && [...deps.get(t)].every(p => done.has(p)));
    if (ready.length === 0) throw new Error('Circular foreign keys between tables; cannot order the copy');
    ready.sort();
    for (const t of ready) { ordered.push(t); done.add(t); }
  }
  return ordered;
}

async function rowCount(client, table) {
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM public.${q(table)}`);
  return rows[0].n;
}

// Newest createdAt/updatedAt anywhere in the database
async function latestActivity(client, tables) {
  let latest = null;
  for (const t of tables) {
    const cols = (await columnsOf(client, t)).map(c => c.column_name).filter(c => c === 'createdAt' || c === 'updatedAt');
    for (const c of cols) {
      const { rows } = await client.query(`SELECT max(${q(c)}) AS m FROM public.${q(t)}`);
      if (rows[0].m && (!latest || rows[0].m > latest)) latest = rows[0].m;
    }
  }
  return latest;
}

function buildSchema(url) {
  console.log('\n1. Preparing the tables on the target (project migrations)...');
  execFileSync(process.execPath, [path.join(__dirname, 'migrate-prod.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'inherit'
  });
}

async function main() {
  const { from, to, replace } = parseArgs(process.argv.slice(2));
  if (!from || !to) {
    console.error('Usage: node scripts/copy-db.js --from <source-url> --to <target-url> [--replace]');
    process.exit(1);
  }
  if (describe(from) === describe(to)) {
    console.error('❌ Source and target are the same database. Nothing copied.');
    process.exit(1);
  }
  console.log(`Copying ${describe(from)}  ->  ${describe(to)}`);

  const source = new Client({ connectionString: from });
  await source.connect();
  const sourceTables = await tablesIn(source);
  if (!sourceTables.includes('User')) {
    console.error('❌ The source has no attendance-system tables. Check the --from address.');
    process.exit(1);
  }

  buildSchema(to);

  const target = new Client({ connectionString: to });
  await target.connect();
  const targetTables = await tablesIn(target);
  const tables = await insertOrder(target, sourceTables.filter(t => targetTables.includes(t)));
  const missing = sourceTables.filter(t => !targetTables.includes(t));
  if (missing.length) console.warn(`⚠️  Not on the target, skipped: ${missing.join(', ')}`);

  // Safety checks before touching anything
  const existing = [];
  for (const t of tables) if (await rowCount(target, t) > 0) existing.push(t);
  if (existing.length && !replace) {
    console.error(`❌ The target already has data (${existing.join(', ')}). Nothing copied.`);
    console.error('   Run again with --replace to overwrite it with a fresh copy.');
    process.exit(1);
  }
  if (existing.length) {
    const [srcLatest, dstLatest] = [await latestActivity(source, tables), await latestActivity(target, tables)];
    if (dstLatest && (!srcLatest || dstLatest > srcLatest)) {
      console.error(`❌ The target has newer data (${dstLatest.toISOString()}) than the source (${srcLatest ? srcLatest.toISOString() : 'none'}).`);
      console.error('   It looks like the target is now the live database. Not overwriting it.');
      process.exit(1);
    }
  }

  console.log(`\n2. Copying ${tables.length} tables...`);
  // A consistent snapshot of the source, and an all-or-nothing write to the target
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await target.query('BEGIN');
  const copied = {};
  try {
    if (existing.length) {
      await target.query(`TRUNCATE ${tables.map(t => `public.${q(t)}`).join(', ')} CASCADE`);
    }
    for (const t of tables) {
      const targetCols = new Map((await columnsOf(target, t)).map(c => [c.column_name, c.udt_name]));
      const cols = (await columnsOf(source, t)).map(c => c.column_name).filter(c => targetCols.has(c));
      const jsonCols = new Set(cols.filter(c => ['json', 'jsonb'].includes(targetCols.get(c))));
      const pk = await primaryKeyOf(source, t);
      const orderBy = (pk.length ? pk : cols).map(q).join(', ');
      let n = 0;
      for (let offset = 0; ; offset += BATCH) {
        const { rows } = await source.query(
          `SELECT ${cols.map(q).join(', ')} FROM public.${q(t)} ORDER BY ${orderBy} LIMIT ${BATCH} OFFSET ${offset}`
        );
        if (rows.length === 0) break;
        const values = [];
        const tuples = rows.map(row => `(${cols.map(c => {
          const v = row[c];
          values.push(jsonCols.has(c) && v !== null ? JSON.stringify(v) : v);
          return `$${values.length}`;
        }).join(', ')})`);
        await target.query(`INSERT INTO public.${q(t)} (${cols.map(q).join(', ')}) VALUES ${tuples.join(', ')}`, values);
        n += rows.length;
        if (rows.length < BATCH) break;
      }
      copied[t] = n;
      console.log(`   ${t.padEnd(22)} ${n}`);
    }

    // Auto-increment counters continue after the copied rows
    const { rows: seqs } = await target.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'`
    );
    for (const { table_name, column_name } of seqs) {
      if (!tables.includes(table_name)) continue;
      await target.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT max(${q(column_name)}) FROM public.${q(table_name)}), 0) + 1, false)`,
        [`public.${q(table_name)}`, column_name]
      );
    }

    if (new URL(to).hostname.includes('supabase')) {
      const { rows: notOwned } = await target.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner <> current_user`
      );
      if (notOwned.length === 0) {
        for (const t of [...tables, '_prisma_migrations']) {
          await target.query(`ALTER TABLE public.${q(t)} ENABLE ROW LEVEL SECURITY`);
        }
        console.log('   Row level security on (tables hidden from Supabase\'s public Data API)');
      } else {
        console.warn('⚠️  Some tables are owned by another role; row level security left unchanged.');
      }
    }

    await target.query('COMMIT');
  } catch (err) {
    await target.query('ROLLBACK').catch(() => {});
    console.error(`\n❌ Copy failed, the target was left unchanged: ${err.message}`);
    process.exit(1);
  } finally {
    await source.query('COMMIT').catch(() => {});
  }

  console.log('\n3. Checking row counts...');
  let ok = true;
  for (const t of tables) {
    const d = await rowCount(target, t);
    if (d !== copied[t]) { ok = false; console.error(`   ❌ ${t}: copied ${copied[t]}, target has ${d}`); }
  }
  await source.end();
  await target.end();
  if (!ok) process.exit(1);
  console.log(`\n✅ Done. ${Object.values(copied).reduce((a, b) => a + b, 0)} rows copied to ${describe(to)}.`);
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
