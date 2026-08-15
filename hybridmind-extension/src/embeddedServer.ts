/**
 * Embedded Backend Server for HybridMind Extension
 * Runs locally only when VS Code is open
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as path from 'path';
import { AutonomousAgent } from './agents/autonomousAgent';

let server: http.Server | null = null;
let serverPort = 3000;

export async function startEmbeddedServer(context: vscode.ExtensionContext): Promise<number> {
  if (server) {
    return serverPort;
  }

  return new Promise((resolve, reject) => {
    // Create a simple HTTP server that proxies to AI APIs
    server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          mode: 'embedded'
        }));
        return;
      }

      // Models endpoint
      if (req.url === '/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(getAvailableModels(req.headers)));
        return;
      }

      // Run endpoint
      if (req.url === '/run/single' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const result = await runModel(data.model, data.prompt, context, req.headers);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

      // Parallel endpoint
      if (req.url === '/run/parallel' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const results = await Promise.all(
              data.models.map((model: string) => runModel(model, data.prompt, context, req.headers))
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ results }));
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

      // Chain endpoint
      if (req.url === '/run/chain' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const steps = [];
            let currentPrompt = data.prompt;

            for (const model of data.models) {
              const result = await runModel(model, currentPrompt, context, req.headers);
              steps.push(result);
              currentPrompt = `Previous response from ${model}: ${result.content}\n\nOriginal task: ${data.prompt}`;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ steps }));
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

      // Agent endpoint - NOW WITH REAL AUTONOMOUS CAPABILITIES!
      if (req.url === '/agent/execute' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);

            // Create autonomous agent
            const agent = new AutonomousAgent(
              async (modelId: string, prompt: string) => {
                return await runModel(modelId, prompt, context, req.headers);
              },
              {
                autonomyLevel: data.autonomyLevel || 3,
                permissions: data.permissions || {}
              }
            );
            
            // Execute the goal autonomously
            // isDirectExecution = true means skip analysis and execute immediately
            const agentResult = await agent.execute(data.goal, data.isDirectExecution || false);
            
            if (agentResult.success) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                result: agentResult.finalResult,
                steps: agentResult.steps,
                plan: `Executed ${agentResult.steps.length} steps`,
                model: 'Autonomous Agent (llama-3.3-70b)',
                suggestions: agentResult.suggestions || [] // Include next step suggestions
              }));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: agentResult.error }));
            }
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        return;
      }

      // Streaming single-model endpoint — Server-Sent Events.
      // Additive sibling of /run/single: same BYOK dispatch rules, but pushes
      // `delta` events as tokens arrive instead of waiting for the full
      // response. Used by the chat UI's "thought process" streaming view.
      if (req.url === '/run/single/stream' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          const controller = new AbortController();
          req.on('close', () => controller.abort());

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });

          try {
            const data = JSON.parse(body);
            const result = await streamModel(
              data.model,
              data.prompt,
              data.messages,
              context,
              req.headers,
              controller.signal,
              (kind, text) => writeSSE(res, 'delta', { kind, text })
            );
            writeSSE(res, 'done', result);
          } catch (error: any) {
            const message = error?.name === 'AbortError' ? 'Stopped by user.' : (error?.message || 'Unknown streaming error');
            writeSSE(res, 'error', { message });
          } finally {
            res.end();
          }
        });
        return;
      }

      // Not found
      res.writeHead(404);
      res.end('Not found');
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        // Try next port
        serverPort++;
        server?.close();
        server = null;
        startEmbeddedServer(context).then(resolve).catch(reject);
      } else {
        reject(error);
      }
    });

    server.listen(serverPort, '127.0.0.1', () => {
      console.log(`HybridMind embedded server running on port ${serverPort}`);
      resolve(serverPort);
    });
  });
}

export function stopEmbeddedServer() {
  if (server) {
    server.close();
    server = null;
  }
}

/**
 * Pulls a single header value out of Node's IncomingHttpHeaders, which can
 * legally hand back a string, an array of strings, or undefined.
 */
