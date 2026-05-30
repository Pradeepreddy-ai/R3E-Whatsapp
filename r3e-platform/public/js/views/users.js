/* ═══════════════════════════════════════════════════
   users.js — User Management & Role Allocation
   Super Admin only
═══════════════════════════════════════════════════ */
'use strict';

/* ── Role definitions with full access descriptions ── */
const ROLE_DEFS = [
  {
    key: 'superadmin', subRole: null,
    label: 'Super Administrator', icon: '👑',
    color: '#C9A34E', bgColor: 'rgba(201,163,78,0.1)',
    badge: 'b-gold',
    description: 'Unrestricted access to the entire platform.',
    access: [
      'View & manage ALL merchants across all locations',
      'Approve, reject, suspend any merchant account',
      'Create, edit, delete all user accounts & roles',
      'Toggle merchant engines & override settings',
      'Manage locations, QR assignments, system config',
      'View full audit logs & system analytics',
      'Access any merchant dashboard (impersonation)',
      'Delete merchants & all associated data',
    ],
    restricted: [],
  },
  {
    key: 'admin', subRole: null,
    label: 'Administrator', icon: '🛡️',
    color: '#3B82F6', bgColor: 'rgba(59,130,246,0.1)',
    badge: 'b-info',
    description: 'Manages merchants in assigned location(s).',
    access: [
      'View & manage merchants in assigned locations',
      'Approve or reject merchant applications',
      'View merchant customers, campaigns & analytics',
      'Toggle merchant engine on/off',
      'Assign QR codes and locations to merchants',
      'View system logs for their location',
    ],
    restricted: [
      'Cannot create or delete user accounts',
      'Cannot access merchants outside their location',
      'Cannot modify system-wide settings',
    ],
  },
  {
    key: 'support', subRole: null,
    label: 'Support Agent', icon: '🎧',
    color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.1)',
    badge: 'b-purple',
    description: 'View-only access to help merchants with issues.',
    access: [
      'View all merchant accounts and their status',
      'View merchant customers, campaigns & discounts',
      'View system logs and audit trails',
      'Access merchant dashboard in read-only mode',
    ],
    restricted: [
      'Cannot approve, reject, or modify merchants',
      'Cannot toggle engine or change settings',
      'Cannot create/delete any records',
      'Cannot access financial or sensitive API data',
    ],
  },
  {
    key: 'merchant', subRole: 'owner',
    label: 'Merchant Owner', icon: '🏪',
    color: '#10B981', bgColor: 'rgba(16,185,129,0.1)',
    badge: 'b-approved',
    description: 'Full control of their own merchant business dashboard.',
    access: [
      'Full merchant dashboard access',
      'Start/stop campaign engine',
      'Manage customers: upload CSV, edit, delete',
      'Create & manage campaigns, discounts, flyers',
      'Configure WhatsApp Business API & auto-messages',
      'Connect social media accounts & publish posts',
      'Manage business hours, QR settings, managers',
    ],
    restricted: [
      'Cannot access other merchants\' data',
      'Cannot access admin or system settings',
    ],
  },
  {
    key: 'merchant', subRole: 'manager',
    label: 'Merchant Manager', icon: '👔',
    color: '#6B7280', bgColor: 'rgba(107,114,128,0.1)',
    badge: 'b-gray',
    description: 'Day-to-day operations without owner-level controls.',
    access: [
      'View merchant dashboard and analytics',
      'View and export customer lists',
      'Create campaigns and schedule messages',
      'Upload customer CSV files',
      'View discounts, flyers, campaigns',
    ],
    restricted: [
      'Cannot start/stop the campaign engine',
      'Cannot delete customers or data',
      'Cannot access WhatsApp API credentials',
      'Cannot modify billing or account settings',
    ],
  },
];

