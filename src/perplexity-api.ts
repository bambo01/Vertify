/**
 * ================================================================================
 * DO NOT MODIFY THIS FILE. This file is READ ONLY and is DETERMINISTIC.
 *
 * Perplexity AI API Service — Strict, Explicit, and Typed API
 *
 * CRITICAL IMPLEMENTATION NOTES:
 * - Always validate model and messages parameters (required for all chat functions)
 * - Handle streaming responses appropriately when stream=true
 * - Always validate the presence of citations in responses
 * - Use proper secret injection through proxy pattern
 * - Validate response structure before accessing nested properties
 * - Remember that responses include both content and source citations
 *
 * DO NOT alter the file or function contracts.
 * Any changes void determinism, auditability, and may break system contracts.
 * ================================================================================
 */

export type PerplexityModel = 'sonar' | 'sonar-pro';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PerplexityChatRequest {
  model: PerplexityModel; // REQUIRED!
  messages: ChatMessage[]; // REQUIRED!
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface PerplexityUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface PerplexityChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length';
}

export interface PerplexityChatResponse {
  id: string;
  model: string;
  created: number;
  usage: PerplexityUsage;
  citations: string[];
  choices: PerplexityChatChoice[];
}

export interface PerplexityStreamChunk {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: 'stop' | 'length' | null;
  }>;
  citations?: string[];
}

export interface PerplexityResearchOptions {
  temperature?: number;
  max_tokens?: number;
  focus_domains?: string[];
}

export interface PerplexityResearchResponse {
  answer: string;
  citations: string[];
  usage: PerplexityUsage;
  model: string;
}

/**
 * Internal utility: throws if response has any error, failure, or API-side validation issue.
 */
function _throwIfError(res: any) {
  if (!res) throw new Error('No response from Perplexity API');
  if (res.error) throw new Error(res.error);
  if (res.detail)
    throw new Error(
      typeof res.detail === 'string' ? res.detail : JSON.stringify(res.detail)
    );
  if (res.failure_reason) throw new Error(res.failure_reason);
}

/**
 * Internal utility: validates response structure and ensures citations are present.
 */
function _validatePerplexityResponse(res: any): void {
  _throwIfError(res);

  if (!res.choices || !Array.isArray(res.choices)) {
    throw new Error('Invalid response: missing or invalid choices array');
  }

  res.choices.forEach((choice: any, index: number) => {
    if (!choice.message || !choice.message.content) {
      throw new Error(
        `Invalid choice at index ${index}: missing message or content`
      );
    }
  });

  // Ensure citations is always an array (handle null/undefined)
  if (!res.citations || !Array.isArray(res.citations)) {
    res.citations = [];
  }
}

/**
 * Internal utility: all Perplexity API calls must go through this proxy, never called directly from client.
 */
async function _proxyPerplexity<T = any>(options: {
  path: string;
  method?: string;
  body?: any;
}): Promise<T> {
  const { path, method = 'POST', body } = options;

  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: 'Bearer secret_cmbgx5nna00003b6n9cxfu73y',
    'content-type': 'application/json',
  };

  const payload: any = {
    protocol: 'https',
    origin: 'api.perplexity.ai',
    path,
    method,
    headers,
  };

  if (body) payload.body = JSON.stringify(body);

  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return res.json();
}

/**
 * ================================================================================
 * CHAT COMPLETION METHODS — model and messages ARE REQUIRED
 * ================================================================================
 */

/**
 * Generate a chat completion with citations. You MUST provide model and messages.
 * @param input - Chat completion request with required model and messages
 * @returns Promise<PerplexityChatResponse> - Response with answer and citations
 */
export async function perplexityChat(
  input: PerplexityChatRequest
): Promise<PerplexityChatResponse> {
  if (!input.model) throw new Error('model is REQUIRED for chat completions');
  if (
    !input.messages ||
    !Array.isArray(input.messages) ||
    input.messages.length === 0
  ) {
    throw new Error('messages array is REQUIRED and cannot be empty');
  }

  const res = await _proxyPerplexity<PerplexityChatResponse>({
    path: '/chat/completions',
    body: { ...input, stream: false },
  });

  _validatePerplexityResponse(res);
  return res;
}

/**
 * Generate a streaming chat completion with citations. You MUST provide model and messages.
 * @param input - Chat completion request with required model and messages
 * @returns Promise<ReadableStream> - Streaming response with chunks
 */
