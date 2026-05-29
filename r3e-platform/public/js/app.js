'use strict';

window.R3E = { user: null, charts: {} };

function setTopbar(title, rightHtml) {
  const el = document.getElementById('topbar-title');
  if (el) el.textContent = title;
  const tr = document.getElementById('topbar-right');
  if (tr && rightHtml !== undefined) tr.innerHTML = rightHtml;
}

/* ── Navigation config per role ── */
const NAV = {
  superadmin: [
    { section:'Overview',  items:[{ view:'sa-dashboard',  icon:'📊', label:'Dashboard'    }] },
    { section:'Merchants', items:[{ view:'sa-merchants',  icon:'🏪', label:'All Merchants' },
                                  { view:'sa-approvals',  icon:'✅', label:'Approvals'     }] },
    { section:'Users',     items:[{ view:'sa-admins',     icon:'🛡️', label:'Admins'        },
                                  { view:'sa-support',    icon:'🎧', label:'Support Team'  }] },
    { section:'System',    items:[{ view:'sa-locations',  icon:'📍', label:'Locations'     },
                                  { view:'sa-logs',       icon:'📋', label:'System Logs'   }] },
  ],
  admin: [
    { section:'Overview',  items:[{ view:'ad-dashboard',  icon:'📊', label:'Dashboard'    }] },
    { section:'Merchants', items:[{ view:'ad-merchants',  icon:'🏪', label:'Merchants'     },
                                  { view:'ad-approvals',  icon:'✅', label:'Approvals'     }] },
    { section:'Users',     items:[{ view:'ad-support',    icon:'🎧', label:'Support Team'  }] },
    { section:'Reports',   items:[{ view:'ad-analytics',  icon:'📈', label:'Analytics'     }] },
  ],
  support: [
    { section:'Overview',  items:[{ view:'sp-dashboard',  icon:'📊', label:'Dashboard'    }] },
    { section:'Merchants', items:[{ view:'sp-merchants',  icon:'🏪', label:'Merchants'     }] },
  ],
  merchant_owner: [
    { section:'My Store',  items:[{ view:'m-dashboard',   icon:'📊', label:'Dashboard'     },
                                  { view:'m-schedule',    icon:'📅', label:'Campaigns'      }] },
    { section:'Customers', items:[{ view:'m-customers',   icon:'👥', label:'Customers'      },
                                  { view:'m-qrcode',      icon:'📱', label:'QR Code'         },
                                  { view:'m-managers',    icon:'👨‍💼', label:'Managers'        }] },
    { section:'Campaigns', items:[{ view:'m-discounts',   icon:'🏷️', label:'Discounts'      },
                                  { view:'m-flyers',      icon:'🖼️', label:'Flyers'          }] },
    { section:'Settings',  items:[{ view:'m-hours',       icon:'🕐', label:'Business Hours'  },
                                  { view:'m-whatsapp',    icon:'💬', label:'WhatsApp'        },
                                  { view:'m-social',      icon:'📲', label:'Social Media'    }] },
  ],
  merchant_manager: [
    { section:'My Store',  items:[{ view:'m-dashboard',   icon:'📊', label:'Dashboard'     },
                                  { view:'m-schedule',    icon:'📅', label:'Campaigns'      }] },
    { section:'Customers', items:[{ view:'m-customers',   icon:'👥', label:'Customers'      }] },
    { section:'Campaigns', items:[{ view:'m-discounts',   icon:'🏷️', label:'Discounts'      },
                                  { view:'m-flyers',      icon:'🖼️', label:'Flyers'          }] },
  ],
};

/* ── View → render function map ── */
const VIEW_MAP = {
  'sa-dashboard': renderSaDashboard, 'sa-merchants': renderSaMerchants,
  'sa-approvals': renderSaApprovals, 'sa-admins':    renderSaAdmins,
  'sa-support':   renderSaSupport,   'sa-locations': renderSaLocations,
  'sa-logs':      renderSaLogs,
  'ad-dashboard': renderAdDashboard, 'ad-merchants': renderAdMerchants,
  'ad-approvals': renderAdApprovals, 'ad-support':   renderAdSupport,
  'ad-analytics': renderAdAnalytics,
  'sp-dashboard': renderSpDashboard, 'sp-merchants': renderSpMerchants,
  'm-dashboard':  renderMDashboard,  'm-customers':  renderMCustomers,
  'm-qrcode':     renderMQRCode,     'm-discounts':  renderMDiscounts,
  'm-flyers':     renderMFlyers,     'm-schedule':   renderMSchedule,
  'm-hours':      renderMHours,      'm-whatsapp':   renderMWhatsApp,
  'm-social':     showSocialView,
  'm-managers':   renderMManagers,
  'profile':      renderProfile,
};

