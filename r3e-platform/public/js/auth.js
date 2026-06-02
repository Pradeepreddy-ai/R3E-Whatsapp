/* ═══════════════════════════════════════════════════════
   auth.js — Login · Register · Forgot Password (OTP flow)
   Passwords verified server-side only. No credentials here.
═══════════════════════════════════════════════════════ */
'use strict';

let _fpEmail  = '';
let _fpToken  = '';
let _otpTimer = null;
let _otpSecs  = 600;

/* ── tab switch ── */
function authTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('auth-login').classList.toggle('hidden', !isLogin);
  document.getElementById('auth-register').classList.toggle('hidden',  isLogin);
  document.querySelectorAll('.auth-tab').forEach((el, i) =>
    el.classList.toggle('active', (i===0 && isLogin)||(i===1 && !isLogin)));
}
function showAuthError(id, msg) { const e=document.getElementById(id); if(e){e.textContent=msg;e.style.display='block';} }
function hideAuthError(id)      { const e=document.getElementById(id); if(e) e.style.display='none'; }

/* ══════════════ LOGIN ══════════════ */
async function doLogin() {
  hideAuthError('login-error');
  const email = document.getElementById('li-email')?.value.trim();
  const pass  = document.getElementById('li-pass')?.value;
  if (!email||!pass) return showAuthError('login-error','Please enter your email and password.');
  const btn = document.getElementById('login-btn');
  if (btn) { btn.disabled=true; btn.textContent='Signing in…'; }
  try {
    const { user } = await API.login(email, pass);
    R3E.user = user;
    sessionStorage.setItem('r3e_user', JSON.stringify(user));
    bootApp();
  } catch(err) {
    showAuthError('login-error', err.message||'Invalid email or password.');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Sign In to Dashboard'; }
  }
}

