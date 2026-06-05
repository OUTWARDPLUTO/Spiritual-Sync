// scripts/preview-today.js — Preview today's shloka in terminal
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getTodaysShloka } = require('../scheduler');
const { getEnrichedContent } = require('../ai-enricher');

async function main() {
  console.log('\n🪷 Today\'s Shloka Preview\n' + '═'.repeat(60));

  const shloka = getTodaysShloka();

  console.log(`\n📖 Source: ${shloka.source}`);
  console.log(`📍 Reference: ${shloka.reference}`);
  console.log(`📿 Theme: ${shloka.theme}`);
  console.log('\nSanskrit:\n' + shloka.devanagari);
  console.log('\nTransliteration:\n' + shloka.transliteration);
  console.log('\nHindi:\n' + shloka.hindi_meaning);
  console.log('\nEnglish:\n' + shloka.english_meaning);

  console.log('\n' + '─'.repeat(60));
  console.log('🤖 Fetching AI enrichment...\n');

  const ai = await getEnrichedContent(shloka);
  console.log('Today\'s Reflection:\n' + ai.reflection);
  console.log('\n🌱 Practice for Today:\n"' + ai.practice + '"');
  console.log('\n' + '═'.repeat(60) + '\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
