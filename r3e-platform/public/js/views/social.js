/* ═══════════════════════════════════════════════════
   social.js v3 — Seamless Social Media Publishing
   Connect once → post automatically forever
═══════════════════════════════════════════════════ */
'use strict';

const PLATFORMS = [
  { key:'facebook',  label:'Facebook Page',        icon:'🫐', color:'#1877F2' },
  { key:'instagram', label:'Instagram Business',   icon:'📸', color:'#E1306C' },
  { key:'google',    label:'Google Business',      icon:'🔵', color:'#4285F4' },
];

async function showSocialView() {
  setTopbar('Social Media');
  renderContent('<div class="loading-state">Loading...</div>');
  const mid = getMid();

  try {
    const [accounts, flyers] = await Promise.all([
      API.getSocialAccounts(mid).catch(() => []),
      API.getFlyers(mid).catch(() => [null,null,null]),
    ]);

    const connected = {};
    accounts.forEach(a => connected[a.platform] = a);
    const hasAnyConnected = Object.keys(connected).length > 0;
    const flyerSlots = (Array.isArray(flyers) ? flyers : [null,null,null]);
    const hasFlyers = flyerSlots.some(f => !!f);

    renderContent(`
      <div class="page-header">
        <div>
          <div class="page-title">Social Media Publishing</div>
          <div class="page-sub">Connect your accounts once — post flyers automatically with one click</div>
        </div>
      </div>

      <!-- PLATFORM CONNECTION STATUS -->
      <div class="grid-3" style="margin-bottom:20px">
        ${PLATFORMS.map(p => platformStatusCard(p, connected[p.key], mid)).join('')}
      </div>

      <!-- PUBLISH PANEL — shown when at least one account is connected -->
      ${hasAnyConnected ? `
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">📤 Post a Flyer</div>

        <div class="grid-2" style="margin-bottom:16px;align-items:start">
          <!-- Left: Flyer picker + preview -->
          <div>
            <label class="form-label">Select Flyer</label>
            ${!hasFlyers ? `
              <div style="border:2px dashed var(--dash-border);border-radius:var(--r);padding:24px;text-align:center">
                <div style="font-size:28px;margin-bottom:8px">🖼️</div>
                <div style="font-size:12px;color:var(--dash-text3);margin-bottom:10px">No flyers uploaded yet</div>
                <button class="btn btn-outline btn-sm" onclick="showView('m-flyers')">Upload Flyers →</button>
              </div>` : `
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
                ${flyerSlots.map((f,i) => f ? `
                  <div onclick="selectFlyer(${i})" id="flyer-thumb-${i}"
                    style="border:2px solid var(--dash-border);border-radius:var(--r);
                           overflow:hidden;cursor:pointer;transition:all .18s;aspect-ratio:1/1">
                    <img src="${f}" style="width:100%;height:100%;object-fit:cover"/>
                  </div>` : `
                  <div style="border:1px dashed var(--dash-border);border-radius:var(--r);
                       aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;
                       font-size:11px;color:var(--dash-text4)">Empty</div>`).join('')}
              </div>
              <div id="selected-flyer-preview" style="display:none;margin-bottom:8px">
                <img id="preview-img" src="" style="max-height:200px;border-radius:6px;
                  border:2px solid var(--gold);width:100%;object-fit:contain"/>
              </div>
              <input type="hidden" id="selected-flyer-idx" value=""/>
            `}
          </div>

          <!-- Right: Caption + Platform selection -->
          <div>
            <div class="form-group">
              <label class="form-label">Caption</label>
              <textarea id="post-caption" class="form-input form-textarea" rows="4"
                placeholder="Write your post caption here...&#10;&#10;Tip: include your offer, hours, and a call to action 🎉"></textarea>
            </div>

            <label class="form-label" style="margin-bottom:10px;display:block">Post to</label>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
              ${PLATFORMS.map(p => {
                const acct = connected[p.key];
                return `<label style="display:flex;align-items:center;gap:12px;padding:10px 14px;
                  background:rgba(255,255,255,${acct?'0.04':'0.01'});
                  border:1px solid var(--dash-border${acct?'':'2'});border-radius:var(--r);
                  cursor:${acct?'pointer':'not-allowed'};opacity:${acct?'1':'0.45'}"
                  ${acct?'':'title="Connect this account first"'}>
                  <input type="checkbox" name="pub-platform" value="${p.key}"
                    ${acct?'':'disabled'}
                    style="width:16px;height:16px;accent-color:var(--gold);cursor:${acct?'pointer':'not-allowed'}"/>
                  <span style="font-size:20px">${p.icon}</span>
                  <div style="flex:1">
                    <div style="font-size:12px;font-weight:600;color:var(--dash-text)">${p.label}</div>
                    <div style="font-size:10px;color:${acct?'var(--dash-text3)':'var(--danger)'}">
                      ${acct ? `✅ Connected as ${acct.accountName||acct.pageName||''}` : '❌ Not connected — click Connect above'}
                    </div>
                  </div>
                </label>`;
              }).join('')}
            </div>

            <button class="btn btn-primary btn-full" onclick="publishNow('${mid}')"
              style="padding:12px;font-size:14px;letter-spacing:.5px">
              📤 Post Now
            </button>
          </div>
        </div>

        <!-- Results area -->
        <div id="publish-results"></div>
      </div>` : `
      <!-- No accounts connected yet -->
      <div class="card" style="text-align:center;padding:32px">
        <div style="font-size:40px;margin-bottom:12px">📲</div>
        <div style="font-size:15px;font-weight:700;color:var(--dash-text);margin-bottom:6px">
          Connect your accounts to start posting
        </div>
        <div style="font-size:12px;color:var(--dash-text3);max-width:400px;margin:0 auto">
          Click <strong>Connect</strong> on any platform above. This happens once —
          after that you can post flyers directly from here with a single click.
        </div>
      </div>`}
    `);

    window.addEventListener('message', _handleSocialMsg);
    window._socialFlyers = flyerSlots;

  } catch(e) {
    renderContent(`<div class="empty-state"><div class="empty-icon">⚠️</div>
      <div class="empty-title">Error</div><div class="empty-sub">${e.message}</div></div>`);
  }
}

/* ── Platform status card ── */
function platformStatusCard(p, acct, mid) {
  const isConn = !!acct;
  return `
    <div class="card" style="border-top:3px solid ${p.color};padding:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:26px">${p.icon}</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--dash-text)">${p.label}</div>
          <div style="margin-top:3px">
            ${isConn
              ? `<span class="badge b-approved" style="font-size:9px">✅ Connected</span>`
              : `<span class="badge b-pending" style="font-size:9px">Not connected</span>`}
          </div>
        </div>
      </div>

      ${isConn ? `
        <div style="padding:8px 10px;background:rgba(255,255,255,0.03);
          border:1px solid var(--dash-border2);border-radius:6px;margin-bottom:10px;font-size:11px">
          <div style="color:var(--dash-text3)">Connected as</div>
          <div style="font-weight:600;color:var(--dash-text);margin-top:2px">${acct.accountName||'—'}</div>
          ${acct.pageName ? `<div style="color:var(--dash-text3);font-size:10px">${acct.pageName}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" style="flex:1;font-size:11px"
            onclick="connectSocial('${p.key}','${mid}')">🔄 Reconnect</button>
          <button class="btn btn-danger" style="font-size:11px;padding:5px 10px"
            onclick="disconnectSocial('${p.key}','${mid}')">✕</button>
        </div>` : `
        <div style="font-size:11px;color:var(--dash-text3);margin-bottom:10px;line-height:1.6">
          ${p.key==='facebook' ? 'Post flyers to your Facebook Business Page automatically.'
          : p.key==='instagram' ? 'Post to your Instagram Business feed. Requires a Facebook Page linked to Instagram.'
          : 'Post updates to Google Maps & Search results.'}
        </div>
        <button class="btn btn-primary btn-full btn-sm"
          onclick="connectSocial('${p.key}','${mid}')">
          ${p.icon} Connect ${p.label.split(' ')[0]}
        </button>`}
    </div>`;
}

/* ── Select flyer ── */
function selectFlyer(idx) {
  const flyers = window._socialFlyers || [];
  const src = flyers[idx];
  if (!src) return;

  /* Update visual selection */
  document.querySelectorAll('[id^="flyer-thumb-"]').forEach(el => {
    el.style.borderColor = 'var(--dash-border)';
    el.style.borderWidth = '2px';
  });
  const thumb = document.getElementById('flyer-thumb-' + idx);
  if (thumb) {
    thumb.style.borderColor = 'var(--gold)';
    thumb.style.borderWidth = '3px';
  }

  /* Show preview */
  const preview = document.getElementById('selected-flyer-preview');
  const img     = document.getElementById('preview-img');
  const inp     = document.getElementById('selected-flyer-idx');
  if (preview) preview.style.display = 'block';
  if (img) img.src = src;
  if (inp) inp.value = idx;
}

/* ── Publish now ── */
async function publishNow(mid) {
  const flyerIdx = document.getElementById('selected-flyer-idx')?.value;
  const caption  = document.getElementById('post-caption')?.value.trim() || '';
  const platforms = [...document.querySelectorAll('[name="pub-platform"]:checked')].map(c => c.value);

  if (flyerIdx === '' || flyerIdx === undefined || flyerIdx === null)
    return showToast('Please select a flyer by clicking on one of the thumbnails above.', 'error');
  if (!platforms.length)
    return showToast('Please tick at least one platform to post to.', 'error');

  const flyers = window._socialFlyers || [];
  const flyerDataUrl = flyers[parseInt(flyerIdx)];
  if (!flyerDataUrl) return showToast('Selected flyer is empty. Please upload a flyer first.', 'error');

  const resultEl = document.getElementById('publish-results');
  if (resultEl) resultEl.innerHTML = `
    <div style="margin-top:16px;border-top:1px solid var(--dash-border2);padding-top:16px">
      <div class="loading-state" style="padding:12px">
        Posting to ${platforms.map(p=>p.charAt(0).toUpperCase()+p.slice(1)).join(', ')}...
      </div>
    </div>`;

  try {
    const res = await fetch('/api/social/publish/' + mid, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms, flyerDataUrl, caption }),
    });
    const data = await res.json();
    const results = data.results || {};

    if (resultEl) {
      resultEl.innerHTML = `
        <div style="margin-top:16px;border-top:1px solid var(--dash-border2);padding-top:16px">
          <div style="font-size:12px;font-weight:700;color:var(--dash-text);margin-bottom:10px">
            Publish Results
          </div>
          ${platforms.map(p => {
            const r = results[p] || {};
            const pDef = PLATFORMS.find(x => x.key === p);
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;
              border-radius:6px;margin-bottom:8px;
              background:${r.success?'rgba(74,222,128,0.08)':'rgba(248,113,113,0.08)'};
              border:1px solid ${r.success?'rgba(74,222,128,0.25)':'rgba(248,113,113,0.25)'}">
              <span style="font-size:22px">${pDef?.icon||'🌐'}</span>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:700;color:var(--dash-text)">${pDef?.label||p}</div>
                <div style="font-size:11px;color:${r.success?'#86EFAC':'#FCA5A5'}">
                  ${r.success
                    ? `✅ Posted successfully${r.url?` · <a href="${r.url}" target="_blank" style="color:var(--gold)">View post ↗</a>`:''}`
                    : `❌ ${r.error || 'Post failed'}`}
                </div>
                ${!r.success && r.error?.includes('token') ? `
                  <div style="font-size:10px;color:var(--dash-text3);margin-top:3px">
                    Tip: Reconnect this account — the session may have expired.
                  </div>` : ''}
              </div>
            </div>`;
          }).join('')}
          ${platforms.every(p => results[p]?.success) ? `
            <div style="text-align:center;padding:10px;font-size:12px;color:var(--dash-text3)">
              🎉 All posts published! Your customers can now see them.
            </div>` : ''}
        </div>`;
    }
  } catch(e) {
    if (resultEl) resultEl.innerHTML = `
      <div style="margin-top:16px;padding:12px;background:rgba(248,113,113,0.08);
        border:1px solid rgba(248,113,113,0.25);border-radius:6px;font-size:12px;color:#FCA5A5">
        ❌ Network error: ${e.message}
      </div>`;
  }
}

/* ── OAuth popup ── */
function connectSocial(platform, merchantId) {
  const w=640, h=660;
  const popup = window.open(
    `/api/social/connect/${platform}?merchantId=${merchantId}`,
    'R3ESocial',
    `width=${w},height=${h},left=${Math.max(0,(screen.width-w)/2)},top=${Math.max(0,(screen.height-h)/2)}`
  );
  if (!popup) showToast('⚠️ Popup blocked — please allow popups for this site and try again.', 'error');
}

function _handleSocialMsg(evt) {
  if (!evt.data?.type?.startsWith('social_')) return;
  const { type, platform, error, accountName } = evt.data;
  if (type === 'social_success') {
    showToast(`✅ ${platform} connected${accountName ? ' as ' + accountName : ''}! You can now post automatically.`, 'success');
    showSocialView();
  } else {
    showToast(`❌ Connection failed: ${error}`, 'error');
  }
}

async function disconnectSocial(platform, merchantId) {
  if (!confirm(`Disconnect ${platform}? You can reconnect anytime.`)) return;
  try {
    await API.disconnectSocial(merchantId, platform);
    showToast(`${platform} disconnected.`);
    showSocialView();
  } catch(e) { showToast(e.message, 'error'); }
}
