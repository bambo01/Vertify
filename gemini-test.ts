import 'dotenv/config';
console.log('Using Gemini key:', process.env.GEMINI_API_KEY?.slice(0, 8) + '...');

import { geminiFactCheck } from './src/gemini-api';

(async () => {
  try {
    const res = await geminiFactCheck('The Earth is flat.', { temperature: 0.1 });
    console.log('✅ Gemini working:\n', res.answer);
  } catch (err: any) {
    console.error('❌ Gemini test failed:', err.message);
  }
})();
