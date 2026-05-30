/* ═══════════════════════════════════════════
   nav.js — shared navbar + footer  v6.0
   Black & Gold Luxury theme
═══════════════════════════════════════════ */
(function(){
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const page = path.split('/').pop().replace('.html','') || 'index';

  const NAV_LINKS = [
    { href:'/features.html',     label:'Features'     },
    { href:'/how-it-works.html', label:'How It Works' },
    { href:'/industries.html',   label:'Industries'   },
    { href:'/pricing.html',      label:'Pricing'      },
    { href:'/faq.html',          label:'FAQ'          },
  ];

  function isActive(href) {
    const p = href.replace('/','').replace('.html','');
    return p === page || (page === 'index' && href === '/');
  }

  /* Inject Playfair Display + Inter fonts */
  if (!document.querySelector('link[data-r3e-fonts]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.dataset.r3eFonts = '1';
    l.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap';
    document.head.appendChild(l);
  }

  if (!document.querySelector('link[href*="global.css"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = '/css/global.css';
    document.head.insertBefore(l, document.head.firstChild);
  }

  const navHTML = `
  <nav id="g-nav">
    <a class="nav-logo" href="/index.html" aria-label="R3E Home">
      <div class="nav-logo-mark">R3E</div>
      <div>
        <div class="nav-logo-text">R3E</div>
        <div class="nav-logo-sub">Retention Engine</div>
      </div>
    </a>
    <div class="nav-links">
      ${NAV_LINKS.map(l=>`<a class="nav-link${isActive(l.href)?' active':''}" href="${l.href}">${l.label}</a>`).join('')}
    </div>
    <div class="nav-actions">
      <a href="/app.html" class="btn btn-outline btn-sm">Sign In</a>
      <a href="/app.html" class="btn btn-primary btn-sm btn-arrow">Get Started</a>
    </div>
    <button class="nav-hamburger" id="nav-ham" aria-label="Menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </nav>
  <div class="nav-mobile" id="nav-mobile" role="dialog" aria-label="Navigation">
    ${NAV_LINKS.map(l=>`<a class="nav-link${isActive(l.href)?' active':''}" href="${l.href}">${l.label}</a>`).join('')}
    <div class="nav-mobile-actions">
      <a href="/app.html" class="btn btn-outline btn-full">Sign In</a>
      <a href="/app.html" class="btn btn-primary btn-full btn-lg">Get Started Free</a>
    </div>
  </div>`;

  const footerHTML = `
  <footer id="g-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="footer-brand-logo">
            <div class="nav-logo-mark">R3E</div>
            <div><div class="nav-logo-text">R3E Platform</div><div class="nav-logo-sub">Retention Engine</div></div>
          </div>
          <p>Intelligent customer retention and engagement for local merchants. Automated WhatsApp campaigns, smart scheduling, and real-time analytics — all in one platform.</p>
          <div class="social-links">
            <a class="social-btn" href="#" title="LinkedIn">in</a>
            <a class="social-btn" href="#" title="Twitter">𝕏</a>
            <a class="social-btn" href="#" title="Instagram">◎</a>
            <a class="social-btn" href="#" title="Facebook">f</a>
          </div>
        </div>
        <div class="footer-col">
          <h5>Platform</h5>
          <div class="footer-link-list">
            <a href="/features.html">Features</a>
            <a href="/how-it-works.html">How It Works</a>
            <a href="/pricing.html">Pricing</a>
            <a href="/app.html">Dashboard Login</a>
          </div>
        </div>
        <div class="footer-col">
          <h5>Industries</h5>
          <div class="footer-link-list">
            <a href="/industries.html">Restaurants</a>
            <a href="/industries.html">Cafés</a>
            <a href="/industries.html">Grocery</a>
            <a href="/industries.html">Beauty &amp; Wellness</a>
            <a href="/industries.html">Retail</a>
          </div>
        </div>
        <div class="footer-col">
          <h5>Company</h5>
          <div class="footer-link-list">
            <a href="#">About Us</a>
            <a href="#">Blog</a>
            <a href="#">Careers</a>
            <a href="/faq.html">FAQ</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} R3E Platform Ltd. All rights reserved.</span>
        <div class="footer-bottom-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">GDPR</a>
        </div>
      </div>
    </div>
  </footer>`;

  function mount(id, html, fallbackFn) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html; else fallbackFn(html);
  }

  document.addEventListener('DOMContentLoaded', function() {
    mount('nav-mount',    navHTML,    h => document.body.insertAdjacentHTML('afterbegin', h));
    mount('footer-mount', footerHTML, h => document.body.insertAdjacentHTML('beforeend', h));

    const nav = document.getElementById('g-nav');
    function onScroll() { if(nav) nav.classList.toggle('scrolled', window.scrollY > 50); }
    window.addEventListener('scroll', onScroll, {passive:true});
    onScroll();

    const ham = document.getElementById('nav-ham');
    const mob = document.getElementById('nav-mobile');
    if (ham && mob) {
      ham.addEventListener('click', () => {
        const open = mob.classList.toggle('open');
        ham.setAttribute('aria-expanded', open);
        document.body.style.overflow = open ? 'hidden' : '';
        const spans = ham.querySelectorAll('span');
        if (open) {
          spans[0].style.transform = 'translateY(6.5px) rotate(45deg)';
          spans[1].style.opacity   = '0';
          spans[2].style.transform = 'translateY(-6.5px) rotate(-45deg)';
        } else {
          spans.forEach(s => { s.style.transform=''; s.style.opacity=''; });
        }
      });
      mob.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        mob.classList.remove('open');
        document.body.style.overflow = '';
        ham.setAttribute('aria-expanded','false');
        ham.querySelectorAll('span').forEach(s => { s.style.transform=''; s.style.opacity=''; });
      }));
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('up'); io.unobserve(e.target); } });
    }, { threshold: 0.07 });
    document.querySelectorAll('.reveal,.reveal-left,.reveal-right').forEach(el => io.observe(el));
  });
})();