function getHeaderValue(headers: http.IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

/**
 * BYOK requests carry the provider name in `x-user-api-provider` and the
 * user's own key in `x-user-provider-key` (see licenseManager.getApiHeaders()).
 * `Authorization` is reserved for license/session auth and must not be read
 * as a provider key here.
 */
function getByokFromHeaders(headers: http.IncomingHttpHeaders): { provider: string; key: string } {
  const provider = getHeaderValue(headers, 'x-user-api-provider').toLowerCase().trim();
  const key = getHeaderValue(headers, 'x-user-provider-key').trim();
  return { provider, key };
}

function getAvailableModels(headers: http.IncomingHttpHeaders = {}) {
  const config = vscode.workspace.getConfiguration('hybridmind');
  const openrouterKey = config.get('openrouterApiKey');
  const { key: userKey } = getByokFromHeaders(headers);

  // Models are available if the user has EITHER the shared OpenRouter key
  // configured OR their own BYOK provider key attached to the request.
  if (!openrouterKey && !userKey) {
    return [];
  }

  return [
    // === FREE MODELS (via OpenRouter) ===
    { id: 'meta-llama/llama-3.3-70b-instruct', provider: 'openrouter', name: '🆓 Llama 3.3 70B', tier: 'free' },
    { id: 'deepseek/deepseek-r1', provider: 'openrouter', name: '🆓 DeepSeek R1', tier: 'free' },
    { id: 'google/gemini-2.0-flash-thinking-exp:free', provider: 'openrouter', name: '🆓 Gemini 2.0 Flash', tier: 'free' },
    { id: 'qwen/qwen-2.5-coder-32b-instruct', provider: 'openrouter', name: '🆓 Qwen 2.5 Coder 32B', tier: 'free' },
    { id: 'mistralai/mixtral-8x7b-instruct', provider: 'openrouter', name: '🆓 Mixtral 8x7B', tier: 'free' },
    
    // === BUDGET MODELS ($0.09-$0.50/M tokens) ===
    { id: 'google/gemini-flash-1.5', provider: 'openrouter', name: '💰 Gemini Flash 1.5', tier: 'budget' },
    { id: 'anthropic/claude-haiku-3.5', provider: 'openrouter', name: '💰 Claude Haiku 3.5', tier: 'budget' },
    { id: 'openai/gpt-4.1-mini', provider: 'openrouter', name: '💰 GPT-4.1 Mini', tier: 'budget' },
    
    // === STANDARD MODELS ($2-$5/M tokens) ===
    { id: 'openai/gpt-4.1', provider: 'openrouter', name: '⭐ GPT-4.1', tier: 'standard' },
    { id: 'anthropic/claude-sonnet-4', provider: 'openrouter', name: '⭐ Claude Sonnet 4', tier: 'standard' },
    { id: 'google/gemini-pro-1.5', provider: 'openrouter', name: '⭐ Gemini Pro 1.5', tier: 'standard' },
    { id: 'x-ai/grok-2', provider: 'openrouter', name: '⭐ Grok 2', tier: 'standard' },
    
    // === PREMIUM MODELS ($15-$75/M tokens) ===
    { id: 'openai/o1', provider: 'openrouter', name: '💎 OpenAI o1 (Reasoning)', tier: 'premium' },
    { id: 'anthropic/claude-opus-4', provider: 'openrouter', name: '💎 Claude Opus 4', tier: 'premium' },
    { id: 'google/gemini-pro-1.5-exp', provider: 'openrouter', name: '💎 Gemini Pro 1.5 Exp', tier: 'premium' }
  ];
}

async function runModel(
  modelId: string,
  prompt: string,
  context: vscode.ExtensionContext,
  headers: http.IncomingHttpHeaders = {}
): Promise<any> {
  // COST PROTECTION: Limit prompt size to prevent accidental huge bills
  const MAX_CHARS = 50000; // ~12,500 tokens (~$0.15 for GPT-4, ~$0.05 for Claude)
  if (prompt.length > MAX_CHARS) {
    throw new Error(
      `Prompt too large: ${prompt.length.toLocaleString()} characters. ` +
      `Maximum: ${MAX_CHARS.toLocaleString()} characters (≈12,500 tokens). ` +
      `Please select less code or split into smaller chunks.`
    );
  }

  // COST WARNING: Large prompts
  if (prompt.length > 20000) {
    console.warn(`Large prompt: ${prompt.length} characters. Estimated cost: $0.10-$0.50`);
  }

  const { provider, key: userKey } = getByokFromHeaders(headers);

  // BYOK path: dispatch to whichever provider function matches the header,
  // using the user's own key. This is the fix for the dead-code providers —
  // previously every request silently fell through to OpenRouter regardless
  // of what the caller asked for.
  if (provider && userKey) {
    switch (provider) {
      case 'groq':
        return runGroq(modelId, prompt, userKey);
      case 'gemini':
      case 'google':
        return runGemini(modelId, prompt, userKey);
      case 'deepseek':
        return runDeepseek(modelId, prompt, userKey);
      case 'qwen':
        return runQwen(modelId, prompt, userKey);
      case 'openai':
        return runOpenAI(modelId, prompt, userKey);
      case 'anthropic':
      case 'claude':
        return runAnthropic(modelId, prompt, userKey);
      case 'openrouter':
        return runOpenRouter(modelId, prompt, userKey);
      default:
        throw new Error(
          `Unknown BYOK provider "${provider}". Supported providers: groq, gemini, deepseek, qwen, openai, anthropic, openrouter.`
        );
    }
  }

  // No per-request BYOK header — fall back to the shared OpenRouter setting
  // (the "just paste one key in settings" default path).
  const config = vscode.workspace.getConfiguration('hybridmind');
  const openrouterKey = config.get<string>('openrouterApiKey') || '';

  if (!openrouterKey) {
    throw new Error(
      'No API key configured. Run "HybridMind: Set API Key (BYOK)" to add a provider key, or set an OpenRouter API key in VS Code Settings > Extensions > HybridMind.'
    );
  }

  return runOpenRouter(modelId, prompt, openrouterKey);
}

type StreamDeltaKind = 'content' | 'reasoning';
type StreamDeltaFn = (kind: StreamDeltaKind, text: string) => void;
interface StreamResult {
  content: string;
  reasoning: string;
  model: string;
  provider: string;
  usage?: any;
}

function writeSSE(res: http.ServerResponse, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Streaming counterpart of runModel(). Additive — reuses the exact same BYOK
 * dispatch rules as runModel() but pushes deltas as they arrive instead of
 * waiting for a full response. Providers whose API doesn't offer real
 * token streaming (Gemini, Qwen) fall back to a single non-streaming call
 * whose result is then chunked out via simulateStreamFromResult() so the
 * caller always sees the same delta/done event shape either way.
 */
async function streamModel(
  modelId: string,
  prompt: string,
  messages: Array<{ role: string; content: string }> | undefined,
  context: vscode.ExtensionContext,
  headers: http.IncomingHttpHeaders,
  signal: AbortSignal,
  onDelta: StreamDeltaFn
): Promise<StreamResult> {
  const MAX_CHARS = 50000;
  if (prompt.length > MAX_CHARS) {
    throw new Error(
      `Prompt too large: ${prompt.length.toLocaleString()} characters. ` +
      `Maximum: ${MAX_CHARS.toLocaleString()} characters (≈12,500 tokens). ` +
      `Please select less code or split into smaller chunks.`
    );
  }

  const chatMessages = messages && messages.length
    ? messages.map(m => ({ role: m.role, content: m.content }))
    : [{ role: 'user', content: prompt }];

  const { provider, key: userKey } = getByokFromHeaders(headers);

  if (provider && userKey) {
    switch (provider) {
      case 'groq':
        return streamOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', userKey, {}, modelId, chatMessages, 'groq', signal, onDelta);
      case 'deepseek':
        return streamOpenAICompatible('https://api.deepseek.com/chat/completions', userKey, {}, modelId, chatMessages, 'deepseek', signal, onDelta);
      case 'openai':
        return streamOpenAICompatible('https://api.openai.com/v1/chat/completions', userKey, {}, modelId, chatMessages, 'openai', signal, onDelta);
      case 'openrouter':
        return streamOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', userKey, {
          'HTTP-Referer': 'https://hybridmind.app',
          'X-Title': 'HybridMind VS Code Extension'
        }, modelId, chatMessages, 'openrouter', signal, onDelta);
      case 'anthropic':
      case 'claude':
        return streamAnthropic(modelId, chatMessages, userKey, signal, onDelta);
      case 'gemini':
      case 'google':
        return simulateStreamFromResult(await runGemini(modelId, prompt, userKey), onDelta);
      case 'qwen':
        return simulateStreamFromResult(await runQwen(modelId, prompt, userKey), onDelta);
      default:
        throw new Error(
          `Unknown BYOK provider "${provider}". Supported providers: groq, gemini, deepseek, qwen, openai, anthropic, openrouter.`
        );
    }
  }

  const config = vscode.workspace.getConfiguration('hybridmind');
  const openrouterKey = config.get<string>('openrouterApiKey') || '';

  if (!openrouterKey) {
    throw new Error(
      'No API key configured. Run "HybridMind: Set API Key (BYOK)" to add a provider key, or set an OpenRouter API key in VS Code Settings > Extensions > HybridMind.'
    );
  }

  return streamOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', openrouterKey, {
    'HTTP-Referer': 'https://hybridmind.app',
    'X-Title': 'HybridMind VS Code Extension'
  }, modelId, chatMessages, 'openrouter', signal, onDelta);
}

