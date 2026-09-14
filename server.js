// server.js — Express API server for Spiritual Sync
require('dotenv').config();
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { initDB, subscriberQueries, logQueries, getISTDateString } = require('./database');
const { createOrder, verifyPayment, calculatePaidUntil, PLANS } = require('./razorpay');
const { sendWelcomeEmail, sendLoginLinkEmail, verifyConnection } = require('./emailer');
const { startScheduler, getTodaysShloka, triggerSendNow } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// ────────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url} - Body:`, JSON.stringify(req.body));
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[RESPONSE] ${req.method} ${req.url} - Status: ${res.statusCode} - Duration: ${Date.now() - start}ms`);
  });
  next();
});

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ────────────────────────────────────────────────

// Health Check (required by Render)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: process.env.APP_NAME || 'Spiritual Sync', ts: new Date().toISOString() });
});
// Admin Auth Middleware
// ────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth?.replace('Bearer ', '');
  if (token === process.env.ADMIN_SECRET_KEY) {
    return next();
  }
  const adminPwd = req.headers['x-admin-password'];
  if (adminPwd === process.env.ADMIN_PASSWORD) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// ════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════


// ─── Rate limiter for /api/wisdom (1 req per 10s per IP) ─────────────────
const wisdomRateMap = new Map();
function wisdomRateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const last = wisdomRateMap.get(ip) || 0;
  if (now - last < 10000) {
    return res.status(429).json({ error: 'Please wait a moment before asking again.' });
  }
  wisdomRateMap.set(ip, now);
  if (wisdomRateMap.size > 500) {
    for (const [k, v] of wisdomRateMap) {
      if (now - v > 60000) wisdomRateMap.delete(k);
    }
  }
  next();
}

// POST /api/wisdom — Real-time Gemini AI wisdom based on user feeling
app.post('/api/wisdom', wisdomRateLimit, async (req, res) => {
  const { feeling } = req.body;
  if (!feeling || typeof feeling !== 'string' || feeling.trim().length < 3) {
    return res.status(400).json({ error: 'Please share how you are feeling.' });
  }
  if (feeling.trim().length > 500) {
    return res.status(400).json({ error: 'Please keep your message under 500 characters.' });
  }
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const userFeeling = feeling.trim();
    const prompt = [
      'You are a deeply knowledgeable spiritual guide — Bhagavad Gita, Ramayana, Upanishads, Yoga Sutras, Chanakya Niti.',
      '',
      'A person has shared how they are feeling: "' + userFeeling + '"',
      '',
      'Select the single most relevant authentic shloka from Indian scriptures for this feeling.',
      'Write a heartfelt personalized reflection for THIS specific person.',
      '',
      'Respond ONLY with valid JSON (no markdown, no code blocks, raw JSON only):',
      '{',
      '  "source": "Bhagavad Gita",',
      '  "reference": "2.47",',
      '  "shloka_devanagari": "full verse in devanagari",',
      '  "transliteration": "romanized transliteration",',
      '  "meaning": "one sentence plain English meaning",',
      '  "theme_emoji": "emoji matching the emotional theme",',
      '  "reflection": "2-3 sentences directly addressing their feeling using you language, warm and personal",',
      '  "practice": "one concrete specific action they can take TODAY for their feeling"',
      '}',
      '',
      'Rules: Use only authentic real shlokas. Address THEIR specific feeling directly. Be warm like a wise friend.'
    ].join('\n');

    const result = await model.generateContent(prompt);
    let raw = result.response.text().trim();
    if (raw.startsWith(String.fromCharCode(96, 96, 96))) {
      const lines = raw.split('\n');
      lines.shift();
      if (lines[lines.length - 1].trim() === String.fromCharCode(96, 96, 96)) lines.pop();
      raw = lines.join('\n').trim();
    }
    const wisdom = JSON.parse(raw);
    const required = ['source','reference','shloka_devanagari','transliteration','meaning','reflection','practice'];
    for (const field of required) {
      if (!wisdom[field]) throw new Error('Missing field: ' + field);
    }
    res.json({ success: true, wisdom });
  } catch (err) {
    console.error('/api/wisdom error:', err.message);
    res.status(500).json({ error: 'The universe is momentarily quiet. Please try again.' });
  }
});
// GET /api/plans — Get subscription plans
app.get('/api/plans', (req, res) => {
  const plans = Object.entries(PLANS).map(([key, val]) => ({
    id: key,
    name: val.name,
    price: val.price,
    price_display: val.price === 0 ? 'Free' : `₹${val.price / 100}`,
    days: val.days,
    description: val.description,
  }));
  res.json({ plans, razorpay_key: process.env.RAZORPAY_KEY_ID });
});

// POST /api/subscribe — Create subscription order
app.post('/api/subscribe', async (req, res) => {
  try {
    const { name, plan, preferred_hour, preferred_language, primary_source } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    // Validate
    if (!name || !email || !plan) {
      return res.status(400).json({ error: 'Name, email and plan are required' });
    }
    
    const validPlans = ['trial', 'monthly_all', 'yearly_all', 'monthly_individual', 'yearly_individual'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const hourNum = parseInt(preferred_hour);
    const validHours = [4, 5, 6, 7, 8, 12, 18, 21];
    if (!validHours.includes(hourNum)) {
      return res.status(400).json({ error: 'Invalid preferred_hour' });
    }

    const langVal = preferred_language || 'both';
    if (!['hindi', 'english', 'both'].includes(langVal)) {
      return res.status(400).json({ error: 'Invalid preferred_language' });
    }

    const sourceVal = primary_source || 'all';
    if (!['all', 'gita', 'ramayan', 'upanishad'].includes(sourceVal)) {
      return res.status(400).json({ error: 'Invalid primary_source focus' });
    }

    // Enforce: Individual plan requires selecting a single scripture focus
    const isIndividual = plan.includes('individual');
    if (isIndividual && sourceVal === 'all') {
      return res.status(400).json({ error: 'Single-scripture plan requires choosing a specific scripture focus.' });
    }

    // Check if already subscribed and active
    const existing = await subscriberQueries.findByEmail(email);
    if (existing && existing.status === 'active') {
      return res.status(409).json({ error: 'This email is already subscribed and active.' });
    }

    // Bypass payment if Razorpay is not configured or uses dummy/test keys
    const bypassPayment = !process.env.RAZORPAY_KEY_ID || 
                          process.env.RAZORPAY_KEY_ID.includes('xxxx') || 
                          process.env.RAZORPAY_KEY_ID.includes('rzp_test_xxxxxxxxxxxxxxxx');

    const planDetails = PLANS[plan];
    const isFree = planDetails ? planDetails.price === 0 : false;

    if (isFree || bypassPayment) {
      // Trial or Bypassed plan — add directly
      const token = uuidv4();
      const paidUntil = calculatePaidUntil(plan);

      await subscriberQueries.create({
        name,
        email,
        plan,
        preferred_hour: hourNum,
        paid_until: paidUntil,
        unsubscribe_token: token,
        razorpay_payment_id: bypassPayment ? 'bypass_test_payment' : null,
        razorpay_order_id: bypassPayment ? 'bypass_test_order' : null,
        status: 'active',
        preferred_language: langVal,
        primary_source: sourceVal
      });

      // Send welcome email
      const subscriber = await subscriberQueries.findByEmail(email);
      sendWelcomeEmail(subscriber).catch(console.error);
      subscriberQueries.markWelcomeSent(subscriber.id).catch(console.error);

      return res.json({
        success: true,
        isFree: true,
        message: bypassPayment ? 'Subscription active (Bypassed payment for testing) 🪷' : 'Trial started! Check your email for a welcome message.',
      });
    }

    // Create Razorpay order
    const result = await createOrder(plan, email, name);

    // Paid plan — return order details for Razorpay checkout
    res.json({
      success: true,
      isFree: false,
      order_id: result.order.id,
      amount: result.order.amount,
      currency: result.order.currency,
      plan_name: result.plan.name,
      subscriber_name: name,
      subscriber_email: email,
      preferred_hour: hourNum,
      preferred_language: langVal,
      primary_source: sourceVal,
    });

  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: err.message || 'Subscription failed' });
  }
});

// POST /api/verify-payment — Verify Razorpay payment and activate subscription
app.post('/api/verify-payment', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      name,
      plan,
      preferred_hour,
      preferred_language,
      primary_source
    } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    // Verify signature
    const isValid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Add subscriber to DB
    const token = uuidv4();
    const paidUntil = calculatePaidUntil(plan);

    // Remove old record if exists (re-subscribe)
    const existing = await subscriberQueries.findByEmail(email);
    if (existing) {
      await subscriberQueries.delete(existing.id);
    }

    await subscriberQueries.create({
      name,
      email,
      plan,
      preferred_hour: parseInt(preferred_hour),
      paid_until: paidUntil,
      unsubscribe_token: token,
      razorpay_payment_id,
      razorpay_order_id,
      status: 'active',
      preferred_language: preferred_language || 'both',
      primary_source: primary_source || 'all',
    });

    // Send welcome email
    const subscriber = await subscriberQueries.findByEmail(email);
    sendWelcomeEmail(subscriber).catch(console.error);
    subscriberQueries.markWelcomeSent(subscriber.id).catch(console.error);

    res.json({
      success: true,
      message: 'Payment verified! Welcome to Spiritual Sync 🪷',
      paid_until: paidUntil,
    });

  } catch (err) {
    console.error('Payment verify error:', err);
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// GET /api/unsubscribe — Unsubscribe endpoint
app.get('/api/unsubscribe', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const subscriber = await subscriberQueries.findByToken(token);
  if (!subscriber) return res.status(404).json({ error: 'Invalid token' });

  await subscriberQueries.unsubscribe(token);
  res.json({ success: true, message: `Unsubscribed ${subscriber.email} successfully.` });
});

// POST /api/subscriber/request-login-link — Request profile access link
app.post('/api/subscriber/request-login-link', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const subscriber = await subscriberQueries.findByEmail(email);
    if (!subscriber) {
      return res.status(404).json({ error: 'This email is not registered with us. Please check the spelling or subscribe first.' });
    }

    // Send access email with a 20-second timeout (Railway SMTP can be slow)
    const emailPromise = sendLoginLinkEmail(subscriber);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timed out. Please try again in a moment.')), 20000);
    });

    await Promise.race([emailPromise, timeoutPromise]);

    res.json({ 
      success: true, 
      message: 'Access link sent! Please check your email inbox (and spam folder) 🙏' 
    });
  } catch (err) {
    console.error('Request login link error:', err);
    res.status(500).json({ error: err.message || 'Failed to send login link. Please try again later.' });
  }
});

// GET /api/subscriber/profile — Fetch subscriber settings by token
app.get('/api/subscriber/profile', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const subscriber = await subscriberQueries.findByToken(token);
  if (!subscriber) return res.status(404).json({ error: 'Subscriber details not found.' });

  res.json({
    success: true,
    subscriber: {
      id: subscriber.id,
      name: subscriber.name,
      email: subscriber.email,
      plan: subscriber.plan,
      status: subscriber.status,
      preferred_hour: subscriber.preferred_hour,
      preferred_language: subscriber.preferred_language || 'both',
      primary_source: subscriber.primary_source || 'all',
      paid_until: subscriber.paid_until
    }
  });
});

// POST /api/subscriber/profile — Update subscriber settings by token
app.post('/api/subscriber/profile', async (req, res) => {
  const { token } = req.query;
  const { preferred_hour, preferred_language, primary_source } = req.body;
  
  if (!token) return res.status(400).json({ error: 'Token required' });

  const subscriber = await subscriberQueries.findByToken(token);
  if (!subscriber) return res.status(404).json({ error: 'Subscriber details not found.' });

  const hourNum = parseInt(preferred_hour);
  if (![4, 5, 6, 7, 8, 12, 18, 21].includes(hourNum)) {
    return res.status(400).json({ error: 'Invalid delivery time hour.' });
  }

  if (!['hindi', 'english', 'both'].includes(preferred_language)) {
    return res.status(400).json({ error: 'Invalid language preference.' });
  }

  if (!['all', 'gita', 'ramayan', 'upanishad'].includes(primary_source)) {
    return res.status(400).json({ error: 'Invalid scripture focus.' });
  }

  // If subscription is individual, primary_source cannot be 'all'
  const isIndividual = subscriber.plan.includes('individual');
  if (isIndividual && primary_source === 'all') {
    return res.status(400).json({ error: 'Single-scripture plan requires choosing a specific scripture focus.' });
  }

  await subscriberQueries.updateProfile(subscriber.id, {
    preferred_hour: hourNum,
    preferred_language,
    primary_source
  });

  res.json({ success: true, message: 'Settings saved successfully!' });
});

// GET /api/today — Get today's shloka (public preview)
app.get('/api/today', (req, res) => {
  const shloka = getTodaysShloka();
  res.json({
    shloka: {
      id: shloka.id,
      source: shloka.source,
      reference: shloka.reference,
      devanagari: shloka.devanagari,
      transliteration: shloka.transliteration,
      hindi_meaning: shloka.hindi_meaning,
      english_meaning: shloka.english_meaning,
      theme: shloka.theme,
    },
  });
});

// ════════════════════════════════════════════════
// ADMIN ROUTES (password-protected)
// ════════════════════════════════════════════════

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true, token: process.env.ADMIN_SECRET_KEY });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const today = getISTDateString();
  const [active, total, todaySent] = await Promise.all([
    subscriberQueries.countActive(),
    subscriberQueries.countTotal(),
    logQueries.getTodayCount(today),
  ]);
  const shloka = getTodaysShloka();

  res.json({
    active_subscribers: active.count,
    total_subscribers: total.count,
    emails_sent_today: todaySent.count,
    today_shloka: {
      id: shloka.id,
      reference: shloka.reference,
      source: shloka.source,
    },
  });
});

// GET /api/admin/subscribers
app.get('/api/admin/subscribers', requireAdmin, async (req, res) => {
  const subscribers = await subscriberQueries.getAll();
  res.json({ subscribers });
});

// DELETE /api/admin/subscribers/:id
app.delete('/api/admin/subscribers/:id', requireAdmin, async (req, res) => {
  await subscriberQueries.delete(parseInt(req.params.id));
  res.json({ success: true });
});

// POST /api/admin/subscribers — Manual add
app.post('/api/admin/subscribers', requireAdmin, async (req, res) => {
  try {
    const { name, plan, preferred_hour, days, preferred_language, primary_source } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    const token = uuidv4();
    const d = new Date();
    d.setDate(d.getDate() + (parseInt(days) || 30));
    const paidUntil = d.toISOString().split('T')[0];

    await subscriberQueries.manualCreate({
      name,
      email,
      plan: plan || 'monthly_all',
      preferred_hour: parseInt(preferred_hour) || 6,
      paid_until: paidUntil,
      unsubscribe_token: token,
      status: 'active',
      preferred_language: preferred_language || 'both',
      primary_source: primary_source || 'all'
    });

    res.json({ success: true, message: `${email} added successfully` });
  } catch (err) {
    console.error('❌ Admin Add Subscriber Error:', err);
    res.status(500).json({ error: err.message || String(err) || 'Internal Server Error' });
  }
});

// POST /api/admin/test-email
app.post('/api/admin/test-email', requireAdmin, async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email required' });
    const result = await triggerSendNow(email);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ Admin Test Email Error:', err);
    res.status(500).json({ error: err.message || String(err) || 'Internal Server Error' });
  }
});

// POST /api/admin/send-now
app.post('/api/admin/send-now', requireAdmin, async (req, res) => {
  try {
    const result = await triggerSendNow();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ Admin Send-Now Error:', err);
    res.status(500).json({ error: err.message || String(err) || 'Internal Server Error' });
  }
});

// GET /api/admin/logs
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
  const logs = await logQueries.getRecent();
  res.json({ logs });
});

// ────────────────────────────────────────────────
// Serve frontend for all other routes
// ────────────────────────────────────────────────
app.get('/store', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'store.html'));
});

app.get('/unsubscribe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'unsubscribe.html'));
});

app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// ────────────────────────────────────────────────
// Start Server
// ────────────────────────────────────────────────
async function start() {
  console.log('\n🪷 Spiritual Sync System Starting...\n');

  // Initialize database
  await initDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📋 Admin panel: http://localhost:${PORT}/admin`);
    console.log(`🌐 Store page: http://localhost:${PORT}/store\n`);

    // Verify Gmail connection in the background so it doesn't block startup
    verifyConnection().then(() => {
      // Start cron scheduler
      startScheduler();
    }).catch(console.error);
  });
}

start().catch(console.error);
