import * as assert from 'assert';
import { startEmbeddedServer, stopEmbeddedServer } from '../src/embeddedServer';
import { localServerHeaders, localServerUrl } from '../src/localServer';
import { loadCatalog } from '../src/providers/modelCatalog';
import { resetVscodeMock } from './mocks/vscode';

/**
 * What actually leaves the machine for a provider, checked by running the
 * real embedded server and catching the outbound request. Nothing here reaches
 * a provider.
 */

const KEY = 'test-fake-key-not-real';

interface Outbound { url: string; headers: Record<string, string>; body: any; }

function sse(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

describe('requests sent to providers', () => {
  let originalFetch: typeof fetch;
  let outbound: Outbound[];

  before(async function () {
    this.timeout(15000);
    await startEmbeddedServer({} as any);
  });

  after(() => {
    stopEmbeddedServer();
  });

  beforeEach(() => {
    resetVscodeMock();
    originalFetch = global.fetch;
    outbound = [];
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /** Lets calls to the embedded server through and answers everything else from `reply`. */
  function interceptProviders(reply: (url: string) => Response) {
    global.fetch = ((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.startsWith('http://127.0.0.1:')) {
        return originalFetch(input, init);
      }
      outbound.push({ url, headers: (init?.headers || {}) as Record<string, string>, body: init?.body ? JSON.parse(init.body) : undefined });
      return Promise.resolve(reply(url));
    }) as typeof fetch;
  }

  async function stream(provider: string, model: string): Promise<string> {
    const response = await fetch(localServerUrl('/run/single/stream'), {
      method: 'POST',
      headers: localServerHeaders({ 'X-User-Api-Provider': provider, 'X-User-Provider-Key': KEY }),
      body: JSON.stringify({ model, prompt: 'hi', messages: [{ role: 'user', content: 'hi' }] })
    });
    return response.text();
  }

  it('sends OpenAI no max_tokens, which its reasoning models refuse with a 400', async function () {
    this.timeout(10000);
    interceptProviders(() => new Response(sse('ok') + 'data: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));

    await stream('openai', 'gpt-5');

    assert.strictEqual(outbound.length, 1);
    assert.strictEqual(outbound[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.strictEqual(outbound[0].body.model, 'gpt-5', 'the model id must reach the provider unchanged');
    assert.ok(!('max_tokens' in outbound[0].body), 'max_tokens must not be sent to OpenAI');
  });

  it('still caps the other OpenAI compatible providers, and passes their model id through unchanged', async function () {
    this.timeout(10000);
    interceptProviders(() => new Response(sse('ok') + 'data: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));

    await stream('groq', 'llama-3.3-70b-versatile');

    assert.strictEqual(outbound[0].url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.strictEqual(outbound[0].body.model, 'llama-3.3-70b-versatile');
    assert.strictEqual(outbound[0].body.max_tokens, 4000);
  });

  it('keeps a Google key out of the URL when chatting, where it used to ride in the query string', async function () {
    this.timeout(10000);
    interceptProviders(() => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 }));

    await fetch(localServerUrl('/run/single'), {
      method: 'POST',
      headers: localServerHeaders({ 'X-User-Api-Provider': 'google', 'X-User-Provider-Key': KEY }),
      body: JSON.stringify({ model: 'gemini-flash-latest', prompt: 'hi' })
    });

    assert.strictEqual(outbound.length, 1);
    assert.strictEqual(outbound[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    assert.ok(!outbound[0].url.includes(KEY));
    assert.strictEqual(outbound[0].headers['x-goog-api-key'], KEY);
  });
});

describe('OpenAI model list', () => {
  const list = (ids: string[]) => async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: ids.map((id, index) => ({ id, created: ids.length - index })) })
  });

  it('defaults to a plain chat model ahead of a reasoning one, which can refuse options and needs a verified organisation to stream', async () => {
    const catalog = await loadCatalog('openai', KEY, { fetchImpl: list(['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o']) as any });

    assert.strictEqual(catalog.defaultModel, 'gpt-4.1');
  });

  it('falls back to the newest gpt model once the plain chat models are gone from the account', async () => {
    const catalog = await loadCatalog('openai', KEY, { fetchImpl: list(['gpt-7', 'gpt-5']) as any });

    assert.strictEqual(catalog.defaultModel, 'gpt-5');
  });

  it('leaves out models that only answer on the Responses API, since a chat request to them fails', async () => {
    const catalog = await loadCatalog('openai', KEY, {
      fetchImpl: list(['gpt-5-codex', 'o3-pro', 'gpt-5-pro-2026', 'gpt-3.5-turbo-instruct', 'o3-deep-research', 'computer-use-preview', 'gpt-4.1', 'o3']) as any
    });

    assert.deepStrictEqual(catalog.models.map((m) => m.id), ['gpt-4.1', 'o3']);
  });
});
