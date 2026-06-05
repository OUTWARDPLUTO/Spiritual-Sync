# 🪷 Daily Shloka — Setup Guide

> Automatic daily shlokas from Bhagavad Gita, Ramayan & Upanishads with AI-powered reflections — delivered to paying subscribers at their chosen time.

---

## 📋 Before You Start — Get These 4 Things

### 1. 📧 Gmail App Password (2 min)
1. Go to your **Gmail account** → Settings (gear icon)
2. Click **"See all settings"** → **"Security"** tab
3. Enable **2-Step Verification** if not already done
4. Search for **"App passwords"** → Click it
5. Select app: **"Mail"**, device: **"Windows Computer"**
6. Click **Generate** → Copy the 16-character password
7. Put it in your `.env` as `GMAIL_APP_PASSWORD`

### 2. 💳 Razorpay Keys (5 min)
1. Go to [razorpay.com](https://razorpay.com) → Sign Up (free)
2. Complete basic KYC (PAN + bank details for live mode)
3. Go to **Settings → API Keys → Generate Test Key**
4. Copy **Key ID** and **Key Secret**
5. Put them in `.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
6. ⚠️ Use **Test Mode** keys first to verify everything works!

### 3. 🤖 Gemini API Key (2 min)
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with Google
3. Click **"Get API key"** → **"Create API key"**
4. Copy the key → put in `.env` as `GEMINI_API_KEY`

### 4. ☁️ Railway Account (5 min)
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. You'll deploy here after testing locally

---

## 🚀 Local Setup

### Step 1 — Install Node.js
Download from [nodejs.org](https://nodejs.org) (LTS version) if not installed.

### Step 2 — Install dependencies
```bash
cd "d:\AI_Project\geeta concept"
npm install
```

### Step 3 — Configure environment
```bash
# Copy the template
copy .env.example .env
# Now edit .env with your actual keys (use Notepad or VS Code)
```

Edit `.env` — fill in ALL values:
```env
PORT=3000
BASE_URL=http://localhost:3000  # Change to your Railway URL after deploy

GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

RAZORPAY_KEY_ID=rzp_test_xxx...  # Use TEST keys first!
RAZORPAY_KEY_SECRET=xxx...
RAZORPAY_WEBHOOK_SECRET=any-random-string

GEMINI_API_KEY=AIzaSy...

ADMIN_PASSWORD=choose-a-strong-password
ADMIN_SECRET_KEY=any-long-random-string-here
```

### Step 4 — Test your email
```bash
node scripts/test-email.js your@email.com
```
✅ If you receive a beautiful shloka email — Gmail is working!

### Step 5 — Preview today's shloka
```bash
node scripts/preview-today.js
```

### Step 6 — Start the server
```bash
npm run dev
```

Open your browser:
- 🌐 **Public Site**: http://localhost:3000
- 🎛️ **Admin Panel**: http://localhost:3000/admin

---

## 🌐 Deploy to Railway (Go Live!)

### Step 1 — Create a Railway project
1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **"Deploy from GitHub repo"**
3. Connect your GitHub and push this project to a repo
4. Railway will auto-detect Node.js

### Step 2 — Add environment variables
In Railway dashboard → Your service → **Variables** tab:
- Add all variables from your `.env` file
- Change `BASE_URL` to your Railway URL (e.g., `https://daily-shloka.up.railway.app`)
- Change Razorpay keys to **LIVE** keys when ready

### Step 3 — Deploy
Railway will automatically build and deploy. Your app is live! 🎉

### Step 4 — Switch to Live Razorpay
1. In Razorpay dashboard → Complete full KYC
2. Generate **Live Mode** keys
3. Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Railway variables
4. Also update `RAZORPAY_KEY_ID` in your public `app.js` → `/api/plans` returns it automatically ✅

---

## 📁 Project Structure

```
geeta concept/
├── server.js          ← Express API (main entry)
├── scheduler.js       ← Hourly cron job
├── emailer.js         ← Beautiful HTML emails
├── database.js        ← SQLite setup & queries
├── ai-enricher.js     ← Gemini AI integration
├── razorpay.js        ← Payment processing
├── .env               ← Your secrets (never commit!)
├── .env.example       ← Template (safe to commit)
├── content/
│   └── shlokas.json   ← 48 curated shlokas
├── data/
│   └── shloka.db      ← SQLite database (auto-created)
├── scripts/
│   ├── test-email.js  ← Test your email config
│   └── preview-today.js
└── public/
    ├── index.html     ← Subscribe landing page
    ├── style.css      ← Beautiful saffron theme
    ├── app.js         ← Frontend logic
    ├── success.html   ← Post-payment page
    ├── unsubscribe.html
    └── admin/
        ├── index.html ← Admin dashboard
        └── admin.js
```

---

## 🎛️ Admin Panel Features

Access at `/admin` with your `ADMIN_PASSWORD`:

| Feature | Description |
|---|---|
| 📊 Overview | Active subscribers, emails sent today, today's shloka |
| 👥 Subscribers | View all subscribers, status, delivery time, delete |
| 📧 Test Email | Send today's shloka to any email |
| ⚡ Force Send | Trigger send for current-hour subscribers |
| 📋 Logs | History of all sent emails |
| ➕ Add Manually | Add subscribers without payment (free access) |

---

## ⏰ How the Scheduler Works

- Runs every hour at **UTC :30** (= **IST :00**, i.e., on every IST hour boundary)
- Finds active subscribers whose `preferred_hour` matches current IST hour
- Gets today's shloka (rotates through all 48 shlokas by day of year)
- Calls Gemini AI once per shloka per day (cached)
- Sends emails with 1-second delay between each (Gmail rate limit safety)
- Logs every send to the database

**Available Delivery Times (IST):**
- 4:00 AM — Brahma Muhurta ✨
- 5:00 AM — Early Morning ⭐
- 6:00 AM — Sunrise 🌅
- 7:00 AM — Morning 🌄
- 8:00 AM — Late Morning ☀️
- 12:00 PM — Noon 🌞
- 6:00 PM — Evening 🌇
- 9:00 PM — Night 🌙

---

## 💰 Subscription Plans

| Plan | Price | Duration | Notes |
|---|---|---|---|
| Free Trial | ₹0 | 7 days | No payment needed |
| Monthly | ₹49 | 30 days | |
| Yearly | ₹399 | 365 days | ~67% off |

Change prices in `.env`:
```env
PRICE_MONTHLY=4900   # in paise (₹49 = 4900 paise)
PRICE_YEARLY=39900   # ₹399
PRICE_TRIAL_DAYS=7
```

---

## 🔧 Troubleshooting

| Problem | Solution |
|---|---|
| Gmail auth error | Make sure 2FA is enabled and you're using App Password, NOT regular password |
| Razorpay error | Check Key ID matches (test vs live). Check signature secret |
| AI fails | Check Gemini API key. System uses fallback content if AI fails |
| Emails not sending | Check Railway logs. Verify `BASE_URL` is your actual Railway URL |
| SQLite error | Delete `data/shloka.db` and restart — it will recreate |

---

## 📞 Support

Built with ❤️ and devotion.
**सत्यमेव जयते** — Truth alone triumphs. 🙏
