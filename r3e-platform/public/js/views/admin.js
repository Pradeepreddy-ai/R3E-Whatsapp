/* ════════════════════════════════════════════
   views/admin.js
   Admin sees ALL merchants from shared DB.
   Location filter is optional — actions are
   gated (admin can only approve/manage their
   location-assigned merchants for safety).
════════════════════════════════════════════ */
'use strict';

/* Admin's assigned location IDs */
function getAdminLocs() { return R3E.user.locations || []; }

/* Filter merchants by admin's locations.
   If admin has no locations assigned, show all. */
function filterByAdminLoc(merchants) {
  const locs = getAdminLocs();
  if (!locs.length) return merchants;                   /* unfiltered if no assignments */
  return merchants.filter(m => locs.includes(m.location_id || m.location));
}

/* ── Dashboard ── */
async function renderAdDashboard() {
  setTitle('Dashboard');
  try {
    const [allMerchants, locs, stats] = await Promise.all([
      API.getMerchants(), API.getLocations(), API.getSystemStats()
    ]);
    const myMs  = filterByAdminLoc(allMerchants);
    const pending  = myMs.filter(m => m.status === 'pending').length;
    const approved = myMs.filter(m => m.status === 'approved').length;

    const custCounts = await Promise.all(myMs.map(m => API.getCustomers(m.id)));
    const totalCusts = custCounts.reduce((a, c) => a + c.length, 0);

    const allCamps = await API.getCampaigns();
    const myCamps  = allCamps.filter(c => myMs.find(m => m.id === c.merchantId));
    const sent     = myCamps.reduce((a,c) => a + (c.sent||c.sent_count||0), 0);
    const red      = myCamps.reduce((a,c) => a + (c.redeemed||c.redeemed_count||0), 0);

    renderContent(`
    <div class="metric-grid">
      <div class="metric-card"><div class="m-label">My Merchants</div><div class="m-val">${myMs.length}</div>
        <div class="m-sub">${badge(approved+' approved','approved')} ${badge(pending+' pending','pending')}</div></div>
      <div class="metric-card"><div class="m-label">Pending Approvals</div>
        <div class="m-val" style="color:${pending>0?'var(--warn)':'var(--success)'}">${pending}</div>
        <div class="m-sub">${pending > 0 ? '<a onclick="showView(\'ad-approvals\')" style="cursor:pointer;color:var(--amber)">Review now →</a>' : 'All clear ✓'}</div></div>
      <div class="metric-card"><div class="m-label">Total Customers</div><div class="m-val">${fmtNum(totalCusts)}</div>
        <div class="m-sub up">Across my merchants</div></div>
      <div class="metric-card"><div class="m-label">Messages Sent</div><div class="m-val">${fmtNum(sent)}</div>
        <div class="m-sub txt-muted">${sent ? Math.round(red/sent*100)+'% redeemed' : '—'}</div></div>
    </div>
    <div class="card mb-0">
      <div class="card-header"><div class="card-title">My Merchants</div>
        <button class="btn btn-outline btn-sm" onclick="showView('ad-merchants')">View all →</button></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Merchant</th><th>Location</th><th>Customers</th><th>Status</th><th>Engine</th><th>Actions</th></tr></thead>
        <tbody>${myMs.map((m, i) => {
          const loc  = locs.find(l => l.id === (m.location_id || m.location));
          const cnt  = custCounts[i]?.length || 0;
          const on   = m.engineOn || m.engine_on;
          const name = m.brandName || m.brand_name;
          return `<tr>
            <td><strong>${name}</strong><br><span class="txt-xs">${m.email}</span></td>
            <td>${loc?.name || '—'}</td>
            <td>${cnt}</td>
            <td>${badge(m.status, m.status)}</td>
            <td>${m.status === 'approved' ? badge(on ? 'ON' : 'OFF', on ? 'approved' : 'rejected') : '—'}</td>
            <td><div class="actions">
              <button class="btn btn-outline btn-xs" onclick="openMerchantDetail('${m.id}')">View</button>
              ${m.status === 'pending' ? `<button class="btn btn-success btn-xs" onclick="approveMerchantAndRefresh('${m.id}')">Approve</button>` : ''}
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

/* ── All Merchants ── */
async function renderAdMerchants() {
  setTitle('Merchants');
  setTopbarRight(`<button class="btn btn-primary btn-sm" onclick="openRegisterMerchantNote()">+ Register Merchant</button>`);
  try {
    const [allMs, locs] = await Promise.all([API.getMerchants(), API.getLocations()]);
    const myMs = filterByAdminLoc(allMs);
    renderSharedMerchantTable(myMs, locs, 'admin');
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

/* ── Approvals ── */
async function renderAdApprovals() {
  setTitle('Merchant Approvals');
  try {
    const allMs = await API.getMerchants('status=pending');
    const pending = filterByAdminLoc(allMs);
    if (!pending.length) {
      renderContent('<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">No pending approvals</div><div class="empty-sub">All applications have been reviewed.</div></div>');
      return;
    }
    renderContent(`
    <div style="margin-bottom:16px">${badge(pending.length+' pending approval'+(pending.length!==1?'s':''),'pending')}</div>
    ${pending.map(m => buildApprovalCard(m, true)).join('')}`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

/* ── Support Team ── */
async function renderAdSupport() {
  setTitle('Support Team');
  setTopbarRight(`<button class="btn btn-primary btn-sm" onclick="openAddUserModal('support')">+ Add Support Agent</button>`);
  try {
    const [users, locs] = await Promise.all([API.getUsers(), API.getLocations()]);
    const myLocs   = getAdminLocs();
    /* Admin can see supports assigned to their locations, or all if no locations set */
    const supports = users.filter(u => u.type === 'support' &&
      (!myLocs.length || (u.locations || []).some(l => myLocs.includes(l))));

    renderContent(`<div class="card mb-0"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Locations</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${supports.length === 0
        ? `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:28px">No support agents assigned to your locations</td></tr>`
        : supports.map(u => `<tr>
          <td><strong>${u.firstName||u.first_name} ${u.lastName||u.last_name}</strong></td>
          <td class="txt-xs">${u.email}</td>
          <td>${u.phone || '—'}</td>
          <td>${(u.locations||[]).map(lid => `<span class="pill-tag">${locs.find(l=>l.id===lid)?.name||lid}</span>`).join('') || '—'}</td>
          <td>${badge(u.status, u.status)}</td>
          <td><div class="actions">
            <button class="btn btn-outline btn-xs" onclick="openEditUserModal('${u.id}')">Edit</button>
            <button class="btn btn-outline btn-xs" onclick="openResetPwdModal('${u.id}','user')">Reset PWD</button>
            <button class="btn ${u.status==='active'?'btn-danger':'btn-success'} btn-xs"
              onclick="toggleUserStatus('${u.id}','${u.status}','ad-support')">${u.status==='active'?'Deactivate':'Activate'}</button>
          </div></td>
        </tr>`).join('')
      }</tbody>
    </table></div></div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

/* ── Analytics ── */
async function renderAdAnalytics() {
  setTitle('Analytics');
  try {
    const [allMs, allCamps] = await Promise.all([API.getMerchants(), API.getCampaigns()]);
    const myMs    = filterByAdminLoc(allMs);
    const myCamps = allCamps.filter(c => myMs.find(m => m.id === c.merchantId));
    const sent    = myCamps.reduce((a,c) => a+(c.sent||c.sent_count||0), 0);
    const red     = myCamps.reduce((a,c) => a+(c.redeemed||c.redeemed_count||0), 0);
    const opened  = myCamps.reduce((a,c) => a+(c.opened||c.opened_count||0), 0);

    renderContent(`
    <div class="metric-grid">
      <div class="metric-card"><div class="m-label">Total Campaigns</div><div class="m-val">${myCamps.length}</div></div>
      <div class="metric-card"><div class="m-label">Messages Sent</div><div class="m-val">${fmtNum(sent)}</div></div>
      <div class="metric-card"><div class="m-label">Opened</div><div class="m-val">${fmtNum(opened)}</div>
        <div class="m-sub">${sent ? Math.round(opened/sent*100) : 0}% open rate</div></div>
      <div class="metric-card"><div class="m-label">Redeemed</div><div class="m-val">${fmtNum(red)}</div>
        <div class="m-sub up">${sent ? Math.round(red/sent*100) : 0}% redemption</div></div>
    </div>
    <div class="grid-2">
      <div class="card mb-0">
        <div class="card-title">Performance by Merchant</div>
        ${myMs.map(m => {
          const mc   = myCamps.filter(c => c.merchantId === m.id);
          const ms   = mc.reduce((a,c) => a+(c.sent||c.sent_count||0), 0);
          const mr   = mc.reduce((a,c) => a+(c.redeemed||c.redeemed_count||0), 0);
          const pct  = ms ? Math.round(mr/ms*100) : 0;
          const name = m.brandName || m.brand_name;
          return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:0.5px solid var(--border2)">
            <div style="flex:1">
              <div class="fw-600">${name}</div>
              <div class="txt-xs">Sent: ${ms} · Redeemed: ${mr}</div>
              <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;margin-top:6px">
                <div style="height:3px;width:${pct}%;background:var(--amber);border-radius:2px"></div>
              </div>
            </div>
            <div style="font-size:15px;font-weight:700;color:var(--amber);min-width:40px;text-align:right">${pct}%</div>
          </div>`;
        }).join('')}
      </div>
      <div class="card mb-0">
        <div class="card-title">Recent Campaigns</div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Date</th><th>Merchant</th><th>Tier</th><th>Sent</th><th>Redeemed</th></tr></thead>
          <tbody>${myCamps.slice().reverse().slice(0,15).map(c => {
            const m = myMs.find(x => x.id === c.merchantId);
            const s = c.sent||c.sent_count||0;
            const r = c.redeemed||c.redeemed_count||0;
            return `<tr>
              <td class="txt-xs">${c.date||c.campaign_date||'—'}</td>
              <td>${m?.brandName||m?.brand_name||'—'}</td>
              <td>${badge(c.tier,'info')}</td>
              <td>${s}</td><td>${r}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>
    </div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

function openRegisterMerchantNote() {
  showToast('Direct merchants to self-register at the login page, or use Super Admin to register them directly.');
}


function deleteMerchantConfirm(merchantId, brandName) {
  const confirmed = confirm(`Are you sure you want to DELETE "${brandName}" and ALL their data (customers, campaigns, etc)? This cannot be undone.`);
  if (!confirmed) return;
  
  const confirm2 = prompt(`Type "${brandName}" to confirm deletion:`, '');
  if (confirm2 !== brandName) return showToast('Deletion cancelled.', 'error');

  deleteMerchantNow(merchantId, brandName);
}

async function deleteMerchantNow(merchantId, brandName) {
  try {
    await API.deleteMerchant(merchantId);
    showToast(`✅ "${brandName}" and all their data have been deleted.`, 'success');
    renderADashboard();
  } catch(e) { showToast(e.message, 'error'); }
}
