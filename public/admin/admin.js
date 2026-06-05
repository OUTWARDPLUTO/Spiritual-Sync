// admin/admin.js — Admin Dashboard Logic

let adminToken = localStorage.getItem('admin_token') || '';

// ────────────────────────────────────────────────
// Init
// ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) {
    showDashboard();
  }

  // Allow Enter key on password field
  const pwdInput = document.getElementById('admin-password');
  if (pwdInput) {
    pwdInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') adminLogin();
    });
  }
});

// ────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────
async function adminLogin() {
  const password = document.getElementById('admin-password').value;
  const errorEl = document.getElementById('login-error');

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (data.success) {
      adminToken = data.token;
      localStorage.setItem('admin_token', adminToken);
      errorEl.style.display = 'none';
      showDashboard();
    } else {
      errorEl.style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = 'Connection error. Is the server running?';
    errorEl.style.display = 'block';
  }
}

function adminLogout() {
  adminToken = '';
  localStorage.removeItem('admin_token');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'grid';
  loadStats();
  loadSubscribers();
}

// ────────────────────────────────────────────────
// Navigation
// ────────────────────────────────────────────────
function showSection(section) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`section-${section}`).classList.add('active');
  document.getElementById(`nav-${section}`).classList.add('active');

  // Load data for sections
  if (section === 'logs') loadLogs();
  if (section === 'subscribers') loadSubscribers();
}

// ────────────────────────────────────────────────
// API Helper
// ────────────────────────────────────────────────
async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    adminLogout();
    throw new Error('Session expired. Please login again.');
  }

  return res.json();
}

