/* ═══════════════════════════════════════════════════════════
   store.js — Multi-Step Subscription Wizard
   Mobile-first: Step 1 → Step 2 → Step 3 → Checkout
   ═══════════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────
let currentStep = 1;
let currentScripture = 'all';
let currentPlanId    = 'trial';
let currentPrice     = 0;
let currentDays      = 7;
let selectedStoreHour = 6;
let allPlans         = [];
let razorpayKey      = '';

const TIME_LABELS = {
  4:  '4 AM IST (Brahma Muhurta)',
  5:  '5 AM IST (Sunrise)',
  6:  '6 AM IST (Morning)',
  7:  '7 AM IST (Early Morning)',
  8:  '8 AM IST (Morning)',
  12: '12 PM IST (Midday)',
  18: '6 PM IST (Evening)',
  21: '9 PM IST (Night)',
};

const SOURCE_LABELS = {
  all:       'All Scriptures',
  gita:      'Bhagavad Gita',
  ramayan:   'Valmiki Ramayan',
  upanishad: 'Upanishads',
};

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initTimeButtons();
  initScriptureCards();
  await loadPlansData();
  checkURLParams();
});

function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// ── Time Buttons ─────────────────────────────────────────
function initTimeButtons() {
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedStoreHour = parseInt(btn.dataset.hour);
      const hiddenInput = document.getElementById('selected-hour');
      if (hiddenInput) hiddenInput.value = selectedStoreHour;
      updateSummary();
    });
  });
}

// ── Scripture Cards ──────────────────────────────────────
function initScriptureCards() {
  document.querySelectorAll('.scripture-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.scripture-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentScripture = card.dataset.source;
      document.getElementById('current-scripture').value = currentScripture;
      renderPlanOptions();
      updateSummary();
    });
  });
}

// ── Load Plans from API ───────────────────────────────────
async function loadPlansData() {
  try {
    const res = await fetch('/api/plans');
    const data = await res.json();
    allPlans = data.plans || [];
    razorpayKey = data.razorpay_key || '';
    renderPlanOptions();
  } catch {
    document.getElementById('plan-options').innerHTML =
      '<p style="color:var(--text-dim);font-size:14px;">Could not load plans. Please refresh.</p>';
  }
}

// ── Render Plan Options Based on Scripture ────────────────
function renderPlanOptions() {
  const container = document.getElementById('plan-options');
  if (!container) return;

  const isIndividual = currentScripture !== 'all';
  const planOrder = isIndividual
    ? ['monthly_individual', 'yearly_individual']
    : ['trial', 'monthly_all', 'yearly_all'];

  const plans = planOrder.map(id => allPlans.find(p => p.id === id)).filter(Boolean);

  container.innerHTML = plans.map(plan => {
    const isFree = plan.price === 0;
    const priceLabel = isFree
      ? '<span style="font-size:22px;font-weight:700;color:var(--gold)">Free</span>'
      : `<span class="plan-option-price">₹${plan.price / 100}</span>`;

    const savings = plan.id === 'yearly_all'
      ? '~33% savings vs monthly' : plan.id === 'yearly_individual'
      ? '~33% savings vs monthly' : '';

    return `
      <div class="plan-option ${plan.id === currentPlanId ? 'active' : ''}"
           data-plan="${plan.id}"
           data-price="${plan.price}"
           data-days="${plan.days}"
           onclick="selectStorePlan('${plan.id}', ${plan.price}, ${plan.days})">
        <div class="plan-option-check">${plan.id === currentPlanId ? '✓' : ''}</div>
        <div class="plan-option-info">
          <div class="plan-option-name">${plan.name}</div>
          <div class="plan-option-desc">${plan.description}${savings ? ` · <span style="color:#68D391;">${savings}</span>` : ''}</div>
        </div>
        ${priceLabel}
      </div>
    `;
  }).join('');

  // If current plan not in list, default to first
  if (!plans.find(p => p.id === currentPlanId) && plans.length > 0) {
    const first = plans[0];
    selectStorePlan(first.id, first.price, first.days, true);
  }

  updateSummary();
}

// ── Select Plan ───────────────────────────────────────────
function selectStorePlan(planId, price, days, silent = false) {
  currentPlanId = planId;
  currentPrice  = price;
  currentDays   = days;

  document.getElementById('selected-plan').value = planId;

  if (!silent) {
    document.querySelectorAll('.plan-option').forEach(el => {
      const isActive = el.dataset.plan === planId;
      el.classList.toggle('active', isActive);
      const check = el.querySelector('.plan-option-check');
      if (check) check.textContent = isActive ? '✓' : '';
    });
  }

  updateSummary();
}

// ── Update Order Summary ──────────────────────────────────
function updateSummary() {
  const nameEl      = document.getElementById('summary-name');
  const scriptureEl = document.getElementById('summary-scripture');
  const hourEl      = document.getElementById('summary-hour');
  const priceEl     = document.getElementById('summary-price');

  const name = document.getElementById('sub-name')?.value.trim() || '—';
  if (nameEl) nameEl.textContent = name || '—';
  if (scriptureEl) scriptureEl.textContent = SOURCE_LABELS[currentScripture] || 'All Scriptures';
  if (hourEl) hourEl.textContent = TIME_LABELS[selectedStoreHour] || `${selectedStoreHour}:00 IST`;
  if (priceEl) {
    priceEl.textContent = currentPrice === 0 ? 'Free' : `₹${currentPrice / 100}`;
  }

  // Update CTA button
  const btn = document.getElementById('wizard-next-btn');
  const btnText = document.getElementById('wizard-btn-text');
  if (btn && btnText && currentStep === 3) {
    if (currentPrice === 0) {
      btnText.textContent = '🪷 Start Free Trial';
    } else {
      btnText.textContent = `Pay ₹${currentPrice / 100} →`;
    }
  }
}

// ── Wizard Navigation ─────────────────────────────────────
function wizardNext() {
  if (currentStep === 1) {
    if (!validateStep1()) return;
    goToStep(2);
  } else if (currentStep === 2) {
    goToStep(3);
  } else if (currentStep === 3) {
    handleCheckout();
  }
}

function wizardBack() {
  if (currentStep > 1) goToStep(currentStep - 1);
}

function goToStep(step) {
  // Animate out current panel
  const currentPanel = document.getElementById(`panel-${currentStep}`);
  if (currentPanel) {
    currentPanel.classList.remove('active');
    currentPanel.classList.add('prev');
    setTimeout(() => currentPanel.classList.remove('prev'), 400);
  }

  currentStep = step;

  // Animate in new panel
  const newPanel = document.getElementById(`panel-${step}`);
  if (newPanel) {
    newPanel.classList.add('active');
  }

  updateWizardProgress();
  updateBottomBar();
  updateSummary();

  // Scroll to top of panel
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateWizardProgress() {
  for (let i = 1; i <= 3; i++) {
    const stepEl = document.getElementById(`wstep-${i}`);
    const connEl = document.getElementById(`wconn-${i}`);
    if (stepEl) {
      stepEl.classList.remove('active', 'done');
      if (i < currentStep) stepEl.classList.add('done');
      else if (i === currentStep) stepEl.classList.add('active');
    }
    if (connEl) {
      connEl.classList.toggle('done', i < currentStep);
    }
  }
  // Update dot labels for done steps
  for (let i = 1; i < currentStep; i++) {
    const dot = document.querySelector(`#wstep-${i} .wizard-step-dot`);
    if (dot) dot.textContent = '✓';
  }
  const currentDot = document.querySelector(`#wstep-${currentStep} .wizard-step-dot`);
  if (currentDot) currentDot.textContent = currentStep;
}

function updateBottomBar() {
  const nextBtn   = document.getElementById('wizard-next-btn');
  const backBtn   = document.getElementById('wizard-back-btn');
  const btnText   = document.getElementById('wizard-btn-text');
  if (!nextBtn || !backBtn || !btnText) return;

  backBtn.style.display = currentStep > 1 ? 'block' : 'none';

  if (currentStep === 1) btnText.textContent = 'Continue →';
  else if (currentStep === 2) btnText.textContent = 'Choose Plan →';
  else {
    btnText.textContent = currentPrice === 0 ? '🪷 Start Free Trial' : `Pay ₹${currentPrice / 100} →`;
  }
}

// ── Validation ────────────────────────────────────────────
function validateStep1() {
  const name  = document.getElementById('sub-name')?.value.trim();
  const email = document.getElementById('sub-email')?.value.trim();

  if (!name) {
    showStoreToast('Please enter your name ✍️', 'error');
    document.getElementById('sub-name')?.focus();
    return false;
  }
  if (!email || !email.includes('@')) {
    showStoreToast('Please enter a valid email address 📧', 'error');
    document.getElementById('sub-email')?.focus();
    return false;
  }
  return true;
}

// ── Checkout ──────────────────────────────────────────────
async function handleCheckout() {
  const name     = document.getElementById('sub-name')?.value.trim();
  const email    = document.getElementById('sub-email')?.value.trim();
  const plan     = document.getElementById('selected-plan')?.value;
  const hour     = document.getElementById('selected-hour')?.value;
  const lang     = document.getElementById('sub-lang')?.value || 'both';
  const source   = document.getElementById('current-scripture')?.value || 'all';

  const btn     = document.getElementById('wizard-next-btn');
  const btnText = document.getElementById('wizard-btn-text');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = '⏳ Processing...';

  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, plan,
        preferred_hour: parseInt(hour),
        preferred_language: lang,
        primary_source: source,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Subscription failed');

    if (data.isFree) {
      window.location.href = `/success?plan=${plan}&name=${encodeURIComponent(name)}&hour=${hour}`;
      return;
    }

    openStoreRazorpay(data, name, email, plan, hour, lang, source);
  } catch (err) {
    showStoreToast(err.message, 'error');
    if (btn) btn.disabled = false;
    if (btnText) updateBottomBar();
  }
}

// ── Razorpay ─────────────────────────────────────────────
function openStoreRazorpay(orderData, name, email, plan, hour, lang, source) {
  const options = {
    key: razorpayKey,
    amount: orderData.amount,
    currency: orderData.currency || 'INR',
    name: 'Spiritual Sync 🪷',
    description: orderData.plan_name,
    order_id: orderData.order_id,
    theme: { color: '#C9A84C' },
    prefill: { name, email },
    modal: {
      ondismiss: () => {
        const btn = document.getElementById('wizard-next-btn');
        if (btn) btn.disabled = false;
        updateBottomBar();
        showStoreToast('Payment cancelled. Come back anytime! 🙏');
      },
    },
    handler: async response => {
      try {
        const res = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...response, name, email, plan,
            preferred_hour: parseInt(hour),
            preferred_language: lang,
            primary_source: source,
          }),
        });
        const data = await res.json();
        if (data.success) {
          window.location.href = `/success?plan=${plan}&name=${encodeURIComponent(name)}&hour=${hour}`;
        } else {
          showStoreToast('Payment verification failed. Please contact support.', 'error');
        }
      } catch (err) {
        showStoreToast('Verification error: ' + err.message, 'error');
      }
    },
  };

  // Dev bypass for test keys
  if (razorpayKey && razorpayKey.includes('test')) {
    console.log('⚠️ Test Razorpay key detected — bypassing for dev');
    window.location.href = `/success?plan=${plan}&name=${encodeURIComponent(name)}&hour=${hour}`;
    return;
  }

  new Razorpay(options).open();
}

// ── URL Params Pre-selection ──────────────────────────────
function checkURLParams() {
  const params = new URLSearchParams(window.location.search);
  const planParam = params.get('plan');
  if (!planParam) return;

  const individualPlans = ['monthly_individual', 'yearly_individual'];
  if (individualPlans.includes(planParam)) {
    currentScripture = 'gita';
    document.querySelectorAll('.scripture-card').forEach(c => {
      c.classList.toggle('active', c.dataset.source === 'gita');
    });
    document.getElementById('current-scripture').value = 'gita';
    renderPlanOptions();
  }

  // Select the plan after render
  setTimeout(() => {
    const planEl = document.querySelector(`[data-plan="${planParam}"]`);
    if (planEl) {
      const price = parseInt(planEl.dataset.price || '0');
      const days  = parseInt(planEl.dataset.days  || '7');
      selectStorePlan(planParam, price, days);
    }
  }, 100);
}

// ── Toast ─────────────────────────────────────────────────
function showStoreToast(msg, type = 'info') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 4500);
}