/* ════════════════════════════════════════════
   BOOT APP — called after successful login
════════════════════════════════════════════ */
function bootApp() {
  const u = R3E.user;

  /* Show app, hide auth */
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');

  /* ── Sidebar user info ── */
  const displayName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  document.getElementById('u-av').textContent = (displayName[0] || '?').toUpperCase();
  document.getElementById('u-name-sb').textContent = displayName;

  const roleLabels = {
    superadmin: 'Super Administrator',
    admin:      'Administrator',
    support:    'Support Agent',
    merchant:   u.subRole === 'owner' ? 'Merchant Owner' : 'Merchant Manager',
  };
  document.getElementById('u-role-sb').textContent = roleLabels[u.userType] || u.userType;

  /* ── Build sidebar nav ── */
  const navKey = u.userType === 'merchant' ? `merchant_${u.subRole}` : u.userType;
  const cfg = NAV[navKey] || [];
  let navHtml = '';
  cfg.forEach(sec => {
    navHtml += `<div class="sidebar-section"><div class="sidebar-section-label">${sec.section}</div>`;
    sec.items.forEach(item => {
      navHtml += `<div class="nav-item" data-view="${item.view}" onclick="showView('${item.view}',this)">
        <span class="nav-icon">${item.icon}</span>${item.label}
      </div>`;
    });
    navHtml += '</div>';
  });
  document.getElementById('nav-links').innerHTML = navHtml;

  /* ── Topbar right: role badge + back-to-site ── */
  const roleClasses = { superadmin:'role-superadmin', admin:'role-admin', support:'role-support', merchant:'role-merchant' };
  const roleIcons   = { superadmin:'👑', admin:'🛡️', support:'🎧', merchant: u.subRole === 'owner' ? '🏪' : '👨‍💼' };
  document.getElementById('topbar-right').innerHTML = `
    <span class="topbar-role-badge ${roleClasses[u.userType] || 'role-admin'}">
      ${roleIcons[u.userType] || '👤'} ${roleLabels[u.userType]}
    </span>
    <a href="/index.html" class="topbar-back-btn" title="Return to the R3E website">
      ← Back to site
    </a>`;

  /* ── Navigate to default view ── */
  if (u.userType === 'merchant') {
    API.getMerchant(u.merchantId)
      .then(m => {
        if (m.status !== 'approved') { showPendingScreen(m.status); }
        else showView('m-dashboard');
      })
      .catch(() => showView('m-dashboard'));
  } else {
    const defaults = { superadmin:'sa-dashboard', admin:'ad-dashboard', support:'sp-dashboard' };
    showView(defaults[u.userType] || 'sa-dashboard');
  }
}

/* ════════════════════════════════════════════
   ROUTING
════════════════════════════════════════════ */
function showView(view, navEl) {
  destroyCharts();

  /* ── Merchant full-page view ── */
  if (view === 'merchantView') {
    if (!R3E.viewingMerchantId) return;
    /* Don't overwrite currentView so back button works */
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    renderContent('<div class="loading-state">Loading merchant data…</div>');
    _loadMerchantView(R3E.viewingMerchantId);
    return;
  }

  R3E.currentView = view;

  /* Update active nav item */
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeEl = navEl || document.querySelector(`.nav-item[data-view="${view}"]`);
  if (activeEl) activeEl.classList.add('active');

  renderContent('<div class="loading-state">Loading…</div>');

  const fn = VIEW_MAP[view];
  if (fn) fn();
  else renderContent(`<div class="empty-state">
    <div class="empty-icon">🚧</div>
    <div class="empty-title">Coming Soon</div>
    <div class="empty-sub">This section is under development.</div>
  </div>`);
}

/* ════════════════════════════════════════════
   PENDING MERCHANT SCREEN
════════════════════════════════════════════ */
function showPendingScreen(status) {
  document.getElementById('nav-links').innerHTML = `
  <div class="sidebar-section">
    <div class="nav-item active">
      <span class="nav-icon">${status === 'pending' ? '⏳' : '❌'}</span>
      ${status === 'pending' ? 'Awaiting Approval' : 'Application Rejected'}
    </div>
  </div>`;

  setTitle(status === 'pending' ? 'Awaiting Approval' : 'Application Rejected');

  renderContent(`
  <div class="pending-screen">
    <div class="pending-icon">${status === 'pending' ? '⏳' : '❌'}</div>
    <h2>${status === 'pending' ? 'Application Under Review' : 'Application Rejected'}</h2>
    <p>${status === 'pending'
      ? 'Your merchant registration is being reviewed by our team. You will be notified by email once your business documents are verified. This typically takes 1–2 business days.'
      : 'Your application was not approved at this time. Please contact support or re-apply with updated documents.'
    }</p>
    ${status === 'pending' ? `
    <div style="text-align:left;background:rgba(255,255,255,0.04);border-radius:var(--r);padding:16px;margin-bottom:20px;font-size:13px;line-height:2;border:0.5px solid var(--border2)">
      <strong style="color:var(--text)">Documents under review:</strong><br>
      ✅ Company Registration Certificate<br>
      ✅ Council Brand Approval Certificate<br>
      ✅ Business information<br>
      ⏳ Identity verification
    </div>` : ''}
    <button class="btn btn-outline" onclick="doLogout()">← Sign Out</button>
  </div>`);
}

