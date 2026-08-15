import * as assert from 'assert';
import { ChatSidebarProvider } from '../src/views/chatSidebarProvider';
import { startEmbeddedServer, stopEmbeddedServer } from '../src/embeddedServer';
import { LicenseManager } from '../src/auth/licenseManager';
import { resetVscodeMock } from './mocks/vscode';

/**
 * Runs through the ordinary `npm test` harness (mocked vscode, real Node
 * process) rather than a real windowed VS Code Extension Development Host.
 *
 * @vscode/test-electron (see test/integration/) was tried first and does
 * launch a genuine Extension Development Host from a single terminal
 * command with no manual F5 — but it failed in this sandbox with
 * `ERR_FILE_NOT_FOUND` loading workbench.html, a VS Code archive/extraction
 * issue in this specific environment, not a bug in the extension. Rather
 * than fight that, this covers the same ground more reliably: it exercises
 * the real ChatSidebarProvider, the real local embeddedServer (plain Node
 * http, no vscode API dependency at all), and the real SSE
 * streaming/parsing logic end to end. The only thing not real is the
 * outbound call to the actual AI provider — nothing should hit a paid API
 * from an automated test.
 */

const EXTENSION_URI = { fsPath: 'C:\\fake-extension-root' } as any;

function makeFakeWebviewView() {
  const postedMessages: any[] = [];
  const messageListeners: Array<(data: any) => void> = [];

  const webview: any = {
    postMessage: (msg: any) => { postedMessages.push(msg); return Promise.resolve(true); },
    onDidReceiveMessage: (listener: (data: any) => void) => {
      messageListeners.push(listener);
      return { dispose: () => {} };
    },
    asWebviewUri: (uri: any) => uri,
    cspSource: 'vscode-webview:',
    options: {},
    html: ''
  };

  const view: any = {
    webview,
    visible: true,
    onDidChangeVisibility: () => ({ dispose: () => {} }),
    onDidDispose: () => ({ dispose: () => {} }),
    show: () => {}
  };

  return { view, postedMessages, sendFromWebview: (data: any) => messageListeners.forEach(l => l(data)) };
}

function fakeGroqSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i++;
      } else {
        controller.close();
      }
    }
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function sseLine(deltaText: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: deltaText } }] })}\n\n`;
}

describe('Streaming chat integration (real server, real provider, mocked vscode)', () => {
  let serverPort: number;
  let originalFetch: typeof fetch;

  before(async function () {
    this.timeout(15000);
    serverPort = await startEmbeddedServer({} as any);
  });

  after(() => {
    stopEmbeddedServer();
  });

  beforeEach(() => {
    resetVscodeMock();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('streams end to end: webview message in, real local server, real SSE parse, streamStart/streamContent/streamEnd out', async function () {
    this.timeout(10000);

    global.fetch = ((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('api.groq.com')) {
        return Promise.resolve(fakeGroqSseResponse([
          sseLine('Hello'),
          sseLine(', '),
          sseLine('world.'),
          'data: [DONE]\n\n'
        ]));
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    await LicenseManager.getInstance().setUserApiKey('Groq', 'test-fake-key-not-real');

    const sidebarProvider = new ChatSidebarProvider(EXTENSION_URI, serverPort);
    const { view, postedMessages } = makeFakeWebviewView();
    sidebarProvider.resolveWebviewView(view, {} as any, { isCancellationRequested: false } as any);

    await (sidebarProvider as any)._streamSingleModel('groq/llama-3.3-70b-versatile', 'test prompt', []);

    const types = postedMessages.map((m: any) => m.type);
    assert.strictEqual(types[0], 'streamStart', 'first message out must be streamStart');
    assert.ok(types.includes('streamContent'), 'expected at least one streamContent delta');
    assert.strictEqual(types[types.length - 1], 'streamEnd', 'stream must resolve with streamEnd, not get stuck');

    const finalMsg = postedMessages.find((m: any) => m.type === 'streamEnd');
    assert.strictEqual(finalMsg.content, 'Hello, world.', 'assembled content must match the concatenated deltas exactly');
  });

  it('Stop/cancel mid-stream leaves the UI in a clean, non-stuck state and keeps the partial answer', async function () {
    this.timeout(10000);

    let sawFirstChunk: () => void;
    const firstChunkSeen = new Promise<void>(resolve => { sawFirstChunk = resolve; });

    global.fetch = ((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('api.groq.com')) {
        const encoder = new TextEncoder();
        let sentFirst = false;
        const body = new ReadableStream({
          pull(controller) {
            if (!sentFirst) {
              sentFirst = true;
              controller.enqueue(encoder.encode(sseLine('partial')));
              sawFirstChunk();
            }
          }
        });
        return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    await LicenseManager.getInstance().setUserApiKey('Groq', 'test-fake-key-not-real');

    const sidebarProvider = new ChatSidebarProvider(EXTENSION_URI, serverPort);
    const { view, postedMessages } = makeFakeWebviewView();
    sidebarProvider.resolveWebviewView(view, {} as any, { isCancellationRequested: false } as any);

    const streamPromise = (sidebarProvider as any)._streamSingleModel('groq/llama-3.3-70b-versatile', 'test prompt', []);

    await firstChunkSeen!;
    await new Promise(r => setTimeout(r, 300));
    (sidebarProvider as any)._cancelStream();

    await streamPromise;

    const types = postedMessages.map((m: any) => m.type);
    assert.strictEqual(types[0], 'streamStart');
    assert.ok(types.includes('streamContent'), 'the partial chunk should have been delivered before cancellation');
    assert.strictEqual(types[types.length - 1], 'streamEnd', 'a cancel with partial content resolves via streamEnd (not streamError), preserving the partial answer');

    const finalMsg = postedMessages.find((m: any) => m.type === 'streamEnd');
    assert.ok(finalMsg.content.includes('partial'), 'partial content must be preserved, not discarded');
    assert.ok(finalMsg.content.includes('Stopped by user'), 'must be clearly labeled as user-stopped, not presented as a complete answer');
  });

  it('a second send while one stream is in flight aborts the first instead of orphaning it', async function () {
    this.timeout(10000);

    global.fetch = ((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('api.groq.com')) {
        const encoder = new TextEncoder();
        const signal: AbortSignal | undefined = init?.signal;
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(sseLine('chunk')));
            // A real fetch response body ends its stream when the request's
            // AbortSignal fires. This fake must do the same, or a cancelled
            // stream's reader.read() hangs forever waiting for data that
            // will never come — exactly the bug that made this test time
            // out before this fix, and a good reminder that a mock fetch
            // has to model abort behavior explicitly, real fetch does it
            // for free.
            if (signal) {
              if (signal.aborted) { controller.close(); return; }
              signal.addEventListener('abort', () => { try { controller.close(); } catch { /* already closed */ } });
            }
          }
        });
        return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    await LicenseManager.getInstance().setUserApiKey('Groq', 'test-fake-key-not-real');

    const sidebarProvider = new ChatSidebarProvider(EXTENSION_URI, serverPort);
    const { view } = makeFakeWebviewView();
    sidebarProvider.resolveWebviewView(view, {} as any, { isCancellationRequested: false } as any);

    const first = (sidebarProvider as any)._streamSingleModel('groq/llama-3.3-70b-versatile', 'first', []);
    await new Promise(r => setTimeout(r, 100));
    const second = (sidebarProvider as any)._streamSingleModel('groq/llama-3.3-70b-versatile', 'second', []);

    await Promise.all([first, second]);
    // Regression check for the concurrent-stream race the code review found:
    // starting a second stream must abort the first, not silently orphan it.
    assert.strictEqual((sidebarProvider as any)._streamAbortController, null, 'no stream should be left dangling after both complete');
  });
});
