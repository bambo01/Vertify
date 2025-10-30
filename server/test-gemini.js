// test-gemini.js (CommonJS)
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('No GEMINI_API_KEY');

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

(async () => {
  try {
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: 'Return ONLY {"ok":true} as JSON' }] }
      ],
      generationConfig: { responseMimeType: 'application/json' }
    });

    console.log('RAW:', result.response.text());
  } catch (err) {
    console.error('Error during generation:', err);
  }
})();
