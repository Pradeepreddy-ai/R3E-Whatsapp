/* ═══════════════════════════════════════════════════
   dashboard-chatbot.js — R3E AI Assistant v2.0
   - Better timeout/cold-start handling
   - New conversation button
   - Improved error messages
═══════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CHATBOT_URL = '/api/chatbot';
  const TIMEOUT_MS  = 55000; // 55s — Render free tier can take 50s to wake
  let history = [], isOpen = false, isTyping = false;

  const QUICK = {
    merchant:   ['How many customers do I have?','What is my engagement rate?','Show my recent campaigns','How can I improve performance?'],
    superadmin: ['Show platform overview','How many merchants are pending?','Total messages sent?','Active engines count'],
    admin:      ['Merchants pending review','Platform customer count','Campaigns run this month'],
    support:    ['Platform overview','Total customers','Recent activity'],
  };

  const style = document.createElement('style');
  style.textContent = `
    #db-chat-btn{position:fixed;bottom:24px;right:24px;z-index:8000;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#C9A34E,#E0BC74);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(201,163,78,0.45);display:flex;align-items:center;justify-content:center;font-size:20px;transition:all .28s ease;color:#0B0B0B}
    #db-chat-btn:hover{transform:scale(1.1) translateY(-2px);box-shadow:0 8px 28px rgba(201,163,78,0.6)}
    .db-badge{position:absolute;top:-3px;right:-3px;width:16px;height:16px;border-radius:50%;background:#E0BC74;color:#0B0B0B;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #0B0B0B;animation:db-pulse 2.5s ease-in-out infinite}
    @keyframes db-pulse{0%,100%{box-shadow:0 0 0 0 rgba(201,163,78,0.5)}50%{box-shadow:0 0 0 5px rgba(201,163,78,0)}}
    #db-chat-win{position:fixed;bottom:86px;right:24px;z-index:8000;width:360px;max-width:calc(100vw - 32px);background:#111111;border:1px solid rgba(201,163,78,0.3);border-radius:12px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.8);display:none;flex-direction:column;max-height:520px;font-family:'Inter',system-ui,sans-serif;animation:db-in .28s cubic-bezier(.34,1.3,.64,1)}
    @keyframes db-in{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
    #db-chat-win.open{display:flex}
    .db-hdr{background:#161616;border-bottom:1px solid rgba(255,255,255,0.06);padding:10px 12px;display:flex;align-items:center;gap:8px;flex-shrink:0}
    .db-hdr-icon{width:30px;height:30px;border-radius:8px;background:rgba(201,163,78,0.1);border:1px solid rgba(201,163,78,0.25);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
    .db-hdr-info{flex:1}
    .db-hdr-name{font-size:12px;font-weight:700;color:#F0EDE8}
    .db-hdr-status{font-size:9px;color:#C9A34E;letter-spacing:1px;text-transform:uppercase;margin-top:1px;display:flex;align-items:center;gap:4px}
    .db-live{width:5px;height:5px;border-radius:50%;background:#C9A34E;animation:db-pulse 2s infinite}
    .db-hdr-actions{display:flex;gap:4px}
    .db-new-btn{background:rgba(201,163,78,0.1);border:1px solid rgba(201,163,78,0.25);border-radius:6px;color:#C9A34E;font-size:10px;font-weight:600;cursor:pointer;padding:4px 8px;letter-spacing:.3px;transition:all .18s;white-space:nowrap}
    .db-new-btn:hover{background:rgba(201,163,78,0.2);border-color:var(--gold)}
    .db-x{background:none;border:none;color:#7A7060;font-size:16px;cursor:pointer;padding:3px 6px;border-radius:4px;transition:all .18s;line-height:1}
    .db-x:hover{color:#F0EDE8;background:rgba(255,255,255,0.06)}
    .db-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin;scrollbar-color:rgba(201,163,78,0.15) transparent}
    .db-msgs::-webkit-scrollbar{width:3px}
    .db-msgs::-webkit-scrollbar-thumb{background:rgba(201,163,78,0.2);border-radius:2px}
    .db-msg{display:flex;flex-direction:column;max-width:90%}
    .db-msg.user{align-self:flex-end;align-items:flex-end}
    .db-msg.bot{align-self:flex-start;align-items:flex-start}
    .db-bubble{padding:8px 12px;border-radius:10px;font-size:12px;line-height:1.65}
    .db-msg.user .db-bubble{background:linear-gradient(135deg,#C9A34E,#E0BC74);color:#0B0B0B;font-weight:500;border-radius:10px 10px 3px 10px}
    .db-msg.bot .db-bubble{background:#1C1C1C;color:#C8C0B0;border:1px solid rgba(255,255,255,0.06);border-radius:10px 10px 10px 3px}
    .db-msg.bot.error .db-bubble{background:rgba(248,113,113,0.08);border-color:rgba(248,113,113,0.2);color:#FCA5A5}
    .db-time{font-size:9px;color:#4A4438;margin-top:3px}
    .db-typing .db-bubble{background:#1C1C1C;border:1px solid rgba(255,255,255,0.06);display:flex;gap:4px;align-items:center;border-radius:10px 10px 10px 3px;padding:10px 14px}
    .db-dot{width:5px;height:5px;border-radius:50%;background:#C9A34E;animation:db-typ .9s ease-in-out infinite}
    .db-dot:nth-child(2){animation-delay:.15s}.db-dot:nth-child(3){animation-delay:.30s}
    @keyframes db-typ{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
    .db-warming{background:#1C1C1C;border:1px solid rgba(201,163,78,0.2);border-radius:10px 10px 10px 3px;padding:8px 12px;font-size:11px;color:#C9A34E;display:flex;align-items:center;gap:8px}
    .db-warm-spin{width:12px;height:12px;border:2px solid rgba(201,163,78,0.3);border-top-color:#C9A34E;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
    @keyframes spin{to{transform:rotate(360deg)}}
    .db-quick{padding:8px 12px 0;display:flex;flex-wrap:wrap;gap:5px}
    .db-qbtn{background:rgba(201,163,78,0.06);border:1px solid rgba(201,163,78,0.2);border-radius:20px;padding:4px 10px;font-size:10px;font-weight:500;color:#C9A34E;cursor:pointer;transition:all .18s;white-space:nowrap;font-family:'Inter',sans-serif}
    .db-qbtn:hover{background:rgba(201,163,78,0.14);border-color:rgba(201,163,78,0.4)}
    .db-input-row{padding:10px 12px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:7px;background:#161616;flex-shrink:0}
    #db-input{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 11px;font-size:12px;color:#F0EDE8;font-family:'Inter',sans-serif;outline:none;resize:none;min-height:36px;max-height:72px;transition:border .18s;line-height:1.5}
    #db-input:focus{border-color:rgba(201,163,78,0.5)}
    #db-input::placeholder{color:#4A4438}
    #db-send{width:34px;height:34px;flex-shrink:0;border-radius:7px;background:linear-gradient(135deg,#C9A34E,#E0BC74);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;color:#0B0B0B;font-size:14px;align-self:flex-end}
    #db-send:hover{box-shadow:0 4px 14px rgba(201,163,78,0.4);transform:scale(1.05)}
    #db-send:disabled{opacity:.35;cursor:default;transform:none}
    .db-footer{text-align:center;padding:5px;font-size:8px;color:#3A3426;letter-spacing:.5px;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.03);background:#161616}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'db-chat-btn';
  btn.title = 'AI Assistant';
  btn.innerHTML = '✨<div class="db-badge">AI</div>';

  const win = document.createElement('div');
  win.id = 'db-chat-win';
  win.innerHTML = `
    <div class="db-hdr">
      <div class="db-hdr-icon">✨</div>
      <div class="db-hdr-info">
        <div class="db-hdr-name">R3E AI Assistant</div>
        <div class="db-hdr-status"><div class="db-live"></div>Connected to your live data</div>
      </div>
      <div class="db-hdr-actions">
        <button class="db-new-btn" id="db-new">↺ New Chat</button>
        <button class="db-x" id="db-x">✕</button>
      </div>
    </div>
    <div class="db-msgs" id="db-msgs"></div>
    <div class="db-quick" id="db-quick"></div>
    <div class="db-input-row">
      <textarea id="db-input" placeholder="Ask about customers, campaigns…" rows="1"></textarea>
      <button id="db-send">➤</button>
    </div>
    <div class="db-footer">Powered by AI · Reads your live data</div>`;

  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\n/g,'<br/>');
  }
  function ts() { return new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }

  function addMsg(role, text, isError=false) {
    const el = document.getElementById('db-msgs');
    if (!el) return;
    const d = document.createElement('div');
    d.className = `db-msg ${role}${isError?' error':''}`;
    d.innerHTML = `<div class="db-bubble">${esc(text)}</div><div class="db-time">${ts()}</div>`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }

  function showTyping(warming=false) {
    const el = document.getElementById('db-msgs');
    if (!el) return null;
    const d = document.createElement('div');
    d.className = 'db-msg bot db-typing';
    if (warming) {
      d.innerHTML = `<div class="db-warming"><div class="db-warm-spin"></div>Waking up AI service, please wait 20–30 seconds…</div>`;
    } else {
      d.innerHTML = `<div class="db-bubble"><div class="db-dot"></div><div class="db-dot"></div><div class="db-dot"></div></div>`;
    }
    el.appendChild(d); el.scrollTop = el.scrollHeight;
    return d;
  }

  function renderQuick() {
    const q = document.getElementById('db-quick');
    if (!q) return;
    q.innerHTML = '';
    if (history.length > 0) return;
    const role = window.R3E?.user?.userType || 'merchant';
    (QUICK[role] || QUICK.merchant).slice(0,4).forEach(txt => {
      const b = document.createElement('button');
      b.className = 'db-qbtn'; b.textContent = txt;
      b.onclick = () => send(txt);
      q.appendChild(b);
    });
  }

  function resetChat() {
    history = [];
    const msgs = document.getElementById('db-msgs');
    if (msgs) msgs.innerHTML = '';
    const q = document.getElementById('db-quick');
    if (q) q.innerHTML = '';
    const u = window.R3E?.user;
    const name = u?.firstName || 'there';
    const isAdmin = ['superadmin','admin','support'].includes(u?.userType);
    addMsg('bot', isAdmin
      ? `👋 Hi ${name}! I have access to live platform data. Ask me about merchants, pending approvals, customer counts, or platform health.`
      : `👋 Hi ${name}! I can see your live store data. Ask me about your customers, campaigns, discounts, or how to improve performance.`
    );
    renderQuick();
  }

  async function send(text) {
    if (isTyping || !text?.trim()) return;
    const inp  = document.getElementById('db-input');
    const sbtn = document.getElementById('db-send');
    if (inp) inp.value = '';
    if (sbtn) sbtn.disabled = true;
    isTyping = true;
    document.getElementById('db-quick').innerHTML = '';
    addMsg('user', text);
    history.push({ role:'user', content:text });

    // Show warming message if this is the first message (cold start possible)
    const isFirstMsg = history.length <= 1;
    const typEl = showTyping(isFirstMsg);

    // Update to normal typing dots after 5s
    let warmTimer = null;
    if (isFirstMsg) {
      warmTimer = setTimeout(() => {
        if (typEl && typEl.parentNode) {
          typEl.querySelector('.db-warming').innerHTML =
            '<div class="db-warm-spin"></div>Still loading, almost ready…';
        }
      }, 10000);
    }

    try {
      const u = window.R3E?.user || {};
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(CHATBOT_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        signal: controller.signal,
        body: JSON.stringify({
          message:       text.trim(),
          history:       history.slice(-8),
          user_type:     u.userType    || 'merchant',
          user_email:    u.email       || '',
          merchant_id:   u.merchantId  || null,
          merchant_name: u.brandName   || null,
          locations:     u.locations   || [],
        }),
      });
      clearTimeout(timeoutId);
      if (warmTimer) clearTimeout(warmTimer);
      const data = await res.json();
      if (typEl) typEl.remove();
      const reply = data.reply || data.error || 'Sorry, something went wrong.';
      addMsg('bot', reply);
      history.push({ role:'assistant', content:reply });
    } catch (e) {
      if (warmTimer) clearTimeout(warmTimer);
      if (typEl) typEl.remove();
      if (e.name === 'AbortError') {
        addMsg('bot', '⏱️ Request timed out. The AI service may be waking up — please try again in a moment.', true);
      } else {
        addMsg('bot', '⚠️ Connection error. Please check your connection and try again.', true);
      }
    }

    isTyping = false;
    if (sbtn) sbtn.disabled = false;
    if (inp) { inp.focus(); inp.style.height='auto'; }
  }

  function openChatWin() {
    isOpen = true;
    win.classList.add('open');
    btn.innerHTML = '✕';
    btn.style.fontSize = '16px';
    if (!document.getElementById('db-msgs').children.length) {
      resetChat();
    }
    setTimeout(() => document.getElementById('db-input')?.focus(), 100);
  }

  function closeChatWin() {
    isOpen = false;
    win.classList.remove('open');
    btn.innerHTML = '✨<div class="db-badge">AI</div>';
    btn.style.fontSize = '20px';
  }

  function inject() {
    const app = document.getElementById('app');
    if (!app || app.classList.contains('hidden')) return;
    if (document.getElementById('db-chat-btn')) return;
    app.appendChild(btn); app.appendChild(win);
    btn.addEventListener('click', () => isOpen ? closeChatWin() : openChatWin());
    document.getElementById('db-x')?.addEventListener('click', closeChatWin);
    document.getElementById('db-new')?.addEventListener('click', resetChat);
    document.getElementById('db-send')?.addEventListener('click', () => {
      const v = document.getElementById('db-input')?.value?.trim();
      if (v) send(v);
    });
    document.getElementById('db-input')?.addEventListener('keydown', e => {
      if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); const v=e.target.value?.trim(); if(v) send(v); }
      const el=e.target; setTimeout(()=>{ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,72)+'px'; },0);
    });
  }

  new MutationObserver(inject).observe(document.body, {attributes:true,childList:true,subtree:true});
  setInterval(inject, 1500);
})();