/* ── Main view ── */
async function renderSAUsers() {
  setTopbar('User Management');
  renderContent('<div class="loading-state">Loading users...</div>');

  try {
    const [users, locations] = await Promise.all([
      API.getUsers(),
      API.getLocations().catch(() => []),
    ]);

    renderContent(`
      <div class="page-header">
        <div>
          <div class="page-title">User Management</div>
          <div class="page-sub">${users.length} system users · Manage roles and access</div>
        </div>
        <button class="btn btn-primary" onclick="openCreateUserModal()">+ Create User</button>
      </div>

      <!-- Tab strip -->
      <div class="tab-strip">
        <button class="tab-btn active" onclick="switchTab(this,'tab-roles')">🏷️ Roles & Access</button>
        <button class="tab-btn" onclick="switchTab(this,'tab-users')">👥 All Users (${users.length})</button>
      </div>

      <!-- ── ROLES TAB ── -->
      <div id="tab-roles" class="tab-panel active">
        <div style="margin-bottom:16px">
          <div style="font-size:12px;color:var(--dash-text3);line-height:1.8">
            Each role has a specific set of permissions. Assign roles carefully —
            they determine what a user can see and do across the entire platform.
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${ROLE_DEFS.map(r => roleCard(r)).join('')}
        </div>
      </div>

      <!-- ── USERS TAB ── -->
      <div id="tab-users" class="tab-panel hidden">
        <!-- Filters -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <input id="user-search" class="form-input" style="flex:1;min-width:200px"
            placeholder="Search by name or email..." oninput="filterUsersTable()"/>
          <select id="user-role-filter" class="form-select" style="width:160px" onchange="filterUsersTable()">
            <option value="">All Roles</option>
            <option value="superadmin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="support">Support</option>
            <option value="merchant">Merchant</option>
          </select>
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <div class="table-wrap">
            <table class="data-table" id="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Created</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="users-tbody">
                ${users.map(u => userRow(u)).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Role summary pills -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          ${Object.entries(
            users.reduce((acc, u) => {
              const k = u.userType + (u.subRole ? '/'+u.subRole : '');
              acc[k] = (acc[k]||0)+1; return acc;
            }, {})
          ).map(([k,n]) => `<span class="badge b-gray">${k}: ${n}</span>`).join('')}
        </div>
      </div>
    `);

    /* Store for filtering */
    window._allUsers     = users;
    window._allLocations = locations;
  } catch(e) {
    renderContent(`<div class="empty-state"><div class="empty-icon">⚠️</div>
      <div class="empty-title">Error loading users</div>
      <div class="empty-sub">${e.message}</div></div>`);
  }
}

/* ── Role card ── */
function roleCard(r) {
  const def = ROLE_DEFS.find(x => x.key === r.key && x.subRole === r.subRole) || r;
  return `
    <div class="card" style="border-left:4px solid ${def.color};padding:16px 18px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:10px;background:${def.bgColor};
            display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">
            ${def.icon}
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--dash-text)">${def.label}</div>
            <div style="font-size:11px;color:var(--dash-text3);margin-top:2px">${def.description}</div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" style="white-space:nowrap"
          onclick="openCreateUserModal('${def.key}','${def.subRole||''}')">
          + Create ${def.label}
        </button>
      </div>
      <div class="grid-2" style="gap:10px">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--success);letter-spacing:.8px;
            text-transform:uppercase;margin-bottom:6px">✅ Has Access To</div>
          <ul style="margin:0;padding-left:16px;font-size:11px;color:var(--dash-text2);line-height:2">
            ${def.access.map(a => `<li>${a}</li>`).join('')}
          </ul>
        </div>
        ${def.restricted.length ? `
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--danger);letter-spacing:.8px;
            text-transform:uppercase;margin-bottom:6px">🚫 No Access To</div>
          <ul style="margin:0;padding-left:16px;font-size:11px;color:var(--dash-text2);line-height:2">
            ${def.restricted.map(a => `<li>${a}</li>`).join('')}
          </ul>
        </div>` : '<div></div>'}
      </div>
    </div>`;
}