/**
 * Shared SSE streaming path for every OpenAI-compatible chat/completions API
 * (Groq, OpenAI, DeepSeek, OpenRouter). Forwards `delta.content` as 'content'
 * deltas. Also watches for `delta.reasoning_content` (DeepSeek reasoner
 * models) and `delta.reasoning` (OpenRouter's reasoning-token field, e.g.
 * DeepSeek R1) and forwards those as a distinct 'reasoning' kind so the UI
 * can render a separate "thinking" region.
 */
async function streamOpenAICompatible(
  url: string,
  apiKey: string,
  extraHeaders: Record<string, string>,
  model: string,
  messages: Array<{ role: string; content: string }>,
  providerName: string,
  signal: AbortSignal,
  onDelta: StreamDeltaFn
): Promise<StreamResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 4000 }),
    signal
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error(`Invalid ${providerName} API key. Check your settings.`);
    } else if (response.status === 429) {
      throw new Error(`${providerName} rate limit exceeded. Wait a few seconds and try again.`);
    }
    throw new Error(`${providerName} API error (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  let usage: any = undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (!dataStr || dataStr === '[DONE]') continue;

      let json: any;
      try {
        json = JSON.parse(dataStr);
      } catch {
        continue;
      }

      const delta = json?.choices?.[0]?.delta;
      if (delta?.reasoning_content) {
        reasoning += delta.reasoning_content;
        onDelta('reasoning', delta.reasoning_content);
      }
      if (delta?.reasoning) {
        reasoning += delta.reasoning;
        onDelta('reasoning', delta.reasoning);
      }
      if (delta?.content) {
        content += delta.content;
        onDelta('content', delta.content);
      }
      if (json?.usage) {
        usage = json.usage;
      }
    }
  }

  return { content, reasoning, model, provider: providerName, usage };
}

/**
 * Anthropic's SSE event shape is different from the OpenAI-style providers
 * (event: content_block_delta / message_delta rather than a flat
 * `choices[0].delta`), so it gets its own small parser.
 */
async function streamAnthropic(
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  signal: AbortSignal,
  onDelta: StreamDeltaFn
): Promise<StreamResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, messages, max_tokens: 4000, stream: true }),
    signal
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error('Invalid Anthropic API key. Check your settings.');
    } else if (response.status === 429) {
      throw new Error('Anthropic rate limit exceeded. Wait a few seconds and try again.');
    }
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (!dataStr) continue;

      let json: any;
      try {
        json = JSON.parse(dataStr);
      } catch {
        continue;
      }

      if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta' && json.delta.text) {
        content += json.delta.text;
        onDelta('content', json.delta.text);
      }
    }
  }

  return { content, reasoning: '', model, provider: 'anthropic', usage: undefined };
}

/**
 * Providers we don't have real token streaming for yet (Gemini, Qwen) still
 * get a non-streaming call under the hood, but the result is chunked out
 * through the same onDelta callback so the UI never sees a jarring
 * instant full-response dump regardless of which provider answered.
 */
async function simulateStreamFromResult(
  result: { content: string; model: string; provider: string },
  onDelta: StreamDeltaFn
): Promise<StreamResult> {
  const text = result.content || '';
  const chunkSize = 20;
  for (let i = 0; i < text.length; i += chunkSize) {
    onDelta('content', text.slice(i, i + chunkSize));
    await new Promise(resolve => setTimeout(resolve, 12));
  }
  return { content: text, reasoning: '', model: result.model, provider: result.provider, usage: undefined };
}

async function runGroq(model: string, prompt: string, apiKey: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid Groq API key. Check your settings.');
      } else if (response.status === 429) {
        throw new Error('Groq rate limit exceeded. Wait a few seconds and try again.');
      } else {
        throw new Error(`Groq API error (${response.status}): ${errorText}`);
      }
    }

    const data: any = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from Groq API');
    }

    return {
      content: data.choices[0].message.content,
      model: model,
      provider: 'groq'
    };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds. The model may be overloaded.');
    }
    throw error;
  }
}

async function runGemini(model: string, prompt: string, apiKey: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid Gemini API key. Check your settings.');
      } else if (response.status === 429) {
        throw new Error('Gemini rate limit exceeded. Wait a few seconds and try again.');
      } else {
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }
    }

    const data: any = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      throw new Error('Invalid response from Gemini API');
    }

    return {
      content: data.candidates[0].content.parts[0].text,
      model: model,
      provider: 'gemini'
    };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds.');
    }
    throw error;
  }
}

async function runDeepseek(model: string, prompt: string, apiKey: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid DeepSeek API key. Check your settings.');
      } else if (response.status === 429) {
        throw new Error('DeepSeek rate limit exceeded. Wait a few seconds and try again.');
      } else {
        throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
      }
    }

    const data: any = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from DeepSeek API');
    }

    return {
      content: data.choices[0].message.content,
      model: model,
      provider: 'deepseek'
    };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds.');
    }
    throw error;
  }
}

async function runQwen(model: string, prompt: string, apiKey: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        input: { messages: [{ role: 'user', content: prompt }] }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid Qwen API key. Check your settings.');
      } else if (response.status === 429) {
        throw new Error('Qwen rate limit exceeded. Wait a few seconds and try again.');
      } else {
        throw new Error(`Qwen API error (${response.status}): ${errorText}`);
      }
    }

    const data: any = await response.json();
    
    if (!data.output || !data.output.choices || !data.output.choices[0] || !data.output.choices[0].message) {
      throw new Error('Invalid response from Qwen API');
    }

    return {
      content: data.output.choices[0].message.content,
      model: model,
      provider: 'qwen'
    };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds.');
    }
    throw error;
  }
}

async function runOpenAI(model: string, prompt: string, apiKey: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key. Check your settings.');
      } else if (response.status === 429) {
        throw new Error('OpenAI rate limit exceeded. Wait a few seconds and try again.');
      } else {
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }
    }

    const data: any = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    return {
      content: data.choices[0].message.content,
      model: model,
      provider: 'openai'
    };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds.');
    }
    throw error;
  }
}

async function runAnthropic(model: string, prompt: string, apiKey: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid Anthropic API key. Check your settings.');
      } else if (response.status === 429) {
        throw new Error('Anthropic rate limit exceeded. Wait a few seconds and try again.');
      } else {
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }
    }

    const data: any = await response.json();
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response from Anthropic API');
    }

    return {
      content: data.content[0].text,
      model: model,
      provider: 'anthropic'
    };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds.');
    }
    throw error;
  }
}

async function runOpenRouter(model: string, prompt: string, apiKey: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s for potentially slower models

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hybridmind.app',
        'X-Title': 'HybridMind VS Code Extension'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.7
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid OpenRouter API key. Check your settings at: VS Code Settings > HybridMind > OpenRouter API Key');
      } else if (response.status === 429) {
        throw new Error('OpenRouter rate limit exceeded. Wait a few seconds and try again.');
      } else if (response.status === 402) {
        throw new Error('Insufficient OpenRouter credits. Top up at: https://openrouter.ai/credits');
      } else {
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
      }
    }

    const data: any = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenRouter API');
    }

    return {
      content: data.choices[0].message.content,
      model: model,
      provider: 'openrouter',
      usage: data.usage // OpenRouter provides usage stats
    };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 60 seconds. The model may be overloaded.');
    }
    throw error;
  }
}
