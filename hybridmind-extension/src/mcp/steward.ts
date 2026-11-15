import { createHash } from 'crypto';
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
 * run because the user asked. So does a tool call, which only happens after
 * the user allows that one call.
 *
 * Approving also saves the tools the server advertised, beside the approval,
 * so the coding agent can be told what an approved server offers without
 * starting it. A saved tool list is only believed while every tool in it
 * hashes to what the approval recorded.
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

export interface Surface {
  readonly descriptors: readonly {
    readonly category: string;
    readonly identity: string;
    /** Canonical JSON text of the descriptor, which is what its hash covers. */
    readonly canonical?: string;
  }[];
}

export interface Pin {
  readonly serverId: string;
  readonly surfaceRoot: string;
  readonly descriptorHashes: Readonly<Record<string, string>>;
  readonly approvedAt: string;
}

export interface DriftEvent {
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
  /**
   * Environment variables for a server started on this machine. mcpsteward
   * passes nothing else from this process's environment.
   */
  readonly env?: Readonly<Record<string, string>>;
}

export interface ToolCallResult {
  readonly isError: boolean;
  readonly text: string;
  readonly content: readonly unknown[];
  readonly structuredContent?: unknown;
}

export interface Steward {
  inventory(options?: { projectDirectories?: readonly string[] }): Promise<Inventory>;
  captureServer(server: ServerRef, options?: OperationOptions): Promise<Surface>;
  diffServer(server: ServerRef, pin: Pin, options?: OperationOptions): Promise<{ surface: Surface; report: { readonly pinnedAt: string; readonly events: readonly DriftEvent[]; readonly unchanged: number } }>;
  createPin(surface: Surface, options: { approvedBy: string }): Pin;
  savePin(pinPath: string, pin: Pin): Promise<void>;
  loadPin(pinPath: string): Promise<Pin>;
  /**
   * Starts the server, confirms it still matches `pin`, and calls one tool on
   * the same connection. Throws ServerChangedError, sending nothing, when
   * anything differs. Absent from mcpsteward before 0.2.0.
   */
  callApprovedTool?(server: ServerRef, pin: Pin, name: string, args: Readonly<Record<string, unknown>>, options?: OperationOptions & { readonly callTimeoutMs?: number }): Promise<{ result: ToolCallResult }>;
  /** The environment variable names a server's own configuration reads. Absent before 0.2.0. */
  environmentNamesFor?(server: ServerRef): readonly string[];
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
      const steward: Steward = {
        inventory: (options) => api.inventory(options),
        captureServer: (server, options) => api.captureServer(server, options),
        diffServer: (server, pin, options) => api.diffServer(server, pin, options),
        createPin: (surface, options) => trust.createPin(surface, options),
        savePin: (pinPath, pin) => trust.savePin(pinPath, pin),
        loadPin: (pinPath) => trust.loadPin(pinPath)
      };
      if (typeof api.callApprovedTool === 'function') {
        steward.callApprovedTool = (server, pin, name, args, options) => api.callApprovedTool(server, pin, name, args, options);
      }
      if (typeof api.environmentNamesFor === 'function') {
        steward.environmentNamesFor = (server) => api.environmentNamesFor(server);
      }
      return steward;
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
// Approved tool lists, for the coding agent.
//
// A pin records only hashes, which is enough to spot a change but not to tell
// the agent what a tool does. So approving also saves each tool's canonical
// JSON, in HybridMind's own storage. It is believed only while each tool hashes
// to exactly what the pin recorded and the pin has no tools it lacks, so a list
// left behind by an earlier approval, or one edited by hand, is ignored.

export interface ApprovedTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
}

interface ToolSetFile {
  readonly version: 1;
  readonly serverId: string;
  readonly surfaceRoot: string;
  readonly tools: readonly { readonly canonical: string }[];
  /**
   * The environment variable names the server was given when it was approved,
   * and so the most it is ever given afterwards. A server's id covers its
   * command and arguments but not its environment, so a configuration edited
   * later to read another variable would otherwise get it without anyone
   * approving that.
   */
  readonly envNames: readonly string[];
}

