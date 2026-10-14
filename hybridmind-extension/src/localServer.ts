import * as crypto from 'crypto';
import type { IncomingHttpHeaders } from 'http';

/**
 * Where the embedded server is listening, and the secret that proves a request
 * came from this extension host.
 *
 * The server holds no credentials of its own, but it will run the agent and
 * forward a prompt to a provider for whoever asks. It used to answer anyone:
 * it sent `Access-Control-Allow-Origin: *`, checked no token, and callers
 * reached it on a hardcoded port 3000 even after it had moved to 3001 because
 * something else already had 3000. So a web page could reach it, and the
 * user's provider key could be posted to whatever unrelated program was
 * listening on 3000. Every caller now gets the address and the token from
 * here, and the server refuses a request that lacks either.
 *
 * This module imports nothing from vscode so the check can be tested directly.
 */

export const LOCAL_SERVER_TOKEN_HEADER = 'x-hybridmind-token';

// One secret per extension host process. It only ever travels as a header on
// requests to 127.0.0.1, so a web page, another VS Code window or any other
// local program has no way to present it.
const token = crypto.randomBytes(32).toString('hex');

// 3000 is only where the server tries first. embeddedServer.ts records the
// port it actually bound once it is listening.
let port = 3000;

export function getLocalServerToken(): string {
  return token;
}

export function getLocalServerPort(): number {
  return port;
}

export function setLocalServerPort(listeningPort: number): void {
  port = listeningPort;
}

/** Full URL for a path on the embedded server, e.g. localServerUrl('/run/single'). */
export function localServerUrl(pathname: string): string {
  // The literal address, not `localhost`: the server binds 127.0.0.1 only, and
  // `localhost` can resolve to ::1 first.
  return `http://127.0.0.1:${port}${pathname}`;
}

/** Headers every request to the embedded server must carry. */
export function localServerHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    [LOCAL_SERVER_TOKEN_HEADER]: token,
    ...extra
  };
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

/**
 * Whether a request to the embedded server came from this extension host.
 *
 * Three independent checks, because each closes a different door:
 * - Origin: a browser attaches it to every cross-site request it sends, and
 *   Node's fetch and axios never do. Any Origin at all means a web page.
 * - Host: under DNS rebinding the page is same-origin and may omit Origin, but
 *   the Host header still names the attacker's domain.
 * - Token: covers everything else on the machine, including another VS Code
 *   window running this same extension.
 */
export function isTrustedLocalRequest(headers: IncomingHttpHeaders, listeningPort: number): boolean {
  if (headers.origin !== undefined) {
    return false;
  }

  const host = firstHeaderValue(headers.host).toLowerCase();
  if (host !== `127.0.0.1:${listeningPort}` && host !== `localhost:${listeningPort}`) {
    return false;
  }

  const presented = Buffer.from(firstHeaderValue(headers[LOCAL_SERVER_TOKEN_HEADER]));
  const expected = Buffer.from(token);
  // timingSafeEqual throws on a length mismatch, so compare lengths first.
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}
