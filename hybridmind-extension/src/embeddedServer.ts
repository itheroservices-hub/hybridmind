/**
 * Embedded Backend Server for HybridMind Extension
 * Runs locally only when VS Code is open
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as path from 'path';

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
        res.end(JSON.stringify(getAvailableModels()));
        return;
      }

      // Run endpoint
      if (req.url === '/run/single' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const result = await runModel(data.model, data.prompt, context);
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
              data.models.map((model: string) => runModel(model, data.prompt, context))
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
              const result = await runModel(model, currentPrompt, context);
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

      // Agent endpoint
      if (req.url === '/agent/execute' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const result = await runModel('llama-3.3-70b', data.goal, context);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              result: result.content,
              plan: 'Agentic workflow (simplified)',
              model: 'llama-3.3-70b'
            }));
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
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

function getAvailableModels() {
  const config = vscode.workspace.getConfiguration('hybridmind');
  const models = [];

  if (config.get('groqApiKey')) {
    models.push(
      { id: 'llama-3.3-70b', provider: 'groq', name: 'Llama 3.3 70B' },
      { id: 'mixtral-8x7b', provider: 'groq', name: 'Mixtral 8x7B' }
    );
  }

  if (config.get('geminiApiKey')) {
    models.push(
      { id: 'gemini-2.0-flash-exp', provider: 'gemini', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', provider: 'gemini', name: 'Gemini 1.5 Pro' }
    );
  }

  if (config.get('deepseekApiKey')) {
    models.push(
      { id: 'deepseek-chat', provider: 'deepseek', name: 'DeepSeek Chat' },
      { id: 'deepseek-coder', provider: 'deepseek', name: 'DeepSeek Coder' }
    );
  }

  if (config.get('qwenApiKey')) {
    models.push(
      { id: 'qwen-max', provider: 'qwen', name: 'Qwen Max' },
      { id: 'qwen-plus', provider: 'qwen', name: 'Qwen Plus' }
    );
  }

  if (config.get('openaiApiKey')) {
    models.push(
      { id: 'gpt-4-turbo', provider: 'openai', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', provider: 'openai', name: 'GPT-3.5 Turbo' }
    );
  }

  if (config.get('anthropicApiKey')) {
    models.push(
      { id: 'claude-3-opus', provider: 'anthropic', name: 'Claude 3 Opus' },
      { id: 'claude-3-sonnet', provider: 'anthropic', name: 'Claude 3 Sonnet' }
    );
  }

  return models;
}

async function runModel(modelId: string, prompt: string, context: vscode.ExtensionContext): Promise<any> {
  const config = vscode.workspace.getConfiguration('hybridmind');
  
  // Map model IDs to actual API model names
  const modelMapping: { [key: string]: string } = {
    'llama-3.3-70b': 'llama-3.3-70b-versatile',
    'mixtral-8x7b': 'mixtral-8x7b-32768',
    'gemini-2.0-flash-exp': 'gemini-2.0-flash-exp',
    'gemini-1.5-pro': 'gemini-1.5-pro',
    'gemini-flash': 'gemini-2.0-flash-exp',
    'deepseek-chat': 'deepseek-chat',
    'deepseek-coder': 'deepseek-coder',
    'deepseek-v3': 'deepseek-chat',
    'qwen-max': 'qwen-max',
    'qwen-plus': 'qwen-plus'
  };
  
  const actualModel = modelMapping[modelId] || modelId;
  
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
  
  // Route to appropriate provider based on model ID
  if (modelId.startsWith('llama') || modelId.startsWith('mixtral')) {
    return runGroq(actualModel, prompt, config.get('groqApiKey') || '');
  } else if (modelId.startsWith('gemini')) {
    return runGemini(actualModel, prompt, config.get('geminiApiKey') || '');
  } else if (modelId.startsWith('deepseek')) {
    return runDeepseek(actualModel, prompt, config.get('deepseekApiKey') || '');
  } else if (modelId.startsWith('qwen')) {
    return runQwen(actualModel, prompt, config.get('qwenApiKey') || '');
  } else if (modelId.startsWith('gpt')) {
    return runOpenAI(actualModel, prompt, config.get('openaiApiKey') || '');
  } else if (modelId.startsWith('claude')) {
    return runAnthropic(actualModel, prompt, config.get('anthropicApiKey') || '');
  }
  
  throw new Error(`Unknown model: ${modelId}`);
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
