const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'AI Text Summarizer API is running ✅ (Gemini)' });
});

// ─── Summarize Route ──────────────────────────────────────────────────────────
app.post('/summarize', async (req, res) => {
  const { text, length, tone } = req.body;

  // Validation
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required.' });
  }

  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount < 20) {
    return res.status(400).json({
      error: `Your text is only ${wordCount} words. Please provide at least 20 words.`,
    });
  }

  // Build prompt
  const lengthGuide = {
    short:    '2-3 sentences only',
    medium:   'one concise paragraph (4-6 sentences)',
    detailed: '3-4 paragraphs covering all key points',
  };

  const toneGuide = {
    neutral: 'neutral and objective',
    formal:  'formal and professional',
    simple:  'simple language suitable for a 10-year-old',
    bullet:  'bullet points (use • for each point, one per line)',
  };

  const selectedLength = lengthGuide[length] || lengthGuide['medium'];
  const selectedTone   = toneGuide[tone]   || toneGuide['neutral'];

  const prompt = `You are an expert summarizer. Summarize the text below.

Rules:
- Length: ${selectedLength}
- Tone/Style: ${selectedTone}
- Capture only the most important ideas
- Do NOT add any preamble like "Here is a summary..." — output ONLY the summary itself

Text to summarize:
"""
${text}
"""`;

  const generateWithRetry = async (prompt, maxRetries = 3) => {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await model.generateContent(prompt);
      } catch (err) {
        const isTransient = err.message?.includes('503') || err.message?.includes('500') || err.message?.includes('overloaded');
        if (isTransient && attempt < maxRetries) {
          const delayMs = attempt * 1000; // 1s, 2s, 3s
          console.warn(`Gemini transient error (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        throw err;
      }
    }
  };

  try {
    const result  = await generateWithRetry(prompt);
    const summary = result.response.text();

    const inputWords  = wordCount;
    const outputWords = summary.trim().split(/\s+/).length;
    const reduction   = Math.round((1 - outputWords / inputWords) * 100);

    res.json({
      summary,
      stats: {
        inputWords,
        outputWords,
        reduction: reduction > 0 ? `${reduction}%` : '0%',
      },
    });

  } catch (err) {
    console.error('Gemini API Error:', err.message);

    if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('401')) {
      return res.status(401).json({ error: 'Invalid Gemini API key. Check your .env file.' });
    }
    if (err.message?.includes('429') || err.message?.includes('quota')) {
      return res.status(429).json({ error: 'Rate limit hit. Please wait a moment and try again.' });
    }

    res.status(500).json({ error: 'Something went wrong: ' + err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`🤖 Using: Google Gemini API (gemini-3.5-flash-lite)`);
  console.log(`📋 Test: GET http://localhost:${PORT}\n`);
});