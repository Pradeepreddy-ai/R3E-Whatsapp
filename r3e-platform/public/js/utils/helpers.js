/* ════ helpers.js — Shared UI utilities ════ */

/* Toast */
let _toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = (type ? 't-' + type : '') + ' show';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* Modal */
function openModal(size, title, bodyHtml, footerHtml = '') {
  document.getElementById('modal-root').innerHTML = `
  <div class="modal-overlay" onclick="closeModal()">
    <div class="modal-box ${size === 'lg' ? 'modal-lg' : size === 'sm' ? 'modal-sm' : ''}" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  </div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

/* Tabs */
function switchTab(btn, panelId) {
  const strip = btn.closest('.tab-strip');
  if (strip) strip.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById(panelId);
  if (panel) {
    const parent = panel.parentElement;
    parent.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    panel.classList.add('active');
  }
}

/* Content helpers */
function renderContent(html) { document.getElementById('content').innerHTML = html; }
function setTitle(t) { document.getElementById('topbar-title').textContent = t; }
function clearTopbarRight() { document.getElementById('topbar-right').innerHTML = ''; }
function setTopbarRight(html) { document.getElementById('topbar-right').innerHTML = html; }

/* Format helpers */
function fmtDate(iso) { return iso ? iso.split('T')[0] : '—'; }
function fmtDateTime(iso) { return iso ? iso.replace('T', ' ').split('.')[0] : '—'; }
function fmtNum(n) { return (n || 0).toLocaleString(); }
function fmtPct(n) { return (n || 0) + '%'; }

/* Status badge HTML */
function badge(text, cls) { return `<span class="badge b-${cls}">${text}</span>`; }

/* Document pill — clickable if it's a data URL */
function docPill(label, value) {
  if (!value || value === 'Not uploaded' || value === '' || value === '—') {
    return `<span class="doc-pill" style="opacity:.5">❌ ${label}: Not uploaded</span>`;
  }
  if (value.startsWith('data:')) {
    const ext = value.startsWith('data:application/pdf') ? 'pdf' : 'image';
    if (ext === 'pdf') {
      return `<a class="doc-pill" href="${value}" target="_blank" title="View document">📄 ${label} ↗</a>`;
    } else {
      return `<a class="doc-pill" href="${value}" target="_blank" title="View document">🖼️ ${label} ↗</a>`;
    }
  }
  return `<span class="doc-pill">📄 ${label}: ${value}</span>`;
}

/* Real file upload — converts to base64 data URL */
function simulateUpload(targetId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.jpg,.jpeg,.png';
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('File too large. Max 5MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;
      /* Store base64 on window for registration submission */
      window._uploads = window._uploads || {};
      window._uploads[targetId] = dataUrl;
      window._uploadNames = window._uploadNames || {};
      window._uploadNames[targetId] = file.name;
      const el = document.getElementById(targetId);
      if (el) {
        el.style.color = '#4ADE80';
        el.textContent = '✅ ' + file.name;
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

/* Generate time options for selects */
function timeOptions(selected) {
  let html = '';
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const t = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
      html += `<option value="${t}" ${t === selected ? 'selected' : ''}>${t}</option>`;
    }
  }
  return html;
}

/* Destroy all Chart.js instances */
function destroyCharts() {
  if (window.R3E && R3E.charts) {
    Object.values(R3E.charts).forEach(c => { try { c.destroy(); } catch(e) {} });
    R3E.charts = {};
  }
}

/* Chart default config */
function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };
}

/* Confirm dialog via modal */
function confirmAction(msg, onConfirm) {
  openModal('sm', 'Confirm Action',
    `<p style="font-size:14px;color:var(--txt2);line-height:1.6">${msg}</p>`,
    `<button class="btn btn-danger" onclick="(${onConfirm.toString()})();closeModal()">Confirm</button>
     <button class="btn btn-outline" onclick="closeModal()">Cancel</button>`
  );
}

/* ══════════════════════════════════════════════════════
   SHARED TABLE HELPERS
   Used by Super Admin, Admin, and Support views.
   Role determines which action buttons are shown.
══════════════════════════════════════════════════════ */

/**
 * renderSharedMerchantTable — renders merchant list with
 * role-appropriate action buttons.
 * role: 'superadmin' | 'admin' | 'support'
 */
function renderSharedMerchantTable(merchants, locs, role) {
  renderContent(`
  <div class="card mb-0">
    <div class="table-toolbar">
      <input class="search-input" placeholder="Search merchants by name or email…" oninput="filterSharedMerchants(this.value)"/>
      <select class="filter-sel" onchange="filterSharedMerchantStatus(this.value)">
        <option value="">All Status</option>
        <option value="approved">Approved</option>
        <option value="pending">Pending</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>
    <div class="table-wrap" id="shared-merchant-wrap">
      ${buildSharedMerchantRows(merchants, locs, role)}
    </div>
  </div>`);
  window._sharedMerchantsCache = { merchants, locs, role };
}

function buildSharedMerchantRows(merchants, locs, role) {
  if (!merchants.length) {
    return '<div class="empty-state" style="padding:32px"><div class="empty-icon">🏪</div><div class="empty-title">No merchants found</div></div>';
  }
  const canApprove = role === 'superadmin' || role === 'admin';
  const canEdit    = role === 'superadmin' || role === 'admin';

  return `<table class="data-table">
    <thead>
      <tr><th>Merchant</th><th>Category</th><th>Location</th><th>Engine</th><th>Status</th><th>Actions</th></tr>
    </thead>
    <tbody>
      ${merchants.map(m => {
        const loc  = locs.find(l => l.id === (m.location_id || m.location));
        const name = m.brandName || m.brand_name || '—';
        const on   = m.engineOn  || m.engine_on;
        return `<tr>
          <td>
            <strong>${name}</strong>
            <br><span class="txt-xs">${m.email}</span>
          </td>
          <td>${m.category || '—'}</td>
          <td>${loc?.name || '<span class="txt-xs">Unassigned</span>'}</td>
          <td>
            ${m.status === 'approved'
              ? (canEdit
                  ? `<div class="toggle-wrap">
                      <label class="toggle">
                        <input type="checkbox" ${on ? 'checked' : ''}
                          onchange="saToggleEngine('${m.id}',this.checked)"/>
                        <span class="toggle-slider"></span>
                      </label>
                      <span class="txt-xs" style="color:${on ? 'var(--success)' : 'var(--text3)'}">${on ? 'ON' : 'OFF'}</span>
                     </div>`
                  : badge(on ? 'ON' : 'OFF', on ? 'approved' : 'rejected'))
              : '—'}
          </td>
          <td>${badge(m.status, m.status)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-outline btn-xs" onclick="openMerchantDetail('${m.id}')">View</button>
              ${canEdit   ? `<button class="btn btn-dark btn-xs" onclick="openEditMerchantModal('${m.id}')">Edit</button>` : ''}
              ${canApprove && m.status === 'pending'
                ? `<button class="btn btn-success btn-xs" onclick="approveMerchantAndRefresh('${m.id}')">Approve</button>
                   <button class="btn btn-danger  btn-xs" onclick="rejectMerchantAndRefresh('${m.id}')">Reject</button>`
                : ''}
            </div>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function filterSharedMerchants(q) {
  const { merchants, locs, role } = window._sharedMerchantsCache || {};
  if (!merchants) return;
  const filtered = !q ? merchants : merchants.filter(m =>
    `${m.brandName||m.brand_name||''} ${m.email} ${m.town||''}`.toLowerCase().includes(q.toLowerCase())
  );
  const el = document.getElementById('shared-merchant-wrap');
  if (el) el.innerHTML = buildSharedMerchantRows(filtered, locs, role);
}

function filterSharedMerchantStatus(s) {
  const { merchants, locs, role } = window._sharedMerchantsCache || {};
  if (!merchants) return;
  const filtered = !s ? merchants : merchants.filter(m => m.status === s);
  const el = document.getElementById('shared-merchant-wrap');
  if (el) el.innerHTML = buildSharedMerchantRows(filtered, locs, role);
}

/**
 * buildApprovalCard — renders a full approval review card.
 * Used by both SA and Admin approval views.
 */
function buildApprovalCard(m, showActions) {
  const name = m.brandName || m.brand_name || '—';
  return `
  <div class="approval-card">
    <div class="approval-header">
      <div>
        <div class="fw-600" style="font-size:16px">${name}</div>
        <div class="txt-xs" style="margin-top:2px">${m.business_name||m.businessName||''} · ${m.category||'—'}</div>
      </div>
      ${showActions ? `
      <div class="page-actions">
        <button class="btn btn-success btn-sm" onclick="approveMerchantAndRefresh('${m.id}')">✅ Approve</button>
        <button class="btn btn-danger  btn-sm" onclick="rejectMerchantAndRefresh('${m.id}')">❌ Reject</button>
        <button class="btn btn-outline btn-sm" onclick="openMerchantDetail('${m.id}')">View Details</button>
      </div>` : ''}
    </div>
    <div class="approval-grid">
      <span class="afield">Contact</span>
      <span class="aval">${m.contact_fname||m.contactFName||''} ${m.contact_lname||m.contactLName||''}</span>
      <span class="afield">Email</span><span class="aval">${m.email}</span>
      <span class="afield">Phone</span><span class="aval">${m.phone||'—'}</span>
      <span class="afield">Address</span>
      <span class="aval">${m.address||'—'}, ${m.town||'—'}, ${m.postcode||'—'}</span>
      <span class="afield">Submitted</span>
      <span class="aval">${fmtDate(m.createdAt||m.created_at)}</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <span class="doc-pill">📄 ${m.reg_cert||m.regCert||'Not uploaded'}</span>
      <span class="doc-pill">📋 ${m.council_cert||m.councilCert||'Not uploaded'}</span>
    </div>
  </div>`;
}

/* Engine toggle (shared by SA and Admin) */
async function saToggleEngine(id, on) {
  try {
    await API.toggleEngine(id, on, R3E.user.email);
    showToast(on ? '🟢 Engine activated!' : '🔴 Engine stopped.');
  } catch(e) {
    showToast(e.message, 'error');
  }
}