/* ════════════════════════════════════════════
   SHARED MERCHANT DETAIL MODAL
   Used by Super Admin, Admin, and Support —
   all roles see the SAME data from the same DB.
   Actions (approve/reject/edit) are gated by role.
════════════════════════════════════════════ */
async function openMerchantDetail(merchantId) {
  try {
    const m = await API.getMerchant(merchantId);
    const brandName = m.brandName || m.brand_name || 'Merchant';

    /* Save admin state before impersonating */
    R3E.impersonating = {
      merchantId,
      brandName,
      prevView:     R3E.currentView || 'merchants',
      prevUserType: R3E.user.userType,
      prevMerchantId: R3E.user.merchantId || null,
      prevBrandName:  R3E.user.brandName  || null,
    };

    /* Temporarily become the merchant */
    R3E.user.userType   = 'merchant';
    R3E.user.merchantId = merchantId;
    R3E.user.brandName  = brandName;

    /* Show impersonation banner */
    _showImpersonationBar(brandName);

    /* Rebuild sidebar as merchant */
    buildNav();

    /* Load merchant dashboard */
    showView('m-dashboard');

  } catch(e) { showToast('Could not load merchant: ' + e.message, 'error'); }
}

async function _loadMerchantView(merchantId) {
  renderContent('<div class="loading-state">Loading merchant data...</div>');
  const isAdmin = ['superadmin','admin','support'].includes(R3E.user?.userType);
  const canEdit = ['superadmin','admin'].includes(R3E.user?.userType);
  try {
    const [m, custs, camps] = await Promise.all([
      API.getMerchant(merchantId),
      API.getCustomers(merchantId).catch(()=>[]),
      API.getCampaigns(merchantId).catch(()=>[])]
    );
    const brandName   = m.brandName    || m.brand_name    || 'Merchant';
    const regCert     = m.regCert      || m.reg_cert      || '';
    const councilCert = m.councilCert  || m.council_cert  || '';

    // Set topbar with exit button
    setTopbar(brandName + ' — Merchant View',
      `<button class="btn btn-outline btn-sm" onclick="exitMerchantView()">← Exit View</button>`);

    renderContent(`
      <div class="page-header">
        <div>
          <div class="page-title">${brandName}</div>
          <div class="page-sub">${m.category||''} · ${m.town||''} · ${m.email||''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${canEdit && m.status==='pending' ? `
            <button class="btn btn-success btn-sm" onclick="approveMerchantAndRefresh('${m.id}')">✅ Approve</button>
            <button class="btn btn-danger btn-sm"  onclick="rejectMerchantAndRefresh('${m.id}')">❌ Reject</button>` : ''}
          ${canEdit ? `
            <button class="btn btn-dark btn-sm" onclick="toggleEngineAdmin('${m.id}',${!m.engineOn})">
              ${m.engineOn ? '🔴 Stop Engine' : '🟢 Start Engine'}
            </button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="exitMerchantView()">← Exit</button>
        </div>
      </div>

      <!-- Status bar -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <span class="badge b-${m.status==='approved'?'approved':m.status==='pending'?'pending':'error'}">
          ${m.status?.toUpperCase()||'UNKNOWN'}
        </span>
        <span class="badge b-${m.engineOn?'approved':'gray'}">Engine ${m.engineOn?'ON':'OFF'}</span>
        <span class="badge b-gray">${custs.length} customers</span>
        <span class="badge b-gray">${camps.length} campaigns</span>
        <span class="badge b-gray">QR: ${m.qrId||'—'}</span>
      </div>

      <!-- Tabs -->
      <div class="tab-strip">
        <button class="tab-btn active" onclick="switchTab(this,'mvt-profile')">Profile</button>
        <button class="tab-btn" onclick="switchTab(this,'mvt-customers')">Customers (${custs.length})</button>
        ${canEdit ? `<button class="tab-btn" onclick="switchTab(this,'mvt-discounts')">Discounts</button>` : ''}
        ${canEdit ? `<button class="tab-btn" onclick="switchTab(this,'mvt-hours')">Business Hours</button>` : ''}
        ${canEdit ? `<button class="tab-btn" onclick="switchTab(this,'mvt-flyers')">Flyers</button>` : ''}
        <button class="tab-btn" onclick="switchTab(this,'mvt-campaigns')">Campaigns</button>
        <button class="tab-btn" onclick="switchTab(this,'mvt-docs')">Documents</button>
      </div>

      <!-- PROFILE TAB -->
      <div id="mvt-profile" class="tab-panel active">
        <div class="grid-2">
          <div class="card">
            <div class="card-title">Business Details</div>
            <div class="approval-grid">
              ${[
                ['Business Name', m.businessName||m.business_name],
                ['Brand', m.brandName||m.brand_name],
                ['Category', m.category],
                ['Phone', m.phone],
                ['Email', m.email],
                ['Address', m.address],
                ['Town', m.town],
                ['County', m.county],
                ['Postcode', m.postcode],
                ['Location', m.locationId||m.location_id||'Unassigned'],
                ['Registered', m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-GB') : '—'],
                ['Approved By', m.approvedBy||m.approved_by||'—'],
              ].map(([l,v]) => `<div class="ag-label">${l}</div><div class="ag-val">${v||'—'}</div>`).join('')}
            </div>
            ${canEdit ? `
              <button class="btn btn-outline btn-sm" style="margin-top:12px"
                onclick="openEditMerchantModal('${m.id}')">✏️ Edit Profile</button>` : ''}
          </div>
          <div class="card">
            <div class="card-title">QR Code</div>
            ${m.qrId ? `
              <div style="text-align:center;padding:16px">
                <div class="qr-placeholder" style="width:120px;height:120px;margin:0 auto 12px;
                  background:var(--dash-bg2);border:2px solid var(--dash-border);border-radius:8px;
                  display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--dash-text3)">
                  QR: ${m.qrId}
                </div>
                <div style="font-size:12px;color:var(--dash-text3)">QR ID: <strong style="color:var(--gold)">${m.qrId}</strong></div>
              </div>` : `<div class="empty-state" style="padding:20px"><div class="empty-sub">Not assigned yet</div></div>`}
          </div>
        </div>
      </div>

      <!-- CUSTOMERS TAB -->
      <div id="mvt-customers" class="tab-panel hidden">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Customers (${custs.length})</div>
            ${canEdit ? `
              <button class="btn btn-primary btn-sm" onclick="openAdminUploadCSV('${m.id}')">⬆ Upload CSV</button>` : ''}
          </div>
          ${custs.length === 0 ? `<div class="empty-state" style="padding:20px"><div class="empty-sub">No customers yet</div></div>` : `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>WhatsApp</th><th>Town</th><th>Source</th><th>Subscribed</th><th>Joined</th></tr></thead>
              <tbody>
                ${custs.slice(0,50).map(c => `<tr>
                  <td>${c.firstName||c.first_name||''} ${c.lastName||c.last_name||''}</td>
                  <td>${c.whatsapp||'—'}</td>
                  <td>${c.town||'—'}</td>
                  <td><span class="badge b-gray">${c.source||'manual'}</span></td>
                  <td>${c.subscribed?'✅':'❌'}</td>
                  <td>${c.registeredAt ? new Date(c.registeredAt).toLocaleDateString('en-GB') : '—'}</td>
                </tr>`).join('')}
                ${custs.length > 50 ? `<tr><td colspan="6" class="txt-xs" style="text-align:center">+${custs.length-50} more customers</td></tr>` : ''}
              </tbody>
            </table>
          </div>`}
        </div>
        <div id="admin-upload-area-${m.id}"></div>
      </div>

      <!-- DISCOUNTS TAB -->
      <div id="mvt-discounts" class="tab-panel hidden">
        <div id="admin-discounts-${m.id}">
          <div class="loading-state">Loading discounts...</div>
        </div>
      </div>

      <!-- BUSINESS HOURS TAB -->
      <div id="mvt-hours" class="tab-panel hidden">
        <div id="admin-hours-${m.id}">
          <div class="loading-state">Loading hours...</div>
        </div>
      </div>

      <!-- FLYERS TAB -->
      <div id="mvt-flyers" class="tab-panel hidden">
        <div id="admin-flyers-${m.id}">
          <div class="loading-state">Loading flyers...</div>
        </div>
      </div>

      <!-- CAMPAIGNS TAB -->
      <div id="mvt-campaigns" class="tab-panel hidden">
        <div class="card">
          <div class="card-title">Campaign History</div>
          ${camps.length === 0 ? `<div class="empty-state" style="padding:20px"><div class="empty-sub">No campaigns yet</div></div>` : `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Tier</th><th>Sent</th><th>Redeemed</th><th>Rate</th></tr></thead>
              <tbody>
                ${camps.slice(0,20).map(c => {
                  const rate = c.sentCount > 0 ? Math.round(c.redeemedCount/c.sentCount*100) : 0;
                  return `<tr>
                    <td>${c.campaignDate ? new Date(c.campaignDate).toLocaleDateString('en-GB') : '—'}</td>
                    <td>${c.tier||'—'}</td>
                    <td>${c.sentCount||0}</td>
                    <td>${c.redeemedCount||0}</td>
                    <td>${rate}%</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}
        </div>
      </div>

      <!-- DOCUMENTS TAB -->
      <div id="mvt-docs" class="tab-panel hidden">
        <div class="card">
          <div class="card-title">Uploaded Documents</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">
            ${docPill('📄 Company Registration', regCert)}
            ${docPill('📋 Council Certificate', councilCert)}
          </div>
        </div>
      </div>
    `);

    /* Lazy-load admin tabs on click */
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (target === 'mvt-discounts') loadAdminDiscounts('${m.id}');
        if (target === 'mvt-hours')     loadAdminHours('${m.id}');
        if (target === 'mvt-flyers')    loadAdminFlyers('${m.id}');
      });
    });

    window._modalCusts = custs;
  } catch(e) {
    renderContent(`<div class="empty-state"><div class="empty-icon">⚠️</div>
      <div class="empty-title">Error loading merchant</div>
      <div class="empty-sub">${e.message}</div>
      <button class="btn btn-outline" style="margin-top:16px" onclick="exitMerchantView()">← Go Back</button></div>`);
  }
}

/* ── Admin upload CSV for a specific merchant ── */
function openAdminUploadCSV(merchantId) {
  R3E._adminUploadMid = merchantId;
  openModal('sm','Upload Customers for Merchant', `
    <input type="file" id="admin-csv-input" accept=".csv" style="display:none" onchange="handleAdminCSVFile(this.files[0])"/>
    <div style="border:2px dashed var(--dash-border);border-radius:var(--r);padding:28px;text-align:center;cursor:pointer"
         onclick="document.getElementById('admin-csv-input').click()"
         ondragover="event.preventDefault()" ondrop="event.preventDefault();handleAdminCSVFile(event.dataTransfer.files[0])">
      <div style="font-size:32px;margin-bottom:8px">📂</div>
      <div style="font-size:13px;font-weight:600;color:var(--dash-text)">Click to browse or drag & drop</div>
      <div style="font-size:11px;color:var(--dash-text3)">CSV only (first_name, last_name, whatsapp, email, dob_month, town)</div>
    </div>
    <div id="admin-csv-status" style="margin-top:10px"></div>
    <div id="admin-csv-preview" class="hidden" style="margin-top:10px"></div>`,
    `<button id="admin-import-btn" class="btn btn-primary hidden" onclick="finalizeAdminCSV()">Import</button>
     <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`);
}

window._adminCsvRows = [];
function handleAdminCSVFile(file) {
  if (!file) return;
  const status = document.getElementById('admin-csv-status');
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split(/\r?\n/).filter(l=>l.trim());
    if (lines.length < 2) { if(status) status.innerHTML='<div class="alert-error">Empty file</div>'; return; }
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/[" ]/g,''));
    window._adminCsvRows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v=>v.trim().replace(/^"|"$/g,''));
      const obj = {}; headers.forEach((h,i)=>obj[h]=vals[i]||'');
      return { firstName:obj.first_name||obj.firstname||'', lastName:obj.last_name||obj.lastname||'',
               whatsapp:obj.whatsapp||obj.phone||'', email:obj.email||'',
               dobMonth:obj.dob_month||'', town:obj.town||'',
               tcAgree:true, subscribed:true, source:'upload' };
    }).filter(r=>r.whatsapp && r.firstName);
    const preview = document.getElementById('admin-csv-preview');
    const btn = document.getElementById('admin-import-btn');
    if (preview) {
      preview.classList.remove('hidden');
      preview.innerHTML = '<div class="alert-success">✅ <strong>' + window._adminCsvRows.length + ' customers</strong> found</div>';
    }
    if (btn) { btn.textContent = 'Import ' + window._adminCsvRows.length + ' Customers'; btn.classList.remove('hidden'); }
    if (status) status.innerHTML = '';
  };
  reader.readAsText(file);
}

function exitMerchantView() {
  if (!R3E.impersonating) {
    /* fallback */
    showView('merchants');
    return;
  }
  const prev = R3E.impersonating;
  R3E.user.userType   = prev.prevUserType;
  R3E.user.merchantId = prev.prevMerchantId;
  R3E.user.brandName  = prev.prevBrandName;
  R3E.impersonating   = null;
  R3E.viewingMerchantId = null;

  /* Hide banner + restore layout */
  const bar = document.getElementById('impersonation-bar');
  if (bar) bar.style.display = 'none';
  const layout = document.getElementById('app-layout') || document.getElementById('app');
  if (layout) layout.style.marginTop = '';

  /* Rebuild admin sidebar */
  buildNav();

  /* Return to previous admin view */
  showView(prev.prevView || 'merchants');
}

function _showImpersonationBar(brandName) {
  let bar = document.getElementById('impersonation-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'impersonation-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;height:40px;' +
      'background:linear-gradient(90deg,#1a0f00,#2a1800);' +
      'border-bottom:2px solid #C9A34E;display:flex;align-items:center;' +
      'justify-content:space-between;padding:0 20px;font-family:Inter,sans-serif;';
    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#C9A34E">👁 Admin View</span>' +
        '<span style="font-size:11px;color:rgba(240,237,232,0.5)">—</span>' +
        '<span id="imp-brand-name" style="font-size:13px;font-weight:700;color:#F0EDE8"></span>' +
        '<span style="font-size:10px;color:rgba(240,237,232,0.4)">Managing this merchants dashboard</span>' +
      '</div>' +
      '<button onclick="exitMerchantView()" ' +
        'style="background:rgba(201,163,78,0.15);border:1px solid rgba(201,163,78,0.4);' +
        'border-radius:6px;color:#C9A34E;font-size:11px;font-weight:700;letter-spacing:.5px;' +
        'padding:5px 16px;cursor:pointer;font-family:Inter,sans-serif;text-transform:uppercase" ' +
        '>'
 +
        '← Exit Merchant Dashboard' +
      '</button>';
    document.body.appendChild(bar);
  }
  document.getElementById('imp-brand-name').textContent = brandName;
  bar.style.display = 'flex';
  const layout = document.getElementById('app-layout') || document.getElementById('app');
  if (layout) layout.style.marginTop = '40px';
}


async function finalizeAdminCSV() {
  if (!window._adminCsvRows?.length) return showToast('No data to import.','error');
  const btn = document.getElementById('admin-import-btn');
  if (btn) { btn.disabled=true; btn.textContent='Importing...'; }
  try {
    const res = await API.addCustomers(R3E._adminUploadMid, window._adminCsvRows);
    window._adminCsvRows = [];
    closeModal();
    showToast('✅ ' + res.added + ' customers imported!','success');
    openMerchantDetail(R3E.viewingMerchantId);
  } catch(e) { showToast(e.message,'error'); if(btn){btn.disabled=false;btn.textContent='Import';} }
}

/* ── Admin: Toggle engine ── */
async function toggleEngineAdmin(merchantId, on) {
  try {
    await API.updateMerchant(merchantId, { engineOn: on, updatedBy: R3E.user.email });
    showToast('Engine ' + (on ? 'started ✅' : 'stopped 🔴'), on ? 'success' : 'error');
    openMerchantDetail(merchantId);
  } catch(e) { showToast(e.message,'error'); }
}

/* ── Lazy load discounts for admin merchant view ── */
async function loadAdminDiscounts(merchantId) {
  const el = document.getElementById('admin-discounts-' + merchantId);
  if (!el || el.dataset.loaded) return;
  el.dataset.loaded = '1';
  try {
    const discs = await API.getDiscounts(merchantId);
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const tiers = ['tier1','tier2','tier3'];
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Discount Tiers</div>
          <button class="btn btn-primary btn-sm" onclick="saveAdminDiscounts('${merchantId}')">Save Discounts</button>
        </div>
        <div class="table-wrap">
          <table class="data-table" style="font-size:12px">
            <thead><tr><th>Day</th>${tiers.map(t=>'<th>'+t.replace('tier','Tier ')+'</th>').join('')}</tr></thead>
            <tbody>
              ${days.map(day => {
                const d = discs.filter(x=>(x.dayOfWeek||x.day_of_week)===day);
                return '<tr><td>' + day + '</td>' + tiers.map(tier => {
                  const r = d.find(x=>(x.tier||'')===tier) || {};
                  return '<td style="white-space:nowrap">' +
                    '<input class="form-input" style="width:52px;padding:4px 6px;font-size:11px;display:inline-block" ' +
                    'placeholder="min" id="d_'+day+'_'+tier+'_min" value="'+(r.pctMin||r.pct_min||'')+'"/> – ' +
                    '<input class="form-input" style="width:52px;padding:4px 6px;font-size:11px;display:inline-block" ' +
                    'placeholder="max" id="d_'+day+'_'+tier+'_max" value="'+(r.pctMax||r.pct_max||'')+'"/>%' +
                    '</td>';
                }).join('') + '</tr>';
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch(e) { el.innerHTML = '<div class="alert-error">'+e.message+'</div>'; }
}

async function saveAdminDiscounts(merchantId) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const tiers = ['tier1','tier2','tier3'];
  const discounts = [];
  days.forEach(day => tiers.forEach(tier => {
    const min = parseFloat(document.getElementById('d_'+day+'_'+tier+'_min')?.value||0);
    const max = parseFloat(document.getElementById('d_'+day+'_'+tier+'_max')?.value||0);
    if (min > 0 || max > 0) discounts.push({ dayOfWeek:day, tier, pctMin:min, pctMax:max });
  }));
  try {
    await API.saveDiscounts(merchantId, discounts);
    showToast('✅ Discounts saved!','success');
  } catch(e) { showToast(e.message,'error'); }
}

/* ── Lazy load hours ── */
async function loadAdminHours(merchantId) {
  const el = document.getElementById('admin-hours-' + merchantId);
  if (!el || el.dataset.loaded) return;
  el.dataset.loaded = '1';
  try {
    const hours = await API.getHours(merchantId);
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Business Hours</div>
          <button class="btn btn-primary btn-sm" onclick="saveAdminHours('${merchantId}')">Save Hours</button>
        </div>
        ${days.map(day => {
          const h = hours.find(x=>(x.dayOfWeek||x.day_of_week)===day)||{};
          return '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--dash-border2)">' +
            '<label class="toggle"><input type="checkbox" id="h_'+day+'_open" '+(h.isOpen||h.is_open?'checked':'')+'/><div class="toggle-slider"></div></label>' +
            '<span style="min-width:36px;font-size:12px;color:var(--dash-text)">'+day+'</span>' +
            '<input class="form-input" style="width:100px;padding:4px 8px" type="time" id="h_'+day+'_start" value="'+(h.startTime||h.start_time||'09:00')+'"/>' +
            '<span style="font-size:12px;color:var(--dash-text3)">to</span>' +
            '<input class="form-input" style="width:100px;padding:4px 8px" type="time" id="h_'+day+'_end" value="'+(h.endTime||h.end_time||'17:00')+'"/>' +
            '</div>';
        }).join('')}
      </div>`;
  } catch(e) { el.innerHTML = '<div class="alert-error">'+e.message+'</div>'; }
}

async function saveAdminHours(merchantId) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const hours = days.map(day => ({
    dayOfWeek: day,
    isOpen:    document.getElementById('h_'+day+'_open')?.checked||false,
    startTime: document.getElementById('h_'+day+'_start')?.value||'09:00',
    endTime:   document.getElementById('h_'+day+'_end')?.value||'17:00',
  }));
  try {
    await API.saveHours(merchantId, hours);
    showToast('✅ Business hours saved!','success');
  } catch(e) { showToast(e.message,'error'); }
}

/* ── Lazy load flyers ── */
async function loadAdminFlyers(merchantId) {
  const el = document.getElementById('admin-flyers-' + merchantId);
  if (!el || el.dataset.loaded) return;
  el.dataset.loaded = '1';
  try {
    const flyers = await API.getFlyers(merchantId).catch(()=>[]);
    el.innerHTML = '<div class="card"><div class="card-title">Flyers</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px">' +
      [0,1,2].map(i => `
        <div style="border:1px solid var(--dash-border);border-radius:var(--r);padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--dash-text3);margin-bottom:8px">Slot ${i+1}</div>
          ${flyers[i] ? '<img src="'+flyers[i]+'" style="width:100%;border-radius:4px;margin-bottom:8px"/>' :
            '<div style="height:80px;background:var(--dash-bg2);border-radius:4px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--dash-text3)">Empty</div>'}
          <button class="btn btn-outline btn-sm btn-full" onclick="adminUploadFlyer('${merchantId}',${i})">
            ${flyers[i] ? '🔄 Replace' : '⬆ Upload'}
          </button>
        </div>`).join('') +
      '</div></div>';
  } catch(e) { el.innerHTML = '<div class="alert-error">'+e.message+'</div>'; }
}

function adminUploadFlyer(merchantId, slotIndex) {
  const input = document.createElement('input');
  input.type='file'; input.accept='image/*,.jpg,.jpeg,.png';
  input.onchange = async () => {
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        await API.post('/api/merchants/'+merchantId+'/flyers', { slotIndex, dataUrl: e.target.result });
        showToast('✅ Flyer uploaded!','success');
        const el = document.getElementById('admin-flyers-'+merchantId);
        if (el) { el.dataset.loaded=''; loadAdminFlyers(merchantId); }
      } catch(err) { showToast(err.message,'error'); }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}


async function approveMerchantAndRefresh(id) {
  try {
    await API.approveMerchant(id, R3E.user.email);
    showToast('✅ Merchant approved!', 'success');
    closeModal();
    if (R3E.currentView) showView(R3E.currentView);
  } catch(e) { showToast(e.message, 'error'); }
}
async function rejectMerchantAndRefresh(id) {
  /* Show reason modal */
  openModal('sm', 'Reject Merchant', `
    <p style="font-size:13px;color:var(--dash-text2);margin-bottom:14px">
      Please provide a reason for rejection. This will be sent to the merchant by email.
    </p>
    <div class="form-group">
      <label class="form-label">Rejection Reason *</label>
      <textarea id="reject-reason" class="form-input form-textarea" rows="3"
        placeholder="e.g. Incomplete council approval certificate submitted. Please resubmit with a valid document."></textarea>
    </div>`,
    `<button class="btn btn-danger" onclick="confirmRejectMerchant('${id}')">Confirm Rejection</button>
     <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`
  );
}
async function confirmRejectMerchant(id) {
  const reason = document.getElementById('reject-reason')?.value.trim();
  if (!reason) return showToast('Please enter a rejection reason.', 'error');
  try {
    await API.rejectMerchant(id, R3E.user.email, reason);
    showToast('Merchant rejected.', 'error');
    closeModal();
    if (R3E.currentView) showView(R3E.currentView);
  } catch(e) { showToast(e.message, 'error'); }
}

/* ════════════════════════════════════════════
   PROFILE VIEW (all roles)
════════════════════════════════════════════ */
async function renderProfile() {
  setTitle('My Profile');
  const u = R3E.user;
  renderContent(`
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Profile Information</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">First Name</label>
          <input id="p-fn" class="form-input" value="${u.firstName || ''}"/></div>
        <div class="form-group"><label class="form-label">Last Name</label>
          <input id="p-ln" class="form-input" value="${u.lastName || ''}"/></div>
      </div>
      <div class="form-group"><label class="form-label">Email Address</label>
        <input class="form-input" value="${u.email}" disabled style="opacity:.55"/></div>
      <div class="form-group"><label class="form-label">Contact Number</label>
        <input id="p-phone" class="form-input" value="${u.phone || ''}"/></div>
      ${u.userType === 'merchant' && u.subRole === 'owner' ? `
        <div class="divider"></div>
        <div class="form-group"><label class="form-label">Brand Name</label>
          <input id="p-brand" class="form-input" value="${u.brandName || ''}"/></div>
        <div class="form-group"><label class="form-label">WhatsApp Business Number</label>
          <input id="p-wa" class="form-input" value="${u.whatsappNum || ''}"/></div>` : ''}
      <button class="btn btn-primary" onclick="saveProfileChanges()">Save Changes</button>
    </div>

    <div class="card">
      <div class="card-title">Change Password</div>
      <div id="pwd-msg"></div>
      <div class="form-group"><label class="form-label">Current Password</label>
        <input id="p-cur" class="form-input" type="password" autocomplete="current-password"/></div>
      <div class="form-group"><label class="form-label">New Password</label>
        <input id="p-new" class="form-input" type="password" placeholder="Min. 8 characters" autocomplete="new-password"/></div>
      <div class="form-group"><label class="form-label">Confirm New Password</label>
        <input id="p-cfm" class="form-input" type="password" autocomplete="new-password"/></div>
      <button class="btn btn-primary" onclick="changeOwnPassword()">Update Password</button>
    </div>
  </div>`);
}

function saveProfileChanges() {
  showToast('✅ Profile updated!', 'success');
}

async function changeOwnPassword() {
  const cur  = document.getElementById('p-cur')?.value;
  const nw   = document.getElementById('p-new')?.value;
  const cfm  = document.getElementById('p-cfm')?.value;
  const msg  = document.getElementById('pwd-msg');
  if (!cur || !nw || !cfm) return (msg.innerHTML = '<div class="alert-error" style="margin-bottom:12px">Please fill all password fields.</div>');
  if (nw !== cfm)  return (msg.innerHTML = '<div class="alert-error" style="margin-bottom:12px">New passwords do not match.</div>');
  if (nw.length < 8) return (msg.innerHTML = '<div class="alert-error" style="margin-bottom:12px">Password must be at least 8 characters.</div>');
  try {
    if (R3E.user.userType === 'merchant') {
      await API.put(`/api/merchants/${R3E.user.merchantId}/reset-password`, { newPassword: nw, resetBy: R3E.user.email });
    } else {
      await API.changePassword(R3E.user.id, cur, nw);
    }
    msg.innerHTML = '<div class="alert-success" style="margin-bottom:12px">✅ Password changed successfully!</div>';
    ['p-cur','p-new','p-cfm'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch(e) {
    msg.innerHTML = `<div class="alert-error" style="margin-bottom:12px">${e.message}</div>`;
  }
}

/* ════════════════════════════════════════════
   INIT — restore session on page load
════════════════════════════════════════════ */
(function init() {
  /* Enter-key login */
  ['li-email','li-pass'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  });

  /* Restore saved session */
  const saved = sessionStorage.getItem('r3e_user');
  if (saved) {
    try {
      R3E.user = JSON.parse(saved);
      bootApp();
    } catch (_) {
      sessionStorage.removeItem('r3e_user');
    }
  }
})();
