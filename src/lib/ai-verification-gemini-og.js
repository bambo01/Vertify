import { geminiFactCheck } from '../gemini-api.ts';

export async function verifyClaimWithAI(claim) {
  try {
    const query = `Fact-check this claim:
Title: ${claim.title}
URL: ${claim.url}
Summary: ${claim.summary}

Please analyze this claim and provide:
1. A verdict (True/False/Uncertain)
2. Confidence level (0-100%)
3. Detailed reasoning
4. Sources used for verification (list URLs or publication names at the end)`;

    const response = await geminiFactCheck(query, {
      temperature: 0.1,
      max_tokens: 2000,
    });

    const answer = response.answer.toLowerCase();

    let result = 'Uncertain';
    let confidence = 50;

    if (answer.includes('true') || answer.includes('accurate') || answer.includes('verified')) {
      result = 'Truth';
      confidence = 75;
    } else if (answer.includes('false') || answer.includes('inaccurate') || answer.includes('misleading')) {
      result = 'Fake';
      confidence = 75;
    }

    if (answer.includes('highly confident') || answer.includes('strong evidence')) {
      confidence = Math.min(95, confidence + 15);
    } else if (answer.includes('uncertain') || answer.includes('unclear') || answer.includes('mixed')) {
      confidence = Math.max(40, confidence - 20);
    }

    return {
      result,
      confidence,
      reasoning: response.answer,
      sources: response.citations || [],
    };
  } catch (error) {
    console.error('AI verification failed:', error);
    return {
      result: 'Uncertain',
      confidence: 0,
      reasoning: 'AI verification failed. Please try again later.',
      sources: [],
    };
  }
}