// ────────────────────────────────────────────────
// Stats
// ────────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await adminFetch('/api/admin/stats');

    document.getElementById('stat-active').textContent = data.active_subscribers;
    document.getElementById('stat-total').textContent = data.total_subscribers;
    document.getElementById('stat-sent').textContent = data.emails_sent_today;

    const s = data.today_shloka;
    document.getElementById('today-shloka').innerHTML = `
      <strong style="color:rgba(200,134,10,0.9);">#${s.id} — ${s.reference}</strong>
      <br><span style="color:rgba(255,255,255,0.5);font-size:13px;">${s.source}</span>
    `;
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ────────────────────────────────────────────────
// Subscribers
// ────────────────────────────────────────────────
async function loadSubscribers() {
  const tbody = document.getElementById('subscribers-body');

  try {
    const data = await adminFetch('/api/admin/subscribers');
    const subs = data.subscribers;

    if (subs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:rgba(255,255,255,0.3);">No subscribers yet</td></tr>';
      return;
    }

    const timeLabels = { 4: '4AM', 5: '5AM', 6: '6AM', 7: '7AM', 8: '8AM', 12: '12PM', 18: '6PM', 21: '9PM' };

    tbody.innerHTML = subs.map(s => `
      <tr>
        <td>${esc(s.name)}</td>
        <td style="font-family:monospace;font-size:12px;">${esc(s.email)}</td>
        <td style="text-transform:capitalize;">${s.plan ? s.plan.replace('_', ' ') : '—'}</td>
        <td style="text-transform:capitalize;">${s.preferred_language || 'both'}</td>
        <td style="text-transform:capitalize;">${s.primary_source || 'all'}</td>
        <td><span class="status-badge status-${s.status}">${s.status}</span></td>
        <td>${timeLabels[s.preferred_hour] || s.preferred_hour + ':00'}</td>
        <td style="font-size:12px;">${s.paid_until || 'N/A'}</td>
        <td style="font-size:12px;">${s.created_at?.split('T')[0] || '—'}</td>
        <td><button class="btn-danger" onclick="deleteSubscriber(${s.id}, '${esc(s.email)}')">Delete</button></td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="color:#FC8181;padding:20px;">${err.message}</td></tr>`;
  }
}

async function deleteSubscriber(id, email) {
  if (!confirm(`Delete subscriber: ${email}?\nThis cannot be undone.`)) return;

  try {
    await adminFetch(`/api/admin/subscribers/${id}`, { method: 'DELETE' });
    loadSubscribers();
    loadStats();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ────────────────────────────────────────────────
// Send Email
// ────────────────────────────────────────────────
async function sendTestEmail() {
  const email = document.getElementById('test-email').value.trim();
  const resultEl = document.getElementById('test-result');

  if (!email) {
    resultEl.innerHTML = '<span style="color:#FC8181;">Please enter an email address.</span>';
    return;
  }

  resultEl.innerHTML = '⏳ Sending...';

  try {
    const data = await adminFetch('/api/admin/test-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (data.success) {
      resultEl.innerHTML = `<span style="color:#68D391;">✅ Test email sent to ${email}!</span>`;
    } else {
      resultEl.innerHTML = `<span style="color:#FC8181;">❌ ${data.error}</span>`;
    }
  } catch (err) {
    resultEl.innerHTML = `<span style="color:#FC8181;">❌ ${err.message}</span>`;
  }
}

async function forceSendNow() {
  const resultEl = document.getElementById('force-result');
  resultEl.innerHTML = '⏳ Sending...';

  try {
    const data = await adminFetch('/api/admin/send-now', { method: 'POST' });

    if (data.successCount !== undefined) {
      resultEl.innerHTML = `<span style="color:#68D391;">✅ Sent: ${data.successCount} | ❌ Failed: ${data.failCount}</span>`;
      loadStats();
    } else {
      resultEl.innerHTML = `<span style="color:#FBD38D;">${data.message || 'No subscribers matched current hour.'}</span>`;
    }
  } catch (err) {
    resultEl.innerHTML = `<span style="color:#FC8181;">❌ ${err.message}</span>`;
  }
}

// ────────────────────────────────────────────────
// Logs
// ────────────────────────────────────────────────
async function loadLogs() {
  const tbody = document.getElementById('logs-body');

  try {
    const data = await adminFetch('/api/admin/logs');
    const logs = data.logs;

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:rgba(255,255,255,0.3);">No logs yet</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td>${esc(l.name)}</td>
        <td style="font-size:12px;font-family:monospace;">${esc(l.email)}</td>
        <td style="font-size:12px;">#${l.shloka_id}</td>
        <td style="font-size:12px;">${l.ist_date}</td>
        <td><span class="status-badge ${l.status === 'sent' ? 'status-active' : 'status-expired'}">${l.status}</span></td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#FC8181;padding:20px;">${err.message}</td></tr>`;
  }
}

// ────────────────────────────────────────────────
// Add Subscriber (Manual)
// ────────────────────────────────────────────────
async function addSubscriber() {
  const name = document.getElementById('add-name').value.trim();
  const email = document.getElementById('add-email').value.trim();
  const plan = document.getElementById('add-plan').value;
  const preferred_language = document.getElementById('add-lang').value;
  const primary_source = document.getElementById('add-source').value;
  const preferred_hour = document.getElementById('add-hour').value;
  const days = document.getElementById('add-days').value;
  const resultEl = document.getElementById('add-result');

  if (!name || !email) {
    resultEl.innerHTML = '<span style="color:#FC8181;">Name and email are required.</span>';
    return;
  }

  // Enforce single-scripture validation locally
  const isIndividual = plan.includes('individual');
  if (isIndividual && primary_source === 'all') {
    resultEl.innerHTML = '<span style="color:#FC8181;">Single-scripture plan requires choosing a specific scripture focus.</span>';
    return;
  }

  try {
    const data = await adminFetch('/api/admin/subscribers', {
      method: 'POST',
      body: JSON.stringify({ name, email, plan, preferred_language, primary_source, preferred_hour, days }),
    });

    if (data.success) {
      resultEl.innerHTML = `<span style="color:#68D391;">✅ ${data.message}</span>`;
      document.getElementById('add-name').value = '';
      document.getElementById('add-email').value = '';
      loadSubscribers();
      loadStats();
    } else {
      resultEl.innerHTML = `<span style="color:#FC8181;">❌ ${data.error}</span>`;
    }
  } catch (err) {
    resultEl.innerHTML = `<span style="color:#FC8181;">❌ ${err.message}</span>`;
  }
}

// ────────────────────────────────────────────────
// Utility
// ────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
