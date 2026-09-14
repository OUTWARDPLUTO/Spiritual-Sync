// ai-enricher.js — Google Gemini AI integration for daily reflections (Bilingual support)
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { cacheQueries, getISTDateString } = require('./database');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate an AI-enriched reflection for today's shloka (Bilingual)
 * Uses caching so the API is only called once per shloka per day
 */
async function getEnrichedContent(shloka) {
  const todayIST = getISTDateString();

  // Check cache first
  const cached = await cacheQueries.get(shloka.id, todayIST);
  if (cached) {
    console.log(`📦 Using cached AI content for shloka #${shloka.id}`);
    return {
      reflection_en: cached.ai_reflection_en || cached.ai_reflection,
      reflection_hi: cached.ai_reflection_hi || cached.ai_reflection,
      practice_en: cached.ai_practice_en || cached.ai_practice,
      practice_hi: cached.ai_practice_hi || cached.ai_practice,
      reflection: cached.ai_reflection_en || cached.ai_reflection,
      practice: cached.ai_practice_en || cached.ai_practice,
    };
  }

  try {
    console.log(`🤖 Generating Bilingual AI content for shloka #${shloka.id}...`);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.7-flash' }, { timeout: 15000 });

    const prompt = `You are a spiritual guide helping modern people connect with ancient Indian wisdom.

Given this shloka from ${shloka.source} (${shloka.reference}):

Sanskrit: ${shloka.devanagari}
English meaning: ${shloka.english_meaning}
Theme: ${shloka.theme}

Please provide:
1. An English reflection (2 paragraphs) on how this applies to modern life, and a one-sentence daily practice tip in English.
2. A Hindi reflection (2 paragraphs) on how this applies to modern life, and a one-sentence daily practice tip in Hindi.

Format your response EXACTLY as:
REFLECTION_EN:
[your English reflection here]

PRACTICE_EN:
[your English practice here]

REFLECTION_HI:
[your Hindi reflection here]

PRACTICE_HI:
[your Hindi practice here]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse the response
    const reflectionEnMatch = text.match(/REFLECTION_EN:\s*([\s\S]*?)(?=PRACTICE_EN:|$)/i);
    const practiceEnMatch   = text.match(/PRACTICE_EN:\s*([\s\S]*?)(?=REFLECTION_HI:|$)/i);
    const reflectionHiMatch = text.match(/REFLECTION_HI:\s*([\s\S]*?)(?=PRACTICE_HI:|$)/i);
    const practiceHiMatch   = text.match(/PRACTICE_HI:\s*([\s\S]*?)$/i);

    const reflection_en = reflectionEnMatch ? reflectionEnMatch[1].trim() : generateFallbackReflection(shloka, 'english');
    const practice_en   = practiceEnMatch ? practiceEnMatch[1].trim() : generateFallbackPractice(shloka, 'english');
    const reflection_hi = reflectionHiMatch ? reflectionHiMatch[1].trim() : generateFallbackReflection(shloka, 'hindi');
    const practice_hi   = practiceHiMatch ? practiceHiMatch[1].trim() : generateFallbackPractice(shloka, 'hindi');

    // Cache the result
    await cacheQueries.set({
      shloka_id: shloka.id,
      ist_date: todayIST,
      ai_reflection_en: reflection_en,
      ai_reflection_hi: reflection_hi,
      ai_practice_en: practice_en,
      ai_practice_hi: practice_hi,
      ai_reflection: reflection_en,
      ai_practice: practice_en,
    });

    return {
      reflection_en,
      reflection_hi,
      practice_en,
      practice_hi,
      reflection: reflection_en,
      practice: practice_en,
    };

  } catch (error) {
    console.error('⚠️ Gemini API error:', error.message);
    const reflection_en = generateFallbackReflection(shloka, 'english');
    const practice_en   = generateFallbackPractice(shloka, 'english');
    const reflection_hi = generateFallbackReflection(shloka, 'hindi');
    const practice_hi   = generateFallbackPractice(shloka, 'hindi');

    return {
      reflection_en,
      reflection_hi,
      practice_en,
      practice_hi,
      reflection: reflection_en,
      practice: practice_en,
    };
  }
}

// ────────────────────────────────────────────────
// Fallback content if Gemini API fails
// ────────────────────────────────────────────────
function generateFallbackReflection(shloka, lang = 'english') {
  if (lang === 'hindi') {
    const reflections = {
      'Karma, Duty, Detachment': 'भगवद गीता की यह शाश्वत सीख हमें याद दिलाती है कि हमारा असली अधिकार हमारे प्रयासों में है, न कि परिणामों को नियंत्रित करने में। जब हम बिना किसी लालसा के अपना काम पूरी निष्ठा से करते हैं, तो हमें एक गहरी शांति और मानसिक स्वतंत्रता मिलती है।',
      'Soul, Immortality, Eternal Nature': 'हमारी व्यस्त आधुनिक जीवनशैली में हम अक्सर खुद को अपनी भूमिकाओं, शरीर और परिस्थितियों से इतना जोड़ लेते हैं कि हम अपने वास्तविक स्वरूप को भूल जाते हैं। यह श्लोक याद दिलाता है कि आप जन्म और मृत्यु से परे एक शाश्वत चेतना हैं।',
      'Devotion, Divine Grace, Surrender': 'समर्पण का अर्थ हार मानना नहीं है, बल्कि ईश्वर की अनंत शक्ति पर विश्वास करना है। जब हम "मैं ही सब कुछ नियंत्रित करता हूँ" के अहंकार को छोड़ देते हैं, तो जीवन में असीम दिव्यता और शांति का प्रवेश होता है।',
      default: 'ये प्राचीन शब्द समय से परे हैं। आज जब आप इस श्लोक को पढ़ें, तो इसके अर्थ को अपने भीतर महसूस करें। प्राचीन ज्ञान मौन में बात करता है और जो ध्यान से सुनता है उसे सही मार्गदर्शन मिलता है।'
    };
    return reflections[shloka.theme] || reflections.default;
  } else {
    const reflections = {
      'Karma, Duty, Detachment': 'This teaching from the Bhagavad Gita reminds us that our true power lies in the quality of our effort, not in controlling outcomes. When we focus on doing our best work — with full dedication and without obsessing over results — we find a deep freedom. The anxiety of "will I succeed?" melts away, replaced by the clarity of "am I doing my best?"',
      'Soul, Immortality, Eternal Nature': 'In our frantic modern lives, we often identify so deeply with our roles, our bodies, and our circumstances that we forget our deeper nature. This shloka is a gentle reminder: you are not just this physical form. You are something much more ancient, much more vast — a consciousness that was never born and will never truly die.',
      'Devotion, Divine Grace, Surrender': 'Surrender does not mean giving up. It means trusting something larger than our individual ego. When we release the tight grip of "I must control everything," a profound grace enters. Our burdens lighten. Solutions appear. This is the miracle of trust — in the universe, in dharma, in the divine.',
      default: 'These ancient words carry wisdom that transcends time. As you read this shloka today, let it settle quietly in your heart. Ancient wisdom does not shout — it whispers. And those who listen carefully will find guidance perfectly suited to exactly where they are in their journey.',
    };
    return reflections[shloka.theme] || reflections.default;
  }
}

function generateFallbackPractice(shloka, lang = 'english') {
  if (lang === 'hindi') {
    const practices = [
      'आज कोई भी कार्य शुरू करने से पहले, एक गहरी सांस लें और अपने प्रयासों को बिना किसी फल की लालसा के समर्पित करें।',
      'आज 5 मिनट मौन में बिताएं, और अपने विचारों को बिना किसी निर्णय के एक बहते हुए बादल की तरह देखें।',
      'आज किसी भी बातचीत में तुरंत प्रतिक्रिया देने के बजाय धैर्यपूर्वक और दयालुता से जवाब दें।',
      'आज डायरी में एक ऐसी बात लिखें जिसके लिए आप आभारी हैं और एक ऐसी बात जिसे आप आज छोड़ना (release) चाहते हैं।',
      'आज किसी एक काम को पूर्ण रूप से केंद्रित होकर करें, बिना फोन देखे या किसी अन्य विचार में खोए।'
    ];
    return practices[shloka.id % practices.length];
  } else {
    const practices = [
      'Before starting any task today, take one deep breath and mentally offer your effort without attachment to the result.',
      'Spend 5 minutes in silence today, observing your thoughts without judgement, like watching clouds pass across an open sky.',
      'Choose one interaction today where you respond with kindness instead of reaction — notice how it changes the energy around you.',
      'Write down one thing you are grateful for and one thing you will release your attachment to today.',
      'Begin one task today with complete focus, giving it your full presence without checking your phone or thinking of other things.',
    ];
    return practices[shloka.id % practices.length];
  }
}

module.exports = { getEnrichedContent };