/* ── User table row ── */
function userRow(u) {
  const def = ROLE_DEFS.find(x => x.key === u.userType && x.subRole === (u.subRole||null))
    || ROLE_DEFS.find(x => x.key === u.userType);
  const isSA = u.userType === 'superadmin';
  return `<tr data-role="${u.userType}" data-name="${(u.firstName+' '+u.lastName).toLowerCase()}" data-email="${u.email.toLowerCase()}">
    <td>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;border-radius:50%;background:${def?.bgColor||'rgba(255,255,255,0.05)'};
          display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">
          ${def?.icon||'👤'}
        </div>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--dash-text)">${u.firstName} ${u.lastName}</div>
          <div style="font-size:11px;color:var(--dash-text3)">${u.email}</div>
        </div>
      </div>
    </td>
    <td>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span class="badge ${def?.badge||'b-gray'}" style="font-size:10px">
          ${def?.icon||''} ${def?.label||u.userType}
        </span>
        ${u.subRole ? `<span style="font-size:9px;color:var(--dash-text3)">${u.subRole}</span>` : ''}
      </div>
    </td>
    <td style="font-size:12px;color:var(--dash-text2)">${u.locationName||'<span style="color:var(--dash-text4)">All / None</span>'}</td>
    <td style="font-size:11px;color:var(--dash-text3)">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—'}</td>
    <td style="font-size:11px;color:var(--dash-text3)">${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-GB') : '<span style="color:var(--dash-text4)">Never</span>'}</td>
    <td>
      <div style="display:flex;gap:6px">
        <button class="btn btn-xs" style="padding:3px 8px;font-size:10px"
          onclick="openEditUserModal('${u.id}')">✏️ Edit</button>
        ${!isSA ? `<button class="btn btn-xs btn-danger" style="padding:3px 8px;font-size:10px"
          onclick="deleteUserConfirm('${u.id}','${u.firstName} ${u.lastName}')">🗑</button>` : ''}
      </div>
    </td>
  </tr>`;
}

/* ── Filter users table ── */
function filterUsersTable() {
  const q    = (document.getElementById('user-search')?.value||'').toLowerCase();
  const role = document.getElementById('user-role-filter')?.value||'';
  document.querySelectorAll('#users-tbody tr').forEach(tr => {
    const nameMatch  = !q || tr.dataset.name.includes(q) || tr.dataset.email.includes(q);
    const roleMatch  = !role || tr.dataset.role === role;
    tr.style.display = (nameMatch && roleMatch) ? '' : 'none';
  });
}

