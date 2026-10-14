import * as assert from 'assert';
import {
  CatalogError,
  isSafeModelId,
  loadCatalog,
  normalizeProvider,
  pickDefaultModel,
  verifyKey
} from '../src/providers/modelCatalog';
import { ChatSidebarProvider } from '../src/views/chatSidebarProvider';
import { LicenseManager } from '../src/auth/licenseManager';
import { resetVscodeMock } from './mocks/vscode';

const KEY = 'test-fake-key-not-real';

interface Call { url: string; headers: Record<string, string>; }

/** A fetch that answers from a table of url prefix to reply, and records what it was asked. */
function fakeFetch(replies: Record<string, { status?: number; body?: any }>) {
  const calls: Call[] = [];
  const impl = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers || {} });
    const prefix = Object.keys(replies).find((candidate) => url.startsWith(candidate));
    const reply = prefix ? replies[prefix] : { status: 404, body: {} };
    const status = reply.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => reply.body };
  };
  return { impl, calls };
}

describe('normalizeProvider', () => {
  it('accepts the names the key picker and the Keys tab store, in any case', () => {
    assert.strictEqual(normalizeProvider('Groq'), 'groq');
    assert.strictEqual(normalizeProvider(' OpenRouter '), 'openrouter');
    assert.strictEqual(normalizeProvider('Google'), 'google');
  });

  it('maps the older names the server already treats as the same provider', () => {
    assert.strictEqual(normalizeProvider('gemini'), 'google');
    assert.strictEqual(normalizeProvider('claude'), 'anthropic');
  });

  it('returns null for a provider it cannot list, instead of guessing one', () => {
    assert.strictEqual(normalizeProvider('mistral'), null);
    assert.strictEqual(normalizeProvider(''), null);
    assert.strictEqual(normalizeProvider(null), null);
  });
});

