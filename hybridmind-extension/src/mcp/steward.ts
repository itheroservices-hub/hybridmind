import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';

/**
 * HybridMind's use of mcpsteward: find the MCP servers configured on this
 * machine, approve what one advertises, and later tell whether it changed.
 *
 * mcpsteward does the work. This module loads it, keeps approvals where its
 * command line tool keeps them (so `mcpsteward trust` in a terminal and
 * Approve in the sidebar are the same approval), and turns its results into
 * something the sidebar can show. It imports nothing from vscode, so it can be
 * tested directly.
 *
 * Only `scan` is silent: it reads configuration files and starts nothing.
 * `approve` and `check` start the server they are given, so they only ever
 * run because the user asked.
 */

// ---------------------------------------------------------------------------
// The parts of mcpsteward's API used here. Declared locally rather than
// imported from the package, which is ESM only while this extension is
// CommonJS.

export type AuthPosture = 'none' | 'env' | 'inline' | 'oauth' | 'unknown';
export type RiskTier = 'critical' | 'high' | 'medium' | 'low';

export interface ServerRef {
  readonly id: string;
  readonly name: string;
  readonly authPosture: AuthPosture;
  readonly endpoint:
    | { readonly transport: 'stdio'; readonly command: string; readonly args: readonly string[]; readonly envNames: readonly string[] }
    | { readonly transport: 'http'; readonly url: string; readonly headerNames: readonly string[] };
  readonly registrations: readonly { readonly client: string; readonly configPath: string; readonly hasInlineCredential: boolean }[];
}

interface Inventory {
  readonly servers: readonly ServerRef[];
  readonly scannedPaths: readonly string[];
  readonly problems: readonly { readonly configPath: string; readonly client: string; readonly reason: string }[];
}

interface Surface {
  readonly descriptors: readonly { readonly category: string; readonly identity: string }[];
}

interface Pin {
  readonly serverId: string;
  readonly surfaceRoot: string;
  readonly descriptorHashes: Readonly<Record<string, string>>;
  readonly approvedAt: string;
}

interface DriftEvent {
  readonly kind: string;
  readonly category: string;
  readonly identity: string;
  readonly summary: string;
  readonly risk: RiskTier;
  readonly riskFactors: readonly string[];
}

interface OperationOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export interface Steward {
  inventory(options?: { projectDirectories?: readonly string[] }): Promise<Inventory>;
  captureServer(server: ServerRef, options?: OperationOptions): Promise<Surface>;
  diffServer(server: ServerRef, pin: Pin, options?: OperationOptions): Promise<{ surface: Surface; report: { readonly pinnedAt: string; readonly events: readonly DriftEvent[]; readonly unchanged: number } }>;
  createPin(surface: Surface, options: { approvedBy: string }): Pin;
  savePin(pinPath: string, pin: Pin): Promise<void>;
  loadPin(pinPath: string): Promise<Pin>;
}

// ---------------------------------------------------------------------------
// Loading

// Through a Function so TypeScript, compiling to CommonJS, leaves a real
// dynamic import in place instead of turning it into require(), which cannot
// load an ESM only package on every Node version VS Code ships.
const importEsm = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

