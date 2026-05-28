/* ═══════════════════════════════════════════════════════
   chatbot.js — R3E Public Pages AI Assistant v2.0
   Uses Groq via /api/chat
   - New conversation button
   - Better fallback replies
   - No more same reply for every question
═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let history  = [];
  let isOpen   = false;
  let isTyping = false;

  const QUICK = [
    'What does R3E do?',
    'How does the free trial work?',
    'What are the pricing plans?',
    'Which industries do you support?',
  ];

  const style = document.createElement('style');
  style.textContent = `
    #r3e-chat-btn{position:fixed;bottom:28px;right:28px;z-index:9000;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#C9A34E,#E0BC74);border:none;cursor:pointer;box-shadow:0 4px 24px rgba(201,163,78,0.4);display:flex;align-items:center;justify-content:center;font-size:22px;transition:all .28s ease;color:#0B0B0B}
    #r3e-chat-btn:hover{transform:scale(1.1) translateY(-2px);box-shadow:0 8px 32px rgba(201,163,78,0.55)}
    #r3e-chat-btn .badge{position:absolute;top:-3px;right:-3px;width:18px;height:18px;border-radius:50%;background:#E0BC74;color:#0B0B0B;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #0B0B0B;animation:chat-pulse 2.5s ease-in-out infinite}
    @keyframes chat-pulse{0%,100%{box-shadow:0 0 0 0 rgba(201,163,78,0.5)}50%{box-shadow:0 0 0 6px rgba(201,163,78,0)}}
    #r3e-chat-win{position:fixed;bottom:92px;right:28px;z-index:9000;width:360px;max-width:calc(100vw - 32px);background:#111111;border:1px solid rgba(201,163,78,0.28);border-radius:12px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.7);display:none;flex-direction:column;max-height:520px;font-family:'Inter',system-ui,sans-serif;animation:chat-in .28s cubic-bezier(.34,1.3,.64,1)}
    @keyframes chat-in{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}
    #r3e-chat-win.open{display:flex}
    .chat-header{background:#161616;border-bottom:1px solid rgba(255,255,255,0.06);padding:12px 14px;display:flex;align-items:center;gap:10px}
    .chat-header-icon{width:34px;height:34px;border-radius:8px;background:rgba(201,163,78,0.1);border:1px solid rgba(201,163,78,0.25);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
    .chat-header-info{flex:1}
    .chat-header-name{font-size:13px;font-weight:600;color:#F0EDE8}
    .chat-header-status{font-size:10px;color:#C9A34E;letter-spacing:.5px;text-transform:uppercase;margin-top:1px;display:flex;align-items:center;gap:4px}
    .chat-dot{width:5px;height:5px;border-radius:50%;background:#C9A34E;animation:chat-pulse 2s infinite}
    .chat-hdr-actions{display:flex;gap:4px}
    .chat-new-btn{background:rgba(201,163,78,0.1);border:1px solid rgba(201,163,78,0.25);border-radius:6px;color:#C9A34E;font-size:10px;font-weight:600;cursor:pointer;padding:4px 8px;letter-spacing:.3px;transition:all .18s;white-space:nowrap}
    .chat-new-btn:hover{background:rgba(201,163,78,0.2)}
    .chat-close{background:none;border:none;color:#7A7060;font-size:18px;cursor:pointer;padding:2px 6px;border-radius:4px;transition:all .18s;line-height:1}
    .chat-close:hover{color:#F0EDE8;background:rgba(255,255,255,0.06)}
    .chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:rgba(201,163,78,0.15) transparent}
    .chat-messages::-webkit-scrollbar{width:3px}
    .chat-messages::-webkit-scrollbar-thumb{background:rgba(201,163,78,0.2);border-radius:2px}
    .chat-msg{display:flex;flex-direction:column;max-width:88%}
    .chat-msg.user{align-self:flex-end;align-items:flex-end}
    .chat-msg.bot{align-self:flex-start;align-items:flex-start}
    .chat-bubble{padding:9px 13px;border-radius:10px;font-size:13px;line-height:1.65}
    .chat-msg.user .chat-bubble{background:linear-gradient(135deg,#C9A34E,#E0BC74);color:#0B0B0B;font-weight:500;border-radius:10px 10px 3px 10px}
    .chat-msg.bot .chat-bubble{background:#1C1C1C;color:#C8C0B0;border:1px solid rgba(255,255,255,0.06);border-radius:10px 10px 10px 3px}
    .chat-time{font-size:9px;color:#4A4438;margin-top:3px}
    .chat-typing .chat-bubble{background:#1C1C1C;border:1px solid rgba(255,255,255,0.06);display:flex;gap:4px;align-items:center;border-radius:10px 10px 10px 3px}
    .typing-dot{width:6px;height:6px;border-radius:50%;background:#C9A34E;animation:typing .9s ease-in-out infinite}
    .typing-dot:nth-child(2){animation-delay:.15s}.typing-dot:nth-child(3){animation-delay:.30s}
    @keyframes typing{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
    .chat-quick{padding:10px 14px 0;display:flex;flex-wrap:wrap;gap:6px}
    .quick-btn{background:rgba(201,163,78,0.06);border:1px solid rgba(201,163,78,0.2);border-radius:20px;padding:5px 12px;font-size:11px;font-weight:500;color:#C9A34E;cursor:pointer;transition:all .18s;white-space:nowrap}
    .quick-btn:hover{background:rgba(201,163,78,0.14);border-color:rgba(201,163,78,0.4)}
    .chat-input-row{padding:12px 14px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;background:#161616}
    #chat-input{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:9px 12px;font-size:13px;color:#F0EDE8;font-family:'Inter',sans-serif;outline:none;resize:none;min-height:38px;max-height:80px;transition:border .18s}
    #chat-input:focus{border-color:rgba(201,163,78,0.5)}
    #chat-input::placeholder{color:#4A4438}
    #chat-send{width:36px;height:36px;flex-shrink:0;border-radius:8px;background:linear-gradient(135deg,#C9A34E,#E0BC74);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;color:#0B0B0B;font-size:15px;align-self:flex-end}
    #chat-send:hover{box-shadow:0 4px 16px rgba(201,163,78,0.4);transform:scale(1.05)}
    #chat-send:disabled{opacity:.4;cursor:default;transform:none}
    .chat-powered{text-align:center;padding:6px;font-size:9px;color:#4A4438;letter-spacing:.5px;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.04);background:#161616}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'r3e-chat-btn';
  btn.innerHTML = '💬<div class="badge">1</div>';
  btn.title = 'Chat with R3E Assistant';

  const win = document.createElement('div');
  win.id = 'r3e-chat-win';
  win.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-icon">✨</div>
      <div class="chat-header-info">
        <div class="chat-header-name">R3E Assistant</div>
        <div class="chat-header-status"><div class="chat-dot"></div>Online · Powered by AI</div>
      </div>
      <div class="chat-hdr-actions">
        <button class="chat-new-btn" id="chat-new-btn">↺ New Chat</button>
        <button class="chat-close" id="chat-close-btn">✕</button>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    <div class="chat-quick" id="chat-quick"></div>
    <div class="chat-input-row">
      <textarea id="chat-input" placeholder="Ask me anything about R3E…" rows="1"></textarea>
      <button id="chat-send">➤</button>
    </div>
    <div class="chat-powered">Powered by Groq AI</div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(win);

  function addMsg(role, text) {
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    const now = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = `<div class="chat-bubble">${escHtml(text)}</div><div class="chat-time">${now}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return null;
    const div = document.createElement('div');
    div.className = 'chat-msg bot chat-typing';
    div.innerHTML = `<div class="chat-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\n/g,'<br/>');
  }

  function renderQuick(show=true) {
    const qEl = document.getElementById('chat-quick');
    if (!qEl) return;
    qEl.innerHTML = '';
    if (!show || history.length > 0) return;
    QUICK.forEach(q => {
      const b = document.createElement('button');
      b.className = 'quick-btn'; b.textContent = q;
      b.onclick = () => sendMessage(q);
      qEl.appendChild(b);
    });
  }

  function resetChat() {
    history = [];
    const msgs = document.getElementById('chat-messages');
    if (msgs) msgs.innerHTML = '';
    addMsg('bot', '👋 Hello! I\'m the R3E assistant. How can I help you today?\n\nI can answer questions about our platform, pricing, features, or help you get started.');
    renderQuick(true);
  }

  async function sendMessage(text) {
    if (isTyping || !text.trim()) return;
    const input  = document.getElementById('chat-input');
    const sendBtn= document.getElementById('chat-send');
    if (input) input.value = '';
    if (sendBtn) sendBtn.disabled = true;
    isTyping = true;
    renderQuick(false);
    addMsg('user', escHtml(text));
    history.push({ role:'user', content:text });
    const typingEl = showTyping();
    try {
      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message:text.trim(), history:history.slice(-8) }),
      });
      const data = await res.json();
      if (typingEl) typingEl.remove();
      const reply = data.reply || data.error || 'Sorry, something went wrong.';
      addMsg('bot', reply);
      history.push({ role:'assistant', content:reply });
    } catch (err) {
      if (typingEl) typingEl.remove();
      addMsg('bot', 'Connection error. Please try again in a moment.');
    }
    isTyping = false;
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
  }

  function openChat() {
    isOpen = true;
    win.classList.add('open');
    btn.innerHTML = '✕';
    btn.style.fontSize = '18px';
    const msgs = document.getElementById('chat-messages');
    if (msgs && msgs.children.length === 0) resetChat();
    setTimeout(()=>{ document.getElementById('chat-input')?.focus(); }, 100);
  }

  function closeChat() {
    isOpen = false;
    win.classList.remove('open');
    btn.innerHTML = '💬<div class="badge">1</div>';
    btn.style.fontSize = '22px';
  }

  btn.addEventListener('click', ()=> isOpen ? closeChat() : openChat());
  document.getElementById('chat-close-btn')?.addEventListener('click', closeChat);
  document.getElementById('chat-new-btn')?.addEventListener('click', resetChat);
  document.getElementById('chat-send')?.addEventListener('click', ()=>{
    const v = document.getElementById('chat-input')?.value?.trim();
    if (v) sendMessage(v);
  });
  document.getElementById('chat-input')?.addEventListener('keydown', e=>{
    if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); const v=e.target.value?.trim(); if(v) sendMessage(v); }
    const el=e.target; setTimeout(()=>{ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,80)+'px'; },0);
  });
})();
