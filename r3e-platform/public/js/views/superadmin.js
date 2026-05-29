/* ════ views/superadmin.js ════ */

async function renderSaDashboard() {
  setTitle('System Dashboard');
  try {
    const [stats, merchants, logs] = await Promise.all([
      API.getSystemStats(), API.getMerchants(), API.getLogs(10)
    ]);
    const locs = await API.getLocations();
    renderContent(`
    <div class="metric-grid">
      <div class="metric-card"><div class="m-label">Total Merchants</div><div class="m-val">${stats.merchants.total}</div><div class="m-sub">${badge(stats.merchants.approved+' approved','approved')} ${badge(stats.merchants.pending+' pending','pending')}</div></div>
      <div class="metric-card"><div class="m-label">Pending Approvals</div><div class="m-val" style="color:var(--warn)">${stats.merchants.pending}</div><div class="m-sub txt-muted">${stats.merchants.pending > 0 ? '<a onclick="showView(\'sa-approvals\')" style="cursor:pointer">Review now →</a>' : 'All clear'}</div></div>
      <div class="metric-card"><div class="m-label">Total Customers</div><div class="m-val">${fmtNum(stats.customers.total)}</div><div class="m-sub up">↑ Across all merchants</div></div>
      <div class="metric-card"><div class="m-label">Administrators</div><div class="m-val">${stats.systemUsers.admins}</div><div class="m-sub txt-muted">${stats.systemUsers.support} support agents</div></div>
      <div class="metric-card"><div class="m-label">Messages Sent</div><div class="m-val">${fmtNum(stats.campaigns.sent)}</div><div class="m-sub txt-muted">${stats.campaigns.total} campaigns</div></div>
      <div class="metric-card"><div class="m-label">Redemption Rate</div><div class="m-val">${stats.campaigns.rate}%</div><div class="m-sub up">↑ Platform average</div></div>
    </div>
    <div class="grid-2-1">
      <div class="card mb-0">
        <div class="card-header"><div class="card-title">Recent Merchants</div><button class="btn btn-outline btn-sm" onclick="showView('sa-merchants')">View all</button></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Merchant</th><th>Category</th><th>Location</th><th>Status</th><th>Registered</th></tr></thead>
          <tbody>${merchants.slice().reverse().slice(0,8).map(m => `<tr>
            <td><strong>${(m.brandName||m.brand_name||"—")}</strong><br><span class="txt-xs">${m.email}</span></td>
            <td>${(m.category||"—")}</td>
            <td>${locs.find(l=>l.id===(m.location_id||m.location))?.name||'—'}</td>
            <td>${badge(m.status, m.status)}</td>
            <td class="txt-xs">${fmtDate((m.createdAt||m.created_at))}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="card mb-0">
        <div class="card-title">Recent Activity</div>
        ${logs.map(l => `<div style="padding:8px 0;border-bottom:0.5px solid var(--border);font-size:12px">
          <div class="fw-600">${l.action}</div>
          <div class="txt-xs" style="margin-top:2px">${l.user} · ${fmtDate(l.ts)}</div>
        </div>`).join('')}
      </div>
    </div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

async function renderSaMerchants() {
  setTitle('All Merchants');
  setTopbarRight(`<button class="btn btn-primary btn-sm" onclick="openRegisterMerchantModal()">+ Register Merchant</button>`);
  try {
    const [merchants, locs] = await Promise.all([API.getMerchants(), API.getLocations()]);
    renderSharedMerchantTable(merchants, locs, 'sa');
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}




async function saToggleEngine(id, on) {
  try { await API.toggleEngine(id, on, R3E.user.email); showToast(on ? '🟢 Engine activated!' : '🔴 Engine stopped.'); }
  catch(e) { showToast(e.message, 'error'); }
}

async function renderSaApprovals() {
  setTitle('Merchant Approvals');
  try {
    const merchants = await API.getMerchants('status=pending');
    if (!merchants.length) {
      renderContent('<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">No pending approvals</div><div class="empty-sub">All merchant applications have been reviewed.</div></div>');
      return;
    }
    renderContent(`
    <div style="margin-bottom:16px">${badge(merchants.length + ' pending approval' + (merchants.length!==1?'s':''), 'pending')}</div>
    ${merchants.map(m => buildApprovalCard(m, true)).join('')}`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

async function renderSaAdmins() {
  setTitle('Administrators');
  setTopbarRight(`<button class="btn btn-primary btn-sm" onclick="openAddUserModal('admin')">+ Add Admin</button>`);
  try {
    const [users, locs] = await Promise.all([API.getUsers(), API.getLocations()]);
    const admins = users.filter(u => u.type === 'admin');
    renderContent(`<div class="card mb-0"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Locations</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${admins.map(u => `<tr>
        <td><strong>${(u.firstName||u.first_name)} ${(u.lastName||u.last_name)}</strong></td>
        <td class="txt-xs">${u.email}</td><td>${u.phone}</td>
        <td>${(u.locations||[]).map(lid => `<span class="pill-tag">${locs.find(l=>l.id===lid)?.name||lid}</span>`).join('')||'—'}</td>
        <td>${badge(u.status, u.status)}</td>
        <td><div class="actions">
          <button class="btn btn-outline btn-xs" onclick="openEditUserModal('${u.id}')">Edit</button>
          <button class="btn btn-outline btn-xs" onclick="openResetPwdModal('${u.id}','user')">Reset PWD</button>
          <button class="btn ${u.status==='active'?'btn-danger':'btn-success'} btn-xs" onclick="toggleUserStatus('${u.id}','${u.status}',R3E.currentView)">${u.status==='active'?'Deactivate':'Activate'}</button>
        </div></td>
      </tr>`).join('')}</tbody>
    </table></div></div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

async function renderSaSupport() {
  setTitle('Support Team');
  setTopbarRight(`<button class="btn btn-primary btn-sm" onclick="openAddUserModal('support')">+ Add Support Agent</button>`);
  try {
    const [users, locs] = await Promise.all([API.getUsers(), API.getLocations()]);
    const supports = users.filter(u => u.type === 'support');
    renderContent(`<div class="card mb-0"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Locations</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${supports.map(u => `<tr>
        <td><strong>${(u.firstName||u.first_name)} ${(u.lastName||u.last_name)}</strong></td>
        <td class="txt-xs">${u.email}</td><td>${u.phone}</td>
        <td>${(u.locations||[]).map(lid => `<span class="pill-tag">${locs.find(l=>l.id===lid)?.name||lid}</span>`).join('')||'—'}</td>
        <td>${badge(u.status, u.status)}</td>
        <td><div class="actions">
          <button class="btn btn-outline btn-xs" onclick="openEditUserModal('${u.id}')">Edit</button>
          <button class="btn btn-outline btn-xs" onclick="openResetPwdModal('${u.id}','user')">Reset PWD</button>
          <button class="btn ${u.status==='active'?'btn-danger':'btn-success'} btn-xs" onclick="toggleUserStatus('${u.id}','${u.status}',R3E.currentView)">${u.status==='active'?'Deactivate':'Activate'}</button>
        </div></td>
      </tr>`).join('')}</tbody>
    </table></div></div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

async function renderSaLocations() {
  setTitle('Locations');
  setTopbarRight(`<button class="btn btn-primary btn-sm" onclick="openAddLocationModal()">+ Add Location</button>`);
  try {
    const [locs, merchants, users] = await Promise.all([API.getLocations(), API.getMerchants(), API.getUsers()]);
    renderContent(`<div class="grid-2">${locs.map(l => `
      <div class="card mb-0">
        <div class="card-header">
          <div><div class="fw-600">${l.name}</div><div class="txt-xs">${l.region}</div></div>
          <button class="btn btn-outline btn-sm" onclick="openEditLocationModal('${l.id}','${l.name}','${l.region}')">Edit</button>
        </div>
        <div class="txt-sm txt-muted" style="margin-bottom:10px">
          Merchants: <strong>${merchants.filter(m=>(m.location_id||m.location)===l.id).length}</strong> &nbsp;·&nbsp;
          Admins: <strong>${users.filter(u=>u.type==='admin'&&(u.locations||[]).includes(l.id)).length}</strong> &nbsp;·&nbsp;
          Support: <strong>${users.filter(u=>u.type==='support'&&(u.locations||[]).includes(l.id)).length}</strong>
        </div>
        <div>${merchants.filter(m=>(m.location_id||m.location)===l.id).map(m=>`<span class="pill-tag">${(m.brandName||m.brand_name||"—")}</span>`).join('')||'<span class="txt-xs">No merchants</span>'}</div>
      </div>`).join('')}</div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

async function renderSaLogs() {
  setTitle('System Logs');
  try {
    const logs = await API.getLogs(200);
    renderContent(`<div class="card mb-0"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Timestamp</th><th>Action</th><th>User</th><th>Details</th></tr></thead>
      <tbody>${logs.map(l => `<tr>
        <td class="txt-xs" style="white-space:nowrap">${fmtDateTime(l.ts)}</td>
        <td><strong>${l.action}</strong></td>
        <td class="txt-xs">${l.user}</td>
        <td class="txt-xs">${l.target}</td>
      </tr>`).join('')}</tbody>
    </table></div></div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

/* ── User Management Modals ── */
async function openAddUserModal(type) {
  const locs = await API.getLocations();
  const locOpts = locs.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
  openModal('sm', `Add ${type === 'admin' ? 'Administrator' : 'Support Agent'}`, `
    <div class="form-row">
      <div class="form-group"><label class="form-label">First Name *</label><input id="nu-fn" class="form-input"/></div>
      <div class="form-group"><label class="form-label">Last Name *</label><input id="nu-ln" class="form-input"/></div>
    </div>
    <div class="form-group"><label class="form-label">Email *</label><input id="nu-em" class="form-input" type="email"/></div>
    <div class="form-group"><label class="form-label">Contact Number *</label><input id="nu-ph" class="form-input" placeholder="+44 ..."/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Password *</label><input id="nu-pw" class="form-input" type="password"/></div>
      <div class="form-group"><label class="form-label">Confirm *</label><input id="nu-pw2" class="form-input" type="password"/></div>
    </div>
    <div class="form-group"><label class="form-label">Assign Locations</label>
      <select id="nu-locs" class="form-select" multiple style="height:90px">${locOpts}</select>
      <div class="form-hint">Hold Ctrl/Cmd to select multiple</div></div>`,
    `<button class="btn btn-primary" onclick="saveNewUser('${type}')">Create ${type === 'admin' ? 'Admin' : 'Support'}</button>
     <button class="btn btn-outline" onclick="closeModal()">Cancel</button>`);
}

async function saveNewUser(type) {
  const fn = document.getElementById('nu-fn')?.value.trim();
  const ln = document.getElementById('nu-ln')?.value.trim();
  const em = document.getElementById('nu-em')?.value.trim();
  const ph = document.getElementById('nu-ph')?.value.trim();
  const pw = document.getElementById('nu-pw')?.value;
  const pw2= document.getElementById('nu-pw2')?.value;
  if (!fn||!ln||!em||!ph||!pw) return showToast('Please fill all required fields','error');
  if (pw !== pw2) return showToast('Passwords do not match','error');
  const locSel = document.getElementById('nu-locs');
  const locs = locSel ? Array.from(locSel.selectedOptions).map(o => o.value) : [];
  try {
    await API.createUser({ type, firstName:fn, lastName:ln, email:em, phone:ph, password:pw, locations:locs, createdBy:R3E.user.email });
    closeModal(); showToast(`✅ ${type === 'admin' ? 'Admin' : 'Support agent'} created!`, 'success');
    if (type === 'admin') renderSaAdmins(); else renderSaSupport();
  } catch(e) { showToast(e.message, 'error'); }
}

async function openEditUserModal(id) {
  const users = await API.getUsers();
  const locs = await API.getLocations();
  const u = users.find(x => x.id === id); if (!u) return;
  const locOpts = locs.map(l => `<option value="${l.id}" ${(u.locations||[]).includes(l.id)?'selected':''}>${l.name}</option>`).join('');
  openModal('sm', 'Edit User', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">First Name</label><input id="eu-fn" class="form-input" value="${u.firstName}"/></div>
      <div class="form-group"><label class="form-label">Last Name</label><input id="eu-ln" class="form-input" value="${u.lastName}"/></div>
    </div>
    <div class="form-group"><label class="form-label">Contact Number</label><input id="eu-ph" class="form-input" value="${u.phone}"/></div>
    <div class="form-group"><label class="form-label">Assign Locations</label>
      <select id="eu-locs" class="form-select" multiple style="height:90px">${locOpts}</select></div>`,
    `<button class="btn btn-primary" onclick="saveEditUser('${id}','${u.type}')">Save Changes</button>
     <button class="btn btn-outline" onclick="closeModal()">Cancel</button>`);
}

async function saveEditUser(id, type) {
  const locSel = document.getElementById('eu-locs');
  const locs = locSel ? Array.from(locSel.selectedOptions).map(o => o.value) : [];
  try {
    await API.updateUser(id, {
      firstName: document.getElementById('eu-fn')?.value.trim(),
      lastName:  document.getElementById('eu-ln')?.value.trim(),
      phone:     document.getElementById('eu-ph')?.value.trim(),
      locations: locs, updatedBy: R3E.user.email
    });
    closeModal(); showToast('✅ User updated!', 'success');
    if (type === 'admin') renderSaAdmins(); else renderSaSupport();
  } catch(e) { showToast(e.message, 'error'); }
}

function openResetPwdModal(id, entityType) {
  openModal('sm', 'Reset Password', `
    <p class="txt-muted" style="margin-bottom:14px;font-size:13px">Set a new temporary password for this user.</p>
    <div class="form-row">
      <div class="form-group"><label class="form-label">New Password *</label><input id="rp-pw" class="form-input" type="password"/></div>
      <div class="form-group"><label class="form-label">Confirm *</label><input id="rp-pw2" class="form-input" type="password"/></div>
    </div>`,
    `<button class="btn btn-primary" onclick="doResetPwd('${id}','${entityType}')">Reset Password</button>
     <button class="btn btn-outline" onclick="closeModal()">Cancel</button>`);
}

async function doResetPwd(id, entityType) {
  const pw  = document.getElementById('rp-pw')?.value;
  const pw2 = document.getElementById('rp-pw2')?.value;
  if (!pw || !pw2) return showToast('Please fill both fields','error');
  if (pw !== pw2) return showToast('Passwords do not match','error');
  if (pw.length < 6) return showToast('Min. 6 characters','error');
  try {
    if (entityType === 'merchant') await API.resetMerchantPwd(id, pw, R3E.user.email);
    else await API.resetUserPwd(id, pw, R3E.user.email);
    closeModal(); showToast('✅ Password reset!', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

async function toggleUserStatus(id, currentStatus, refreshView) {
  try {
    await API.updateUser(id, { status: currentStatus === 'active' ? 'inactive' : 'active', updatedBy: R3E.user.email });
    showToast('User status updated.');
    const view = refreshView || R3E.currentView;
    if (view) showView(view);
  } catch(e) { showToast(e.message, 'error'); }
}

function openAddLocationModal() {
  openModal('sm', 'Add Location', `
    <div class="form-group"><label class="form-label">Location Name *</label><input id="al-name" class="form-input" placeholder="e.g. Bristol South"/></div>
    <div class="form-group"><label class="form-label">Region *</label><input id="al-region" class="form-input" placeholder="England"/></div>`,
    `<button class="btn btn-primary" onclick="saveNewLocation()">Add Location</button>
     <button class="btn btn-outline" onclick="closeModal()">Cancel</button>`);
}
async function saveNewLocation() {
  const name = document.getElementById('al-name')?.value.trim();
  const region = document.getElementById('al-region')?.value.trim();
  if (!name || !region) return showToast('Please fill all fields','error');
  try {
    await API.createLocation({ name, region, createdBy: R3E.user.email });
    closeModal(); showToast('✅ Location added!', 'success'); renderSaLocations();
  } catch(e) { showToast(e.message, 'error'); }
}

function openEditLocationModal(id, name, region) {
  openModal('sm', 'Edit Location', `
    <div class="form-group"><label class="form-label">Location Name *</label><input id="el-name" class="form-input" value="${name}"/></div>
    <div class="form-group"><label class="form-label">Region</label><input id="el-region" class="form-input" value="${region}"/></div>`,
    `<button class="btn btn-primary" onclick="saveEditLocation('${id}')">Save</button>
     <button class="btn btn-outline" onclick="closeModal()">Cancel</button>`);
}
async function saveEditLocation(id) {
  try {
    await API.updateLocation(id, { name: document.getElementById('el-name')?.value.trim(), region: document.getElementById('el-region')?.value.trim() });
    closeModal(); showToast('✅ Location updated!', 'success'); renderSaLocations();
  } catch(e) { showToast(e.message, 'error'); }
}

async function openEditMerchantModal(id) {
  const [m, locs] = await Promise.all([API.getMerchant(id), API.getLocations()]);
  const locOpts = locs.map(l => `<option value="${l.id}" ${(m.location_id||m.location)===l.id?'selected':''}>${l.name}</option>`).join('');
  openModal('sm', 'Edit Merchant', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Brand Name</label><input id="em-brand" class="form-input" value="${(m.brandName||m.brand_name||"—")}"/></div>
      <div class="form-group"><label class="form-label">Phone</label><input id="em-phone" class="form-input" value="${m.phone}"/></div>
    </div>
    <div class="form-group"><label class="form-label">Location</label>
      <select id="em-loc" class="form-select"><option value="">Unassigned</option>${locOpts}</select></div>
    <div class="form-group"><label class="form-label">Status</label>
      <select id="em-status" class="form-select">
        <option value="pending" ${m.status==='pending'?'selected':''}>Pending</option>
        <option value="approved" ${m.status==='approved'?'selected':''}>Approved</option>
        <option value="rejected" ${m.status==='rejected'?'selected':''}>Rejected</option>
      </select></div>
    <div class="divider"></div>
    <div class="form-group"><label class="form-label">Reset Password (leave blank to keep)</label>
      <input id="em-pw" class="form-input" type="password" placeholder="New password (optional)"/></div>`,
    `<button class="btn btn-primary" onclick="saveEditMerchant('${id}')">Save Changes</button>
     <button class="btn btn-outline btn-xs btn-danger" style="margin-right:auto" onclick="openResetPwdModal('${id}','merchant')">Reset PWD</button>
     <button class="btn btn-outline" onclick="closeModal()">Cancel</button>`);
}

async function saveEditMerchant(id) {
  try {
    await API.updateMerchant(id, {
      brandName: document.getElementById('em-brand')?.value.trim(),
      phone:     document.getElementById('em-phone')?.value.trim(),
      location:  document.getElementById('em-loc')?.value,
      status:    document.getElementById('em-status')?.value,
      updatedBy: R3E.user.email,
    });
    const pw = document.getElementById('em-pw')?.value;
    if (pw) await API.resetMerchantPwd(id, pw, R3E.user.email);
    closeModal(); showToast('✅ Merchant updated!', 'success'); if (R3E.currentView) showView(R3E.currentView);
  } catch(e) { showToast(e.message, 'error'); }
}

function openRegisterMerchantModal() {
  showToast('Direct merchants to the self-registration form at the login screen.');
}
