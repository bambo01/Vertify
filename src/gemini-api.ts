/**
 * Gemini 2.5 API Service — FINAL working version
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GeminiChatResponse {
  answer: string;
  citations: string[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

async function _proxyGemini(body: any): Promise<any> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${err}`);
  }

  return res.json();
}

export async function geminiFactCheck(
  claim: string,
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<GeminiChatResponse> {
  if (!claim || typeof claim !== 'string') throw new Error('claim string is REQUIRED');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a fact-checking assistant. Analyze claims carefully, provide evidence-based responses, and cite reliable sources if available.',
    },
    { role: 'user', content: claim },
  ];

  const formattedMessages = messages.map((msg) => ({
    role: msg.role === 'system' ? 'user' : msg.role === 'assistant' ? 'model' : msg.role,
    parts: [{ text: msg.content }],
  }));

  const data = await _proxyGemini({
    contents: formattedMessages,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.max_tokens ?? 2048,
    },
  });

  const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return {
    answer,
    citations: [],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    model: 'gemini-2.5-pro',
  };
}
