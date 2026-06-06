// emailer.js — Nodemailer + beautiful HTML email templates for Spiritual Sync
require('dotenv').config();
const nodemailer = require('nodemailer');

// Strip spaces from Gmail App Password (Gmail displays it as 'xxxx xxxx xxxx xxxx' but SMTP needs no spaces)
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_PASS = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

// Normalize BASE_URL to ensure it contains http:// or https://
const rawBaseUrl = process.env.BASE_URL || 'http://localhost:3000';
const BASE_URL = rawBaseUrl.startsWith('http') ? rawBaseUrl : `https://${rawBaseUrl}`;

// Startup diagnostics
if (!GMAIL_USER) console.error('❌ GMAIL_USER env var is missing!');
if (!GMAIL_PASS) console.error('❌ GMAIL_APP_PASSWORD env var is missing!');
else console.log(`📧 Email configured for: ${GMAIL_USER} (password: ${GMAIL_PASS.length} chars)`);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS — works on Railway (port 465 is often blocked)
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Accept self-signed certs in cloud envs
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,   // 10 seconds
  socketTimeout: 15000,     // 15 seconds
});

// Verify connection on startup
async function verifyConnection() {
  try {
    await transporter.verify();
    console.log('✅ Gmail SMTP connection verified');
    return true;
  } catch (err) {
    console.error('❌ Gmail SMTP error:', err.message);
    console.error('   → Check GMAIL_USER and GMAIL_APP_PASSWORD env vars on Railway');
    return false;
  }
}

// ────────────────────────────────────────────────
// Daily Shloka Email
// ────────────────────────────────────────────────
async function sendDailyShloka(subscriber, shloka, aiContent) {
  const unsubUrl = `${BASE_URL}/unsubscribe?token=${subscriber.unsubscribe_token}`;
  const html = buildShlokaEmailHTML(subscriber, shloka, aiContent, unsubUrl);

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Spiritual Sync 🪷'}" <${process.env.GMAIL_USER}>`,
    to: subscriber.email,
    subject: `🌸 ${shloka.source} — ${shloka.reference}`,
    html,
    text: buildPlainText(subscriber, shloka, aiContent, unsubUrl),
  };

  return transporter.sendMail(mailOptions);
}

// ────────────────────────────────────────────────
// Welcome Email
// ────────────────────────────────────────────────
async function sendWelcomeEmail(subscriber) {
  const unsubUrl = `${BASE_URL}/unsubscribe?token=${subscriber.unsubscribe_token}`;
  const timeLabel = getTimeLabel(subscriber.preferred_hour);
  const html = buildWelcomeEmailHTML(subscriber, timeLabel, unsubUrl);

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Spiritual Sync 🪷'}" <${process.env.GMAIL_USER}>`,
    to: subscriber.email,
    subject: `🙏 Welcome to Spiritual Sync, ${subscriber.name}!`,
    html,
  };

  return transporter.sendMail(mailOptions);
}

