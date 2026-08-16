// Provider-independent AI abstraction.
// Falls back to a deterministic heuristic engine when no external provider is configured.

import { config } from './config';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiResponse {
  text: string;
  provider: string;
}

export async function callAi(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiResponse> {
  const provider = config.ai.provider;
  if (provider === 'openai' && config.ai.apiKey) {
    return callOpenAi(messages, opts);
  }
  // Deterministic fallback: no external call. Return a structured placeholder
  // that downstream heuristic engines will use as a signal to generate locally.
  return {
    text: '',
    provider: 'heuristic',
  };
}

async function callOpenAi(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiResponse> {
  const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages,
      temperature: 0.7,
      ...(opts?.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI provider error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    provider: 'openai',
  };
}

export function isExternalAiConfigured(): boolean {
  return config.ai.provider === 'openai' && Boolean(config.ai.apiKey);
}