export async function perplexityChatStream(
  input: PerplexityChatRequest
): Promise<ReadableStream> {
  if (!input.model) throw new Error('model is REQUIRED for chat completions');
  if (
    !input.messages ||
    !Array.isArray(input.messages) ||
    input.messages.length === 0
  ) {
    throw new Error('messages array is REQUIRED and cannot be empty');
  }

  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      protocol: 'https',
      origin: 'api.perplexity.ai',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: 'Bearer secret_cmbgx5nna00003b6n9cxfu73y',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...input, stream: true }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Streaming request failed: ${response.status}`);
  }

  return new ReadableStream({
    start(controller) {
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body reader available');

      function pump(): Promise<void> {
        return reader!.read().then(({ done, value }) => {
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
          return pump();
        });
      }
      return pump();
    },
  });
}

/**
 * Generate a research-focused response using the huge model for maximum capability.
 * @param query - Research question or topic
 * @param options - Optional research configuration
 * @returns Promise<PerplexityResearchResponse> - Comprehensive research response
 */
export async function perplexityResearch(
  query: string,
  options: PerplexityResearchOptions = {}
): Promise<PerplexityResearchResponse> {
  if (!query || typeof query !== 'string') {
    throw new Error('query string is REQUIRED for research');
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a research assistant. Provide comprehensive, well-sourced answers with proper citations.',
    },
    {
      role: 'user',
      content: query,
    },
  ];

  const request: PerplexityChatRequest = {
    model: 'sonar-pro',
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens ?? 4000,
  };

  const res = await perplexityChat(request);

  return {
    answer: res.choices[0]?.message?.content || '',
    citations: res.citations || [],
    usage: res.usage,
    model: res.model,
  };
}

/**
 * Generate a fact-checking response with emphasis on source verification.
 * @param claim - Statement or claim to fact-check
 * @param options - Optional fact-checking configuration
 * @returns Promise<PerplexityResearchResponse> - Fact-check response with sources
 */
export async function perplexityFactCheck(
  claim: string,
  options: PerplexityResearchOptions = {}
): Promise<PerplexityResearchResponse> {
  if (!claim || typeof claim !== 'string') {
    throw new Error('claim string is REQUIRED for fact-checking');
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a fact-checking assistant. Analyze claims carefully, provide evidence-based responses, and cite reliable sources.',
    },
    {
      role: 'user',
      content: `Please fact-check this claim: "${claim}"`,
    },
  ];

  const request: PerplexityChatRequest = {
    model: 'sonar-pro',
    messages,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.max_tokens ?? 2000,
  };

  const res = await perplexityChat(request);

  return {
    answer: res.choices[0]?.message?.content || '',
    citations: res.citations || [],
    usage: res.usage,
    model: res.model,
  };
}

/**
 * ================================================================================
 * MODEL-SPECIFIC CONVENIENCE METHODS
 * ================================================================================
 */

/**
 * Chat completion using the huge model (maximum capability).
 * @param input - Chat request without model (automatically set to huge)
 * @returns Promise<PerplexityChatResponse> - Chat response
 */
export async function perplexityHuge(
  input: Omit<PerplexityChatRequest, 'model'>
): Promise<PerplexityChatResponse> {
  return perplexityChat({
    ...input,
    model: 'sonar-pro',
  });
}

/**
 * Chat completion using the large model (balanced performance).
 * @param input - Chat request without model (automatically set to large)
 * @returns Promise<PerplexityChatResponse> - Chat response
 */
export async function perplexityLarge(
  input: Omit<PerplexityChatRequest, 'model'>
): Promise<PerplexityChatResponse> {
  return perplexityChat({
    ...input,
    model: 'sonar-pro',
  });
}

/**
 * Chat completion using the small model (fastest response).
 * @param input - Chat request without model (automatically set to small)
 * @returns Promise<PerplexityChatResponse> - Chat response
 */
export async function perplexitySmall(
  input: Omit<PerplexityChatRequest, 'model'>
): Promise<PerplexityChatResponse> {
  return perplexityChat({
    ...input,
    model: 'sonar',
  });
}

/**
 * ================================================================================
 * UTILITY METHODS
 * ================================================================================
 */

/**
 * Validate a Perplexity API response structure.
 * @param response - Response object to validate
 * @returns Promise<boolean> - True if valid, throws error if invalid
 */
export async function perplexityValidateResponse(
  response: any
): Promise<boolean> {
  try {
    _validatePerplexityResponse(response);
    return true;
  } catch (error) {
    throw new Error(`Response validation failed: ${error}`);
  }
}

/**
 * Extract citations from a Perplexity response safely.
 * @param response - Perplexity chat response
 * @returns string[] - Array of citation URLs (empty if none)
 */
export function perplexityExtractCitations(
  response: PerplexityChatResponse
): string[] {
  if (!response || !response.citations) return [];
  return Array.isArray(response.citations) ? response.citations : [];
}

/**
 * Calculate total token usage across multiple responses.
 * @param responses - Array of Perplexity responses
 * @returns number - Total token count
 */
export function perplexityCalculateTotalTokens(
  responses: Array<PerplexityChatResponse | PerplexityResearchResponse>
): number {
  return responses.reduce((total, response) => {
    return total + (response.usage?.total_tokens || 0);
  }, 0);
}

/**
 * Get the answer content from a chat response safely.
 * @param response - Perplexity chat response
 * @returns string - Answer content (empty string if none)
 */
export function perplexityGetAnswer(response: PerplexityChatResponse): string {
  if (!response || !response.choices || response.choices.length === 0)
    return '';
  return response.choices[0]?.message?.content || '';
}
