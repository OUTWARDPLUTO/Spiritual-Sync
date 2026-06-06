// scheduler.js — Hourly cron job for sending daily shlokas
require('dotenv').config();
const cron = require('node-cron');
const path = require('path');
const { subscriberQueries, logQueries, getISTDateString, getDayOfYear } = require('./database');
const { sendDailyShloka } = require('./emailer');
const { getEnrichedContent } = require('./ai-enricher');

// Load shloka database
const shlokasData = require('./content/shlokas.json');
const shlokas = shlokasData.shlokas;

// Filter shlokas by scripture category
const gitaShlokas = shlokas.filter(s => s.source === 'Bhagavad Gita');
const ramayanShlokas = shlokas.filter(s => s.source === 'Valmiki Ramayan' || s.source === 'Ramcharitmanas');
const upanishadShlokas = shlokas.filter(s => 
  s.source.includes('Upanishad') || 
  s.source.includes('Isha') || 
  s.source.includes('Katha') || 
  s.source.includes('Mundaka') || 
  s.source.includes('Mandukya') || 
  s.source.includes('Chandogya') || 
  s.source.includes('Brihadaranyaka') || 
  s.source.includes('Taittiriya')
);

/**
 * Get today's shloka based on day of year (cycles through all shlokas)
 */
function getTodaysShloka() {
  const dayOfYear = getDayOfYear();
  const index = dayOfYear % shlokas.length;
  return shlokas[index];
}

/**
 * Resolve the scripture shloka based on subscriber selection
 */
function getSubscriberShloka(subscriber) {
  const dayOfYear = getDayOfYear();
  const source = subscriber.primary_source || 'all';

  if (source === 'gita') {
    if (gitaShlokas.length > 0) {
      return gitaShlokas[dayOfYear % gitaShlokas.length];
    }
  } else if (source === 'ramayan') {
    if (ramayanShlokas.length > 0) {
      return ramayanShlokas[dayOfYear % ramayanShlokas.length];
    }
  } else if (source === 'upanishad') {
    if (upanishadShlokas.length > 0) {
      return upanishadShlokas[dayOfYear % upanishadShlokas.length];
    }
  }

  // Fallback: cycle through all scriptures rotating
  return shlokas[dayOfYear % shlokas.length];
}

/**
 * Main send job — runs for subscribers at a given IST hour
 */
async function runSendJob(istHour) {
  const todayIST = getISTDateString();
  console.log(`\n⏰ Running send job for ${istHour}:00 IST on ${todayIST}`);

  // Expire old subscriptions
  await subscriberQueries.expireOld();

  // Get active subscribers for this hour
  const subscribers = await subscriberQueries.getActiveForHour(istHour);
  console.log(`📋 Found ${subscribers.length} active subscriber(s) for this hour`);

  if (subscribers.length === 0) return { successCount: 0, failCount: 0 };

  // Send emails
  let successCount = 0;
  let failCount = 0;

  for (const subscriber of subscribers) {
    // Skip if already sent today (double-check)
    const alreadySent = await subscriberQueries.alreadySentToday(subscriber.id, todayIST);
    if (alreadySent) {
      console.log(`  ⏭️ Skipping ${subscriber.email} — already sent today`);
      continue;
    }

    const shloka = getSubscriberShloka(subscriber);
    console.log(`📖 Picked shloka #${shloka.id} (${shloka.reference}) for ${subscriber.email} (Source: ${subscriber.primary_source}, Lang: ${subscriber.preferred_language})`);

    // Get AI enrichment
    let aiContent;
    try {
      aiContent = await getEnrichedContent(shloka);
    } catch (err) {
      console.error('AI enrichment failed, using fallback:', err.message);
      aiContent = {
        reflection_en: 'May this timeless shloka bring peace and wisdom to your day.',
        reflection_hi: 'यह श्लोक आपके दिन में शांति और सकारात्मक ऊर्जा लेकर आए।',
        practice_en: 'Pause for one moment of stillness and read this shloka again with full attention.',
        practice_hi: 'एक पल के लिए शांत हो जाएं और इस श्लोक को ध्यानपूर्वक दोबारा पढ़ें।',
        reflection: 'May this timeless shloka bring peace and wisdom to your day.',
        practice: 'Pause for one moment of stillness and read this shloka again with full attention.',
      };
    }

    try {
      await sendDailyShloka(subscriber, shloka, aiContent);

      await logQueries.record({
        subscriber_id: subscriber.id,
        shloka_id: shloka.id,
        ist_date: todayIST,
        status: 'sent',
        error_message: null,
      });

      successCount++;
      console.log(`  ✅ Sent to: ${subscriber.email}`);

      // Rate limiting: 1 second between emails
      await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      failCount++;
      console.error(`  ❌ Failed for ${subscriber.email}:`, err.message);

      await logQueries.record({
        subscriber_id: subscriber.id,
        shloka_id: shloka.id,
        ist_date: todayIST,
        status: 'failed',
        error_message: err.message,
      });
    }
  }

  console.log(`\n📊 Send job complete — ✅ ${successCount} sent, ❌ ${failCount} failed\n`);
  return { successCount, failCount };
}

/**
 * Start the cron scheduler
 */
function startScheduler() {
  console.log('🕉️  Spiritual Sync Scheduler started');
  console.log('⏰  Checking for subscribers every hour (IST boundary)');

  cron.schedule('30 * * * *', async () => {
    // Compute current IST hour
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset);
    const istHour = ist.getUTCHours();

    await runSendJob(istHour);
  }, {
    timezone: 'UTC',
  });

  console.log('✅ Scheduler initialized. Next fire: top of next UTC :30');
}

// ────────────────────────────────────────────────
// Manual trigger (for testing from server.js)
// ────────────────────────────────────────────────
async function triggerSendNow(targetEmail = null) {
  const todayIST = getISTDateString();

  if (targetEmail) {
    const subscriber = await subscriberQueries.findByEmail(targetEmail);
    const mockSub = subscriber || {
      id: 0,
      name: 'Admin',
      email: targetEmail,
      unsubscribe_token: 'test-token',
      preferred_language: 'both',
      primary_source: 'all',
      preferred_hour: 6
    };
    
    // Choose a random shloka for testing so that subsequent test mails send different teachings
    const source = mockSub.primary_source || 'all';
    let pool = shlokas;
    if (source === 'gita' && gitaShlokas.length > 0) pool = gitaShlokas;
    else if (source === 'ramayan' && ramayanShlokas.length > 0) pool = ramayanShlokas;
    else if (source === 'upanishad' && upanishadShlokas.length > 0) pool = upanishadShlokas;

    const randomIdx = Math.floor(Math.random() * pool.length);
    const shloka = pool[randomIdx];
    const aiContent = await getEnrichedContent(shloka);
    
    await sendDailyShloka(mockSub, shloka, aiContent);
    return { message: `Test email sent to ${targetEmail}`, shloka: shloka.reference };
  }

  // Send to all currently-due subscribers (manual force)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const istHour = ist.getUTCHours();
  return runSendJob(istHour);
}

module.exports = { startScheduler, getTodaysShloka, triggerSendNow, getSubscriberShloka };
