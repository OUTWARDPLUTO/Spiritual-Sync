// store.js — Store page interactive logic & payment integration
document.addEventListener('DOMContentLoaded', () => {
  initStore();
});

let currentScripture = 'all'; // 'all', 'gita', 'ramayan', 'upanishad'
let currentPlanId = 'monthly_all'; // plan ID
let currentPrice = 9900;
let currentDays = 30;
let storeRazorpayKey = '';
let allPlansList = [];

// IST Hour selections
let selectedStoreHour = 6;

function initStore() {
  const scriptureCards = document.querySelectorAll('#scripture-options .option-card');
  scriptureCards.forEach(card => {
    card.addEventListener('click', () => {
      scriptureCards.forEach(c => {
        c.classList.remove('selected');
        c.querySelector('.option-check').textContent = '';
      });
      card.classList.add('selected');
      card.querySelector('.option-check').textContent = '✓';
      
      currentScripture = card.dataset.source;
      renderPlans();
      updateSummary();
    });
  });

  // Time Slot Selection
  const timeBtns = document.querySelectorAll('.time-btn');
  timeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      timeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedStoreHour = parseInt(btn.dataset.hour);
      document.getElementById('selected-hour').value = selectedStoreHour;
    });
  });

  // Load plans from API
  fetchPlans().then(() => {
    // Read plan from URL params
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    
    if (planParam) {
      preselectPlan(planParam);
    } else {
      renderPlans();
      updateSummary();
    }
  });

  // Form Submit
  const form = document.getElementById('store-subscribe-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      handleStoreCheckout();
    });
  }
}

async function fetchPlans() {
  try {
    const res = await fetch('/api/plans');
    const data = await res.json();
    storeRazorpayKey = data.razorpay_key;
    allPlansList = data.plans;
  } catch (err) {
    console.error('Failed to load plans:', err);
  }
}

function renderPlans() {
  const container = document.getElementById('plan-options');
  if (!container || allPlansList.length === 0) return;

  // Filter plans based on scripture choice
  // 'all' -> trial, monthly_all, yearly_all
  // individual -> monthly_individual, yearly_individual
  let filtered = [];
  if (currentScripture === 'all') {
    filtered = allPlansList.filter(p => ['trial', 'monthly_all', 'yearly_all'].includes(p.id));
  } else {
    filtered = allPlansList.filter(p => ['monthly_individual', 'yearly_individual'].includes(p.id));
  }

  // Ensure selected plan is one of the available ones
  const hasCurrent = filtered.some(p => p.id === currentPlanId);
  if (!hasCurrent && filtered.length > 0) {
    currentPlanId = filtered[0].id;
  }

  container.innerHTML = filtered.map(plan => `
    <div class="option-card ${plan.id === currentPlanId ? 'selected' : ''}" 
         data-plan-id="${plan.id}" 
         onclick="selectStorePlan('${plan.id}')">
      <div class="option-info">
        <div class="option-name">${plan.name}</div>
        <div class="option-desc">${plan.description}</div>
      </div>
      <div style="display:flex; align-items:center; gap: 14px;">
        <span style="font-weight:600; color:var(--cream);">${plan.price_display}</span>
        <div class="option-check">${plan.id === currentPlanId ? '✓' : ''}</div>
      </div>
    </div>
  `).join('');

  // Re-attach custom hover cursor classes
  container.querySelectorAll('.option-card').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });

  const activePlanObj = allPlansList.find(p => p.id === currentPlanId);
  if (activePlanObj) {
    currentPrice = activePlanObj.price;
    currentDays = activePlanObj.days;
  }
}

function selectStorePlan(planId) {
  currentPlanId = planId;
  const cards = document.querySelectorAll('#plan-options .option-card');
  cards.forEach(c => {
    const isSel = c.dataset.planId === planId;
    c.classList.toggle('selected', isSel);
    c.querySelector('.option-check').textContent = isSel ? '✓' : '';
  });

  const activePlanObj = allPlansList.find(p => p.id === currentPlanId);
  if (activePlanObj) {
    currentPrice = activePlanObj.price;
    currentDays = activePlanObj.days;
  }
  updateSummary();
}

function preselectPlan(planParam) {
  // e.g. 'trial', 'monthly_all', 'yearly_all', 'monthly_individual', 'yearly_individual'
  const plan = allPlansList.find(p => p.id === planParam);
  if (!plan) return;

  currentPlanId = planParam;
  
  // Resolve scripture path
  if (planParam.includes('individual')) {
    // Default to gita if none chosen
    currentScripture = 'gita';
    const scriptureCards = document.querySelectorAll('#scripture-options .option-card');
    scriptureCards.forEach(c => {
      const match = c.dataset.source === 'gita';
      c.classList.toggle('selected', match);
      c.querySelector('.option-check').textContent = match ? '✓' : '';
    });
  } else {
    currentScripture = 'all';
    const scriptureCards = document.querySelectorAll('#scripture-options .option-card');
    scriptureCards.forEach(c => {
      const match = c.dataset.source === 'all';
      c.classList.toggle('selected', match);
      c.querySelector('.option-check').textContent = match ? '✓' : '';
    });
  }

  renderPlans();
  updateSummary();
}

function updateSummary() {
  const scriptureLabels = {
    all: 'All scriptures (rotating)',
    gita: 'Bhagavad Gita focus only',
    ramayan: 'Valmiki Ramayan focus only',
    upanishad: 'Upanishads focus only'
  };

  document.getElementById('summary-scripture').textContent = scriptureLabels[currentScripture];
  document.getElementById('summary-duration').textContent = `${currentDays} Days`;
  document.getElementById('summary-price').textContent = currentPrice === 0 ? 'Free' : `₹${currentPrice / 100}`;
}

async function handleStoreCheckout() {
  const name  = document.getElementById('sub-name').value.trim();
  const email = document.getElementById('sub-email').value.trim();
  const lang  = document.getElementById('sub-lang').value;
  const preferred_hour = selectedStoreHour;
  const plan  = currentPlanId;
  const primary_source = currentScripture;

  if (!name || !email) return showToast('Please enter your name and email ✍️', 'error');

  const btn     = document.getElementById('store-subscribe-btn');
  const btnText = document.getElementById('btn-text');
  btnText.textContent = '⏳ Processing...';
  btn.disabled = true;

  try {
    const res  = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name, 
        email, 
        plan, 
        preferred_hour, 
        preferred_language: lang, 
        primary_source 
      }),
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
    openStoreRazorpay(data, name, email, plan, preferred_hour, lang, primary_source);
  } catch (err) {
    showToast(err.message, 'error');
    btnText.textContent = 'Confirm & Pay 🪷';
    btn.disabled = false;
  }
}

function openStoreRazorpay(orderData, name, email, plan, preferred_hour, lang, primary_source) {
  const options = {
    key: storeRazorpayKey,
    amount: orderData.amount,
    currency: orderData.currency,
    name: 'Spiritual Sync 🪷',
    description: orderData.plan_name,
    order_id: orderData.order_id,
    theme: { color: '#B88E2F' },
    prefill: { name, email },
    modal: {
      ondismiss: () => {
        const btn     = document.getElementById('store-subscribe-btn');
        const btnText = document.getElementById('btn-text');
        btnText.textContent = 'Confirm & Pay 🪷';
        btn.disabled = false;
        showToast('Payment cancelled. Come back anytime! 🙏');
      },
    },
    handler: async response => {
      try {
        const res  = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ...response, 
            name, 
            email, 
            plan, 
            preferred_hour,
            preferred_language: lang,
            primary_source
          }),
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