/** What was approved for the agent: the tools, and the variables the server may be given. */
export interface ApprovedRecord {
  readonly tools: ApprovedTool[];
  readonly envNames: readonly string[];
}

export function toolSetPathFor(serverId: string, toolsDirectory: string): string {
  if (!SAFE_SERVER_ID.test(serverId)) {
    throw new Error(`Unexpected server id "${serverId}".`);
  }
  return path.join(toolsDirectory, `${serverId}.tools.json`);
}

function hashOf(canonical: string): string {
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

/**
 * Saves the tools in `surface`, which must be the surface `pin` was made from,
 * with the environment variable names the server was given to produce it.
 */
export async function saveToolSet(surface: Surface, pin: Pin, toolsDirectory: string, envNames: readonly string[] = []): Promise<number> {
  const tools = surface.descriptors
    .filter((descriptor) => descriptor.category === 'tool')
    .map((descriptor) => {
      if (typeof descriptor.canonical !== 'string') {
        throw new Error('This version of mcpsteward does not keep tool definitions, so they cannot be saved.');
      }
      return { canonical: descriptor.canonical };
    });
  const file: ToolSetFile = { version: 1, serverId: pin.serverId, surfaceRoot: pin.surfaceRoot, tools, envNames: cleanNames(envNames) };
  if (!verifyToolSet(file, pin)) {
    throw new Error('The tools do not match the approval they were saved with.');
  }
  await fs.promises.mkdir(toolsDirectory, { recursive: true });
  const finalPath = toolSetPathFor(pin.serverId, toolsDirectory);
  const temporaryPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(temporaryPath, JSON.stringify(file), 'utf8');
  try {
    await fs.promises.rename(temporaryPath, finalPath);
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
  return tools.length;
}

/**
 * The approved tools for `pin`'s server, or null when none were saved or what
 * was saved does not match the approval exactly.
 */
export function loadToolSet(pin: Pin, toolsDirectory: string): ApprovedTool[] | null {
  return loadApprovedRecord(pin, toolsDirectory)?.tools ?? null;
}

/** The approved tools and environment variable names, or null as for loadToolSet. */
export function loadApprovedRecord(pin: Pin, toolsDirectory: string): ApprovedRecord | null {
  let file: ToolSetFile;
  try {
    file = JSON.parse(fs.readFileSync(toolSetPathFor(pin.serverId, toolsDirectory), 'utf8'));
  } catch {
    return null;
  }
  const tools = verifyToolSet(file, pin);
  return tools ? { tools, envNames: cleanNames(file.envNames) } : null;
}

function cleanNames(names: unknown): string[] {
  return Array.isArray(names) ? [...new Set(names.filter((name): name is string => typeof name === 'string' && ENV_NAME.test(name)))].sort() : [];
}

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function verifyToolSet(file: ToolSetFile, pin: Pin): ApprovedTool[] | null {
  if (!file || file.version !== 1 || file.serverId !== pin.serverId || file.surfaceRoot !== pin.surfaceRoot || !Array.isArray(file.tools) || !Array.isArray(file.envNames)) {
    return null;
  }
  if (!pin.descriptorHashes || typeof pin.descriptorHashes !== 'object') {
    return null;
  }
  const pinnedTools = Object.keys(pin.descriptorHashes).filter((key) => key.startsWith('tool:'));
  if (pinnedTools.length !== file.tools.length) {
    return null;
  }
  const seen = new Set<string>();
  const tools: ApprovedTool[] = [];
  for (const entry of file.tools) {
    if (!entry || typeof entry.canonical !== 'string') {
      return null;
    }
    let value: any;
    try {
      value = JSON.parse(entry.canonical);
    } catch {
      return null;
    }
    const name = value && typeof value.name === 'string' ? value.name : '';
    const key = `tool:${name}`;
    if (!name || seen.has(key) || pin.descriptorHashes[key] !== hashOf(entry.canonical)) {
      return null;
    }
    seen.add(key);
    tools.push({
      name,
      description: typeof value.description === 'string' ? value.description : '',
      inputSchema: value.inputSchema && typeof value.inputSchema === 'object' ? value.inputSchema : { type: 'object' }
    });
  }
  return tools;
}

// ---------------------------------------------------------------------------
// What a started server is given from this machine's environment: only names
// its own configuration reads, and once approved, only names it read then.

export function environmentNames(steward: Steward, server: ServerRef): readonly string[] {
  if (typeof steward.environmentNamesFor !== 'function') {
    return [];
  }
  try {
    return cleanNames(steward.environmentNamesFor(server));
  } catch {
    return [];
  }
}

/**
 * The variables to hand `server`: names its configuration reads, limited to
 * `allowed` when given, with values read from `source`. Names that are not set
 * are left out.
 */
export function launchEnvironment(steward: Steward, server: ServerRef, source: NodeJS.ProcessEnv = process.env, allowed?: readonly string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of environmentNames(steward, server)) {
    if (allowed && !allowed.includes(name)) {
      continue;
    }
    const value = lookupEnv(source, name);
    if (value !== undefined) {
      env[name] = value;
    }
  }
  return env;
}

/** Names the configuration reads now that it did not when the server was approved. */
export function newEnvironmentNames(current: readonly string[], approved: readonly string[]): string[] {
  return current.filter((name) => !approved.includes(name));
}

/** Exact name first, then any case, as Windows names variables. */
function lookupEnv(source: NodeJS.ProcessEnv, name: string): string | undefined {
  if (typeof source[name] === 'string') {
    return source[name];
  }
  const upper = name.toUpperCase();
  for (const [key, value] of Object.entries(source)) {
    if (key.toUpperCase() === upper && typeof value === 'string') {
      return value;
    }
  }
  return undefined;
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
  /** Environment variable names its configuration reads, which it is given when started. */
  readonly envNames: readonly string[];
  /**
   * The tools the agent may use, as approved. Null when the server is approved
   * but its tool list was not saved with that approval. Undefined when scanned
   * without a place to look for tool lists.
   */
  readonly agentTools?: readonly ApprovedTool[] | null;
  /** When the current approval was made, if the server is approved and it could be read. */
  readonly approvedAt?: string;
  /**
   * Environment variable names recorded with the approval: the most the server
   * is given when checked or called. Empty for an approval with no record.
   */
  readonly approvedEnvNames?: readonly string[];
  /** Names its configuration reads now that were not approved. Set only when there are some. */
  readonly newEnvNames?: readonly string[];
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
  const env = server.envNames.length
    ? `\n\nIt will be given these values from your environment, because its configuration reads them: ${server.envNames.join(', ')}`
    : '';
  return `This will ${action}, as set in:\n${files.join('\n') || 'an unknown file'}${env}`;
}

function isInside(file: string, folder: string): boolean {
  const relative = path.relative(folder, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function scan(
  steward: Steward,
  pinDirectory: string = defaultPinDirectory(),
  projectDirectories: readonly string[] = [],
  options: { toolsDirectory?: string } = {}
): Promise<ScanResult> {
  const inventory = await steward.inventory(projectDirectories.length ? { projectDirectories } : undefined);
  const servers = await Promise.all(inventory.servers.map(async (ref): Promise<ServerSummary> => {
    const registrations = ref.registrations.map((site) => ({ ...site, clientLabel: clientLabel(site.client) }));
    let approved = false;
    try {
      approved = fs.existsSync(pinPathFor(ref.id, pinDirectory));
    } catch {
      approved = false;
    }
    // Reading the approval and the saved tool list touches only files on disk.
    const envNames = environmentNames(steward, ref);
    let agentTools: readonly ApprovedTool[] | null | undefined;
    let approvedAt: string | undefined;
    let approvedEnvNames: readonly string[] | undefined;
    let newEnvNames: string[] = [];
    if (approved && options.toolsDirectory) {
      agentTools = null;
      approvedEnvNames = [];
      try {
        const pin = await steward.loadPin(pinPathFor(ref.id, pinDirectory));
        if (pin && pin.serverId === ref.id) {
          approvedAt = typeof pin.approvedAt === 'string' ? pin.approvedAt : undefined;
          const record = loadApprovedRecord(pin, options.toolsDirectory);
          if (record) {
            approvedEnvNames = record.envNames;
            newEnvNames = newEnvironmentNames(envNames, record.envNames);
            // A configuration that now reads variables nobody approved is not
            // offered to the agent until it is approved again.
            agentTools = newEnvNames.length ? null : record.tools;
          }
        }
      } catch {
        agentTools = null;
      }
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
      approved,
      envNames,
      ...(agentTools === undefined ? {} : { agentTools }),
      ...(approvedAt === undefined ? {} : { approvedAt }),
      ...(approvedEnvNames === undefined ? {} : { approvedEnvNames }),
      ...(newEnvNames.length ? { newEnvNames } : {})
    };
  }));
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
  /** Whether the tool list was saved, so the agent can use this server. */
  readonly agentReady: boolean;
}

interface ApproveOptions {
  readonly approvedBy?: string;
  readonly pinDirectory?: string;
  /** Where approved tool lists live. Without it, nothing is saved for the agent. */
  readonly toolsDirectory?: string;
  /** The environment variable names the server was given, recorded with the approval. */
  readonly envNames?: readonly string[];
}

export async function approve(steward: Steward, server: ServerRef, options: OperationOptions & ApproveOptions = {}): Promise<ApproveResult> {
  const surface = await steward.captureServer(server, { signal: options.signal, timeoutMs: options.timeoutMs, ...(options.env ? { env: options.env } : {}) });
  return approveSurface(steward, server, surface, options);
}

/**
 * Pin a surface that was already captured, such as the one a check just
 * compared. Accepting a reviewed change this way pins exactly what the user
 * looked at, not a fresh capture that could differ from it.
 */
export async function approveSurface(steward: Steward, server: ServerRef, surface: Surface, options: ApproveOptions = {}): Promise<ApproveResult> {
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
  // The approval stands either way; only the agent's use of it depends on this.
  let agentReady = false;
  if (options.toolsDirectory) {
    try {
      await saveToolSet(surface, pin, options.toolsDirectory, options.envNames);
      agentReady = true;
    } catch {
      agentReady = false;
    }
  }
  return {
    approvedAt: pin.approvedAt,
    tools: surface.descriptors.filter((descriptor) => descriptor.category === 'tool').length,
    items: surface.descriptors.length,
    agentReady
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

export async function check(steward: Steward, server: ServerRef, options: OperationOptions & { pinDirectory?: string; toolsDirectory?: string; envNames?: readonly string[] } = {}): Promise<CheckResult> {
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
  const { surface, report } = await steward.diffServer(server, pin, { signal: options.signal, timeoutMs: options.timeoutMs, ...(options.env ? { env: options.env } : {}) });

  const events = [...report.events].sort((a, b) => RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk));
  // An unchanged surface is, hash for hash, the one approved, so its tools can
  // be saved for the agent without approving anything new. This is how a server
  // approved before tool lists were kept becomes usable by a plain check.
  if (!events.length && options.toolsDirectory && !loadToolSet(pin, options.toolsDirectory)) {
    try {
      await saveToolSet(surface, pin, options.toolsDirectory, options.envNames);
    } catch {
      // A check reports changes; failing to save a list is not one.
    }
  }
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
  if (name === 'ServerChangedError') {
    return `${serverName} changed since you approved it, so nothing was sent.`;
  }
  if (name === 'ToolNotApprovedError') {
    return `${serverName} has no approved tool by that name, so nothing was sent.`;
  }
  if (/placeholder|only the client that owns this configuration/i.test(message)) {
    // A value such as ${input:...} is filled in by the client that owns the
    // configuration, usually by asking, and nothing here can stand in for it.
    const target = serverId && SAFE_SERVER_ID.test(serverId) ? ` ${serverId}` : '';
    return `${serverName} reads a value in its configuration that is not set in the environment VS Code started with, or that only its own MCP client can fill in. HybridMind cannot start it. Run "npx mcpsteward trust${target}" in a terminal instead.`;
  }
  if (/not found/i.test(message) && /command/i.test(message)) {
    return `${serverName} could not be started: its program is not installed or not on your PATH.`;
  }
  // mcpsteward redacts its own messages before they reach here.
  return `${serverName}: ${message || 'the check failed.'}`;
}
