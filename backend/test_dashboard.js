// Test script for the advanced-dashboard endpoint
// Generates a JWT token directly and tests the endpoint

const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'super_secret_construction_key_123';

// Generate a test token
const token = jwt.sign(
  { id: 1, username: 'test_admin', role: 'admin', name: 'Test Admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ ${testName}`);
      passed++;
    } else {
      console.log(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // ─── TEST 1: Global dashboard (no filters) ──────────────
  console.log('\n─── TEST 1: Advanced Dashboard (no filters) ───');
  const r1 = await apiGet('/transactions/advanced-dashboard');
  assert(r1.status === 200, `Status 200 (got ${r1.status})`);
  assert(Array.isArray(r1.body.inventory), 'inventory is array');
  assert(typeof r1.body.kpis === 'object', 'kpis is object');
  assert(Array.isArray(r1.body.consumption), 'consumption is array');
  assert(Array.isArray(r1.body.top_materials), 'top_materials is array');
  assert(Array.isArray(r1.body.shipments), 'shipments is array');
  assert(r1.body.project === null, 'project is null (global view)');
  assert(r1.body.filters.project_id === null, 'filter project_id is null');

  // Verify KPI fields
  const kpi = r1.body.kpis;
  assert(typeof kpi.total_materials === 'number', 'kpi.total_materials is number');
  assert(typeof kpi.total_valuation === 'number', 'kpi.total_valuation is number');
  assert(typeof kpi.total_shipments === 'number', 'kpi.total_shipments is number');
  assert(typeof kpi.total_usage_records === 'number', 'kpi.total_usage_records is number');
  assert(typeof kpi.estimated_cost === 'number', 'kpi.estimated_cost is number');
  assert(typeof kpi.low_stock === 'number', 'kpi.low_stock is number');
  assert(typeof kpi.out_of_stock === 'number', 'kpi.out_of_stock is number');

  // Verify inventory item shape
  if (r1.body.inventory.length > 0) {
    const item = r1.body.inventory[0];
    assert(typeof item.id === 'number', 'inventory item has id');
    assert(typeof item.name === 'string', 'inventory item has name');
    assert(typeof item.current_stock === 'number', 'inventory item has current_stock');
    assert(typeof item.min_stock === 'number', 'inventory item has min_stock');
    assert(['normal','low','out'].includes(item.status), 'inventory item has valid status');
  }

  // ─── TEST 2: Project-filtered dashboard ──────────────────
  console.log('\n─── TEST 2: Dashboard with project_id=1 ───');
  const r2 = await apiGet('/transactions/advanced-dashboard?project_id=1');
  assert(r2.status === 200, `Status 200 (got ${r2.status})`);
  assert(r2.body.filters.project_id === '1', 'filter reflects project_id=1');
  // project may be null if project_id=1 doesn't exist, that's ok
  if (r2.body.project) {
    assert(typeof r2.body.project.name === 'string', 'project has name');
  }

  // ─── TEST 3: Date-filtered dashboard ─────────────────────
  console.log('\n─── TEST 3: Dashboard with date range ───');
  const r3 = await apiGet('/transactions/advanced-dashboard?start_date=2026-01-01&end_date=2026-12-31');
  assert(r3.status === 200, `Status 200 (got ${r3.status})`);
  assert(r3.body.filters.start_date === '2026-01-01', 'start_date filter echoed');
  assert(r3.body.filters.end_date === '2026-12-31', 'end_date filter echoed');

  // ─── TEST 4: Combined filters ────────────────────────────
  console.log('\n─── TEST 4: Dashboard with project + date ───');
  const r4 = await apiGet('/transactions/advanced-dashboard?project_id=1&start_date=2026-01-01&end_date=2026-12-31');
  assert(r4.status === 200, `Status 200 (got ${r4.status})`);
  assert(r4.body.filters.project_id === '1', 'project filter echoed');
  assert(r4.body.filters.start_date === '2026-01-01', 'start_date filter echoed');

  // ─── TEST 5: Legacy endpoints still work ─────────────────
  console.log('\n─── TEST 5: Legacy endpoints ───');
  const r5 = await apiGet('/transactions/dashboard-summary');
  assert(r5.status === 200, `dashboard-summary: Status 200 (got ${r5.status})`);
  assert(typeof r5.body.total_materials === 'number', 'legacy kpi field exists');

  // ─── SUMMARY ─────────────────────────────────────────────
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
