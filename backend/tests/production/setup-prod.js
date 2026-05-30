'use strict';
/**
 * Production Load-Test Setup
 *
 * Creates 2,000 test students enrolled in the REP's class, then opens an
 * ONLINE attendance session. Writes the output files k6 needs.
 *
 * Roles used:
 *   SUPERADMIN (superadmin/123456)  — adds students to class
 *   REP        (kingsley123/123456) — closes sessions, creates new session
 *
 * Usage:
 *   node tests/production/setup-prod.js
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const BASE          = process.env.PROD_API_URL || 'https://class-attendance-backend-o80x.onrender.com/api';
const SUPERADMIN_USER = process.env.SUPERADMIN_USER || 'superadmin';
const SUPERADMIN_PASS = process.env.SUPERADMIN_PASS || '123456';
const REP_USER        = process.env.REP_USER        || 'kingsley123';
const REP_PASS        = process.env.REP_PASS        || '123456';
const STUDENT_COUNT   = parseInt(process.env.STUDENT_COUNT || '2000', 10);
const ENROLL_BATCH    = 500;   // students per addStudentsToClass request

// ── minimal HTTP helpers ─────────────────────────────────────────────────────

function request(method, urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url  = new URL(urlStr);
    const lib  = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = lib.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });

    req.on('error', reject);
    req.setTimeout(60_000, () => { req.destroy(new Error('Request timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

const get   = (url, token)       => request('GET',   url, null, token ? { Authorization: `Bearer ${token}` } : {});
const post  = (url, body, token) => request('POST',  url, body, token ? { Authorization: `Bearer ${token}` } : {});
const patch = (url, body, token) => request('PATCH', url, body, token ? { Authorization: `Bearer ${token}` } : {});

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(' GCTU Production Load-Test Setup');
  console.log(` API : ${BASE}`);
  console.log(`${'═'.repeat(62)}\n`);

  // 1. Login both accounts in parallel
  process.stdout.write('1. Logging in (superadmin + REP)... ');
  const [saRes, repRes] = await Promise.all([
    post(`${BASE}/auth/login`, { username: SUPERADMIN_USER, password: SUPERADMIN_PASS }),
    post(`${BASE}/auth/login`, { username: REP_USER,        password: REP_PASS        })
  ]);

  if (saRes.status !== 200) {
    console.error(`\n   SUPERADMIN login FAILED (${saRes.status}):`, saRes.body);
    process.exit(1);
  }
  if (repRes.status !== 200) {
    console.error(`\n   REP login FAILED (${repRes.status}):`, repRes.body);
    process.exit(1);
  }

  const saToken  = saRes.body.token  || saRes.body.accessToken;
  const repToken = repRes.body.token || repRes.body.accessToken;
  const repClassId = repRes.body.user?.assignedClass?.id;
  console.log('✓');
  console.log(`   REP class : ${repRes.body.user?.assignedClass?.displayName}`);
  console.log(`   Class ID  : ${repClassId}`);

  if (!repClassId) {
    console.error('\n   REP has no assigned class — cannot proceed.');
    process.exit(1);
  }

  // 2. Close any open sessions (REP token — REP/ADMIN only)
  process.stdout.write('\n2. Checking for open sessions... ');
  const activeRes    = await get(`${BASE}/sessions/active`);
  const activeSessions = Array.isArray(activeRes.body) ? activeRes.body : [];
  console.log(`found ${activeSessions.length}`);

  for (const s of activeSessions) {
    process.stdout.write(`   Closing ${s.id.slice(0, 8)}... `);
    const r = await patch(`${BASE}/sessions/${s.id}/close`, {}, repToken);
    console.log(r.status === 200 ? '✓' : `failed (${r.status})`);
  }

  // 3. Get courses for REP's class (SUPERADMIN)
  process.stdout.write('\n3. Fetching courses for REP class... ');
  const coursesRes = await get(`${BASE}/admin/classes/${repClassId}/courses`, saToken);
  const classCourses = Array.isArray(coursesRes.body) ? coursesRes.body : [];
  if (classCourses.length === 0) {
    console.error(`\n   No courses linked to this class (${repClassId}). Cannot create session.`);
    process.exit(1);
  }
  // Pick first course
  const course   = classCourses[0].course || classCourses[0];
  const courseId = course.id;
  console.log(`✓  using "${course.name || course.code}" (${courseId.slice(0, 8)})`);

  // 4. Build test student list
  console.log(`\n4. Building ${STUDENT_COUNT} test student records...`);
  const allStudents = [];        // for k6
  const studentRows = [];        // for addStudentsToClass

  for (let i = 0; i < STUDENT_COUNT; i++) {
    const idx   = String(i + 1).padStart(6, '0');
    const idxNo = `LT${idx}`;
    allStudents.push({
      indexNumber:       idxNo,
      name:              `LoadTest Student ${i + 1}`,
      deviceFingerprint: `ltfp_${idxNo}`
    });
    studentRows.push({
      indexNumber: idxNo,
      name:        `LoadTest Student ${i + 1}`,
      email:       `${idxNo.toLowerCase()}@loadtest.gctu.edu.gh`
    });
  }

  // 5. Enroll test students in REP class (SUPERADMIN — upserts students + ClassStudent in one call)
  console.log(`\n5. Enrolling ${STUDENT_COUNT} test students in class (batches of ${ENROLL_BATCH})...`);
  let enrolled = 0;

  for (let i = 0; i < studentRows.length; i += ENROLL_BATCH) {
    const batch   = studentRows.slice(i, i + ENROLL_BATCH);
    const batchNo = Math.floor(i / ENROLL_BATCH) + 1;
    process.stdout.write(`   Batch ${batchNo}/${Math.ceil(studentRows.length / ENROLL_BATCH)} (${i + 1}–${Math.min(i + ENROLL_BATCH, STUDENT_COUNT)})... `);

    const r = await post(`${BASE}/admin/classes/${repClassId}/students`, { students: batch }, saToken);
    if (r.status === 200) {
      enrolled += r.body.addedCount || batch.length;
      console.log(`✓  added:${r.body.addedCount} skipped:${r.body.skippedCount}`);
    } else {
      console.error(`FAILED (${r.status}):`, typeof r.body === 'string' ? r.body.slice(0, 120) : r.body);
    }
  }
  console.log(`   Total enrolled: ${enrolled} ✓`);

  // 6. Create ONLINE session (REP token — REP/ADMIN only, classId auto-set server-side)
  process.stdout.write('\n6. Creating ONLINE attendance session... ');
  const endTime  = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours
  const sessRes  = await post(`${BASE}/sessions`, {
    courseId,
    sessionType: 'ONLINE',
    endTime,
    latitude:  null,
    longitude: null
  }, repToken);

  if (sessRes.status !== 201 && sessRes.status !== 200) {
    console.error(`\n   FAILED (${sessRes.status}):`, sessRes.body);
    process.exit(1);
  }

  const session    = sessRes.body.session || sessRes.body;
  const manualCode = session.manualCode;
  const sessionId  = session.id;
  console.log('✓');
  console.log(`   Session ID  : ${sessionId}`);
  console.log(`   Manual code : ${manualCode}`);
  console.log(`   Class ID    : ${session.classId}`);
  console.log(`   Ends at     : ${session.endTime}`);

  // 7. Write output files
  const outDir       = path.join(__dirname);
  const studentsFile = path.join(outDir, 'students.json');
  const sessionFile  = path.join(outDir, 'session.json');

  fs.writeFileSync(studentsFile, JSON.stringify(allStudents, null, 2));
  fs.writeFileSync(sessionFile,  JSON.stringify({ sessionId, manualCode }, null, 2));

  console.log(`\n7. Output files written:`);
  console.log(`   ${studentsFile}  (${allStudents.length} students)`);
  console.log(`   ${sessionFile}`);

  console.log(`\n${'═'.repeat(62)}`);
  console.log(' SETUP COMPLETE — ready to run load test');
  console.log(`${'═'.repeat(62)}`);
  console.log('\nRun the full test:');
  console.log('  node tests/production/run-load-test.js\n');
}

main().catch(err => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