// ────────────────────────────────────────────────
// HTML Email Template — Daily Shloka
// ────────────────────────────────────────────────
function buildShlokaEmailHTML(subscriber, shloka, aiContent, unsubUrl) {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const sourceIcon = getSourceIcon(shloka.source);
  const lang = subscriber.preferred_language || 'both';

  let explanationHTML = '';
  let reflectionHTML = '';
  let practiceHTML = '';

  if (lang === 'english') {
    explanationHTML = `
      <tr>
        <td style="padding:0 32px 20px;">
          <div style="background:#F3F0FF;border-radius:10px;padding:20px;border-left:3px solid #7B68EE;">
            <div style="color:#5B21B6;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">🌍 English Explanation</div>
            <p style="margin:0;color:#2D1B6B;font-size:15px;line-height:1.8;font-style:italic;">"${shloka.english_meaning}"</p>
          </div>
        </td>
      </tr>`;
    
    const reflectionText = (aiContent.reflection_en || aiContent.reflection || '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p style="margin:0 0 12px 0;">');

    reflectionHTML = `
      <tr>
        <td style="padding:0 32px 20px;">
          <div style="background:linear-gradient(135deg,#1a2744,#2D3A6B);border-radius:12px;padding:24px;">
            <div style="color:#90CAF9;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">✨ Today's Learnings</div>
            <p style="margin:0;color:#E3F2FD;font-size:14px;line-height:1.9;">${reflectionText}</p>
          </div>
        </td>
      </tr>`;

    practiceHTML = `
      <tr>
        <td style="padding:0 32px 24px;">
          <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);border-radius:12px;padding:20px;">
            <div style="color:#A5D6A7;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">🌱 Daily Application</div>
            <p style="margin:0;color:#E8F5E9;font-size:15px;line-height:1.7;font-style:italic;">"${aiContent.practice_en || aiContent.practice}"</p>
          </div>
        </td>
      </tr>`;
  } else if (lang === 'hindi') {
    explanationHTML = `
      <tr>
        <td style="padding:0 32px 20px;">
          <div style="background:#FFF3E0;border-radius:10px;padding:20px;border-left:3px solid #FF8F00;">
            <div style="color:#E65100;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">🇮🇳 हिंदी व्याख्या</div>
            <p style="margin:0;color:#4A2800;font-size:15px;line-height:1.8;">${shloka.hindi_meaning}</p>
          </div>
        </td>
      </tr>`;
    
    const reflectionText = (aiContent.reflection_hi || aiContent.reflection || '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p style="margin:0 0 12px 0;">');

    reflectionHTML = `
      <tr>
        <td style="padding:0 32px 20px;">
          <div style="background:linear-gradient(135deg,#1a2744,#2D3A6B);border-radius:12px;padding:24px;">
            <div style="color:#90CAF9;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">✨ आज की सीख (Learnings)</div>
            <p style="margin:0;color:#E3F2FD;font-size:14px;line-height:1.9;">${reflectionText}</p>
          </div>
        </td>
      </tr>`;

    practiceHTML = `
      <tr>
        <td style="padding:0 32px 24px;">
          <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);border-radius:12px;padding:20px;">
            <div style="color:#A5D6A7;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">🌱 जीवन में उपयोग (Daily Application)</div>
            <p style="margin:0;color:#E8F5E9;font-size:15px;line-height:1.7;font-style:italic;">"${aiContent.practice_hi || aiContent.practice}"</p>
          </div>
        </td>
      </tr>`;
  } else {
    // Both
    explanationHTML = `
      <tr>
        <td style="padding:0 32px 20px;">
          <div style="background:#FFF3E0;border-radius:10px;padding:20px;border-left:3px solid #FF8F00;margin-bottom:12px;">
            <div style="color:#E65100;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">🇮🇳 हिंदी व्याख्या</div>
            <p style="margin:0;color:#4A2800;font-size:15px;line-height:1.8;">${shloka.hindi_meaning}</p>
          </div>
          <div style="background:#F3F0FF;border-radius:10px;padding:20px;border-left:3px solid #7B68EE;">
            <div style="color:#5B21B6;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">🌍 English Explanation</div>
            <p style="margin:0;color:#2D1B6B;font-size:15px;line-height:1.8;font-style:italic;">"${shloka.english_meaning}"</p>
          </div>
        </td>
      </tr>`;

    const reflectionText = (aiContent.reflection_en || aiContent.reflection || '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p style="margin:0 0 12px 0;">');

    reflectionHTML = `
      <tr>
        <td style="padding:0 32px 20px;">
          <div style="background:linear-gradient(135deg,#1a2744,#2D3A6B);border-radius:12px;padding:24px;">
            <div style="color:#90CAF9;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">✨ Today's Learnings & Reflection</div>
            <p style="margin:0;color:#E3F2FD;font-size:14px;line-height:1.9;">${reflectionText}</p>
          </div>
        </td>
      </tr>`;

    practiceHTML = `
      <tr>
        <td style="padding:0 32px 24px;">
          <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);border-radius:12px;padding:20px;">
            <div style="color:#A5D6A7;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">🌱 Practice for Today</div>
            <p style="margin:0;color:#E8F5E9;font-size:15px;line-height:1.7;font-style:italic;">"${aiContent.practice_en || aiContent.practice}"</p>
          </div>
        </td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spiritual Sync</title>
</head>
<body style="margin:0;padding:0;background:#120F0D;font-family:Georgia,serif;">

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#120F0D;padding:20px 10px;">
<tr><td align="center">

<!-- Main Card -->
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#5E1919 0%,#B88E2F 50%,#5E1919 100%);padding:32px 24px;text-align:center;">
      <div style="font-size:36px;margin-bottom:8px;">🪷</div>
      <div style="color:#FFE082;font-size:13px;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">Spiritual Sync</div>
      <div style="color:rgba(255,255,255,0.8);font-size:13px;">${today}</div>
      <div style="margin-top:12px;display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,224,130,0.4);border-radius:20px;padding:4px 16px;">
        <span style="color:#FFE082;font-size:12px;">${sourceIcon} ${shloka.reference}</span>
      </div>
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td style="padding:24px 32px 0;text-align:center;">
      <p style="margin:0;color:#5E1919;font-size:14px;letter-spacing:1px;">नमस्ते ${subscriber.name} 🙏</p>
    </td>
  </tr>

  <!-- Sanskrit Shloka -->
  <tr>
    <td style="padding:24px 32px;">
      <div style="background:linear-gradient(135deg,#FFF8E7,#FFFDF5);border:1px solid #EAD292;border-radius:12px;padding:28px;text-align:center;border-left:4px solid #B88E2F;">
        <div style="color:#5E1919;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;">॥ आज का श्लोक ॥</div>
        <div style="color:#2D1B00;font-size:22px;line-height:1.8;font-weight:bold;white-space:pre-line;">${shloka.devanagari}</div>
        <div style="border-top:1px solid #EAD292;margin:18px 0;"></div>
        <div style="color:#7C602D;font-size:14px;font-style:italic;line-height:1.8;">${shloka.transliteration}</div>
      </div>
    </td>
  </tr>

  <!-- Meaning Block -->
  ${explanationHTML}

  <!-- Divider with Om -->
  <tr>
    <td style="padding:0 32px 20px;text-align:center;">
      <div style="color:#B88E2F;font-size:24px;letter-spacing:8px;">· ॐ ·</div>
    </td>
  </tr>

  <!-- AI Reflection -->
  ${reflectionHTML}

  <!-- Practice of the Day -->
  ${practiceHTML}

  <!-- Theme Tag -->
  <tr>
    <td style="padding:0 32px 24px;text-align:center;">
      <span style="display:inline-block;background:#FFF8E7;border:1px solid #B88E2F;border-radius:20px;padding:6px 18px;color:#5E1919;font-size:12px;letter-spacing:1px;">📿 ${shloka.theme}</span>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#FFF8E7;padding:24px 32px;border-top:1px solid #EAD292;text-align:center;">
      <p style="margin:0 0 8px 0;color:#5E1919;font-size:13px;font-weight:bold;">Spiritual Sync 🪷</p>
      <p style="margin:0 0 12px 0;color:#7C602D;font-size:12px;">सत्यं वद। धर्मं चर। — Speak Truth. Walk the Path.</p>
      <p style="margin:0;font-size:11px;color:#A07850;">
        You are receiving this because you subscribed to Spiritual Sync.<br>
        <a href="${unsubUrl}" style="color:#5E1919;text-decoration:underline;">Manage Subscription</a> anytime.
      </p>
    </td>
  </tr>

</table>
<!-- End Main Card -->

</td></tr>
</table>
<!-- End Wrapper -->

</body>
</html>`;
}

// ────────────────────────────────────────────────
// Welcome Email HTML
// ────────────────────────────────────────────────
function buildWelcomeEmailHTML(subscriber, timeLabel, unsubUrl) {
  const langLabels = { hindi: 'Hindi (हिंदी)', english: 'English', both: 'Both (Hindi + English)' };
  const langLabel = langLabels[subscriber.preferred_language || 'both'];
  const srcLabels = { all: 'All Scriptures (Rotating)', gita: 'Bhagavad Gita Only', ramayan: 'Valmiki Ramayan Only', upanishad: 'Upanishads Only' };
  const srcLabel = srcLabels[subscriber.primary_source || 'all'];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#120F0D;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#120F0D;padding:20px 10px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">

  <tr>
    <td style="background:linear-gradient(135deg,#5E1919,#B88E2F,#5E1919);padding:40px 24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🪷</div>
      <h1 style="margin:0;color:#FFE082;font-size:28px;font-weight:normal;">Welcome to Spiritual Sync</h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">नमस्ते ${subscriber.name} 🙏</p>
    </td>
  </tr>

  <tr>
    <td style="padding:32px;">
      <p style="color:#4A2800;font-size:16px;line-height:1.8;margin:0 0 20px;">
        You have taken a beautiful step on the path of self-discovery and wisdom. Starting from tomorrow, you will receive your daily shloka from your chosen scriptures, customized to your time and language preferences.
      </p>

      <div style="background:#FFF8E7;border:1px solid #B88E2F;border-radius:12px;padding:20px;margin:24px 0;text-align:left;">
        <div style="color:#5E1919;font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;text-align:center;font-weight:bold;">Your Preferences</div>
        <div style="margin-bottom:8px;font-size:14px;color:#2D1B00;">⏰ <strong>Delivery Time:</strong> ${timeLabel}</div>
        <div style="margin-bottom:8px;font-size:14px;color:#2D1B00;">🌐 <strong>Preferred Language:</strong> ${langLabel}</div>
        <div style="font-size:14px;color:#2D1B00;">📖 <strong>Scripture Focus:</strong> ${srcLabel}</div>
      </div>

      <div style="background:#F3F0FF;border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="margin:0 0 10px;color:#5B21B6;font-size:13px;font-weight:bold;letter-spacing:1px;">WHAT YOU WILL RECEIVE:</p>
        <p style="margin:0;color:#2D1B6B;font-size:14px;line-height:1.9;">
          🌸 Sacred Sanskrit shloka with English transliteration<br>
          📖 Accurate explanation in your chosen language<br>
          ✨ AI-guided reflections tailored to modern life<br>
          🌱 A daily practice for immediate application
        </p>
      </div>

      <p style="color:#7C602D;font-size:13px;line-height:1.7;margin:0;text-align:center;border-top:1px solid #EAD292;padding-top:20px;">
        "सत्यमेव जयते" — Truth alone triumphs.<br>
        May this daily connection guide you toward clarity and peace.
      </p>
    </td>
  </tr>

  <tr>
    <td style="background:#FFF8E7;padding:20px 32px;border-top:1px solid #EAD292;text-align:center;">
      <p style="margin:0;color:#A07850;font-size:11px;">
        Spiritual Sync 🪷 | <a href="${unsubUrl}" style="color:#5E1919;text-decoration:underline;">Manage Subscription</a>
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ────────────────────────────────────────────────
// Plain text fallback
// ────────────────────────────────────────────────
function buildPlainText(subscriber, shloka, aiContent, unsubUrl) {
  const lang = subscriber.preferred_language || 'both';
  let reflectionText = aiContent.reflection_en || aiContent.reflection;
  let practiceText = aiContent.practice_en || aiContent.practice;
  let meaningText = `Hindi Meaning:\n${shloka.hindi_meaning}\n\nEnglish Translation:\n"${shloka.english_meaning}"`;

  if (lang === 'english') {
    reflectionText = aiContent.reflection_en || aiContent.reflection;
    practiceText = aiContent.practice_en || aiContent.practice;
    meaningText = `English Translation:\n"${shloka.english_meaning}"`;
  } else if (lang === 'hindi') {
    reflectionText = aiContent.reflection_hi || aiContent.reflection;
    practiceText = aiContent.practice_hi || aiContent.practice;
    meaningText = `Hindi Meaning:\n${shloka.hindi_meaning}`;
  }

  return `Namaste ${subscriber.name} 🙏

TODAY'S SHLOKA — ${shloka.reference}
${'─'.repeat(50)}

${shloka.devanagari}

Transliteration:
${shloka.transliteration}

${meaningText}

─────────────────────────────────────────

Today's Reflection:
${reflectionText}

Practice for Today:
"${practiceText}"

Theme: ${shloka.theme}

─────────────────────────────────────────
Spiritual Sync 🪷
To manage your subscription: ${unsubUrl}
`;
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
function getSourceIcon(source) {
  const icons = {
    'Bhagavad Gita': '📖',
    'Valmiki Ramayan': '🏹',
    'Ramcharitmanas': '🪷',
    'Isha Upanishad': '🕉️',
    'Brihadaranyaka Upanishad': '🕉️',
    'Katha Upanishad': '🕉️',
    'Chandogya Upanishad': '🕉️',
    'Mundaka Upanishad': '🕉️',
    'Taittiriya Upanishad': '🕉️',
    'Mandukya Upanishad': '🕉️',
    'Chanakya Niti': '🦁',
    'Yoga Sutras of Patanjali': '🧘',
  };
  return icons[source] || '📿';
}

function getTimeLabel(hour) {
  const labels = {
    4: '4:00 AM — Brahma Muhurta ✨',
    5: '5:00 AM — Early Morning 🌙',
    6: '6:00 AM — Sunrise 🌅',
    7: '7:00 AM — Morning 🌄',
    8: '8:00 AM — Late Morning ☀️',
    12: '12:00 PM — Noon 🌞',
    18: '6:00 PM — Evening 🌇',
    21: '9:00 PM — Night 🌙',
  };
  return labels[hour] || `${hour}:00 daily`;
}

// ────────────────────────────────────────────────
// Login Link Email
// ────────────────────────────────────────────────
async function sendLoginLinkEmail(subscriber) {
  const linkUrl = `${BASE_URL}/unsubscribe?token=${subscriber.unsubscribe_token}`;
  const html = buildLoginLinkEmailHTML(subscriber, linkUrl);

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Spiritual Sync 🪷'}" <${process.env.GMAIL_USER}>`,
    to: subscriber.email,
    subject: `🪷 Access Your Spiritual Sync Profile`,
    html,
  };

  return transporter.sendMail(mailOptions);
}

function buildLoginLinkEmailHTML(subscriber, linkUrl) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spiritual Sync Profile Access</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Inter:wght@400;600&display=swap');
    body { font-family: 'Inter', sans-serif; background: #0A0807; margin:0; padding:0; color: rgba(251,248,243,0.9); }
  </style>
</head>
<body style="background-color:#0A0807; font-family:'Inter',sans-serif; margin:0; padding:40px 10px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" align="center">
    <tr>
      <td>
        <table width="600" cellpadding="0" cellspacing="0" align="center" style="max-width:600px;width:100%;background:#120F0D;border:1px solid rgba(184,142,47,0.18);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
          <tr>
            <td style="background:linear-gradient(135deg,#5E1919,#B88E2F,#5E1919);padding:40px 24px;text-align:center;">
              <div style="font-size:48px;margin-bottom:12px;">🪷</div>
              <h1 style="margin:0;color:#EAD292;font-size:28px;font-weight:normal;font-family:'Cormorant Garamond',serif;letter-spacing:1px;">Spiritual Sync</h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">Profile Access Link 🙏</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px;background:#120F0D;">
              <p style="color:#FBF8F3;font-size:16px;line-height:1.8;margin:0 0 20px;">
                Namaste <strong>${subscriber.name}</strong>,
              </p>
              <p style="color:rgba(251,248,243,0.7);font-size:15px;line-height:1.8;margin:0 0 32px;">
                We received a request to access your Spiritual Sync subscriber settings. 
                Using the link below, you can view your profile, adjust your daily delivery hour, change your language preference, choose your scripture focus, or manage your subscription status.
              </p>
              
              <div style="text-align:center;margin:36px 0;">
                <a href="${linkUrl}" style="background:#B88E2F;color:#120F0D;padding:16px 36px;border-radius:30px;font-weight:bold;text-decoration:none;font-size:16px;display:inline-block;box-shadow:0 10px 25px rgba(184,142,47,0.25);transition:all 0.3s;letter-spacing:0.5px;">
                  Access Settings & Profile 🪷
                </a>
              </div>
              
              <p style="color:rgba(251,248,243,0.4);font-size:13px;line-height:1.8;margin:32px 0 0;text-align:center;border-top:1px solid rgba(184,142,47,0.1);padding-top:24px;">
                If you did not request this email, you can safely ignore it. Your profile link is unique and secure.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#0F0D0C;padding:20px 32px;border-top:1px solid rgba(184,142,47,0.1);text-align:center;">
              <p style="margin:0;color:rgba(251,248,243,0.3);font-size:12px;">
                Spiritual Sync 🪷 | Connecting Ancient Wisdom to Modern Souls
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { sendDailyShloka, sendWelcomeEmail, sendLoginLinkEmail, verifyConnection, getTimeLabel };