/* ── Create user modal ── */
async function openCreateUserModal(preRole, preSubRole) {
  const locs = window._allLocations || [];
  renderContent(document.getElementById('content').innerHTML); // keep page
  openModal('md', 'Create New User', `
    <div class="grid-2">
      <div class="form-group"><label class="form-label">First Name *</label>
        <input id="nu-fname" class="form-input" placeholder="Sarah"/></div>
      <div class="form-group"><label class="form-label">Last Name</label>
        <input id="nu-lname" class="form-input" placeholder="Mitchell"/></div>
    </div>
    <div class="form-group"><label class="form-label">Email Address *</label>
      <input id="nu-email" class="form-input" type="email" placeholder="sarah@r3e.platform"/></div>
    <div class="form-group"><label class="form-label">Password * (min 8 chars)</label>
      <input id="nu-pass" class="form-input" type="password" placeholder="Secure@Pass1"/>
      <div class="form-hint">Share this with the user — they can reset it later via Forgot Password</div>
    </div>

    <div class="card" style="padding:14px;margin-bottom:14px;background:rgba(255,255,255,0.02)">
      <div class="card-title" style="margin-bottom:12px">Role & Access</div>
      <div style="display:flex;flex-direction:column;gap:8px" id="role-selector">
        ${ROLE_DEFS.map(r => `
          <label style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;
            border:1px solid var(--dash-border2);border-radius:8px;cursor:pointer;transition:all .18s"
            onclick="selectUserRole('${r.key}','${r.subRole||''}')"
            id="role-opt-${r.key}-${r.subRole||'none'}"
            onmouseover="this.style.borderColor='var(--gold-border)'"
            onmouseout="if(!this.querySelector('input').checked)this.style.borderColor='var(--dash-border2)'">
            <input type="radio" name="nu-role" value="${r.key}|${r.subRole||''}"
              style="margin-top:2px;accent-color:var(--gold)"
              ${preRole===r.key&&(preSubRole||'')===(r.subRole||'')?'checked':''}/>
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:18px">${r.icon}</span>
                <span style="font-size:13px;font-weight:700;color:var(--dash-text)">${r.label}</span>
                <span class="badge ${r.badge}" style="font-size:9px">${r.key}${r.subRole?'/'+r.subRole:''}</span>
              </div>
              <div style="font-size:11px;color:var(--dash-text3);line-height:1.6">${r.description}</div>
              <div style="font-size:10px;color:var(--dash-text4);margin-top:4px">
                ${r.access.slice(0,2).join(' · ')}${r.access.length>2?' · ...':''}
              </div>
            </div>
          </label>`).join('')}
      </div>
    </div>

    <div class="form-group" id="nu-loc-wrap" style="display:${['superadmin'].includes(preRole)?'none':'block'}">
      <label class="form-label">Assign to Location <span style="color:var(--dash-text3)">(optional for admins)</span></label>
      <select id="nu-location" class="form-select">
        <option value="">All locations / Not assigned</option>
        ${locs.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
      </select>
    </div>
  `,
  `<button class="btn btn-primary" onclick="submitCreateUser()">Create User</button>
   <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`);

  /* Auto-select: preRole if given, otherwise first role */
  const defaultRole = preRole || ROLE_DEFS[0].key;
  const defaultSub  = preRole ? (preSubRole||'') : (ROLE_DEFS[0].subRole||'');
  /* Defer until DOM is rendered */
  setTimeout(() => selectUserRole(defaultRole, defaultSub), 50);
}

function selectUserRole(role, subRole) {
  /* Store reliably — don't rely on :checked selector in innerHTML */
  window._selectedRole = { userType: role, subRole: subRole || '' };

  document.querySelectorAll('[id^="role-opt-"]').forEach(el => {
    const inp = el.querySelector('input');
    if (!inp) return;
    const selected = inp.value === role + '|' + (subRole || '');
    inp.checked = selected;
    el.style.borderColor = selected ? 'var(--gold)' : 'var(--dash-border2)';
    el.style.background  = selected ? 'rgba(201,163,78,0.06)' : '';
    el.style.boxShadow   = selected ? '0 0 0 1px var(--gold)' : 'none';
  });

  const locWrap = document.getElementById('nu-loc-wrap');
  if (locWrap) locWrap.style.display = role === 'superadmin' ? 'none' : 'block';
}

/* Clear stored role when modal closed */
function closeModalAndClear() { window._selectedRole = null; closeModal(); }

async function submitCreateUser() {
  const fname  = document.getElementById('nu-fname')?.value.trim();
  const lname  = document.getElementById('nu-lname')?.value.trim()||'';
  const email  = document.getElementById('nu-email')?.value.trim();
  const pass   = document.getElementById('nu-pass')?.value;
  const locId  = document.getElementById('nu-location')?.value||null;
  const sel = window._selectedRole;

  if (!fname) return showToast('First name is required.', 'error');
  if (!email) return showToast('Email address is required.', 'error');
  if (!pass)  return showToast('Password is required.', 'error');
  if (pass.length < 8) return showToast('Password must be at least 8 characters.', 'error');
  if (!sel?.userType) return showToast('Please select a role for this user.', 'error');

  const { userType, subRole } = sel;
  const btn = document.querySelector('.modal-footer .btn-primary');
  if (btn) { btn.disabled=true; btn.textContent='Creating...'; }

  try {
    await API.createUser({
      firstName: fname, lastName: lname, email,
      password: pass, userType, subRole: subRole||null,
      locationId: locId||null, createdBy: R3E.user.email,
    });
    closeModal();
    showToast(`✅ ${fname} ${lname} created as ${userType}${subRole?'/'+subRole:''}!`, 'success');
    renderSAUsers();
  } catch(e) {
    showToast(e.message, 'error');
    if (btn) { btn.disabled=false; btn.textContent='Create User'; }
  }
}

