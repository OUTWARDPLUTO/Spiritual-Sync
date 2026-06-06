/* ═══════════════════════════════════════════════════
   app.js — Mobile-First Interactive Frontend
   Bottom Nav · Particles · 3D Tilt · Parallax (desktop)
═══════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────
let selectedPlan = 'trial';
let selectedHour = 6;
let razorpayKey = '';
const isMobile = window.innerWidth <= 768;
const isTouch  = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// ─────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLoader();
  initCursor();
  initScrollProgress();
  initNav();
  initBottomNav();
  initParticleCanvas();
  if (!isTouch) initParallax();
  initScrollAnimations();
  if (!isTouch) initMagnetic();
  init3DTilt();
  initEmailMockup();
  initFAQ();
  initSourcesScrollDots();
  initHeroReveal();
  loadTodaysShloka();
  loadPlans();
  setupTimeButtons();
  setupForm();
});


// ─────────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────────
function initLoader() {
  const loader = document.getElementById('loader');
  if (!loader) {
    document.body.style.overflow = 'auto';
    return;
  }
  setTimeout(() => {
    loader.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }, 2200);
  document.body.style.overflow = 'hidden';
}

// ─────────────────────────────────────────────────
// CUSTOM CURSOR
// ─────────────────────────────────────────────────
function initCursor() {
  const cursor = document.getElementById('cursor');
  const glow   = document.getElementById('cursor-glow');
  if (!cursor) return;

  if (isTouch || window.innerWidth <= 1024) {
    cursor.style.display = 'none';
    if (glow) glow.style.display = 'none';
    document.body.style.cursor = 'auto';
    return;
  }

  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let glowX = mouseX, glowY = mouseY;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    cursor.style.left = mouseX + 'px';
    cursor.style.top  = mouseY + 'px';
  });

  const hoverTargets = 'a, button, .plan-card, .feat-card, .tilt-card, input';
  document.querySelectorAll(hoverTargets).forEach(el => {
    el.addEventListener('mouseenter', () => cursor.style.transform = 'translate(-50%,-50%) scale(2)');
    el.addEventListener('mouseleave', () => cursor.style.transform = 'translate(-50%,-50%) scale(1)');
  });

  function animateCursor() {
    glowX += (mouseX - glowX) * 0.06;
    glowY += (mouseY - glowY) * 0.06;
    if (glow) { glow.style.left = glowX + 'px'; glow.style.top = glowY + 'px'; }
    requestAnimationFrame(animateCursor);
  }
  animateCursor();
}

// ─────────────────────────────────────────────────
// SCROLL PROGRESS BAR
// ─────────────────────────────────────────────────
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const scrollTop = document.documentElement.scrollTop;
    const docH = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    bar.style.width = (scrollTop / docH * 100) + '%';
  }, { passive: true });
}

// ─────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────
function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

// ─────────────────────────────────────────────────
// PARTICLE CANVAS
// ─────────────────────────────────────────────────
function initParticleCanvas() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Fewer particles on mobile for performance
  const COUNT = isTouch ? 20 : 60;
  const symbols = ['ॐ', '✦', '◈', '❋', '·', '✧'];
  const particles = Array.from({ length: COUNT }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2.5 + 0.5,
    speed: Math.random() * 0.4 + 0.1,
    opacity: Math.random() * 0.5 + 0.05,
    drift: (Math.random() - 0.5) * 0.3,
    symbol: Math.random() > 0.8 ? symbols[Math.floor(Math.random() * symbols.length)] : null,
    fontSize: Math.random() * 12 + 8,
    pulse: Math.random() * Math.PI * 2,
  }));

  let mouse = { x: -999, y: -999 };
  document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      // Mouse repulsion
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        p.x += (dx / dist) * 1.5;
        p.y += (dy / dist) * 1.5;
      }

      p.pulse += 0.02;
      const alpha = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));

      if (p.symbol) {
        ctx.font = `${p.fontSize}px 'Noto Sans Devanagari', serif`;
        ctx.fillStyle = `rgba(200,134,10,${alpha * 0.6})`;
        ctx.fillText(p.symbol, p.x, p.y);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,134,10,${alpha})`;
        ctx.fill();
      }

      p.y -= p.speed;
      p.x += p.drift;

      if (p.y < -20) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
      if (p.x < 0 || p.x > canvas.width) p.drift *= -1;
    });

    requestAnimationFrame(draw);
  }
  draw();
}

// ─────────────────────────────────────────────────
// PARALLAX (mouse + scroll)
// ─────────────────────────────────────────────────
function initParallax() {
  const layers = document.querySelectorAll('.parallax-layer');
  let targetX = 0, targetY = 0, curX = 0, curY = 0;

  document.addEventListener('mousemove', e => {
    targetX = (e.clientX / window.innerWidth  - 0.5) * 30;
    targetY = (e.clientY / window.innerHeight - 0.5) * 20;
  }, { passive: true });

  // Scroll parallax for hero
  const heroContent = document.getElementById('hero-content');
  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    if (heroContent && sy < window.innerHeight) {
      heroContent.style.transform = `translateY(${sy * 0.25}px)`;
      heroContent.style.opacity = `${1 - sy / (window.innerHeight * 0.7)}`;
    }
  }, { passive: true });

  function animate() {
    curX += (targetX - curX) * 0.07;
    curY += (targetY - curY) * 0.07;
    layers.forEach(layer => {
      const speed = parseFloat(layer.dataset.speed || 0.05);
      layer.style.transform = `translate(${curX * speed * 10}px, ${curY * speed * 10}px)`;
    });
    requestAnimationFrame(animate);
  }
  animate();
}

// ─────────────────────────────────────────────────
// SCROLL ANIMATIONS (IntersectionObserver)
// ─────────────────────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => entry.target.classList.add('in-view'), parseInt(delay));
      }
    });
  // Lower threshold on mobile since viewport is smaller
  }, { threshold: isMobile ? 0.06 : 0.12 });

  document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
}

// ─────────────────────────────────────────────────
// MAGNETIC BUTTONS
// ─────────────────────────────────────────────────
function initMagnetic() {
  document.querySelectorAll('.magnetic').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      btn.style.transform = `translate(${dx * 0.25}px, ${dy * 0.3}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
      setTimeout(() => btn.style.transition = '', 500);
    });
  });
}

// ─────────────────────────────────────────────────
// 3D TILT CARDS
// ─────────────────────────────────────────────────
function init3DTilt() {
  document.querySelectorAll('.tilt-card').forEach(card => {
    const shine = card.querySelector('.card-shine');

    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width  / 2;
      const cy = rect.height / 2;
      const rotX = ((y - cy) / cy) * -3.5;
      const rotY = ((x - cx) / cx) * 3.5;

      card.style.transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.015,1.015,1.015)`;
      card.style.transition = 'transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)';

      if (shine) {
        shine.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.08) 0%, transparent 55%)`;
      }
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1200px) rotateX(0) rotateY(0) scale3d(1,1,1)';
      card.style.transition = 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
      if (shine) shine.style.background = '';
    });
  });
}

// ─────────────────────────────────────────────────
// EMAIL MOCKUP CONTROLS
// ─────────────────────────────────────────────────
function initEmailMockup() {
  const btnLight = document.getElementById('mock-theme-light');
  const btnDark  = document.getElementById('mock-theme-dark');
  const mockup   = document.getElementById('email-mockup-wrapper');
  
  if (btnLight && btnDark && mockup) {
    btnLight.addEventListener('click', () => {
      mockup.classList.remove('theme-dark');
      mockup.classList.add('theme-light');
      btnLight.classList.add('active');
      btnDark.classList.remove('active');
    });
    btnDark.addEventListener('click', () => {
      mockup.classList.remove('theme-light');
      mockup.classList.add('theme-dark');
      btnDark.classList.add('active');
      btnLight.classList.remove('active');
    });
  }

  const langBtns = document.querySelectorAll('.mock-lang-btn');
  const mockHindi = document.getElementById('mock-email-hindi');
  const mockEnglish = document.getElementById('mock-email-english');
  const mockReflection = document.getElementById('mock-email-reflection');

  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      langBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      
      if (view === 'all') {
        if (mockHindi) mockHindi.style.display = 'block';
        if (mockEnglish) mockEnglish.style.display = 'block';
        if (mockReflection) mockReflection.style.display = 'block';
      } else if (view === 'sanskrit') {
        if (mockHindi) mockHindi.style.display = 'none';
        if (mockEnglish) mockEnglish.style.display = 'none';
        if (mockReflection) mockReflection.style.display = 'none';
      } else if (view === 'translation') {
        if (mockHindi) mockHindi.style.display = 'block';
        if (mockEnglish) mockEnglish.style.display = 'block';
        if (mockReflection) mockReflection.style.display = 'none';
      }
    });
  });
}

// ─────────────────────────────────────────────────
// FAQ ACCORDION
// ─────────────────────────────────────────────────
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(i => i.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });
}


// ─────────────────────────────────────────────────
// LOAD TODAY'S SHLOKA
// ─────────────────────────────────────────────────
async function loadTodaysShloka() {
  const card = document.getElementById('shloka-preview');
  if (!card) return;

  try {
    const res = await fetch('/api/today');
    const { shloka: s } = await res.json();

    const srcIcons = { 'Bhagavad Gita': '📖', 'Valmiki Ramayan': '🏹', 'Ramcharitmanas': '🪷' };
    const icon = srcIcons[s.source] || '📿';

    card.innerHTML = `
      <div class="card-shine"></div>
      <div class="card-top-bar">
        <div class="card-source">
          <span class="card-source-dot"></span>
          ${icon} ${s.source}
        </div>
        <span class="card-ref">${s.reference}</span>
      </div>
      <div class="card-body">
        <div class="shloka-devanagari">${s.devanagari}</div>
        <div class="card-divider"></div>
        <div class="shloka-translit">${s.transliteration}</div>
        <div class="meaning-block hindi">
          <div class="meaning-label">🇮🇳 Hindi Meaning</div>
          <div class="meaning-text">${s.hindi_meaning}</div>
        </div>
        <div class="meaning-block english">
          <div class="meaning-label">🌍 English Meaning</div>
          <div class="meaning-text italic">"${s.english_meaning}"</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:4px;">
          <div class="card-theme">📿 ${s.theme}</div>
        </div>
        <div class="ai-teaser">
          <p>✨ Subscribers also get a <span>mindful AI reflection</span> and a daily practice tip 🌱</p>
        </div>
      </div>`;

    // Re-init tilt on newly rendered card
    init3DTilt();
  } catch {
    card.innerHTML = `<div class="card-loading">
      <div class="loading-om">ॐ</div>
      <p>Preview will appear once the server is running.</p>
    </div>`;
  }
}

// ─────────────────────────────────────────────────
// LOAD PLANS
// ─────────────────────────────────────────────────
async function loadPlans() {
  const grid = document.getElementById('plans-grid');
  if (!grid) return;

  try {
    const res  = await fetch('/api/plans');
    const data = await res.json();
    razorpayKey = data.razorpay_key;

    const order = ['trial', 'monthly_all', 'monthly_individual'];
    const plans = order.map(id => data.plans.find(p => p.id === id)).filter(Boolean);

    grid.innerHTML = plans.map(plan => {
      let extraHtml = '';
      if (plan.id === 'monthly_all') {
        extraHtml = `<div class="plan-savings" style="margin-top: 12px; color: var(--gold-light); font-size: 13px;">Yearly option: ₹799/yr (~33% savings)</div>`;
      } else if (plan.id === 'monthly_individual') {
        extraHtml = `<div class="plan-savings" style="margin-top: 12px; color: var(--gold-light); font-size: 13px;">Yearly option: ₹399/yr (~33% savings)</div>`;
      } else if (plan.id === 'trial') {
        extraHtml = `<div class="plan-savings" style="margin-top: 12px; color: rgba(255,255,255,0.3); font-size: 13px;">No credit card required</div>`;
      }

      return `
        <div class="plan-card tilt-card ${plan.id === 'trial' ? 'selected' : ''}"
             data-plan="${plan.id}" id="plan-card-${plan.id}"
             onclick="selectPlan('${plan.id}')">
          <div class="card-shine"></div>
          ${plan.id === 'monthly_all' ? '<div class="plan-popular-badge">🔥 All Scriptures</div>' : ''}
          ${plan.id === 'monthly_individual' ? '<div class="plan-popular-badge" style="background:rgba(184,142,47,0.15); border-color:var(--border);">🎯 Focused Path</div>' : ''}
          <div class="plan-check-ring">${plan.id === 'trial' ? '✓' : ''}</div>
          <div class="plan-name">${plan.name}</div>
          <div class="plan-price-wrap">
            <div class="plan-price">
              ${plan.price === 0 ? 'Free' : `<sup>₹</sup>${plan.price / 100}<sub>/mo</sub>`}
            </div>
          </div>
          <div class="plan-duration">${plan.days} days access</div>
          <div class="plan-desc" style="margin-bottom:0;">${plan.description}</div>
          ${extraHtml}
        </div>
      `;
    }).join('');

    init3DTilt();
    initMagnetic();

    // Re-attach hover cursor class
    document.querySelectorAll('.plan-card').forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });
  } catch {
    grid.innerHTML = `<div class="plans-loading"><p style="color:rgba(255,248,236,0.4)">Could not load plans. Please refresh.</p></div>`;
  }
}

// ─────────────────────────────────────────────────
// PLAN SELECTION
// ─────────────────────────────────────────────────
function selectPlan(planId) {
  window.location.href = `/store?plan=${planId}`;
}

// ─────────────────────────────────────────────────
// TIME BUTTONS
// ─────────────────────────────────────────────────
function setupTimeButtons() {
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedHour = parseInt(btn.dataset.hour);
      document.getElementById('selected-hour').value = selectedHour;
    });
  });
}

// ─────────────────────────────────────────────────
// FORM SUBMISSION
// ─────────────────────────────────────────────────
function setupForm() {
  const form = document.getElementById('subscribe-form');
  if (!form) return;
  form.addEventListener('submit', e => { e.preventDefault(); handleSubscribe(); });
}

async function handleSubscribe() {
  const name  = document.getElementById('sub-name').value.trim();
  const email = document.getElementById('sub-email').value.trim();
  const plan  = document.getElementById('selected-plan').value;
  const preferred_hour = document.getElementById('selected-hour').value;

  if (!name || !email) return showToast('Please enter your name and email ✍️', 'error');

  const btn     = document.getElementById('subscribe-btn');
  const btnText = document.getElementById('btn-text');
  btnText.textContent = '⏳ Processing...';
  btn.disabled = true;

  try {
    const res  = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, plan, preferred_hour }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Subscription failed');

    if (data.isFree) {
      showToast('🪷 Welcome! Check your email for a greeting!', 'success');
      setTimeout(() => {
        window.location.href = `/success?plan=trial&name=${encodeURIComponent(name)}&hour=${preferred_hour}`;
      }, 1200);
      return;
    }
    openRazorpay(data, name, email, plan, preferred_hour);
  } catch (err) {
    showToast(err.message, 'error');
    btnText.textContent = 'Try Again';
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────
// RAZORPAY
// ─────────────────────────────────────────────────
function openRazorpay(orderData, name, email, plan, preferred_hour) {
  const options = {
    key: razorpayKey,
    amount: orderData.amount,
    currency: orderData.currency,
    name: 'Daily Shloka 🪷',
    description: orderData.plan_name,
    order_id: orderData.order_id,
    theme: { color: '#C8860A' },
    prefill: { name, email },
    modal: {
      ondismiss: () => {
        const btn     = document.getElementById('subscribe-btn');
        const btnText = document.getElementById('btn-text');
        btnText.textContent = plan === 'monthly' ? 'Subscribe Monthly 🙏' : 'Subscribe Yearly 🕉️';
        btn.disabled = false;
        showToast('Payment cancelled. Come back anytime! 🙏');
      },
    },
    handler: async response => {
      try {
        const res  = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...response, name, email, plan, preferred_hour }),
        });
        const data = await res.json();
        if (data.success) {
          window.location.href = `/success?plan=${plan}&name=${encodeURIComponent(name)}&hour=${preferred_hour}`;
        } else {
          showToast('Payment verification failed. Contact support.', 'error');
        }
      } catch (err) {
        showToast('Verification error: ' + err.message, 'error');
      }
    },
  };
  new Razorpay(options).open();
}

// ─────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  setTimeout(() => toast.classList.remove('show'), 4500);
}

// ─────────────────────────────────────────────────
// SCROLL TO FORM
// ─────────────────────────────────────────────────
function scrollToForm() {
  document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' });
}

// ─────────────────────────────────────────────────
// BOTTOM NAVIGATION ACTIVE STATES
// ─────────────────────────────────────────────────
function initBottomNav() {
  const bnav = document.getElementById('bottom-nav');
  if (!bnav) return;

  const bnavProfile = document.getElementById('bnav-profile');
  if (bnavProfile) {
    bnavProfile.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = document.getElementById('profile-modal');
      if (modal) {
        modal.classList.add('show');
        document.getElementById('profile-request-email')?.focus();
      }
    });
  }

  const sections = [
    { id: 'hero',    navId: 'bnav-home'    },
    { id: 'preview', navId: 'bnav-preview' },
    { id: 'plans',   navId: 'bnav-plans'   },
  ];

  const bnavItems = bnav.querySelectorAll('.bnav-item');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const match = sections.find(s => s.id === entry.target.id);
        if (match) {
          bnavItems.forEach(i => i.classList.remove('active'));
          document.getElementById(match.navId)?.classList.add('active');
        }
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) observer.observe(el);
  });
}

// ─────────────────────────────────────────────────
// SOURCES SCROLL DOTS (mobile carousel indicator)
// ─────────────────────────────────────────────────
function initSourcesScrollDots() {
  const scroll = document.getElementById('sources-scroll');
  const dots = document.querySelectorAll('#sources-dots .scroll-dot');
  if (!scroll || !dots.length) return;

  scroll.addEventListener('scroll', () => {
    const cards = scroll.querySelectorAll('.source-card');
    if (!cards.length) return;
    const cardW = cards[0].offsetWidth + 16; // gap
    const idx = Math.round(scroll.scrollLeft / cardW);
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }, { passive: true });
}

// ─────────────────────────────────────────────────
// HERO REVEAL ANIMATIONS
// ─────────────────────────────────────────────────
function initHeroReveal() {
  // Reveal .reveal-up elements staggered on load
  const els = document.querySelectorAll('.reveal-up');
  els.forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), 400 + i * 120);
  });
}

// ─────────────────────────────────────────────────
// PROFILE ACCESS MODAL FLOW
// ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const profileModal = document.getElementById('profile-modal');
  const openLinks = [
    document.getElementById('nav-manage-link'),
    document.getElementById('nav-mobile-profile-btn'),
    document.getElementById('footer-manage-link')
  ].filter(Boolean);
  const closeBtn = document.getElementById('profile-modal-close');
  const requestForm = document.getElementById('profile-request-form');
  const statusEl = document.getElementById('profile-modal-status');

  if (profileModal && openLinks.length > 0) {
    // Open modal
    openLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        profileModal.classList.add('show');
        statusEl.style.display = 'none';
        statusEl.className = 'modal-status';
        requestForm.reset();
        document.getElementById('profile-request-email')?.focus();
      });
    });

    // Close modal on close button click
    closeBtn?.addEventListener('click', () => {
      profileModal.classList.remove('show');
    });

    // Close modal on clicking outside the modal card
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) {
        profileModal.classList.remove('show');
      }
    });

    // Handle form submit
    requestForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('profile-request-email').value.trim();
      const submitBtn = requestForm.querySelector('button[type="submit"]');
      
      if (!email) return;

      // Show sending state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending... ⏳';
      }
      statusEl.style.display = 'none';

      try {
        const res = await fetch('/api/subscriber/request-login-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          statusEl.textContent = data.message;
          statusEl.className = 'modal-status success';
          statusEl.style.display = 'block';
          requestForm.reset();
        } else {
          statusEl.textContent = data.error || 'This email is not registered. Please check or subscribe first.';
          statusEl.className = 'modal-status error';
          statusEl.style.display = 'block';
        }
      } catch (err) {
        statusEl.textContent = 'Connection error. Please try again.';
        statusEl.className = 'modal-status error';
        statusEl.style.display = 'block';
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Access Link →';
        }
      }
    });
  }
});
