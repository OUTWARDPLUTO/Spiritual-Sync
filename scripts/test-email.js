// scripts/test-email.js — Send a test email
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sendDailyShloka, verifyConnection } = require('../emailer');
const { getEnrichedContent } = require('../ai-enricher');
const shlokas = require('../content/shlokas.json');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/test-email.js your@email.com');
    process.exit(1);
  }

  console.log('🔍 Verifying Gmail connection...');
  const ok = await verifyConnection();
  if (!ok) {
    console.error('❌ Gmail connection failed. Check your .env file.');
    process.exit(1);
  }

  const shloka = shlokas.shlokas[0]; // Always use first shloka for testing
  console.log(`📖 Using shloka: ${shloka.reference}`);

  const aiContent = await getEnrichedContent(shloka);
  console.log('✨ AI content generated');

  const testSub = {
    id: 0,
    name: 'Test User',
    email,
    unsubscribe_token: 'test-unsubscribe-token',
  };

  await sendDailyShloka(testSub, shloka, aiContent);
  console.log(`✅ Test email sent to ${email}`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
