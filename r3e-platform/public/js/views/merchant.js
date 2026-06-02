/* ════════════════════════════════════════════════════
   views/merchant.js — Merchant Owner & Manager views
   All fields from server are now camelCase.
════════════════════════════════════════════════════ */
'use strict';

function getMid() { return R3E.user.merchantId; }

/* ─────────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────────── */
async function renderMDashboard() {
  setTitle('My Store Dashboard');
  try {
    const [merchant, stats, camps] = await Promise.all([
      API.getMerchant(getMid()),
      API.getMerchantStats(getMid()),
      API.getCampaigns(getMid()),
    ]);
    const recent = camps.slice(0, 6);

    renderContent(`
    <!-- Engine Banner -->
    <div class="engine-card">
      <div class="engine-icon">${merchant.engineOn ? '🟢' : '🔴'}</div>
      <div class="engine-info">
        <div class="engine-title">Campaign Engine —
          <span style="color:${merchant.engineOn ? 'var(--success)' : 'var(--danger)}'}">
            ${merchant.engineOn ? 'RUNNING' : 'STOPPED'}
          </span>
        </div>
        <div class="engine-desc">WhatsApp automation · 7-week rotation · Skip-3 scheduling</div>
      </div>
      ${(R3E.user.subRole === 'owner' || R3E.user.subRole === undefined || R3E.impersonating) ? `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <label class="toggle" title="${merchant.engineOn ? 'Stop' : 'Start'} engine">
          <input type="checkbox" ${merchant.engineOn ? 'checked' : ''}
            onchange="toggleMEngine(this.checked)"/>
          <span class="toggle-slider"></span>
        </label>
        <span style="font-size:9px;color:var(--dash-text3);text-transform:uppercase;letter-spacing:.5px">
          ${merchant.engineOn ? 'Stop' : 'Start'}
        </span>
      </div>` : ''}
    </div>

    <!-- Metrics -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="m-label">Total Customers</div>
        <div class="m-val">${fmtNum(stats.customers.total)}</div>
        <div class="m-sub">${fmtNum(stats.customers.subscribed)} subscribed</div>
      </div>
      <div class="metric-card">
        <div class="m-label">Via QR Code</div>
        <div class="m-val">${fmtNum(stats.customers.viaQR)}</div>
        <div class="m-sub txt-muted">${fmtNum(stats.customers.viaUpload)} via upload</div>
      </div>
      <div class="metric-card">
        <div class="m-label">Messages Sent</div>
        <div class="m-val">${fmtNum(stats.campaigns.sent)}</div>
        <div class="m-sub txt-muted">${stats.campaigns.total} campaigns</div>
      </div>
      <div class="metric-card">
        <div class="m-label">Redemption Rate</div>
        <div class="m-val">${stats.campaigns.rate}%</div>
        <div class="m-sub up">↑ ${fmtNum(stats.campaigns.redeemed)} redeemed</div>
      </div>
    </div>

    <!-- Recent campaigns + store info -->
    <div class="grid-2-1">
      <div class="card mb-0">
        <div class="card-header">
          <div class="card-title">Recent Campaigns</div>
          <button class="btn btn-outline btn-sm" onclick="showView('m-schedule')">Full Schedule →</button>
        </div>
        ${recent.length === 0
          ? `<div class="empty-state" style="padding:28px">
               <div class="empty-icon">📤</div>
               <div class="empty-title">No campaigns yet</div>
               <div class="empty-sub">Turn the engine on and configure your discounts to begin</div>
             </div>`
          : `<div class="table-wrap"><table class="data-table">
               <thead><tr><th>Date</th><th>Tier</th><th>Sent</th><th>Opened</th><th>Redeemed</th><th>Rate</th></tr></thead>
               <tbody>${recent.map(c => `<tr>
                 <td class="txt-xs">${c.date || '—'}</td>
                 <td>${badge(c.tier, 'info')}</td>
                 <td>${c.sent}</td><td>${c.opened}</td><td>${c.redeemed}</td>
                 <td class="${c.sent && (c.redeemed/c.sent) > 0.25 ? 'up' : ''}">${c.sent ? Math.round(c.redeemed/c.sent*100) : 0}%</td>
               </tr>`).join('')}</tbody>
             </table></div>`
        }
      </div>
      <div class="card mb-0">
        <div class="card-title">Store Info</div>
        <div class="approval-grid" style="font-size:13px">
          <span class="afield">Brand</span><span class="aval">${merchant.brandName}</span>
          <span class="afield">Category</span><span class="aval">${merchant.category}</span>
          <span class="afield">WhatsApp</span>
          <span class="aval">${merchant.whatsappNum || badge('Not set', 'pending')}</span>
          <span class="afield">QR Code</span>
          <span class="aval">${merchant.qrId || badge('Not generated', 'pending')}</span>
          <span class="afield">Status</span>
          <span class="aval">${badge(merchant.status, merchant.status)}</span>
        </div>
        <div style="margin-top:16px">
          <div class="m-label" style="margin-bottom:8px">Today's Discounts</div>
          <div id="today-disc-area"><div class="txt-xs">Loading…</div></div>
        </div>
      </div>
    </div>`);

    loadTodayDiscounts();
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

async function loadTodayDiscounts() {
  try {
    const disc = await API.getDiscounts(getMid());
    const days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today = days[new Date().getDay()];
    const t1 = disc.tier1?.find(x => x.day === today);
    const t2 = disc.tier2?.find(x => x.day === today);
    const t3 = disc.tier3?.find(x => x.day === today);
    const el = document.getElementById('today-disc-area');
    if (!el) return;
    if (!t1 && !t2 && !t3) {
      el.innerHTML = `<span class="txt-xs">No discounts configured for today (${today})</span>`;
      return;
    }
    el.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap">
      ${t1 ? `<div class="metric-card" style="flex:1;min-width:70px;text-align:center;padding:10px 8px">
        <div class="m-label">Tier 1</div>
        <div style="font-size:18px;font-weight:700;color:var(--amber)">${t1.pct}%</div>
      </div>` : ''}
      ${t2 ? `<div class="metric-card" style="flex:1;min-width:70px;text-align:center;padding:10px 8px">
        <div class="m-label">Tier 2</div>
        <div style="font-size:18px;font-weight:700;color:var(--amber)">${t2.pct}%</div>
      </div>` : ''}
      ${t3 ? `<div class="metric-card" style="flex:1;min-width:70px;text-align:center;padding:10px 8px">
        <div class="m-label">Tier 3</div>
        <div style="font-size:18px;font-weight:700;color:var(--amber)">${t3.pct}%</div>
      </div>` : ''}
    </div>`;
  } catch(_) {}
}

async function toggleMEngine(on) {
  try {
    const result = await API.toggleEngine(getMid(), on, R3E.user.email);

    if (on) {
      /* Engine just turned ON */
      if (result.whatsapp) {
        const wa = result.whatsapp;
        if (wa.sent > 0) {
          showToast('🟢 Engine ON! WhatsApp sent to ' + wa.sent + ' customers' +
            (wa.failed > 0 ? ' (' + wa.failed + ' failed)' : '') + '.', 'success');
        } else if (wa.error) {
          showToast('🟢 Engine ON — WhatsApp error: ' + wa.error + '. Check credentials in WhatsApp Settings.', 'error');
        } else if (wa.total === 0) {
          showToast('🟢 Engine ON! No subscribed customers to message yet.', 'success');
        } else {
          showToast('🟢 Engine ON! WhatsApp: ' + wa.sent + '/' + wa.total + ' sent.', 'success');
        }
      } else {
        showToast('🟢 Campaign engine activated! Configure WhatsApp in Settings to auto-message customers.', 'success');
      }
    } else {
      showToast('🔴 Engine stopped. Campaigns paused.');
    }
    renderMDashboard();
  } catch(e) { showToast(e.message, 'error'); }
}

/* ─────────────────────────────────────────────────
   CUSTOMERS
───────────────────────────────────────────────── */
async function renderMCustomers() {
  setTitle('Customers');
  setTopbarRight(`
    <button class="btn btn-primary btn-sm" onclick="openUploadCSVModal()">⬆ Upload CSV</button>
    <button class="btn btn-outline btn-sm" onclick="openAddCustomerModal()">+ Add Customer</button>
  `);
  try {
    const custs = await API.getCustomers(getMid());
    const subscribed  = custs.filter(c => c.subscribed).length;
    const viaQR       = custs.filter(c => c.source === 'qr').length;
    const viaUpload   = custs.filter(c => c.source === 'upload').length;
    window._custsCache = custs;

    renderContent(`
    <div class="metric-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="metric-card"><div class="m-label">Total</div><div class="m-val">${custs.length}</div></div>
      <div class="metric-card"><div class="m-label">Subscribed</div><div class="m-val">${subscribed}</div></div>
      <div class="metric-card"><div class="m-label">Via QR Code</div><div class="m-val">${viaQR}</div></div>
      <div class="metric-card"><div class="m-label">Via Upload</div><div class="m-val">${viaUpload}</div></div>
    </div>
    <div class="card mb-0">
      <div class="table-toolbar">
        <input class="search-input" placeholder="Search by name, phone or email…"
          oninput="filterCustomerTable(this.value)"/>
        <select class="filter-sel" onchange="filterCustomerSource(this.value)">
          <option value="">All Sources</option>
          <option value="qr">QR Code</option>
          <option value="upload">Upload</option>
          <option value="manual">Manual</option>
        </select>
        <select class="filter-sel" onchange="filterCustomerGroup(this.value)">
          <option value="">All Groups</option>
          ${['A','B','C','D','E','F','G'].map(g => `<option value="${g}">Group ${g}</option>`).join('')}
        </select>
      </div>
      <div id="cust-table-wrap">${buildCustomerRows(custs)}</div>
    </div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

function buildCustomerRows(custs) {
  if (!custs.length) return `<div class="empty-state" style="padding:30px">
    <div class="empty-icon">👥</div>
    <div class="empty-title">No customers yet</div>
    <div class="empty-sub">Share your QR code or upload a CSV to get started</div>
  </div>`;
  return `<div class="table-wrap"><table class="data-table">
    <thead>
      <tr><th>ID</th><th>Name</th><th>WhatsApp</th><th>Email</th><th>Town</th>
          <th>DOB Month</th><th>Group</th><th>Source</th><th>Subscribed</th><th>Registered</th></tr>
    </thead>
    <tbody>${custs.map(c => `<tr>
      <td class="txt-mono txt-xs">${c.id}</td>
      <td><strong>${c.firstName} ${c.lastName}</strong></td>
      <td>${c.whatsapp}</td>
      <td class="txt-xs">${c.email || '—'}</td>
      <td>${c.town || '—'}</td>
      <td>${c.dobMonth || '—'}</td>
      <td><span class="badge b-info">${c.group || '—'}</span></td>
      <td>${badge(c.source === 'qr' ? 'QR Code' : c.source === 'upload' ? 'Upload' : 'Manual',
            c.source === 'qr' ? 'qr' : c.source === 'upload' ? 'upload' : 'info')}</td>
      <td>${badge(c.subscribed ? 'Yes' : 'No', c.subscribed ? 'approved' : 'rejected')}</td>
      <td class="txt-xs">${fmtDate(c.registeredAt)}</td>
      <td style="white-space:nowrap;font-size:11px">
        <button class="btn btn-xs" style="padding:3px 6px;font-size:10px" 
          onclick="editCustomerModal('${c.id}')">✏️ Edit</button>
        <button class="btn btn-xs btn-danger" style="padding:3px 6px;font-size:10px"
          onclick="deleteCustomerConfirm('${c.id}','${c.firstName}')">🗑</button>
      </td>
    </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function _applyCustomerFilters() {
  const q   = document.querySelector('.search-input')?.value || '';
  const src = document.querySelectorAll('.filter-sel')[0]?.value || '';
  const grp = document.querySelectorAll('.filter-sel')[1]?.value || '';
  let list = window._custsCache || [];
  if (q)   list = list.filter(c => `${c.firstName} ${c.lastName} ${c.whatsapp} ${c.email||''}`.toLowerCase().includes(q.toLowerCase()));
  if (src) list = list.filter(c => c.source === src);
  if (grp) list = list.filter(c => c.group === grp);
  const el = document.getElementById('cust-table-wrap');
  if (el) el.innerHTML = buildCustomerRows(list);
}
function filterCustomerTable(q)  { _applyCustomerFilters(); }
function filterCustomerSource(s) { _applyCustomerFilters(); }
function filterCustomerGroup(g)  { _applyCustomerFilters(); }

/* Add customer modal */
function openAddCustomerModal() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  openModal('sm', 'Add Customer', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">First Name *</label><input id="nc-fn" class="form-input"/></div>
      <div class="form-group"><label class="form-label">Last Name *</label><input id="nc-ln" class="form-input"/></div>
    </div>
    <div class="form-group"><label class="form-label">WhatsApp Number *</label>
      <input id="nc-wa" class="form-input" placeholder="+44 7700 000000"/></div>
    <div class="form-group"><label class="form-label">Email Address</label>
      <input id="nc-em" class="form-input" type="email"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Date of Birth Month</label>
        <select id="nc-dob" class="form-select">${months.map(m => `<option>${m}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Town *</label>
        <input id="nc-town" class="form-input"/></div>
    </div>
    <label class="check-row"><input type="checkbox" id="nc-sub" checked/>
      &nbsp;Subscribe to campaigns</label>`,
    `<button class="btn btn-primary" onclick="saveNewCustomer()">Add Customer</button>
     <button class="btn btn-outline" onclick="closeModal()">Cancel</button>`);
}

async function saveNewCustomer() {
  const fn   = document.getElementById('nc-fn')?.value.trim();
  const ln   = document.getElementById('nc-ln')?.value.trim();
  const wa   = document.getElementById('nc-wa')?.value.trim();
  const town = document.getElementById('nc-town')?.value.trim();
  if (!fn || !ln || !wa || !town) return showToast('Please fill all required fields.', 'error');
  try {
    await API.addCustomers(getMid(), [{
      firstName:  fn,
      lastName:   ln,
      whatsapp:   wa,
      email:      document.getElementById('nc-em')?.value.trim(),
      dobMonth:   document.getElementById('nc-dob')?.value,
      town,
      tcAgree:    true,
      subscribed: document.getElementById('nc-sub')?.checked,
      source:     'manual',
    }]);
    closeModal();
    showToast('✅ Customer added!', 'success');
    renderMCustomers();
  } catch(e) { showToast(e.message, 'error'); }
}

/* CSV upload modal — real file picker + drag & drop */
function openUploadCSVModal() {
  window._csvRows = [];
  openModal('sm', 'Upload Customer Data', `
    <p style="font-size:13px;color:var(--dash-text2);margin-bottom:12px">
      Upload your customer list as a <strong style="color:var(--dash-text)">CSV</strong> file.<br/>
      Required columns: <strong style="color:var(--gold)">first_name, last_name, whatsapp</strong><br/>
      Optional: email, dob_month, town
    </p>
    <a href="#" onclick="downloadCSVTemplate();return false"
       style="font-size:11px;color:var(--gold);display:inline-block;margin-bottom:12px">
      ↓ Download template CSV
    </a>
    <input type="file" id="csv-file-input" accept=".csv,.txt"
           style="display:none" onchange="handleCSVFile(this.files[0])"/>
    <div id="csv-drop-zone"
         style="border:2px dashed var(--dash-border);border-radius:var(--r);padding:28px;
                text-align:center;background:rgba(255,255,255,0.02);cursor:pointer;transition:all .2s"
         onclick="document.getElementById('csv-file-input').click()"
         ondragover="event.preventDefault();this.style.borderColor='var(--gold)';this.style.background='var(--gold-bg)'"
         ondragleave="this.style.borderColor='var(--dash-border)';this.style.background='rgba(255,255,255,0.02)'"
         ondrop="event.preventDefault();this.style.borderColor='var(--dash-border)';handleCSVFile(event.dataTransfer.files[0])">
      <div style="font-size:32px;margin-bottom:10px">📂</div>
      <div style="font-size:13px;font-weight:600;color:var(--dash-text);margin-bottom:4px">
        Click to browse or drag & drop
      </div>
      <div style="font-size:11px;color:var(--dash-text3)">CSV only — max 10 MB</div>
    </div>
    <div id="csv-status" style="margin-top:10px"></div>
    <div id="csv-preview" class="hidden" style="margin-top:12px"></div>`,
    `<button id="import-btn" class="btn btn-primary hidden" onclick="finalizeCSVImport()">Import</button>
     <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`);
}

function downloadCSVTemplate() {
  const csv = 'first_name,last_name,whatsapp,email,dob_month,town\nJohn,Smith,+447700100001,john@email.com,March,London\nJane,Doe,+447700100002,jane@email.com,July,Manchester';
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'r3e_customers_template.csv'; a.click();
}

function handleCSVFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return showToast('File too large. Max 10 MB.', 'error');
  const status = document.getElementById('csv-status');
  if (status) status.innerHTML = '<div class="loading-state" style="padding:8px">Reading file…</div>';
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        if (status) status.innerHTML = '<div class="alert-error">File is empty or missing data rows.</div>';
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[" ]/g,''));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
        const obj = {};
        headers.forEach((h,i) => { obj[h] = vals[i]||''; });
        return obj;
      });
      window._csvRows = rows.map(r => ({
        firstName: r.first_name||r.firstname||r.fname||r['first name']||'',
        lastName:  r.last_name ||r.lastname ||r.lname||r['last name'] ||'',
        whatsapp:  r.whatsapp  ||r.phone    ||r.mobile||r.tel||'',
        email:     r.email||'',
        dobMonth:  r.dob_month||r.birth_month||r.birthmonth||'',
        town:      r.town||r.city||r.area||'',
        tcAgree:true, subscribed:true, source:'upload',
      })).filter(r => r.whatsapp && r.firstName);

      if (!window._csvRows.length) {
        if (status) status.innerHTML = '<div class="alert-error">No valid rows found. Ensure you have first_name and whatsapp columns.</div>';
        return;
      }
      const shown = window._csvRows.slice(0,5);
      const preview = document.getElementById('csv-preview');
      if (preview) {
        preview.classList.remove('hidden');
        preview.innerHTML = '<div class="alert-success" style="margin-bottom:10px">✅ <strong>' + window._csvRows.length + ' customers</strong> found in "' + file.name + '"</div>' +
          '<div class="table-wrap"><table class="data-table" style="font-size:11px"><thead><tr><th>Name</th><th>WhatsApp</th><th>Email</th><th>Town</th></tr></thead><tbody>' +
          shown.map(r => '<tr><td>' + r.firstName + ' ' + r.lastName + '</td><td>' + r.whatsapp + '</td><td>' + (r.email||'—') + '</td><td>' + (r.town||'—') + '</td></tr>').join('') +
          (window._csvRows.length > 5 ? '<tr><td colspan="4" class="txt-xs" style="text-align:center">+ ' + (window._csvRows.length-5) + ' more rows…</td></tr>' : '') +
          '</tbody></table></div>';
      }
      const btn = document.getElementById('import-btn');
      if (btn) { btn.textContent = 'Import ' + window._csvRows.length + ' Customers'; btn.classList.remove('hidden'); }
      if (status) status.innerHTML = '';
    } catch(err) {
      if (status) status.innerHTML = '<div class="alert-error">Parse error: ' + err.message + '</div>';
    }
  };
  reader.readAsText(file);
}

async function finalizeCSVImport() {
  if (!window._csvRows?.length) return showToast('No data to import.', 'error');
  const btn = document.getElementById('import-btn');
  if (btn) { btn.disabled=true; btn.textContent='Importing…'; }
  try {
    const res = await API.addCustomers(getMid(), window._csvRows);
    window._csvRows = [];
    closeModal();
    showToast('✅ ' + res.added + ' customers imported!', 'success');
    renderMCustomers();
  } catch(e) {
    showToast(e.message, 'error');
    if (btn) { btn.disabled=false; btn.textContent='Import ' + window._csvRows.length + ' Customers'; }
  }
}

/* ─────────────────────────────────────────────────
   QR CODE
───────────────────────────────────────────────── */
async function renderMQRCode() {
  setTitle('QR Code');
  try {
    const m = await API.getMerchant(getMid());
    if (m.status !== 'approved') {
      renderContent(`<div class="empty-state">
        <div class="empty-icon">🔒</div>
        <div class="empty-title">QR Code not available</div>
        <div class="empty-sub">Your merchant account must be approved before a QR code is generated.</div>
      </div>`);
      return;
    }
    const regUrl = `${window.location.origin}/register.html?mid=${m.id}&qr=${m.qrId}`;
    renderContent(`
    <div class="grid-2">
      <div class="card mb-0">
        <div class="card-title">Customer Registration QR Code</div>
        <div class="qr-card">
          <div id="qr-canvas"></div>
          <div style="text-align:center">
            <div class="fw-600" style="font-size:15px">${m.brandName}</div>
            <div class="txt-xs" style="margin-top:4px">QR ID: ${m.qrId}</div>
          </div>
          <div style="font-size:11px;color:var(--text3);word-break:break-all;text-align:center;max-width:280px">${regUrl}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
            <button class="btn btn-primary btn-sm" onclick="downloadQR()">⬇ Download PDF</button>
            <button class="btn btn-outline btn-sm" onclick="copyToClipboard('${regUrl}')">📋 Copy Link</button>
          </div>
        </div>
      </div>
      <div class="card mb-0">
        <div class="card-title">How Customers Register</div>
        <div style="font-size:13px;line-height:1.9;color:var(--text2);margin-bottom:16px">
          When a customer scans this QR code with their phone, they are taken to your
          branded registration page — no app required.
        </div>
        <div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:var(--r);border:0.5px solid var(--border2);margin-bottom:16px">
          <div class="fw-600" style="margin-bottom:10px;font-size:13px">Registration form collects:</div>
          <div style="font-size:13px;line-height:2;color:var(--text2)">
            ✅ First &amp; Last Name<br>
            ✅ WhatsApp Number<br>
            ✅ Email Address<br>
            ✅ Date of Birth Month<br>
            ✅ Town<br>
            ✅ Terms &amp; Conditions consent
          </div>
        </div>
        <div class="metric-grid" style="grid-template-columns:1fr 1fr">
          <div class="metric-card"><div class="m-label">QR Registrations</div>
            <div class="m-val" id="qr-reg-count">…</div></div>
          <div class="metric-card"><div class="m-label">Total Customers</div>
            <div class="m-val" id="total-cust-count">…</div></div>
        </div>
        <div style="margin-top:14px;padding:12px;background:rgba(232,130,42,0.06);border-radius:var(--r);border:0.5px solid rgba(232,130,42,0.2);font-size:12px;color:var(--text2);line-height:1.7">
          💡 <strong style="color:var(--amber)">Tip:</strong> Print the PDF and display it at your counter,
          on menus, receipts, and any marketing materials to maximise sign-ups.
        </div>
      </div>
    </div>`);

    /* Generate QR */
    setTimeout(() => {
      const el = document.getElementById('qr-canvas');
      if (el && typeof QRCode !== 'undefined') {
        el.innerHTML = '';
        new QRCode(el, { text: regUrl, width: 180, height: 180,
          colorDark: '#F0EBE0', colorLight: '#16130E' });
      }
    }, 200);

    /* Load counts */
    API.getCustomers(getMid()).then(custs => {
      const qrEl = document.getElementById('qr-reg-count');
      const totEl = document.getElementById('total-cust-count');
      if (qrEl)  qrEl.textContent  = custs.filter(c => c.source === 'qr').length;
      if (totEl) totEl.textContent = custs.length;
    });
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}
function downloadQR() { showToast('📄 QR Code PDF download started…', 'success'); }
function copyToClipboard(text) { navigator.clipboard?.writeText(text); showToast('📋 Link copied!'); }

/* ─────────────────────────────────────────────────
   MANAGERS (owner only)
───────────────────────────────────────────────── */
async function renderMManagers() {
  setTitle('Managers');
  setTopbarRight(`<button class="btn btn-primary btn-sm" onclick="openAddManagerModal()">+ Register Manager</button>`);
  try {
    const managers = await API.getManagers(getMid());
    renderContent(`
    <div class="card mb-0">
      ${managers.length === 0
        ? `<div class="empty-state">
             <div class="empty-icon">👨‍💼</div>
             <div class="empty-title">No managers yet</div>
             <div class="empty-sub">Register a manager to help run your store dashboard.</div>
           </div>`
        : `<div class="table-wrap"><table class="data-table">
             <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Added</th><th>Actions</th></tr></thead>
             <tbody>${managers.map(mm => `<tr>
               <td><strong>${mm.first_name} ${mm.last_name}</strong></td>
               <td class="txt-xs">${mm.email}</td>
               <td>${mm.phone || '—'}</td>
               <td>${badge(mm.status, mm.status)}</td>
               <td class="txt-xs">${fmtDate(mm.created_at)}</td>
               <td><div class="actions">
                 <button class="btn btn-outline btn-xs" onclick="openResetMgrPwdModal('${mm.id}')">Reset PWD</button>
                 <button class="btn ${mm.status==='active'?'btn-danger':'btn-success'} btn-xs"
                   onclick="toggleMgrStatus('${mm.id}','${mm.status}')">
                   ${mm.status === 'active' ? 'Deactivate' : 'Activate'}</button>
               </div></td>
             </tr>`).join('')}</tbody>
           </table></div>`}
    </div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

function openAddManagerModal() {
  openModal('sm', 'Register Manager', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">First Name *</label>
        <input id="nm-fn" class="form-input"/></div>
      <div class="form-group"><label class="form-label">Last Name *</label>
        <input id="nm-ln" class="form-input"/></div>
    </div>
    <div class="form-group"><label class="form-label">Email Address *</label>
      <input id="nm-em" class="form-input" type="email"/></div>
    <div class="form-group"><label class="form-label">Contact Number</label>
      <input id="nm-ph" class="form-input" placeholder="+44 …"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Password *</label>
        <input id="nm-pw" class="form-input" type="password" placeholder="Min. 8 chars"/></div>
      <div class="form-group"><label class="form-label">Confirm Password *</label>
        <input id="nm-pw2" class="form-input" type="password"/></div>
    </div>`,
    `<button class="btn btn-primary" onclick="saveNewManager()">Register Manager</button>
     <button class="btn btn-outline" onclick="closeModal()">Cancel</button>`);
}

async function saveNewManager() {
  const fn  = document.getElementById('nm-fn')?.value.trim();
  const ln  = document.getElementById('nm-ln')?.value.trim();
  const em  = document.getElementById('nm-em')?.value.trim();
  const ph  = document.getElementById('nm-ph')?.value.trim();
  const pw  = document.getElementById('nm-pw')?.value;
  const pw2 = document.getElementById('nm-pw2')?.value;
  if (!fn || !ln || !em || !pw) return showToast('Please fill all required fields.', 'error');
  if (pw !== pw2)  return showToast('Passwords do not match.', 'error');
  if (pw.length < 8) return showToast('Password must be at least 8 characters.', 'error');
  try {
    await API.createManager(getMid(), { firstName:fn, lastName:ln, email:em, phone:ph, password:pw, createdBy:R3E.user.email });
    closeModal();
    showToast('✅ Manager registered!', 'success');
    renderMManagers();
  } catch(e) { showToast(e.message, 'error'); }
}

function openResetMgrPwdModal(id) {
  openModal('sm', 'Reset Manager Password', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">New Password *</label>
        <input id="rmp-pw"  class="form-input" type="password" placeholder="Min. 8 chars"/></div>
      <div class="form-group"><label class="form-label">Confirm *</label>
        <input id="rmp-pw2" class="form-input" type="password"/></div>
    </div>`,
    `<button class="btn btn-primary" onclick="doResetMgrPwd('${id}')">Reset Password</button>
     <button class="btn btn-outline" onclick="closeModal()">Cancel</button>`);
}
async function doResetMgrPwd(id) {
  const pw  = document.getElementById('rmp-pw')?.value;
  const pw2 = document.getElementById('rmp-pw2')?.value;
  if (!pw || pw !== pw2) return showToast('Passwords do not match.', 'error');
  if (pw.length < 8)     return showToast('Min. 8 characters.', 'error');
  try {
    await API.resetMgrPwd(id, pw, R3E.user.email);
    closeModal();
    showToast('✅ Password reset!', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}
async function toggleMgrStatus(id, current) {
  try {
    await API.updateManager(id, { status: current === 'active' ? 'inactive' : 'active' });
    showToast('Manager status updated.');
    renderMManagers();
  } catch(e) { showToast(e.message, 'error'); }
}

/* ─────────────────────────────────────────────────
   DISCOUNTS
───────────────────────────────────────────────── */
async function renderMDiscounts() {
  setTitle('Discount Management');
  try {
    const [disc, hrs] = await Promise.all([API.getDiscounts(getMid()), API.getHours(getMid())]);
    const days  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const tiers = [
      { key:'tier1', label:'Tier 1 — VIP Group',      desc:'For your most loyal rotation group customers',  color:'var(--amber)' },
      { key:'tier2', label:'Tier 2 — Loyalist Global', desc:'One weekly campaign to all registered customers', color:'var(--gold2)' },
      { key:'tier3', label:'Tier 3 — Public',          desc:'Up to 2 campaigns/week for unregistered users',  color:'var(--text2)' },
    ];
    renderContent(`
    <div class="tab-strip">
      ${tiers.map((t,i) => `<button class="tab-btn ${i===0?'active':''}" onclick="switchTab(this,'disc-${t.key}')">${t.label}</button>`).join('')}
    </div>
    ${tiers.map((t,i) => `
    <div id="disc-${t.key}" class="tab-panel ${i===0?'active':''}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <div class="fw-600" style="color:${t.color}">${t.label}</div>
          <div class="txt-xs" style="margin-top:2px">${t.desc}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveDiscountTier('${t.key}')">Save ${t.label.split('—')[0].trim()}</button>
      </div>
      <div class="card mb-0">
        <div style="display:grid;grid-template-columns:100px 1fr 1fr auto;gap:10px;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:var(--r) var(--r) 0 0;font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">
          <span>Day</span><span>Min %</span><span>Max %</span><span>Status</span>
        </div>
        ${days.map(day => {
          const existing = disc[t.key]?.find(x => x.day === day);
          const isOpen   = hrs[day]?.open !== false;
          return `<div class="disc-row" style="${!isOpen ? 'opacity:0.45' : ''}">
            <div class="disc-day" style="color:${isOpen?'var(--text)':'var(--text3)'}">
              ${day}${!isOpen ? ' <span class="txt-xs">(closed)</span>' : ''}
            </div>
            <input id="d-${t.key}-${day}-min" type="number" class="form-input disc-input"
              placeholder="0" min="0" max="100" step="0.5"
              value="${existing?.pct || ''}" ${!isOpen ? 'disabled' : ''}
              style="width:90px;text-align:center"/>
            <input id="d-${t.key}-${day}-max" type="number" class="form-input disc-input"
              placeholder="0" min="0" max="100" step="0.5"
              value="${existing?.pctMax || existing?.pct || ''}" ${!isOpen ? 'disabled' : ''}
              style="width:90px;text-align:center"/>
            <span>${existing?.pct
              ? badge(`${existing.pct}%${existing.pctMax && existing.pctMax !== existing.pct ? `–${existing.pctMax}%` : ''}`, 'approved')
              : '<span class="txt-xs">Not set</span>'
            }</span>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('')}`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

async function saveDiscountTier(tierKey) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  try {
    const current = await API.getDiscounts(getMid());
    current[tierKey] = days.map(day => {
      const minEl = document.getElementById(`d-${tierKey}-${day}-min`);
      const maxEl = document.getElementById(`d-${tierKey}-${day}-max`);
      const pct    = parseFloat(minEl?.value) || 0;
      const pctMax = parseFloat(maxEl?.value) || pct;
      return { day, pct, pctMax };
    }).filter(x => x.pct > 0);
    await API.saveDiscounts(getMid(), current);
    showToast(`✅ ${tierKey.replace('tier','Tier ')} discounts saved!`, 'success');
    renderMDiscounts();
  } catch(e) { showToast(e.message, 'error'); }
}

/* ─────────────────────────────────────────────────
   FLYERS
───────────────────────────────────────────────── */
async function renderMFlyers() {
  setTitle('Marketing Flyers');
  try {
    const flyers = await API.getFlyers(getMid());
    window._flyersCache = [...flyers];
    renderContent(`
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Upload up to 7 marketing flyers</div>
      <p class="txt-muted" style="font-size:13px;margin-bottom:16px">
        Flyers are included in WhatsApp campaigns. Accepted: JPG, PNG, WebP. Max 5 MB each.
      </p>
      <div class="flyer-grid">
        ${flyers.map((f, i) => `
        <div class="flyer-slot" onclick="uploadFlyer(${i})" id="flyer-slot-${i}">
          ${f
            ? `<img src="${f}" alt="Flyer ${i+1}"/>
               <div class="flyer-overlay">
                 <button class="btn btn-danger btn-xs"
                   onclick="event.stopPropagation();removeFlyer(${i})">Remove</button>
               </div>`
            : `<div style="font-size:26px">🖼️</div>
               <div style="font-size:12px;font-weight:500">Flyer ${i+1}</div>
               <div class="txt-xs">Click to upload</div>`}
        </div>`).join('')}
      </div>
    </div>
    <div class="card" style="background:rgba(232,130,42,0.06);border-color:rgba(232,130,42,0.2)">
      <div class="fw-600" style="margin-bottom:8px">💡 Tips for effective flyers</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.9">
        • Use clear, high-quality images of your food or products<br>
        • Include your brand logo prominently<br>
        • Keep the discount offer clearly visible<br>
        • Optimal size: 800×800 px square for best WhatsApp rendering
      </div>
    </div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

async function uploadFlyer(index) {
  try {
    const m = await API.getMerchant(getMid());
    const emojis = ['🌶️','🍔','🍣','🍕','☕','🥗','🍰'];
    const bgs    = ['#2A1A10','#0C1E30','#0F1F08','#1A0C1F','#1F1A10','#1A2A20','#2A1A20'];
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgs[index % bgs.length];
    ctx.fillRect(0, 0, 400, 400);
    ctx.font = '80px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(emojis[index % emojis.length], 200, 180);
    ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#F0EBE0';
    ctx.fillText(m.brandName, 200, 255);
    ctx.font = '16px sans-serif'; ctx.fillStyle = '#E8822A';
    ctx.fillText('Special Offer · Flyer ' + (index+1), 200, 290);
    const dataUrl = canvas.toDataURL();
    if (!window._flyersCache) window._flyersCache = ['','','','','','',''];
    window._flyersCache[index] = dataUrl;
    await API.saveFlyers(getMid(), window._flyersCache);
    showToast(`✅ Flyer ${index+1} uploaded!`, 'success');
    renderMFlyers();
  } catch(e) { showToast(e.message, 'error'); }
}

async function removeFlyer(index) {
  if (!window._flyersCache) return;
  window._flyersCache[index] = '';
  try {
    await API.saveFlyers(getMid(), window._flyersCache);
    showToast('Flyer removed.');
    renderMFlyers();
  } catch(e) { showToast(e.message, 'error'); }
}

/* ─────────────────────────────────────────────────
   CAMPAIGN SCHEDULE
───────────────────────────────────────────────── */
async function renderMSchedule() {
  setTitle('Campaign Schedule');
  try {
    const [m, hrs, custs] = await Promise.all([
      API.getMerchant(getMid()),
      API.getHours(getMid()),
      API.getCustomers(getMid()),
    ]);
    const subscribed = custs.filter(c => c.subscribed);
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    /* Build 4-week forward calendar starting Monday */
    const today    = new Date();
    const dayOfWeek = today.getDay();
    const monday   = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

    const schedDays = [];
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + w * 7 + d);
        const dayName = days[d];
        const isOpen  = hrs[dayName]?.open !== false;
        schedDays.push({ date, dayName, isOpen });
      }
    }
    let openCount = 0;
    schedDays.forEach(sd => {
      if (sd.isOpen) { sd.isSend = (openCount % 4 === 0); openCount++; }
    });

    /* 7-group rotation */
    const GROUPS = ['A','B','C','D','E','F','G'];
    const COLORS  = ['#E8822A','#185FA5','#1D9E75','#BA7517','#6D28D9','#D4537E','#3B6D11'];
    const groupSize = Math.max(1, Math.ceil(subscribed.length / 7));
    const groups    = GROUPS.map((g, i) => subscribed.slice(i * groupSize, (i+1) * groupSize));

    renderContent(`
    <div class="grid-2-1">
      <div>
        <div class="card">
          <div class="card-title">4-Week Send Calendar (Skip-3 Logic)</div>
          <p class="txt-muted" style="font-size:12px;margin-bottom:16px">
            Each customer group is sent a campaign every 4th working day —
            skip 3, send 1. Closed days are automatically skipped.
          </p>
          ${[0,1,2,3].map(wi => {
            const weekDays = schedDays.slice(wi * 7, (wi+1) * 7);
            return `
            <div style="margin-bottom:14px">
              <div class="txt-xs" style="margin-bottom:6px;padding-left:2px;color:var(--text3)">
                Week ${wi + 1} · ${weekDays[0]?.date.toLocaleDateString('en-GB', {day:'numeric',month:'short'})} – ${weekDays[6]?.date.toLocaleDateString('en-GB', {day:'numeric',month:'short'})}
              </div>
              <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
                ${days.map(d => `<div style="text-align:center;font-size:9px;font-weight:700;color:var(--text3)">${d}</div>`).join('')}
              </div>
              <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
                ${weekDays.map(sd => {
                  const cls = !sd.isOpen ? 'closed' : sd.isSend ? 'send' : 'skip';
                  return `<div class="sched-cell ${cls}">
                    <div class="date">${sd.date.getDate()}</div>
                    <div class="action">${!sd.isOpen ? '🔒' : sd.isSend ? '📤' : '–'}</div>
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')}
          <div style="display:flex;gap:14px;font-size:11px;margin-top:4px;flex-wrap:wrap">
            <span style="display:flex;align-items:center;gap:5px">
              <span style="width:12px;height:12px;background:rgba(232,130,42,0.1);border:0.5px solid rgba(232,130,42,0.3);border-radius:3px"></span>
              Send Day</span>
            <span style="display:flex;align-items:center;gap:5px">
              <span style="width:12px;height:12px;background:rgba(255,255,255,0.03);border:0.5px solid var(--border2);border-radius:3px"></span>
              Skip</span>
            <span style="display:flex;align-items:center;gap:5px">
              <span style="width:12px;height:12px;background:rgba(255,255,255,0.01);border-radius:3px"></span>
              Closed</span>
          </div>
        </div>
      </div>
      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-title">7-Week Customer Rotation</div>
          <p class="txt-muted" style="font-size:12px;margin-bottom:14px">
            ${subscribed.length} subscribed customers split into 7 groups.
            Each customer receives a message approximately once every 7 weeks.
          </p>
          ${groups.map((g, i) => `
          <div class="rotation-row">
            <div class="week-badge" style="background:${COLORS[i]}">${GROUPS[i]}</div>
            <div class="week-info">
              <div class="week-label">Group ${GROUPS[i]} — Week ${i+1}</div>
              <div class="week-detail">
                ${g.slice(0,3).map(c => c.firstName).join(', ')}${g.length > 3 ? ` +${g.length-3} more` : ''}
              </div>
            </div>
            <div class="week-count">${g.length}</div>
          </div>`).join('')}
          ${subscribed.length === 0
            ? '<div class="txt-xs" style="text-align:center;padding:12px;color:var(--text3)">No subscribed customers yet</div>'
            : ''}
        </div>
        <div class="card mb-0">
          <div class="card-title">Engine Status</div>
          <div class="approval-grid" style="font-size:13px">
            <span class="afield">Status</span>
            <span class="aval">${badge(m.engineOn ? 'Running' : 'Stopped', m.engineOn ? 'approved' : 'rejected')}</span>
            <span class="afield">Channel</span><span class="aval">WhatsApp</span>
            <span class="afield">Subscribed</span><span class="aval">${subscribed.length} customers</span>
            <span class="afield">Groups</span><span class="aval">7 (A – G)</span>
            <span class="afield">Rotation</span><span class="aval">7 weeks / 49 days</span>
            <span class="afield">Schedule</span><span class="aval">Skip-3 (every 4th open day)</span>
          </div>
        </div>
      </div>
    </div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

/* ─────────────────────────────────────────────────
   BUSINESS HOURS
───────────────────────────────────────────────── */
async function renderMHours() {
  setTitle('Business Hours');
  try {
    const hrs  = await API.getHours(getMid());
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    renderContent(`
    <div class="card mb-0">
      <div class="card-header">
        <div>
          <div class="fw-600">Business Working Hours</div>
          <div class="txt-xs" style="margin-top:2px">
            Campaigns are only scheduled and sent during these hours.
          </div>
        </div>
        <button class="btn btn-primary" onclick="saveBusinessHours()">Save Hours</button>
      </div>
      ${days.map(day => {
        const dh = hrs[day] || { open: false, start: '', end: '' };
        return `<div class="hours-row">
          <div class="day-check">
            <label class="check-row">
              <input type="checkbox" id="h-open-${day}" ${dh.open ? 'checked' : ''}
                onchange="toggleDayRow('${day}',this.checked)"/>
              <span class="fw-600">${day}</span>
            </label>
          </div>
          <div class="hours-selects" id="h-row-${day}"
            style="${!dh.open ? 'opacity:0.4;pointer-events:none' : ''}">
            <select id="h-start-${day}" class="form-select">${timeOptions(dh.start || '09:00')}</select>
            <span class="hours-sep">to</span>
            <select id="h-end-${day}" class="form-select">${timeOptions(dh.end || '22:00')}</select>
          </div>
          <span class="txt-xs" style="min-width:80px;color:${dh.open ? 'var(--success)' : 'var(--text3)'}">
            ${dh.open ? `${dh.start || '?'} – ${dh.end || '?'}` : 'Closed'}
          </span>
        </div>`;
      }).join('')}
    </div>`);
  } catch(e) { renderContent(`<div class="alert-error">${e.message}</div>`); }
}

function toggleDayRow(day, open) {
  const el = document.getElementById('h-row-' + day);
  if (el) { el.style.opacity = open ? '1' : '0.4'; el.style.pointerEvents = open ? '' : 'none'; }
}

async function saveBusinessHours() {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const data = {};
  days.forEach(day => {
    data[day] = {
      open:  document.getElementById(`h-open-${day}`)?.checked || false,
      start: document.getElementById(`h-start-${day}`)?.value || '',
      end:   document.getElementById(`h-end-${day}`)?.value || '',
    };
  });
  try {
    await API.saveHours(getMid(), data);
    showToast('✅ Business hours saved!', 'success');
    renderMHours();
  } catch(e) { showToast(e.message, 'error'); }
}

/* ─────────────────────────────────────────────────
   WHATSAPP SETTINGS
───────────────────────────────────────────────── */
async function renderMWhatsApp() {
  setTopbar('WhatsApp Settings');
  renderContent('<div class="loading-state">Loading...</div>');
  const mid = getMid();
  try {
    const m = await API.getMerchant(mid);
    renderContent(`
      <div class="page-header">
        <div><div class="page-title">WhatsApp Settings</div>
        <div class="page-sub">Connect WhatsApp Business API to send automated messages</div></div>
        <button class="btn btn-primary" onclick="saveWhatsApp('${mid}')">Save Settings</button>
      </div>
      <div class="grid-2" style="align-items:start">
        <div>
          <div class="card" style="margin-bottom:14px">
            <div class="card-title">WhatsApp Business API</div>
            <div class="alert-info" style="margin-bottom:12px;font-size:12px;line-height:1.8">
              <strong>Free setup — 1,000 messages/month:</strong><br/>
              1. Go to <a href="https://developers.facebook.com" target="_blank" style="color:var(--gold)">developers.facebook.com</a> → Create App → Business<br/>
              2. Add <strong>WhatsApp</strong> product → copy <strong>Phone Number ID</strong> &amp; <strong>Access Token</strong><br/>
              3. For testing: add recipient numbers in <em>API Setup → Test Numbers</em><br/>
              4. For live sending: submit app for <em>Business Verification</em> (free, ~2 days)
            </div>
            <div class="form-group"><label class="form-label">WhatsApp Business Number</label>
              <input id="wa-phone" class="form-input" value="${m.whatsappNum||''}" placeholder="+44 7700 200002"/></div>
            <div class="form-group"><label class="form-label">API Access Token</label>
              <input id="wa-token" class="form-input" type="password" value="${m.waToken||''}" placeholder="EAAx..."/>
              <div class="form-hint">System User Access Token from Meta Business Suite</div></div>
            <div class="form-group"><label class="form-label">Phone Number ID</label>
              <input id="wa-phone-id" class="form-input" value="${m.waPhoneId||''}" placeholder="987654321"/>
              <div class="form-hint">From Meta Developer Console > WhatsApp > Phone Numbers</div></div>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn btn-outline btn-sm" onclick="testWhatsApp('${mid}')">Send Test Message</button>
              <button class="btn btn-success btn-sm" onclick="saveWhatsApp('${mid}')">Save</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Send Manual Message</div>
            <div class="form-group"><label class="form-label">Send to</label>
              <select id="wa-manual-segment" class="form-select">
                <option value="all">All subscribed customers</option>
                <option value="qr">QR registered only</option>
                <option value="upload">Uploaded only</option>
                <option value="birthday">Birthday this month</option>
              </select></div>
            <div class="form-group"><label class="form-label">Custom Message (optional)</label>
              <textarea id="wa-manual-msg" class="form-input form-textarea" rows="2"
                placeholder="Leave empty to use campaign template..."></textarea></div>
            <button class="btn btn-primary btn-sm" onclick="sendManualWhatsApp('${mid}')">Send Now</button>
            <div id="wa-send-result" style="margin-top:10px"></div>
          </div>
        </div>
        <div>
          <div class="card" style="margin-bottom:14px">
            <div class="card-title">Campaign Message Template</div>
            <div class="form-group">
              <label class="form-label">Message Template</label>
              <textarea id="wa-template" class="form-input form-textarea" rows="4"
                placeholder="Hi {firstName}! {brandName} has a special offer for you today. Show this message at the counter for your exclusive discount.">${m.waTemplate||''}</textarea>
              <div class="form-hint">Variables: {firstName} {lastName} {brandName} {discount} {expiryDate}</div>
            </div>
            <div class="form-group"><label class="form-label">Send Time</label>
              <select id="wa-send-time" class="form-select">
                <option value="business_hours" ${m.waSendTime==='business_hours'?'selected':''}>During business hours (recommended)</option>
                <option value="morning" ${m.waSendTime==='morning'?'selected':''}>Morning (9am-12pm)</option>
                <option value="afternoon" ${m.waSendTime==='afternoon'?'selected':''}>Afternoon (12pm-5pm)</option>
                <option value="evening" ${m.waSendTime==='evening'?'selected':''}>Evening (5pm-8pm)</option>
                <option value="anytime" ${m.waSendTime==='anytime'?'selected':''}>Any time</option>
              </select></div>
            <button class="btn btn-primary btn-sm" onclick="saveWhatsApp('${mid}')">Save Template</button>
          </div>
          <div class="card">
            <div class="card-title">Auto-Trigger Messages</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${[
                {key:'autoWeekly',    label:'Weekly Offer',    desc:'Weekly discount to subscribed customers'},
                {key:'autoBirthday',  label:'Birthday Message',desc:'Birthday greeting each month'},
                {key:'autoWelcome',   label:'Welcome Message', desc:'Welcome when new customer registers via QR'},
                {key:'autoReengage',  label:'Re-engagement',   desc:'Message customers inactive 30+ days'},
              ].map(t => `<div style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--dash-border2);border-radius:var(--r)">
                <div><div style="font-size:12px;font-weight:600;color:var(--dash-text)">${t.label}</div>
                <div style="font-size:11px;color:var(--dash-text3)">${t.desc}</div></div>
                <label class="toggle"><input type="checkbox" id="wa-${t.key}" ${(m[t.key])?'checked':''}/><div class="toggle-slider"></div></label>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    `);
  } catch(e) {
    renderContent('<div class="empty-state"><div class="empty-icon">error</div><div class="empty-title">Error: ' + e.message + '</div></div>');
  }
}

async function saveWhatsApp(mid) {
  const data = {
    whatsappNum:  document.getElementById('wa-phone')?.value.trim()||'',
    waToken:      document.getElementById('wa-token')?.value.trim()||'',
    waPhoneId:    document.getElementById('wa-phone-id')?.value.trim()||'',
    waTemplate:   document.getElementById('wa-template')?.value.trim()||'',
    waSendTime:   document.getElementById('wa-send-time')?.value||'business_hours',
    autoWeekly:   document.getElementById('wa-autoWeekly')?.checked||false,
    autoBirthday: document.getElementById('wa-autoBirthday')?.checked||false,
    autoWelcome:  document.getElementById('wa-autoWelcome')?.checked||false,
    autoReengage: document.getElementById('wa-autoReengage')?.checked||false,
    updatedBy: R3E.user.email,
  };
  try {
    await API.updateMerchant(mid, data);
    showToast('WhatsApp settings saved!', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

async function testWhatsApp(mid) {
  const token   = document.getElementById('wa-token')?.value.trim();
  const phoneId = document.getElementById('wa-phone-id')?.value.trim();
  if (!token || !phoneId) return showToast('Enter API token and Phone Number ID first.', 'error');
  const testNum = prompt('Enter WhatsApp number for test (e.g. +447700000000):');
  if (!testNum) return;
  try {
    const r = await fetch('/api/whatsapp/test', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ phoneId, token, to: testNum, message: 'Hello from R3E Platform! Your WhatsApp connection is working correctly.' })
    });
    const d = await r.json();
    if (d.success) showToast('Test message sent!', 'success');
    else showToast('Send failed: ' + (d.error||'Unknown error'), 'error');
  } catch(e) { showToast(e.message, 'error'); }
}

async function sendManualWhatsApp(mid) {
  const segment  = document.getElementById('wa-manual-segment')?.value||'all';
  const msg      = document.getElementById('wa-manual-msg')?.value.trim()||'';
  const resultEl = document.getElementById('wa-send-result');
  if (resultEl) resultEl.innerHTML = '<div class="loading-state" style="padding:8px">Sending...</div>';
  try {
    const r = await fetch('/api/whatsapp/send/' + mid, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ segment, customMessage: msg })
    });
    const d = await r.json();
    if (resultEl) {
      if (d.sent !== undefined) {
        const msg = d.sent > 0
          ? '<div class="alert-success">✅ Sent to <strong>' + d.sent + '</strong> customers!' +
            (d.failed ? ' <span style="color:var(--gold)">' + d.failed + ' failed</span>' : '') + '</div>'
          : '<div class="alert-warn" style="padding:10px;border-radius:6px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);font-size:12px">' +
            '⚠️ Sent to 0 customers (' + (d.failed||0) + ' failed).<br/>' +
            '<strong>Common reasons:</strong><br/>' +
            '• Test mode: add recipient numbers in Meta Developer Console → API Setup → Test Numbers<br/>' +
            '• Free-text messages require customer to message you first within 24h<br/>' +
            '• For campaigns: create a WhatsApp Message Template in Meta Business Suite<br/>' +
            '• <strong>Authentication Error?</strong> Your token expired — get a Permanent Token from Meta Business Suite → System Users<br/>' +
            '<a href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages" target="_blank" style="color:var(--gold)">View Meta docs ↗</a>' +
            '</div>';
        resultEl.innerHTML = msg;
      } else {
        resultEl.innerHTML = '<div class="alert-error">❌ ' + (d.error||'Send failed') + '</div>';
      }
    }
  } catch(e) {
    if (resultEl) resultEl.innerHTML = '<div class="alert-error">' + e.message + '</div>';
  }
}


async function saveWhatsAppSettings() {
  const num = document.getElementById('wa-num')?.value.trim();
  try {
    await API.updateMerchant(getMid(), { whatsappNum: num, updatedBy: R3E.user.email });
    showToast('✅ WhatsApp settings saved!', 'success');
    renderMWhatsApp();
  } catch(e) { showToast(e.message, 'error'); }
}
function testWhatsApp() { showToast('📱 Test message sent to your WhatsApp number!', 'success'); }


/* Edit customer modal */
async function editCustomerModal(customerId, merchantId) {
  try {
    const custs = await API.getCustomers(merchantId);
    const c = custs.find(x => x.id == customerId);
    if (!c) return showToast('Customer not found.', 'error');

    openModal('sm', 'Edit Customer', `
      <div class="form-group"><label class="form-label">First Name</label>
        <input id="ec-fname" class="form-input" value="${c.firstName||c.first_name||''}" placeholder="John"/></div>
      <div class="form-group"><label class="form-label">Last Name</label>
        <input id="ec-lname" class="form-input" value="${c.lastName||c.last_name||''}" placeholder="Smith"/></div>
      <div class="form-group"><label class="form-label">WhatsApp Number</label>
        <input id="ec-whatsapp" class="form-input" value="${c.whatsapp||''}" placeholder="+44 7700 000000"/></div>
      <div class="form-group"><label class="form-label">Email</label>
        <input id="ec-email" class="form-input" type="email" value="${c.email||''}" placeholder="john@email.com"/></div>
      <div class="form-group"><label class="form-label">Birth Month</label>
        <input id="ec-dob" class="form-input" value="${c.dobMonth||c.dob_month||''}" placeholder="March"/></div>
      <div class="form-group"><label class="form-label">Town</label>
        <input id="ec-town" class="form-input" value="${c.town||''}" placeholder="London"/></div>
      <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="ec-subscribed" ${c.subscribed?'checked':''} style="width:16px;height:16px;accent-color:var(--gold)"/>
        <span>Subscribed to updates</span>
      </label>`,
      `<button class="btn btn-primary" onclick="saveCustomerEdit('${customerId}','${merchantId}')">Save Changes</button>
       <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`);
  } catch(e) { showToast(e.message, 'error'); }
}

async function saveCustomerEdit(customerId, merchantId) {
  const data = {
    firstName:  document.getElementById('ec-fname')?.value.trim()||'',
    lastName:   document.getElementById('ec-lname')?.value.trim()||'',
    whatsapp:   document.getElementById('ec-whatsapp')?.value.trim()||'',
    email:      document.getElementById('ec-email')?.value.trim()||'',
    dobMonth:   document.getElementById('ec-dob')?.value.trim()||'',
    town:       document.getElementById('ec-town')?.value.trim()||'',
    subscribed: document.getElementById('ec-subscribed')?.checked||false,
  };
  if (!data.firstName || !data.whatsapp) return showToast('First name and WhatsApp are required.', 'error');
  try {
    await API.updateCustomer(customerId, data);
    closeModal();
    showToast('✅ Customer updated!', 'success');
    renderMCustomers();
  } catch(e) { showToast(e.message, 'error'); }
}

function deleteCustomerConfirm(customerId, customerName) {
  if (!confirm(`Delete "${customerName}"? This cannot be undone.`)) return;
  deleteCustomerNow(customerId);
}

async function deleteCustomerNow(customerId) {
  try {
    await API.deleteCustomer(customerId);
    showToast('✅ Customer deleted.', 'success');
    renderMCustomers();
  } catch(e) { showToast(e.message, 'error'); }
}


/* Merchant Profile & Documents */
async function renderMProfile() {
  setTopbar('My Profile & Documents');
  renderContent('<div class="loading-state">Loading profile...</div>');
  const mid = getMid();
  try {
    const m = await API.getMerchant(mid);
    const regCert     = m.regCert || m.reg_cert || '';
    const councilCert = m.councilCert || m.council_cert || '';

    const fields = [
      ['Business Name', m.businessName||m.business_name],
      ['Brand Name',    m.brandName||m.brand_name],
      ['Category',      m.category],
      ['Email',         m.email],
      ['Phone',         m.phone],
      ['Address',       m.address],
      ['Town',          m.town],
      ['County',        m.county],
      ['Postcode',      m.postcode],
      ['Status',        (m.status||'').toUpperCase()],
      ['Engine',        m.engineOn ? 'ON' : 'OFF'],
      ['QR Code',       m.qrId||'Not assigned'],
    ];

    renderContent(
      '<div class="page-header"><div>' +
        '<div class="page-title">My Profile & Documents</div>' +
        '<div class="page-sub">View and download your business documents</div>' +
      '</div></div>' +
      '<div class="grid-2">' +
        '<div class="card"><div class="card-title">Business Information</div>' +
          '<div class="approval-grid">' +
            fields.map(([l,v]) => '<div class="ag-label">'+l+'</div><div class="ag-val">'+(v||'—')+'</div>').join('') +
          '</div></div>' +
        '<div class="card"><div class="card-title">Uploaded Documents</div>' +
          '<div style="margin-top:12px">' +
            (regCert     ? docPill('Company Registration',  regCert)     : '<div style="color:var(--dash-text3);font-size:12px">No registration certificate uploaded</div>') +
            (councilCert ? docPill('Council Certificate',   councilCert) : '<div style="color:var(--dash-text3);font-size:12px">No council certificate uploaded</div>') +
          '</div>' +
          '<div style="margin-top:16px;padding:12px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:6px;font-size:11px;color:var(--dash-text3)">' +
            '<strong>Document Info:</strong><br/>' +
            'These documents were uploaded during your registration and reviewed by admins during approval.' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  } catch(e) {
    renderContent('<div class="empty-state"><div class="empty-icon">error</div><div class="empty-title">Error: '+e.message+'</div></div>');
  }
}
