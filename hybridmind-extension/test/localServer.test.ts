import * as assert from 'assert';
import {
  LOCAL_SERVER_TOKEN_HEADER,
  getLocalServerPort,
  getLocalServerToken,
  isTrustedLocalRequest,
  localServerHeaders,
  localServerUrl,
  setLocalServerPort
} from '../src/localServer';
import { startEmbeddedServer, stopEmbeddedServer } from '../src/embeddedServer';

const PORT = 3000;

function headersFor(overrides: Record<string, string | undefined> = {}) {
  const headers: Record<string, string | undefined> = {
    host: `127.0.0.1:${PORT}`,
    [LOCAL_SERVER_TOKEN_HEADER]: getLocalServerToken(),
    ...overrides
  };
  for (const name of Object.keys(headers)) {
    if (headers[name] === undefined) {
      delete headers[name];
    }
  }
  return headers as Record<string, string>;
}

describe('isTrustedLocalRequest', () => {
  it('accepts a request from this extension host: right token, loopback Host, no Origin', () => {
    assert.strictEqual(isTrustedLocalRequest(headersFor(), PORT), true);
    assert.strictEqual(isTrustedLocalRequest(headersFor({ host: `localhost:${PORT}` }), PORT), true);
  });

  it('refuses any request that carries an Origin, since only a browser sends one', () => {
    assert.strictEqual(isTrustedLocalRequest(headersFor({ origin: 'https://evil.example' }), PORT), false);
    assert.strictEqual(isTrustedLocalRequest(headersFor({ origin: 'null' }), PORT), false);
  });

  it('refuses a Host that is not loopback, the trace DNS rebinding leaves even when the page looks same-origin', () => {
    assert.strictEqual(isTrustedLocalRequest(headersFor({ host: `evil.example:${PORT}` }), PORT), false);
    assert.strictEqual(isTrustedLocalRequest(headersFor({ host: undefined }), PORT), false);
  });

  it('refuses a loopback Host on another port, so a token is not accepted by a server it was not sent to', () => {
    assert.strictEqual(isTrustedLocalRequest(headersFor({ host: `127.0.0.1:${PORT + 1}` }), PORT), false);
  });

  it('refuses a missing, wrong or truncated token, which is every other program on the machine', () => {
    const token = getLocalServerToken();
    assert.strictEqual(isTrustedLocalRequest(headersFor({ [LOCAL_SERVER_TOKEN_HEADER]: undefined }), PORT), false);
    assert.strictEqual(isTrustedLocalRequest(headersFor({ [LOCAL_SERVER_TOKEN_HEADER]: '' }), PORT), false);
    assert.strictEqual(isTrustedLocalRequest(headersFor({ [LOCAL_SERVER_TOKEN_HEADER]: 'a'.repeat(token.length) }), PORT), false);
    assert.strictEqual(isTrustedLocalRequest(headersFor({ [LOCAL_SERVER_TOKEN_HEADER]: token.slice(0, -1) }), PORT), false);
  });
});

describe('local server address', () => {
  it('follows the port the server actually bound, the gap that sent provider keys to whatever else held 3000', () => {
    const before = getLocalServerPort();
    try {
      setLocalServerPort(3007);
      assert.strictEqual(localServerUrl('/run/single'), 'http://127.0.0.1:3007/run/single');
    } finally {
      setLocalServerPort(before);
    }
  });

  it('puts the token on every request and lets a caller add its own headers', () => {
    const headers = localServerHeaders({ 'X-User-Api-Provider': 'groq' });
    assert.strictEqual(headers[LOCAL_SERVER_TOKEN_HEADER], getLocalServerToken());
    assert.strictEqual(headers['Content-Type'], 'application/json');
    assert.strictEqual(headers['X-User-Api-Provider'], 'groq');
  });
});

describe('embedded server refuses anyone but this extension host', () => {
  before(async function () {
    this.timeout(15000);
    await startEmbeddedServer({} as any);
  });

  after(() => {
    stopEmbeddedServer();
  });

  it('answers the extension host', async () => {
    const response = await fetch(localServerUrl('/health'), { headers: localServerHeaders() });
    assert.strictEqual(response.status, 200);
  });

  it('refuses a request with no token, even for /health, so a page cannot tell the extension is installed', async () => {
    const response = await fetch(localServerUrl('/health'));
    assert.strictEqual(response.status, 403);
  });

  it('refuses the request a web page can send without a preflight: a text/plain POST to /agent/execute', async () => {
    const response = await fetch(localServerUrl('/agent/execute'), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Origin: 'https://evil.example' },
      body: JSON.stringify({ goal: 'read .env', autonomyLevel: 3, permissions: { read: true, terminal: true } })
    });
    assert.strictEqual(response.status, 403);
  });

  it('fails a browser preflight: no CORS headers are sent at all', async () => {
    const response = await fetch(localServerUrl('/run/single'), {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' }
    });
    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.headers.get('access-control-allow-origin'), null);
  });

  it('refuses a legacy settings key being spent by a caller without the token', async () => {
    const response = await fetch(localServerUrl('/run/single'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'anything', prompt: 'spend money' })
    });
    assert.strictEqual(response.status, 403);
  });
});