/** The installed mcpsteward package directory, found by walking up from here. */
function findPackageRoot(start: string = __dirname): string {
  // This file runs from out/mcp in the extension and from test-out/src/mcp in
  // tests, so the extension root is at most four levels up. Looking further
  // would pick up whatever happens to sit above the extension.
  let dir = start;
  for (let level = 0; level <= 4; level++) {
    const candidate = path.join(dir, 'node_modules', 'mcpsteward');
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('mcpsteward is not installed alongside HybridMind.');
}

let loaded: Promise<Steward> | null = null;

export function loadSteward(): Promise<Steward> {
  if (!loaded) {
    loaded = (async () => {
      const root = findPackageRoot();
      // By file URL, so nothing depends on how a bare specifier would resolve
      // from inside the Function above.
      const api = await importEsm(pathToFileURL(path.join(root, 'dist', 'api.js')).href);
      const trust = await importEsm(pathToFileURL(path.join(root, 'dist', 'trust', 'index.js')).href);
      return {
        inventory: (options) => api.inventory(options),
        captureServer: (server, options) => api.captureServer(server, options),
        diffServer: (server, pin, options) => api.diffServer(server, pin, options),
        createPin: (surface, options) => trust.createPin(surface, options),
        savePin: (pinPath, pin) => trust.savePin(pinPath, pin),
        loadPin: (pinPath) => trust.loadPin(pinPath)
      } as Steward;
    })();
    // A failed load should be retried next time, not remembered.
    loaded.catch(() => { loaded = null; });
  }
  return loaded;
}

// ---------------------------------------------------------------------------
// Approvals live where the mcpsteward command line keeps them.

export function defaultPinDirectory(): string {
  return path.join(os.homedir(), '.mcpsteward', 'pins');
}

const SAFE_SERVER_ID = /^[\w.-]{1,128}$/;

export function pinPathFor(serverId: string, pinDirectory: string = defaultPinDirectory()): string {
  // Ids are hashes mcpsteward computes, but nothing read from a config file
  // gets to choose a path.
  if (!SAFE_SERVER_ID.test(serverId)) {
    throw new Error(`Unexpected server id "${serverId}".`);
  }
  return path.join(pinDirectory, `${serverId}.pin.json`);
}

// ---------------------------------------------------------------------------
// Scanning: offline, starts nothing.

export interface ServerSummary {
  readonly ref: ServerRef;
  readonly id: string;
  readonly name: string;
  readonly transport: 'stdio' | 'http';
  /**
   * What to show for where the server runs: the program name for a local
   * server, the host for a remote one. Never the full command line or URL,
   * which can carry a key.
   */
  readonly where: string;
  readonly authPosture: AuthPosture;
  readonly registrations: readonly { readonly client: string; readonly clientLabel: string; readonly configPath: string; readonly hasInlineCredential: boolean }[];
  readonly hasInlineCredential: boolean;
  readonly approved: boolean;
}

export interface ScanResult {
  readonly servers: readonly ServerSummary[];
  readonly problems: Inventory['problems'];
  readonly scannedFiles: number;
  readonly withInlineCredentials: number;
}

const CLIENT_LABELS: Record<string, string> = {
  'claude-desktop': 'Claude Desktop',
  'claude-code': 'Claude Code',
  vscode: 'VS Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  cline: 'Cline',
  zed: 'Zed'
};

/**
 * A server name as it is safe to show: a config file key, written by whoever
 * wrote the file, so line breaks, control and direction override characters
 * are collapsed and the length is capped. Used for every label, tooltip,
 * prompt and notification.
 */
export function safeDisplayName(name: string): string {
  const cleaned = String(name || '')
    .replace(/[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]+/g, ' ')
    .trim();
  return (cleaned || 'unnamed server').slice(0, 120);
}

export function clientLabel(client: string): string {
  return CLIENT_LABELS[client] || client;
}

export function whereLabel(server: ServerRef): string {
  if (server.endpoint.transport === 'http') {
    try {
      return new URL(server.endpoint.url).host;
    } catch {
      return 'remote server';
    }
  }
  return path.basename(server.endpoint.command) || 'local program';
}

/**
 * @param projectDirectories open workspace folders, so project level configs
 *   such as .vscode/mcp.json and .mcp.json are found as well as user level ones.
 */
/**
 * What approving or checking `server` will do, in plain words: the program it
 * runs or the host it connects to, and where that is configured.
 */
export function describeLaunch(server: ServerSummary, workspaceFolders: readonly string[] = []): string {
  const action = server.transport === 'http'
    ? `connect to ${server.where} and send the headers in its configuration`
    : `run the program "${server.where}" with the arguments in its configuration`;
  const files = server.registrations.map((site) => {
    const inProject = workspaceFolders.some((folder) => isInside(site.configPath, folder));
    return `${site.configPath}${inProject ? ' (in this project)' : ''}`;
  });
  return `This will ${action}, as set in:\n${files.join('\n') || 'an unknown file'}`;
}

function isInside(file: string, folder: string): boolean {
  const relative = path.relative(folder, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function scan(steward: Steward, pinDirectory: string = defaultPinDirectory(), projectDirectories: readonly string[] = []): Promise<ScanResult> {
  const inventory = await steward.inventory(projectDirectories.length ? { projectDirectories } : undefined);
  const servers = inventory.servers.map((ref): ServerSummary => {
    const registrations = ref.registrations.map((site) => ({ ...site, clientLabel: clientLabel(site.client) }));
    let approved = false;
    try {
      approved = fs.existsSync(pinPathFor(ref.id, pinDirectory));
    } catch {
      approved = false;
    }
    return {
      ref,
      id: ref.id,
      name: safeDisplayName(ref.name),
      transport: ref.endpoint.transport,
      where: whereLabel(ref),
      authPosture: ref.authPosture,
      registrations,
      hasInlineCredential: registrations.some((site) => site.hasInlineCredential),
      approved
    };
  });
  // Keys written into config files first, since those are the ones to act on.
  servers.sort((a, b) => Number(b.hasInlineCredential) - Number(a.hasInlineCredential) || a.name.localeCompare(b.name));
  return {
    servers,
    problems: inventory.problems,
    scannedFiles: inventory.scannedPaths.length,
    withInlineCredentials: servers.filter((server) => server.hasInlineCredential).length
  };
}

// ---------------------------------------------------------------------------
// Approving and checking: these start the server.

export interface ApproveResult {
  readonly approvedAt: string;
  readonly tools: number;
  readonly items: number;
}

export async function approve(steward: Steward, server: ServerRef, options: OperationOptions & { approvedBy?: string; pinDirectory?: string } = {}): Promise<ApproveResult> {
  const surface = await steward.captureServer(server, { signal: options.signal, timeoutMs: options.timeoutMs });
  return approveSurface(steward, server, surface, options);
}

/**
 * Pin a surface that was already captured, such as the one a check just
 * compared. Accepting a reviewed change this way pins exactly what the user
 * looked at, not a fresh capture that could differ from it.
 */
export async function approveSurface(steward: Steward, server: ServerRef, surface: Surface, options: { approvedBy?: string; pinDirectory?: string } = {}): Promise<ApproveResult> {
  const pin = steward.createPin(surface, { approvedBy: options.approvedBy || safeUserName() });
  const finalPath = pinPathFor(server.id, options.pinDirectory);
  // Written beside the final file and renamed into place, so another window
  // reading the pin never sees half of one.
  const temporaryPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  await steward.savePin(temporaryPath, pin);
  try {
    await fs.promises.rename(temporaryPath, finalPath);
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
  return {
    approvedAt: pin.approvedAt,
    tools: surface.descriptors.filter((descriptor) => descriptor.category === 'tool').length,
    items: surface.descriptors.length
  };
}

export interface CheckResult {
  readonly state: 'not-approved' | 'unchanged' | 'changed' | 'damaged-approval';
  /** What the server advertised during this check, for accepting a change as reviewed. */
  readonly surface?: Surface;
  readonly approvedAt?: string;
  readonly unchanged?: number;
  /** Most severe first. */
  readonly events: readonly DriftEvent[];
  readonly worstRisk?: RiskTier;
  readonly counts: Readonly<Record<RiskTier, number>>;
}

const RISK_ORDER: RiskTier[] = ['critical', 'high', 'medium', 'low'];

export async function check(steward: Steward, server: ServerRef, options: OperationOptions & { pinDirectory?: string } = {}): Promise<CheckResult> {
  const emptyCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const pinPath = pinPathFor(server.id, options.pinDirectory);
  if (!fs.existsSync(pinPath)) {
    return { state: 'not-approved', events: [], counts: emptyCounts };
  }
  let pin: Pin;
  try {
    pin = await steward.loadPin(pinPath);
  } catch {
    return { state: 'damaged-approval', events: [], counts: emptyCounts };
  }
  // A pin can be edited by hand or copied between servers. One that does not
  // belong to this server, or has nothing to compare, is not an approval.
  if (pin.serverId !== server.id || !pin.descriptorHashes || typeof pin.descriptorHashes !== 'object') {
    return { state: 'damaged-approval', events: [], counts: emptyCounts };
  }
  const { surface, report } = await steward.diffServer(server, pin, { signal: options.signal, timeoutMs: options.timeoutMs });

  const events = [...report.events].sort((a, b) => RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk));
  const counts = { ...emptyCounts };
  for (const event of events) {
    counts[event.risk] += 1;
  }
  return {
    state: events.length ? 'changed' : 'unchanged',
    surface,
    approvedAt: report.pinnedAt,
    unchanged: report.unchanged,
    events,
    worstRisk: events.length ? events[0].risk : undefined,
    counts
  };
}

function safeUserName(): string {
  try {
    return os.userInfo().username || 'HybridMind user';
  } catch {
    return 'HybridMind user';
  }
}

// ---------------------------------------------------------------------------
// Failures, in words a person can act on.

export function describeFailure(error: unknown, serverName: string, serverId?: string): string {
  const name = (error as any)?.name || '';
  const message = String((error as any)?.message || error || '');

  if (name === 'AuthenticationRequiredError') {
    return `${serverName} needs you to sign in before it will answer. HybridMind does not sign in to servers for you.`;
  }
  if (name === 'CancellationError' || name === 'AbortError') {
    return `Stopped before ${serverName} finished.`;
  }
  if (name === 'TimeoutError') {
    return `${serverName} did not answer in time.`;
  }
  if (/placeholder/i.test(message)) {
    // The library never hands a server this editor's environment, so a config
    // that reads ${env:NAME} cannot be started from here.
    const target = serverId && SAFE_SERVER_ID.test(serverId) ? ` ${serverId}` : '';
    return `${serverName} reads a value from your environment in its configuration. HybridMind does not pass your environment to servers it starts. Run "npx mcpsteward trust${target}" in a terminal instead.`;
  }
  if (/not found/i.test(message) && /command/i.test(message)) {
    return `${serverName} could not be started: its program is not installed or not on your PATH.`;
  }
  // mcpsteward redacts its own messages before they reach here.
  return `${serverName}: ${message || 'the check failed.'}`;
}