/* ══════════════ REGISTER ══════════════ */
async function doRegister() {
  hideAuthError('reg-error');
  document.getElementById('reg-notice').style.display='none';
  const fields = ['r-biz','r-brand','r-cat','r-fname','r-lname','r-phone',
                  'r-addr','r-town','r-county','r-postcode','r-email','r-pass','r-pass2'];
  for (const id of fields) {
    if (!document.getElementById(id)?.value.trim())
      return showAuthError('reg-error','Please fill in all required fields.');
  }
  const pass = document.getElementById('r-pass').value;
  const conf = document.getElementById('r-pass2').value;
  if (pass!==conf)    return showAuthError('reg-error','Passwords do not match.');
  if (pass.length<8)  return showAuthError('reg-error','Password must be at least 8 characters.');
  if (!document.getElementById('r-tnc').checked)
    return showAuthError('reg-error','Please agree to the Terms & Conditions.');
  const btn = document.getElementById('reg-btn');
  if (btn) { btn.disabled=true; btn.textContent='Submitting…'; }
  try {
    await API.createMerchant({
      businessName: document.getElementById('r-biz').value.trim(),
      brandName:    document.getElementById('r-brand').value.trim(),
      category:     document.getElementById('r-cat').value,
      contactFName: document.getElementById('r-fname').value.trim(),
      contactLName: document.getElementById('r-lname').value.trim(),
      phone:        document.getElementById('r-phone').value.trim(),
      address:      document.getElementById('r-addr').value.trim(),
      town:         document.getElementById('r-town').value.trim(),
      county:       document.getElementById('r-county').value.trim(),
      postcode:     document.getElementById('r-postcode').value.trim(),
      email:        document.getElementById('r-email').value.trim().toLowerCase(),
      password:     pass,
      regCert:      (window._uploads||{})['reg-cert-lbl'] || '',
      councilCert:  (window._uploads||{})['council-cert-lbl'] || '',
      tcAgree:      true,
    });
    document.getElementById('reg-notice').style.display='block';
    ['r-pass','r-pass2'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  } catch(err) {
    showAuthError('reg-error', err.message||'Registration failed. Please try again.');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Submit Registration'; }
  }
}

/* ══════════════ LOGOUT ══════════════ */
function doLogout() {
  R3E.user = null;
  sessionStorage.removeItem('r3e_user');
  destroyCharts();
  _stopOTPTimer();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('main-auth').classList.remove('hidden');
  document.getElementById('forgot-screen').classList.add('hidden');
  ['li-email','li-pass'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderContent('<div class="loading-state">Signed out.</div>');
}

/* ═════════════════════════════════════════
   FORGOT PASSWORD — show / hide
═════════════════════════════════════════ */
function showForgotPassword() {
  document.getElementById('main-auth').classList.add('hidden');
  document.getElementById('forgot-screen').classList.remove('hidden');
  fpGoToStep(1);
  _fpEmail=''; _fpToken='';
  _stopOTPTimer();
  ['fp-email-error','fp-otp-error','fp-pwd-error'].forEach(hideAuthError);
  const em = document.getElementById('fp-email');
  if (em) em.value='';
}
function hideForgotPassword() {
  _stopOTPTimer();
  document.getElementById('forgot-screen').classList.add('hidden');
  document.getElementById('main-auth').classList.remove('hidden');
  authTab('login');
}

/* ── step navigator ── */
function fpGoToStep(n) {
  document.querySelectorAll('.fp-step').forEach((el,i)=>
    el.classList.toggle('active', i+1===n));
  for (let i=1;i<=3;i++) {
    const dot  = document.getElementById(`fdot-${i}`);
    const lbl  = document.getElementById(`flbl-${i}`);
    const line = document.getElementById(`fline-${i}`);
    if (!dot) continue;
    dot.className  = 'fp-step-dot '+(i<n?'done':i===n?'current':'pending');
    if (lbl)  lbl.className  = 'fp-step-label'+(i===n?' current':'');
    if (line) line.className = 'fp-step-line'+(i<n?' done':'');
  }
}

/* ═════════════════════════════════════════
   STEP 1 — send OTP
═════════════════════════════════════════ */
async function fpSendOTP() {
  hideAuthError('fp-email-error');
  const email = document.getElementById('fp-email')?.value.trim().toLowerCase();
  if (!email||!email.includes('@'))
    return showAuthError('fp-email-error','Please enter a valid email address.');
  const btn = document.getElementById('fp-send-btn');
  if (btn) { btn.disabled=true; btn.textContent='Sending…'; }
  try {
    await API.forgotPassword(email);
    _fpEmail = email;
    const disp = document.getElementById('fp-email-display');
    if (disp) disp.textContent = email;
    fpGoToStep(2);
    _startOTPTimer();
    _initOTPInputs();
  } catch(err) {
    showAuthError('fp-email-error', err.message||'Could not send code. Please check the email address.');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Send Verification Code'; }
  }
}

/* ═════════════════════════════════════════
   STEP 2 — OTP countdown timer
═════════════════════════════════════════ */
function _startOTPTimer() {
  _stopOTPTimer();
  _otpSecs = 600;
  _renderTimer();
  _otpTimer = setInterval(()=>{
    _otpSecs--;
    _renderTimer();
    if (_otpSecs<=0) {
      _stopOTPTimer();
      const el = document.getElementById('otp-timer');
      if (el) {
        el.classList.add('expired');
        el.innerHTML='Code expired. <a href="#" onclick="fpResendOTP();return false" style="color:#EC4899;font-weight:600">Send a new code →</a>';
      }
      const vbtn = document.getElementById('fp-verify-btn');
      if (vbtn) vbtn.disabled=true;
    }
  },1000);
}
function _stopOTPTimer() { if(_otpTimer){clearInterval(_otpTimer);_otpTimer=null;} }
function _renderTimer() {
  const cd = document.getElementById('otp-countdown');
  if (!cd) return;
  const m=Math.floor(_otpSecs/60), s=_otpSecs%60;
  cd.textContent=`${m}:${String(s).padStart(2,'0')}`;
  cd.style.color = _otpSecs<=60 ? '#fca5a5' : '#EC4899';
}

/* ── OTP digit input wiring ── */
function _initOTPInputs() {
  const inputs = document.querySelectorAll('.otp-digit');
  inputs.forEach((inp,i)=>{
    inp.value=''; inp.classList.remove('filled');
    inp.oninput = function() {
      this.value = this.value.replace(/\D/g,'').slice(-1);
      this.classList.toggle('filled', !!this.value);
      if (this.value && i<inputs.length-1) inputs[i+1].focus();
    };
    inp.onkeydown = function(e) {
      if (e.key==='Backspace'&&!this.value&&i>0) inputs[i-1].focus();
      if (e.key==='ArrowLeft' &&i>0)             inputs[i-1].focus();
      if (e.key==='ArrowRight'&&i<inputs.length-1) inputs[i+1].focus();
    };
    inp.onpaste = function(e) {
      e.preventDefault();
      const text=(e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
      text.split('').forEach((ch,j)=>{ if(inputs[j]){inputs[j].value=ch;inputs[j].classList.add('filled');} });
      const focus=Math.min(text.length, inputs.length-1);
      if (inputs[focus]) inputs[focus].focus();
    };
  });
  if (inputs[0]) inputs[0].focus();
}
function _getOTP() {
  return Array.from(document.querySelectorAll('.otp-digit')).map(i=>i.value).join('');
}

/* ── verify OTP ── */
async function fpVerifyOTP() {
  hideAuthError('fp-otp-error');
  const otp = _getOTP();
  if (otp.length<6) return showAuthError('fp-otp-error','Please enter all 6 digits.');
  if (_otpSecs<=0)  return showAuthError('fp-otp-error','This code has expired. Please request a new one.');
  const btn = document.getElementById('fp-verify-btn');
  if (btn) { btn.disabled=true; btn.textContent='Verifying…'; }
  try {
    const res = await API.verifyOTP(_fpEmail, otp);
    _fpToken = res.token;
    _stopOTPTimer();
    fpGoToStep(3);
    const pwd = document.getElementById('fp-newpwd');
    if (pwd) pwd.addEventListener('input', ()=>_updatePwdStrength(pwd.value));
  } catch(err) {
    showAuthError('fp-otp-error', err.message||'Incorrect or expired code.');
    /* shake animation on digits */
    const wrap = document.getElementById('otp-inputs');
    if (wrap) { wrap.style.animation='shake .4s ease'; setTimeout(()=>wrap.style.animation='',500); }
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Verify Code'; }
  }
}

/* ── resend OTP ── */
async function fpResendOTP() {
  hideAuthError('fp-otp-error');
  try {
    await API.forgotPassword(_fpEmail);
    _initOTPInputs();
    const timerEl = document.getElementById('otp-timer');
    if (timerEl) {
      timerEl.classList.remove('expired');
      timerEl.innerHTML='Code expires in <span id="otp-countdown">10:00</span>';
    }
    const vbtn = document.getElementById('fp-verify-btn');
    if (vbtn) vbtn.disabled=false;
    _startOTPTimer();
    showToast('✅ New code sent!','success');
  } catch(err) {
    showAuthError('fp-otp-error', err.message||'Could not resend code. Try again shortly.');
  }
}

/* ═════════════════════════════════════════
   STEP 3 — password strength + update
═════════════════════════════════════════ */
function _updatePwdStrength(pw) {
  let score = 0;
  if (pw.length>=8)             score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;
  const colours=['#DC2626','#D97706','#7C3AED','#059669'];
  const labels =['Weak','Fair','Good','Strong'];
  for (let i=1;i<=4;i++) {
    const bar=document.getElementById(`pbar-${i}`);
    if (bar) bar.style.background = i<=score ? colours[score-1] : 'rgba(255,255,255,0.1)';
  }
  const lbl=document.getElementById('pwd-strength-label');
  if (lbl) {
    lbl.textContent=pw.length?(labels[score-1]||''):'';
    lbl.style.color=score>0?colours[score-1]:'rgba(196,181,253,0.5)';
  }
}

async function fpUpdatePassword() {
  hideAuthError('fp-pwd-error');
  const pw1=document.getElementById('fp-newpwd')?.value;
  const pw2=document.getElementById('fp-confirmpwd')?.value;
  if (!pw1||!pw2)   return showAuthError('fp-pwd-error','Please enter and confirm your new password.');
  if (pw1.length<8) return showAuthError('fp-pwd-error','Password must be at least 8 characters.');
  if (pw1!==pw2)    return showAuthError('fp-pwd-error','Passwords do not match.');
  if (!_fpToken)    return showAuthError('fp-pwd-error','Session expired. Please start the process again.');
  const btn=document.getElementById('fp-update-btn');
  if (btn) { btn.disabled=true; btn.textContent='Updating…'; }
  try {
    await API.resetPassword(_fpEmail, _fpToken, pw1);
    _fpToken=''; _fpEmail='';
    fpGoToStep(4);
  } catch(err) {
    showAuthError('fp-pwd-error', err.message||'Could not update password. Please try again.');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Update Password'; }
  }
}
