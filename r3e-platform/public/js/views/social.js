/* ═══════════════════════════════════════════════════
   social.js — Social Media Integration v2.0
   
   MODE 1: Quick Share (zero setup, always free)
     - Downloads flyer as image
     - Opens platform's create-post page
     - Copies caption to clipboard
   
   MODE 2: Connected (OAuth, free APIs, one-time setup)
     - Facebook Graph API (free)
     - Instagram Graph API (free, via Facebook)
     - Google Business Profile API (free)
═══════════════════════════════════════════════════ */
'use strict';

async function showSocialView() {
  setTopbar('Social Media');
  renderContent('<div class="loading-state">Loading…</div>');
  const mid = R3E.user.merchantId;
  try {
    const [accounts, flyers] = await Promise.all([
      API.getSocialAccounts(mid).catch(()=>[]),
      API.getFlyers(mid).catch(()=>[])
    ]);
    const connected = {};
    accounts.forEach(a => connected[a.platform] = a);

    const flyerOptions = flyers
      .map((f,i) => f ? `<option value="${i}">Flyer Slot ${i+1}</option>` : '').join('');
    const hasFlyerOptions = flyers.some(f => !!f);

    renderContent(`
      <div class="page-header">
        <div>
          <div class="page-title">Social Media Publishing</div>
          <div class="page-sub">Publish your promotional flyers across all platforms — completely free</div>
        </div>
      </div>

      <!-- ══ TAB STRIP ══ -->
      <div class="tab-strip">
        <button class="tab-btn active" onclick="switchTab(this,'social-quick')">⚡ Quick Share</button>
        <button class="tab-btn" onclick="switchTab(this,'social-connected')">🔗 Connected Accounts</button>
        <button class="tab-btn" onclick="switchTab(this,'social-setup')">⚙️ Setup Guide</button>
      </div>

      <!-- ══ QUICK SHARE TAB ══ -->
      <div id="social-quick" class="tab-panel active">
        <div class="card" style="border:1px solid rgba(201,163,78,0.25);background:rgba(201,163,78,0.04);margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:0">
            <div style="font-size:28px">⚡</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--dash-text)">No setup required — works instantly</div>
              <div style="font-size:12px;color:var(--dash-text3);margin-top:2px">
                Download your flyer and post it to any social platform in seconds.
              </div>
            </div>
          </div>
        </div>

        ${!hasFlyerOptions ? `
          <div class="empty-state">
            <div class="empty-icon">🖼️</div>
            <div class="empty-title">No flyers uploaded yet</div>
            <div class="empty-sub">Go to Flyers section and upload your promotional images first, then come back to publish them.</div>
            <button class="btn btn-primary" style="margin-top:16px" onclick="showView('m-flyers')">Go to Flyers →</button>
          </div>` : `

          <!-- Flyer + Caption picker -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-title">1. Select your flyer and caption</div>
            <div class="grid-2">
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Flyer to publish</label>
                <select id="qs-flyer" class="form-select" onchange="previewQuickFlyer(this.value, '${mid}')">
                  <option value="">-- Choose a flyer --</option>
                  ${flyerOptions}
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Caption</label>
                <textarea id="qs-caption" class="form-input form-textarea" rows="2"
                  placeholder="🎉 Special offer this week! Visit us to claim your discount."></textarea>
              </div>
            </div>
            <div id="qs-preview" style="margin-top:12px;display:none">
              <img id="qs-img" src="" style="max-height:120px;border-radius:6px;border:1px solid var(--dash-border2)"/>
            </div>
          </div>

          <!-- Platform share buttons -->
          <div class="card">
            <div class="card-title">2. Share to platform</div>
            <div class="grid-3">
              ${quickShareCard('facebook')}
              ${quickShareCard('instagram')}
              ${quickShareCard('google')}
            </div>
          </div>
        `}
      </div>

      <!-- ══ CONNECTED ACCOUNTS TAB ══ -->
      <div id="social-connected" class="tab-panel">
        <div class="grid-3" style="margin-bottom:20px">
          ${platformCard('facebook',  connected, mid)}
          ${platformCard('instagram', connected, mid)}
          ${platformCard('google',    connected, mid)}
        </div>

        ${accounts.length > 0 ? `
          <div class="card">
            <div class="card-header">
              <div class="card-title">📤 Publish Flyer via API</div>
            </div>
            ${!hasFlyerOptions ? `<div class="empty-state" style="padding:20px"><div class="empty-sub">Upload flyers first in the Flyers section</div></div>` : `
            <div class="grid-2" style="margin-bottom:14px">
              <div class="form-group">
                <label class="form-label">Select Flyer</label>
                <select id="api-flyer" class="form-select">
                  <option value="">-- Choose flyer --</option>
                  ${flyerOptions}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Caption</label>
                <textarea id="api-caption" class="form-input form-textarea" rows="2"
                  placeholder="Your promotional message…"></textarea>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:14px">
              <label class="form-label">Publish to</label>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                ${accounts.map(a => `
                  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;
                    padding:8px 14px;background:rgba(255,255,255,0.04);
                    border:1px solid var(--dash-border2);border-radius:6px;transition:all .18s"
                    onmouseover="this.style.borderColor='var(--gold-border)'"
                    onmouseout="this.style.borderColor='var(--dash-border2)'">
                    <input type="checkbox" name="api-platform" value="${a.platform}"
                      style="accent-color:var(--gold);width:14px;height:14px"/>
                    <span style="font-size:18px">${pIcon(a.platform)}</span>
                    <div>
                      <div style="font-size:12px;font-weight:600;color:var(--dash-text)">${pLabel(a.platform)}</div>
                      <div style="font-size:10px;color:var(--dash-text3)">${a.pageName || a.accountName || ''}</div>
                    </div>
                  </label>`).join('')}
              </div>
            </div>
            <button class="btn btn-primary" onclick="publishViaAPI('${mid}')">📤 Publish to Selected</button>
            <div id="api-result" style="margin-top:14px"></div>
            `}
          </div>` : `
          <div class="empty-state">
            <div class="empty-icon">🔗</div>
            <div class="empty-title">No accounts connected</div>
            <div class="empty-sub">Connect your accounts above to enable one-click publishing via the free APIs.</div>
          </div>`}
      </div>

      <!-- ══ SETUP GUIDE TAB ══ -->
      <div id="social-setup" class="tab-panel">
        <div class="card" style="margin-bottom:14px">
          <div style="font-size:14px;font-weight:700;color:var(--dash-text);margin-bottom:12px">
            ✅ All APIs are 100% free — no charges, ever
          </div>
          <div style="font-size:12px;color:var(--dash-text3);line-height:1.8">
            Facebook, Instagram, and Google Business Profile APIs are all free to use.
            You only need to create a free developer account once, then connect.
          </div>
        </div>
        ${setupGuide('facebook')}
        ${setupGuide('instagram')}
        ${setupGuide('google')}
        <div class="card" style="border-color:rgba(201,163,78,0.25)">
          <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:10px;letter-spacing:.5px;text-transform:uppercase">
            Render Environment Variables Needed
          </div>
          <div style="display:grid;grid-template-columns:180px 1fr;gap:6px 12px;font-size:12px">
            ${[
              ['FB_APP_ID','Your Facebook App ID'],
              ['FB_APP_SECRET','Your Facebook App Secret'],
              ['GOOGLE_CLIENT_ID','Your Google OAuth Client ID'],
              ['GOOGLE_CLIENT_SECRET','Your Google OAuth Client Secret'],
              ['APP_BASE_URL','https://r3e-platform.onrender.com'],
            ].map(([k,v]) => `
              <div style="font-family:monospace;color:var(--gold);background:rgba(201,163,78,0.08);padding:4px 8px;border-radius:4px">${k}</div>
              <div style="color:var(--dash-text2);padding:4px 0">${v}</div>`).join('')}
          </div>
        </div>
      </div>
    `);

    window.addEventListener('message', handleSocialMsg);
  } catch(e) {
    renderContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error</div><div class="empty-sub">${e.message}</div></div>`);
  }
}

/* ── Quick share card ── */
function quickShareCard(platform) {
  const steps = {
    facebook:  ['Download flyer', 'Opens Facebook', 'Create a post', 'Attach downloaded image'],
    instagram: ['Download flyer', 'Transfer to phone', 'Open Instagram app', 'Create new post'],
    google:    ['Download flyer', 'Opens Google Business', 'Add update', 'Attach downloaded image'],
  };
  return `
    <div class="card" style="text-align:center;border-top:3px solid ${pColor(platform)}">
      <div style="font-size:32px;margin-bottom:8px">${pIcon(platform)}</div>
      <div style="font-size:13px;font-weight:700;color:var(--dash-text);margin-bottom:4px">${pLabel(platform)}</div>
      <ol style="text-align:left;font-size:11px;color:var(--dash-text3);margin:10px 0 14px;padding-left:16px;line-height:2">
        ${steps[platform].map(s => `<li>${s}</li>`).join('')}
      </ol>
      <button class="btn btn-primary btn-full btn-sm" onclick="quickShare('${platform}')">
        ↓ Download & Open ${pShortLabel(platform)}
      </button>
    </div>`;
}

/* ── Quick share action ── */
async function quickShare(platform) {
  const flyerIdx = document.getElementById('qs-flyer')?.value;
  if (!flyerIdx) return showToast('Please select a flyer first.', 'error');
  const caption = document.getElementById('qs-caption')?.value || '';
  const mid = R3E.user.merchantId;

  try {
    const flyers = await API.getFlyers(mid);
    const dataUrl = flyers[parseInt(flyerIdx)];
    if (!dataUrl) return showToast('That flyer slot is empty.', 'error');

    /* Download flyer */
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `r3e-flyer-${platform}-${Date.now()}.jpg`;
    a.click();

    /* Copy caption */
    if (caption) {
      try { await navigator.clipboard.writeText(caption); } catch {}
    }

    /* Short delay then open platform */
    setTimeout(() => {
      const urls = {
        facebook: 'https://www.facebook.com/pages/creation/?ref=page_creation_hub',
        instagram:'https://www.instagram.com/create/story/',
        google:   'https://business.google.com/posts/new',
      };
      window.open(urls[platform], '_blank');
      showToast(`✅ Flyer downloaded${caption ? ' + caption copied' : ''}! Now create your post on ${pShortLabel(platform)}.`, 'success');
    }, 500);
  } catch(e) { showToast(e.message, 'error'); }
}

/* ── Preview selected flyer ── */
async function previewQuickFlyer(idx, mid) {
  const preview = document.getElementById('qs-preview');
  const img     = document.getElementById('qs-img');
  if (!preview || !img || !idx) { if(preview) preview.style.display='none'; return; }
  try {
    const flyers = await API.getFlyers(mid);
    const src = flyers[parseInt(idx)];
    if (src) { img.src = src; preview.style.display = 'block'; }
    else preview.style.display = 'none';
  } catch {}
}

/* ── Platform card (connected mode) ── */
function platformCard(platform, connected, mid) {
  const acct  = connected[platform];
  const badge = acct
    ? `<span class="badge b-approved" style="font-size:9px">✅ Connected</span>`
    : `<span class="badge b-pending"  style="font-size:9px">Not Connected</span>`;

  const info = acct ? `
    <div style="margin:10px 0;padding:10px;background:rgba(201,163,78,0.06);border:1px solid rgba(201,163,78,0.15);border-radius:6px;font-size:12px">
      <div style="color:var(--dash-text3);margin-bottom:2px">Connected as</div>
      <div style="font-weight:600;color:var(--dash-text)">${acct.accountName || '—'}</div>
      ${acct.pageName ? `<div style="color:var(--dash-text3)">Page: ${acct.pageName}</div>` : ''}
      <div style="font-size:10px;color:var(--dash-text4);margin-top:3px">Since ${acct.connectedAt ? new Date(acct.connectedAt).toLocaleDateString('en-GB') : '—'}</div>
    </div>` : `<div style="margin:10px 0;font-size:11px;color:var(--dash-text3);line-height:1.65">${pDesc(platform)}</div>`;

  const btns = acct ? `
    <div style="display:flex;gap:6px">
      <button class="btn btn-success btn-sm" style="flex:1" onclick="connectSocial('${platform}','${mid}')">🔄 Reconnect</button>
      <button class="btn btn-danger btn-sm" onclick="disconnectSocial('${platform}','${mid}')">✕</button>
    </div>` : `<button class="btn btn-primary btn-full btn-sm" onclick="connectSocial('${platform}','${mid}')">
      ${pIcon(platform)} Connect ${pShortLabel(platform)}
    </button>`;

  return `
    <div class="card" style="border-top:3px solid ${pColor(platform)};padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:24px">${pIcon(platform)}</span>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--dash-text)">${pLabel(platform)}</div>
            <div style="font-size:10px;color:var(--dash-text3)">${pSubtitle(platform)}</div>
          </div>
        </div>
        ${badge}
      </div>
      ${info}${btns}
    </div>`;
}

/* ── Setup guide card ── */
function setupGuide(platform) {
  const steps = {
    facebook:[
      'Go to <strong>developers.facebook.com</strong> → Create App → Business',
      'Add <strong>Facebook Login</strong> product',
      'Under App Settings → Basic: copy <strong>App ID</strong> and <strong>App Secret</strong>',
      'Under Facebook Login → Settings: add redirect URI <code>https://r3e-platform.onrender.com/api/social/callback/facebook</code>',
      'Add <strong>FB_APP_ID</strong> and <strong>FB_APP_SECRET</strong> to Render env vars',
    ],
    instagram:[
      'Same Facebook App — also add <strong>Instagram Graph API</strong> product',
      'Link your Instagram Professional account to your Facebook Page (in Meta Business Suite)',
      'Add redirect URI <code>https://r3e-platform.onrender.com/api/social/callback/instagram</code>',
      'Use same <strong>FB_APP_ID</strong> and <strong>FB_APP_SECRET</strong>',
    ],
    google:[
      'Go to <strong>console.cloud.google.com</strong> → New Project (free)',
      'Enable <strong>My Business Account Management API</strong> + <strong>My Business Business Information API</strong>',
      'OAuth Consent Screen → External → add your Gmail as test user',
      'Credentials → Create OAuth 2.0 Client ID → Web App',
      'Add redirect URI <code>https://r3e-platform.onrender.com/api/social/callback/google</code>',
      'Add <strong>GOOGLE_CLIENT_ID</strong> and <strong>GOOGLE_CLIENT_SECRET</strong> to Render',
    ],
  };

  return `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:22px">${pIcon(platform)}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--dash-text)">${pLabel(platform)}</div>
          <div class="badge b-approved" style="margin-top:4px;font-size:9px">100% Free</div>
        </div>
      </div>
      <ol style="margin:0;padding-left:18px;font-size:12px;color:var(--dash-text2);line-height:2.1">
        ${steps[platform].map(s => `<li>${s}</li>`).join('')}
      </ol>
    </div>`;
}

/* ── OAuth popup ── */
function connectSocial(platform, merchantId) {
  const w = 640, h = 660;
  const popup = window.open(
    `/api/social/connect/${platform}?merchantId=${merchantId}`,
    'R3ESocial',
    `width=${w},height=${h},left=${Math.max(0,(screen.width-w)/2)},top=${Math.max(0,(screen.height-h)/2)}`
  );
  if (!popup) showToast('⚠️ Popup blocked. Please allow popups for this site then try again.', 'error');
}

function handleSocialMsg(evt) {
  if (!evt.data?.type?.startsWith('social_')) return;
  const { type, platform, error, accountName } = evt.data;
  if (type === 'social_success') {
    showToast(`✅ ${pLabel(platform)} connected${accountName ? ' as ' + accountName : ''}!`, 'success');
    showSocialView();
  } else {
    showToast(`❌ Connection failed: ${error}`, 'error');
  }
}

async function disconnectSocial(platform, merchantId) {
  if (!confirm(`Disconnect ${pLabel(platform)}? You can reconnect anytime.`)) return;
  try {
    await API.disconnectSocial(merchantId, platform);
    showToast(`${pLabel(platform)} disconnected.`);
    showSocialView();
  } catch(e) { showToast(e.message, 'error'); }
}

/* ── Publish via API ── */
async function publishViaAPI(merchantId) {
  const flyerIdx = document.getElementById('api-flyer')?.value;
  if (!flyerIdx) return showToast('Please select a flyer.', 'error');
  const platforms = [...document.querySelectorAll('[name="api-platform"]:checked')].map(c => c.value);
  if (!platforms.length) return showToast('Please select at least one platform.', 'error');
  const caption  = document.getElementById('api-caption')?.value || '';
  const resultEl = document.getElementById('api-result');
  if (resultEl) resultEl.innerHTML = '<div class="loading-state" style="padding:8px">Publishing…</div>';
  try {
    const flyers = await API.getFlyers(merchantId);
    const flyerDataUrl = flyers[parseInt(flyerIdx)];
    if (!flyerDataUrl) return showToast('Flyer slot is empty.', 'error');
    const { results } = await API.publishFlyer(merchantId, { platforms, flyerDataUrl, caption });
    if (resultEl) resultEl.innerHTML = Object.entries(results).map(([p, r]) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:6px;margin-bottom:6px;
        background:${r.success?'rgba(74,222,128,0.08)':'rgba(248,113,113,0.08)'};
        border:1px solid ${r.success?'rgba(74,222,128,0.2)':'rgba(248,113,113,0.2)'}">
        <span style="font-size:18px">${pIcon(p)}</span>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--dash-text)">${pLabel(p)}</div>
          <div style="font-size:11px;color:${r.success?'#86EFAC':'#FCA5A5'}">
            ${r.success ? `✅ Published${r.url?` · <a href="${r.url}" target="_blank" style="color:var(--gold)">View ↗</a>`:''}` : `❌ ${r.error}`}
          </div>
        </div>
      </div>`).join('');
  } catch(e) {
    if (resultEl) resultEl.innerHTML = `<div class="alert-error">${e.message}</div>`;
  }
}

/* ── Helpers ── */
function pIcon(p)      { return {facebook:'🫐',instagram:'📸',google:'🔵'}[p]||'🌐'; }
function pLabel(p)     { return {facebook:'Facebook Page',instagram:'Instagram Business',google:'Google Business'}[p]||p; }
function pShortLabel(p){ return {facebook:'Facebook',instagram:'Instagram',google:'Google'}[p]||p; }
function pColor(p)     { return {facebook:'#1877F2',instagram:'#E1306C',google:'#4285F4'}[p]||'#C9A34E'; }
function pSubtitle(p)  { return {facebook:'Photo posts & page updates',instagram:'Feed posts & promotions',google:'Maps & Search updates'}[p]||''; }
function pDesc(p) {
  return {
    facebook:'Post your flyers to your Facebook Business Page and reach your followers.',
    instagram:'Publish to your Instagram Business account. Requires a linked Facebook Page.',
    google:'Post updates and photos directly to your Google Business Profile (Maps & Search).',
  }[p]||'';
}