/* ── Edit user modal ── */
async function openEditUserModal(userId) {
  const u = window._allUsers?.find(x => x.id == userId);
  if (!u) return showToast('User not found.', 'error');
  const locs = window._allLocations || [];

  openModal('md', 'Edit User — ' + u.firstName + ' ' + u.lastName, `
    <div class="grid-2">
      <div class="form-group"><label class="form-label">First Name</label>
        <input id="eu-fname" class="form-input" value="${u.firstName||''}"/></div>
      <div class="form-group"><label class="form-label">Last Name</label>
        <input id="eu-lname" class="form-input" value="${u.lastName||''}"/></div>
    </div>
    <div class="form-group"><label class="form-label">Email</label>
      <input class="form-input" value="${u.email}" disabled style="opacity:.5"/></div>
    <div class="form-group"><label class="form-label">New Password <span style="color:var(--dash-text3)">(leave blank to keep current)</span></label>
      <input id="eu-pass" class="form-input" type="password" placeholder="Leave blank to keep unchanged"/></div>

    <div class="form-group"><label class="form-label">Role</label>
      <select id="eu-role" class="form-select" onchange="updateEditSubRoleOptions()">
        ${ROLE_DEFS.map(r =>
          `<option value="${r.key}|${r.subRole||''}" ${u.userType===r.key&&(u.subRole||'')===(r.subRole||'')?'selected':''}>
            ${r.icon} ${r.label}
          </option>`).join('')}
      </select></div>

    <div class="form-group"><label class="form-label">Location</label>
      <select id="eu-location" class="form-select">
        <option value="">All locations / Not assigned</option>
        ${locs.map(l => `<option value="${l.id}" ${u.locationName===l.name?'selected':''}>${l.name}</option>`).join('')}
      </select></div>

    <div class="form-group" style="padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:6px">
      <div style="font-size:11px;color:var(--dash-text3)">
        <strong>Last login:</strong> ${u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-GB') : 'Never'}<br/>
        <strong>Created:</strong> ${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—'}
      </div>
    </div>
  `,
  `<button class="btn btn-primary" onclick="submitEditUser('${userId}')">Save Changes</button>
   <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`);
}

async function submitEditUser(userId) {
  const fname = document.getElementById('eu-fname')?.value.trim();
  const lname = document.getElementById('eu-lname')?.value.trim()||'';
  const pass  = document.getElementById('eu-pass')?.value||'';
  const locId = document.getElementById('eu-location')?.value||null;
  const selVal = document.getElementById('eu-role')?.value || '';
  const [userType, subRole] = selVal.split('|');
  if (!userType) return showToast('Please select a role.', 'error');
  const btn = document.querySelector('.modal-footer .btn-primary');
  if (btn) { btn.disabled=true; btn.textContent='Saving...'; }
  try {
    await API.updateUser(userId, {
      firstName: fname, lastName: lname,
      userType, subRole: subRole||null,
      locationId: locId||null,
      password: pass||undefined,
      updatedBy: R3E.user.email,
    });
    closeModal();
    showToast('✅ User updated!', 'success');
    renderSAUsers();
  } catch(e) {
    showToast(e.message, 'error');
    if (btn) { btn.disabled=false; btn.textContent='Save Changes'; }
  }
}

/* ── Delete user ── */
function deleteUserConfirm(userId, name) {
  if (!confirm(`Delete user "${name}"? They will lose all access immediately. This cannot be undone.`)) return;
  deleteUserNow(userId, name);
}

async function deleteUserNow(userId, name) {
  try {
    await API.deleteUser(userId, R3E.user.email);
    showToast(`✅ "${name}" deleted.`, 'success');
    renderSAUsers();
  } catch(e) { showToast(e.message, 'error'); }
}