describe('loadCatalog', () => {
  it('lists Groq models with the real ids the API expects, the gap that made every chat fail on "llama-3.3-70b"', async () => {
    const { impl, calls } = fakeFetch({
      'https://api.groq.com/openai/v1/models': {
        body: { data: [
          { id: 'whisper-large-v3', active: true },
          { id: 'llama-3.1-8b-instant', active: true },
          { id: 'llama-3.3-70b-versatile', active: true },
          { id: 'meta-llama/llama-guard-4-12b', active: true },
          { id: 'retired-model', active: false }
        ] }
      }
    });

    const catalog = await loadCatalog('Groq', KEY, { fetchImpl: impl });

    assert.deepStrictEqual(catalog.models.map((m) => m.id), ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']);
    assert.strictEqual(catalog.defaultModel, 'llama-3.3-70b-versatile');
    assert.strictEqual(catalog.providerLabel, 'Groq');
    assert.strictEqual(calls[0].headers.Authorization, `Bearer ${KEY}`);
  });

  it('puts the newest OpenAI chat model first and drops what cannot hold a chat', async () => {
    const { impl } = fakeFetch({
      'https://api.openai.com/v1/models': {
        body: { data: [
          { id: 'text-embedding-3-large', created: 50 },
          { id: 'gpt-4o', created: 10 },
          { id: 'gpt-4.1', created: 20 },
          { id: 'gpt-4o-audio-preview', created: 30 },
          { id: 'whisper-1', created: 5 }
        ] }
      }
    });

    const catalog = await loadCatalog('openai', KEY, { fetchImpl: impl });

    assert.deepStrictEqual(catalog.models.map((m) => m.id), ['gpt-4.1', 'gpt-4o']);
    assert.strictEqual(catalog.defaultModel, 'gpt-4.1');
  });

  it('reads Anthropic display names and sends the key the way that API requires', async () => {
    const { impl, calls } = fakeFetch({
      'https://api.anthropic.com/v1/models': {
        body: { data: [
          { id: 'claude-opus-9', display_name: 'Claude Opus 9' },
          { id: 'claude-sonnet-9', display_name: 'Claude Sonnet 9' },
          { id: 'claude-sonnet-8', display_name: 'Claude Sonnet 8' }
        ] }
      }
    });

    const catalog = await loadCatalog('anthropic', KEY, { fetchImpl: impl });

    assert.strictEqual(catalog.models[0].name, 'Claude Opus 9');
    // The list is newest first, so the first Sonnet is the newest Sonnet.
    assert.strictEqual(catalog.defaultModel, 'claude-sonnet-9');
    assert.strictEqual(calls[0].headers['x-api-key'], KEY);
    assert.ok(calls[0].headers['anthropic-version']);
  });

  it('strips Google\'s "models/" prefix, keeps only models that can generate, and keeps the key out of the URL', async () => {
    const { impl, calls } = fakeFetch({
      'https://generativelanguage.googleapis.com/v1beta/models': {
        body: { models: [
          { name: 'models/text-embedding-004', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/gemini-9-pro', displayName: 'Gemini 9 Pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }
        ] }
      }
    });

    const catalog = await loadCatalog('Google', KEY, { fetchImpl: impl });

    assert.deepStrictEqual(catalog.models.map((m) => m.id), ['gemini-9-pro', 'gemini-flash-latest']);
    assert.strictEqual(catalog.defaultModel, 'gemini-flash-latest');
    assert.ok(!calls[0].url.includes(KEY), 'the key must not appear in the request URL');
    assert.strictEqual(calls[0].headers['x-goog-api-key'], KEY);
  });

  it('defaults OpenRouter to its own router, which exists on every account and cannot go stale', async () => {
    const { impl } = fakeFetch({
      'https://openrouter.ai/api/v1/models': {
        body: { data: [
          { id: 'some-lab/new-model', name: 'New Model' },
          { id: 'openrouter/auto', name: 'Auto Router' }
        ] }
      }
    });

    const catalog = await loadCatalog('openrouter', KEY, { fetchImpl: impl });

    assert.strictEqual(catalog.defaultModel, 'openrouter/auto');
    assert.strictEqual(catalog.models[0].name, 'New Model');
  });

  it('offers only Qwen text models, since requests go to the text generation endpoint', async () => {
    const { impl } = fakeFetch({
      'https://dashscope.aliyuncs.com/compatible-mode/v1/models': {
        body: { data: [{ id: 'qwen-vl-max' }, { id: 'qwen-plus' }, { id: 'text-embedding-v3' }, { id: 'qwen-max' }, { id: 'wan-video' }] }
      }
    });

    const catalog = await loadCatalog('qwen', KEY, { fetchImpl: impl });

    assert.deepStrictEqual(catalog.models.map((m) => m.id), ['qwen-plus', 'qwen-max']);
    assert.strictEqual(catalog.defaultModel, 'qwen-plus');
  });

  it('drops an id that could not be a real model id, so a hostile provider reply cannot put markup in the sidebar', async () => {
    const { impl } = fakeFetch({
      'https://openrouter.ai/api/v1/models': {
        body: { data: [
          { id: 'x" onmouseover="alert(1)', name: 'Quote escape' },
          { id: '<img src=x onerror=alert(1)>', name: 'Tag' },
          { id: 'a'.repeat(201), name: 'Too long' },
          { id: 'lab/real-model:free', name: 'N'.repeat(500) }
        ] }
      }
    });

    const catalog = await loadCatalog('openrouter', KEY, { fetchImpl: impl });

    assert.deepStrictEqual(catalog.models.map((m) => m.id), ['lab/real-model:free']);
    assert.strictEqual(catalog.models[0].name.length, 200);
    assert.strictEqual(catalog.defaultModel, 'lab/real-model:free');
  });

  it('keeps every shape of id real providers use', () => {
    for (const id of ['gpt-4.1', 'claude-sonnet-4-5', 'meta-llama/llama-3.3-70b-instruct', '~lab/model-latest', 'google/gemini:batch', 'ft:gpt-4o:org::abc123', 'accounts/x/models/y@v1']) {
      assert.ok(isSafeModelId(id), id);
    }
    for (const id of ['', 'has space', 'a"b', "a'b", 'a<b', 'a>b', 'a&b', null, 42]) {
      assert.ok(!isSafeModelId(id), String(id));
    }
  });

  it('refuses a reply that declares itself far larger than any real model list', async () => {
    const impl = async () => ({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name === 'content-length' ? String(64 * 1024 * 1024) : null) },
      json: async () => { throw new Error('the body must not be read'); }
    });

    await assert.rejects(loadCatalog('groq', KEY, { fetchImpl: impl as any }), (error: any) => error.kind === 'provider');
  });

  it('says the key was rejected on a 401, in words that never repeat the key', async () => {
    const { impl } = fakeFetch({ 'https://api.deepseek.com/models': { status: 401, body: {} } });

    await assert.rejects(loadCatalog('deepseek', KEY, { fetchImpl: impl }), (error: any) => {
      assert.ok(error instanceof CatalogError);
      assert.strictEqual(error.kind, 'rejected-key');
      assert.ok(!error.message.includes(KEY));
      return true;
    });
  });

  it('recognises Google\'s way of refusing a key, which is a 400 and not a 401', async () => {
    const { impl } = fakeFetch({
      'https://generativelanguage.googleapis.com/v1beta/models': {
        status: 400,
        body: { error: { code: 400, status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }
      }
    });

    await assert.rejects(loadCatalog('google', KEY, { fetchImpl: impl }), (error: any) => error.kind === 'rejected-key');
  });

  it('does not blame the key for a 400 that is about something else', async () => {
    const { impl } = fakeFetch({
      'https://generativelanguage.googleapis.com/v1beta/models': {
        status: 400,
        body: { error: { code: 400, status: 'INVALID_ARGUMENT', details: [{ reason: 'SOMETHING_ELSE' }] } }
      }
    });

    await assert.rejects(loadCatalog('google', KEY, { fetchImpl: impl }), (error: any) => error.kind === 'provider');
  });

  it('reports a network failure as its own kind, so "check your connection" is not shown for a bad key', async () => {
    const impl = async () => { throw new Error('getaddrinfo ENOTFOUND'); };

    await assert.rejects(loadCatalog('groq', KEY, { fetchImpl: impl as any }), (error: any) => {
      assert.strictEqual(error.kind, 'network');
      return true;
    });
  });

  it('refuses to guess when there is no key or no known provider', async () => {
    const { impl, calls } = fakeFetch({});

    await assert.rejects(loadCatalog('groq', '', { fetchImpl: impl }), (error: any) => error.kind === 'no-key');
    await assert.rejects(loadCatalog('mistral', KEY, { fetchImpl: impl }), (error: any) => error.kind === 'unknown-provider');
    assert.strictEqual(calls.length, 0, 'nothing should be sent without a key and a known provider');
  });

  it('falls back to the first listed model when none of the preferred ones exist', () => {
    assert.strictEqual(pickDefaultModel('groq', [{ id: 'brand-new', name: 'brand-new' }]), 'brand-new');
    assert.strictEqual(pickDefaultModel('groq', []), null);
  });
});

