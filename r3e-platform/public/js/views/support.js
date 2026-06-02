/* ════════════════════════════════════════════
   views/support.js
   Support sees ALL merchants from shared DB
   (read-only — no approve/reject/edit actions)
════════════════════════════════════════════ */
'use strict';

function getSupportLocs() { return R3E.user.locations || []; }

function filterBySpLoc(merchants) {
  const locs = getSupportLocs();
  if (!locs.length) return merchants;
  return merchants.filter(m => locs.includes(m.location_id || m.location));
}

/* ── Dashboard ── */
async function renderSpDashboard() {
  setTitle('Support Dashboard');
  try {
    const [allMs, locs] = await Promise.all([API.getMerchants(), API.getLocations()]);
    const myMs = filterBySpLoc(allMs);

    const custCounts = await Promise.all(myMs.map(m => API.getCustomers(m.id)));
    const totalCusts = custCounts.reduce((a, c) => a + c.length, 0);

    renderContent(`
    <div class="alert-info" style="margin-bottom:20px">
      🎧 <strong>Support view</strong> — Read-only access to merchant and customer data. Contact an Admin to make changes.
    </div>
    <div class="metric-grid">
      <div class="metric-card"><div class="m-label">Merchants in My Area</div><div class="m-val">${myMs.length}</div></div>
      <div class="metric-card"><div class="m-label">Active</div><div class="m-val">${myMs.filter(m=>m.status==='approved').length}</div></div>
      <div class="metric-card"><div class="m-label">Pending Review</div><div class="m-val" style="color:var(--warn)">${myMs.filter(m=>m.status==='pending').length}</div></div>
      <div class="metric-card"><div class="m-label">Total Customers</div><div class="m-val">${fmtNum(totalCusts)}</div></div>
    </div>
    <div class="card mb-0">
      <div class="card-header"><div class="card-title">Merchants</div>
        <button class="btn btn-outline btn-sm" onclick="showView('sp-merchants')">View all →</button></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Merchant</th><th>Category</th><th>Location</th><th>Customers</th><th>Status</th><th>Engine</th><th>Actions</th></tr></thead>
        <tbody>${myMs.map((m, i) => {
          const loc  = locs.find(l => l.id === (m.location_id || m.location));
          const cnt  = custCounts[i]?.length || 0;
          const on   = m.engineOn || m.engine_on;
          const name = m.brandName || m.brand_name;
          return `<tr>
            <td><strong>${name}</strong><br><span class="txt-xs">${m.email}</span></td>
            <td>${m.category || '—'}</td>
            <td>${loc?.name || '—'}</td>
            <td>${cnt}</td>
            <td>${badge(m.status, m.status)}</td>
            <td>${m.status==='approved' ? badge(on?'ON':'OFF', on?'approved':'rejected') : '—'}</td>
            <td><button class="btn btn-outline btn-xs" onclick="openMerchantDetail('${m.id}')">View Details</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

/* ── All Merchants (support) ── */
async function renderSpMerchants() {
  setTitle('Merchants');
  try {
    const [allMs, locs] = await Promise.all([API.getMerchants(), API.getLocations()]);
    const myMs = filterBySpLoc(allMs);
    renderSharedMerchantTable(myMs, locs, 'support');
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}