describe('verifyKey', () => {
  it('accepts a key once the provider lists models for it, without sending a completion', async () => {
    const { impl, calls } = fakeFetch({ 'https://api.groq.com/openai/v1/models': { body: { data: [{ id: 'llama-3.3-70b-versatile' }] } } });

    const catalog = await verifyKey('groq', KEY, { fetchImpl: impl });

    assert.strictEqual(catalog.models.length, 1);
    assert.ok(calls.every((call) => !call.url.includes('chat/completions')));
  });

  it('checks an OpenRouter key separately, because its model list is public and proves nothing', async () => {
    const { impl, calls } = fakeFetch({
      'https://openrouter.ai/api/v1/models': { body: { data: [{ id: 'openrouter/auto', name: 'Auto' }] } },
      'https://openrouter.ai/api/v1/key': { status: 401, body: {} }
    });

    await assert.rejects(verifyKey('openrouter', KEY, { fetchImpl: impl }), (error: any) => error.kind === 'rejected-key');
    assert.ok(calls.some((call) => call.url === 'https://openrouter.ai/api/v1/key'));
  });
});

describe('sidebar model list', () => {
  const EXTENSION_URI = { fsPath: 'C:\\fake-extension-root' } as any;
  let originalFetch: typeof fetch;

  function makeSidebar() {
    const posted: any[] = [];
    const listeners: Array<(data: any) => void> = [];
    const view: any = {
      webview: {
        postMessage: (msg: any) => { posted.push(msg); return Promise.resolve(true); },
        onDidReceiveMessage: (listener: (data: any) => void) => { listeners.push(listener); return { dispose: () => {} }; },
        asWebviewUri: (uri: any) => uri,
        cspSource: 'vscode-webview:',
        options: {},
        html: ''
      },
      visible: true,
      onDidChangeVisibility: () => ({ dispose: () => {} }),
      onDidDispose: () => ({ dispose: () => {} }),
      show: () => {}
    };
    const provider = new ChatSidebarProvider(EXTENSION_URI, 3000);
    provider.resolveWebviewView(view, {} as any, { isCancellationRequested: false } as any);
    return { provider, posted };
  }

  beforeEach(() => {
    resetVscodeMock();
    originalFetch = global.fetch;
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await LicenseManager.getInstance().clearUserApiKey();
  });

  it('offers the saved key\'s own models and a real default, so the first message does not go out under a made up name', async () => {
    global.fetch = (async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      assert.ok(url.startsWith('https://api.groq.com/openai/v1/models'), `unexpected request to ${url}`);
      return new Response(JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile', active: true }] }), { status: 200 });
    }) as typeof fetch;
    await LicenseManager.getInstance().setUserApiKey('Groq', KEY);
    const { provider, posted } = makeSidebar();

    await (provider as any)._sendModelCatalog();

    const ready = posted.find((m) => m.type === 'modelCatalog' && m.state === 'ready');
    assert.ok(ready, 'expected a ready catalog');
    assert.strictEqual(ready.defaultModel, 'llama-3.3-70b-versatile');
    assert.strictEqual(ready.providerLabel, 'Groq');
  });

  it('tells the webview there is no key, instead of listing models nobody can call', async () => {
    global.fetch = (async () => { throw new Error('nothing should be requested without a key'); }) as typeof fetch;
    const { provider, posted } = makeSidebar();

    await (provider as any)._sendModelCatalog();

    assert.deepStrictEqual(posted.filter((m) => m.type === 'modelCatalog').map((m) => m.state), ['no-key']);
  });

  it('reports a rejected key from Verify with the provider\'s own verdict, where it used to fail every key', async () => {
    global.fetch = (async () => new Response('{}', { status: 401 })) as typeof fetch;
    const { provider, posted } = makeSidebar();

    await (provider as any)._handleVerifyApiKey('openai', KEY);

    const last = posted[posted.length - 1];
    assert.strictEqual(last.type, 'byokStatus');
    assert.strictEqual(last.status, 'error');
    assert.ok(/rejected this key/.test(last.message));
    assert.ok(!last.message.includes(KEY));
  });
});
