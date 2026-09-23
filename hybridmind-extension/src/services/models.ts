import type { OntologyObject } from '@hybridmind/ontology-core';
/**
 * Which providers the user holds a key for.
 *
 * Injected rather than read from a module here. In the web app this came from
 * localStorage; in the extension keys live in VS Code's SecretStorage, which is
 * OS-encrypted, asynchronous, and unreachable from a pure function. Taking the
 * answer as an argument keeps this file pure and testable and lets the caller
 * supply whichever store it actually uses.
 *
 * keyAvailable is what makes BYOK enforceable rather than assumed: a frontier
 * model without a key is never a candidate, so this predicate must reflect the
 * real store and never be defaulted to true.
 */
export type Provider = 'google' | 'openrouter' | 'anthropic' | 'openai' | 'groq' | 'deepseek' | 'qwen';

export type HasKey = (provider: Provider) => boolean;

/** Used when a caller supplies no predicate: nothing is keyed, so nothing frontier is eligible. */
export const NO_KEYS: HasKey = () => false;

/**
 * The model catalog: what this user can actually run, as ontology objects.
 *
 * Two sources, and they are asymmetric on purpose.
 *
 * Local models are discovered through the bridge rather than the browser, from
 * Ollama and LM Studio. Going through the bridge keeps discovery on the same path
 * as GPU telemetry and avoids depending on the user having set OLLAMA_ORIGINS or
 * enabled CORS in LM Studio before the app can see anything. LM Studio's own REST
 * API reports quantization and maximum context length, so those are read; Ollama
 * reports neither context window nor footprint, so both are derived and the
 * object says so.
 *
 * Frontier models are a curated static list. There is no catalog endpoint that
 * works without a key, and a model the user cannot call is not a candidate, so
 * keyAvailable comes from hasKey() and nothing else. BYOK is absolute here: an
 * unkeyed frontier model is carried in the catalog so the UI can offer it, and is
 * never selectable.
 *
 * Absence is a state, not a failure. A machine with no Ollama and no LM Studio
 * produces a catalog that says which runtimes were unreachable and why; a machine
 * running LM Studio with nothing downloaded produces a catalog that says that
 * instead. Collapsing those into an empty list is what makes a user chase a
 * problem that does not exist.
 */

/* ------------------------------------------------------------ VRAM estimation */

/**
 * Bits per weight by quantization tag, as the GGUF schemes actually land rather
 * than as their names suggest: Q4_K_M averages nearer 4.8 bits than 4, because
 * the K-quant schemes store per-block scales alongside the weights.
 *
 * These are the figures the estimate rests on. They are not measurements of any
 * particular model, and a model whose tensors are mixed precision will land
 * somewhere between two rows here.
 */
const BITS_PER_WEIGHT: Array<[RegExp, number]> = [
  [/^f32|fp32|float32/i, 32],
  [/^f16|fp16|bf16|float16/i, 16],
  [/^q8/i, 8.5],
  [/^q6/i, 6.6],
  [/^q5/i, 5.5],
  [/^q4/i, 4.8],
  [/^q3/i, 3.9],
  [/^q2/i, 3.0],
  [/^iq4/i, 4.3],
  [/^iq3/i, 3.4],
  [/^iq2/i, 2.4],
  [/^mxfp4/i, 4.25],
];

/** Assumed when no quantization is reported. Q4 K-quants are the common default. */
const DEFAULT_BITS_PER_WEIGHT = 4.8;

/**
 * Runtime, KV cache and CUDA context overhead on top of the weights. A flat
 * fraction plus a floor, because the fixed costs dominate on a small model and
 * the context-proportional ones dominate on a large one.
 */
const OVERHEAD_FRACTION = 0.15;
const OVERHEAD_FLOOR_MB = 512;

export function bitsPerWeight(quantization?: string): number {
  if (!quantization) return DEFAULT_BITS_PER_WEIGHT;
  const tag = quantization.trim();
  for (const [pattern, bits] of BITS_PER_WEIGHT) {
    if (pattern.test(tag)) return bits;
  }
  return DEFAULT_BITS_PER_WEIGHT;
}

/**
 * Parameter count from a runtime-reported string such as "32B", "7.6B" or
 * "8x7B". Returns undefined rather than a guess when the string is not one of
 * those shapes, since a wrong parameter count produces a confidently wrong
 * footprint.
 */
export function parseParameterCount(parameterSize?: string): number | undefined {
  if (!parameterSize) return undefined;
  const text = parameterSize.trim().toUpperCase().replace(/\s+/g, '');
  const match = /^(?:(\d+)X)?(\d+(?:\.\d+)?)([BM])$/.exec(text);
  if (!match) return undefined;
  const experts = match[1] ? Number(match[1]) : 1;
  const magnitude = match[3] === 'B' ? 1e9 : 1e6;
  const count = experts * Number(match[2]) * magnitude;
  return Number.isFinite(count) && count > 0 ? count : undefined;
}

/**
 * Estimated VRAM to serve a model locally. This is arithmetic on the parameter
 * count and the quantization tag, not a measurement: weights at the given bit
 * width, plus a fraction for KV cache and runtime overhead with a floor. Actual
 * residency depends on context length, batch size and how much the runtime
 * offloads, and will differ. When a file size is known it is used for the weights
 * instead of the bit-width arithmetic, since that part is then observed.
 */
export function estimateVramMb(options: {
  parameterSize?: string;
  quantization?: string;
  sizeBytes?: number;
}): number | undefined {
  const MIB = 1024 * 1024;
  let weightsMb: number | undefined;

  if (typeof options.sizeBytes === 'number' && options.sizeBytes > 0) {
    weightsMb = options.sizeBytes / MIB;
  } else {
    const params = parseParameterCount(options.parameterSize);
    if (params === undefined) return undefined;
    weightsMb = (params * bitsPerWeight(options.quantization)) / 8 / MIB;
  }

  return Math.round(weightsMb * (1 + OVERHEAD_FRACTION) + OVERHEAD_FLOOR_MB);
}

/**
 * Capability as an ordinal over parameter count. Nothing here has been
 * benchmarked, and this is not a quality claim: it is the only ordering
 * available without running evaluations, and selectModelForTask needs some
 * ordering to mean "most capable".
 */
export function localCapabilityTier(parameterSize?: string): number | undefined {
  const params = parseParameterCount(parameterSize);
  if (params === undefined) return undefined;
  const billions = params / 1e9;
  if (billions < 4) return 1;
  if (billions < 14) return 2;
  if (billions < 35) return 3;
  if (billions < 80) return 4;
  return 5;
}

/** Context window assumed for a local model whose runtime does not report one. */
const ASSUMED_LOCAL_CONTEXT = 8192;

/* ------------------------------------------------------- local runtime inputs */

export interface OllamaModelPayload {
  name: string;
  sizeBytes?: number;
  parameterSize?: string;
  quantization?: string;
  family?: string;
}

export interface OllamaPayload {
  available: boolean;
  reason?: string;
  installed?: unknown;
  resident?: unknown;
}

export interface LmStudioModelPayload {
  id: string;
  type?: string;
  quantization?: string;
  arch?: string;
  publisher?: string;
  maxContextLength?: number;
  state?: string;
  source?: string;
}

export interface LmStudioPayload {
  available: boolean;
  reason?: string;
  port?: number;
  portSource?: string;
  api?: 'api/v0' | 'v1' | string;
  models?: unknown;
  settings?: LmStudioSettingsPayload;
}

export interface LmStudioSettingsPayload {
  root?: string;
  server?: {
    found?: boolean;
    file?: string;
    reason?: string;
    port?: number;
    corsEnabled?: boolean;
  };
  settingsReason?: string;
  modelsDirectory?: { configured?: string; used?: boolean; reason?: string; path?: string };
  presets?: Array<Record<string, unknown>>;
}

export class CatalogError extends Error {}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

/**
 * Normalizes a bridge payload. The bridge already validates what the runtime
 * returned, and this validates again on the way in: the two are separate trust
 * boundaries, and a payload arriving here has crossed Firestore in between.
 */
export function parseOllamaModels(payload: unknown): OllamaModelPayload[] {
  if (!Array.isArray(payload)) {
    throw new CatalogError('Ollama model listing is not an array.');
  }
  const out: OllamaModelPayload[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const name = str(record.name);
    // A nameless entry cannot be loaded or keyed, so it is dropped rather than
    // given a placeholder id that would later fail to resolve.
    if (!name) continue;
    const model: OllamaModelPayload = { name };
    const sizeBytes = count(record.sizeBytes);
    if (sizeBytes !== undefined) model.sizeBytes = sizeBytes;
    const parameterSize = str(record.parameterSize);
    if (parameterSize) model.parameterSize = parameterSize;
    const quantization = str(record.quantization);
    if (quantization) model.quantization = quantization;
    const family = str(record.family);
    if (family) model.family = family;
    out.push(model);
  }
  return out;
}

export function parseLmStudioModels(payload: unknown): LmStudioModelPayload[] {
  if (!Array.isArray(payload)) {
    throw new CatalogError('LM Studio model listing is not an array.');
  }
  const out: LmStudioModelPayload[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const id = str(record.id);
    if (!id) continue;
    const model: LmStudioModelPayload = { id };
    const type = str(record.type);
    if (type) model.type = type;
    const quantization = str(record.quantization);
    if (quantization) model.quantization = quantization;
    const arch = str(record.arch);
    if (arch) model.arch = arch;
    const publisher = str(record.publisher);
    if (publisher) model.publisher = publisher;
    const maxContextLength = count(record.maxContextLength);
    if (maxContextLength !== undefined) model.maxContextLength = maxContextLength;
    const state = str(record.state);
    if (state) model.state = state;
    const source = str(record.source);
    if (source) model.source = source;
    out.push(model);
  }
  return out;
}

/**
 * Parameter size is not in Ollama's /api/tags for every model, but it is usually
 * in the tag itself ("qwen2.5-coder:32b"). Reading it from the name is a fallback
 * for when details.parameter_size is absent.
 */
function parameterSizeFromName(name: string): string | undefined {
  const match = /[:-](\d+(?:\.\d+)?)b\b/i.exec(name);
  return match ? `${match[1]}B` : undefined;
}

function localModelObject(options: {
  id: string;
  displayName: string;
  runtime: 'ollama' | 'lmstudio';
  provider: string;
  parameterSize?: string;
  quantization?: string;
  sizeBytes?: number;
  contextWindow?: number;
  contextWindowReported: boolean;
  supportsTools?: boolean;
}): OntologyObject {
  const properties: Record<string, unknown> = {
    id: options.id,
    displayName: options.displayName,
    residence: 'local',
    runtime: options.runtime,
    provider: options.provider,
    // Local inference costs the user nothing beyond electricity, which is what
    // makes a local fit the cheapest answer available rather than merely cheap.
    costPerMTokensIn: 0,
    costPerMTokensOut: 0,
    // Nothing to key: the weights are on the machine.
    keyAvailable: true,
  };

  if (options.parameterSize) properties.parameterSize = options.parameterSize;
  if (options.quantization) properties.quantization = options.quantization;

  const vram = estimateVramMb({
    parameterSize: options.parameterSize,
    quantization: options.quantization,
    sizeBytes: options.sizeBytes,
  });
  if (vram !== undefined) {
    properties.vramRequiredMb = vram;
    properties.vramEstimated = true;
  }

  const tier = localCapabilityTier(options.parameterSize);
  if (tier !== undefined) properties.capabilityTier = tier;

  properties.contextWindow = options.contextWindow ?? ASSUMED_LOCAL_CONTEXT;
  properties.contextWindowSource = options.contextWindowReported ? 'reported' : 'estimated';

  if (options.supportsTools !== undefined) properties.supportsTools = options.supportsTools;

  return { type: 'Model', id: options.id, properties, schemaVersion: 2 };
}

export function ollamaModelObjects(models: OllamaModelPayload[]): OntologyObject[] {
  return models.map((m) => {
    const parameterSize = m.parameterSize ?? parameterSizeFromName(m.name);
    return localModelObject({
      id: m.name,
      displayName: m.name,
      runtime: 'ollama',
      provider: 'ollama',
      parameterSize,
      quantization: m.quantization,
      sizeBytes: m.sizeBytes,
      // Ollama's tag listing carries no context window, so the value is an
      // assumption and is marked as one. Tool support is likewise unreported,
      // so it is left absent rather than claimed: routeInference treats an
      // absent supportsTools as "not known to support tools", which is the
      // honest reading.
      contextWindowReported: false,
    });
  });
}

export function lmStudioModelObjects(models: LmStudioModelPayload[]): OntologyObject[] {
  return (
    models
      // Embedding models cannot serve a chat task, so they are not candidates.
      .filter((m) => m.type !== 'embeddings')
      .map((m) =>
        localModelObject({
          id: m.id,
          displayName: m.id,
          runtime: 'lmstudio',
          provider: 'lmstudio',
          parameterSize: parameterSizeFromName(m.id),
          quantization: m.quantization,
          // /api/v0/models reports the real maximum context, which is strictly
          // better than the assumption Ollama forces. /v1/models does not, and
          // a model discovered that way falls back to the assumption.
          contextWindow: m.maxContextLength,
          contextWindowReported: m.maxContextLength !== undefined,
        }),
      )
  );
}

/* ---------------------------------------------------------- frontier catalog */

interface FrontierSpec {
  id: string;
  displayName: string;
  provider: Provider;
  contextWindow: number;
  supportsTools: boolean;
  costPerMTokensIn: number;
  costPerMTokensOut: number;
  capabilityTier: number;
}

/**
 * Curated because there is no way to enumerate a provider's models, with prices,
 * without a key for each one.
 *
 * Prices are USD per million tokens at standard (non-batch, non-cached) rates as
 * last checked. They move, and two of them are known to be approximate: Groq and
 * DashScope publish per-model rates that change with promotional tiers, and the
 * Qwen figures here are converted from CNY list prices. Treat every number as a
 * planning figure and the provider's console as the authority. A price that is
 * wrong here makes a cheapest-first choice wrong, not a call fail.
 */
export const FRONTIER_MODELS: FrontierSpec[] = [
  // Anthropic
  { id: 'claude-opus-4-5', displayName: 'Claude Opus 4.5', provider: 'anthropic', contextWindow: 200000, supportsTools: true, costPerMTokensIn: 5, costPerMTokensOut: 25, capabilityTier: 5 },
  { id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', provider: 'anthropic', contextWindow: 200000, supportsTools: true, costPerMTokensIn: 3, costPerMTokensOut: 15, capabilityTier: 5 },
  { id: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5', provider: 'anthropic', contextWindow: 200000, supportsTools: true, costPerMTokensIn: 1, costPerMTokensOut: 5, capabilityTier: 3 },

  // OpenAI
  { id: 'gpt-5.1', displayName: 'GPT-5.1', provider: 'openai', contextWindow: 400000, supportsTools: true, costPerMTokensIn: 1.25, costPerMTokensOut: 10, capabilityTier: 5 },
  { id: 'gpt-5-mini', displayName: 'GPT-5 mini', provider: 'openai', contextWindow: 400000, supportsTools: true, costPerMTokensIn: 0.25, costPerMTokensOut: 2, capabilityTier: 3 },
  { id: 'gpt-5-nano', displayName: 'GPT-5 nano', provider: 'openai', contextWindow: 400000, supportsTools: true, costPerMTokensIn: 0.05, costPerMTokensOut: 0.4, capabilityTier: 2 },

  // Google. Gemini 2.5 Pro charges more above a 200k prompt; the lower tier is
  // quoted here, so a very long prompt costs more than this figure implies.
  { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', provider: 'google', contextWindow: 1048576, supportsTools: true, costPerMTokensIn: 1.25, costPerMTokensOut: 10, capabilityTier: 5 },
  { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', provider: 'google', contextWindow: 1048576, supportsTools: true, costPerMTokensIn: 0.3, costPerMTokensOut: 2.5, capabilityTier: 3 },
  { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', provider: 'google', contextWindow: 1048576, supportsTools: true, costPerMTokensIn: 0.1, costPerMTokensOut: 0.4, capabilityTier: 2 },

  // DeepSeek. Off-peak discounts are not reflected here.
  { id: 'deepseek-chat', displayName: 'DeepSeek V3 (chat)', provider: 'deepseek', contextWindow: 128000, supportsTools: true, costPerMTokensIn: 0.28, costPerMTokensOut: 0.42, capabilityTier: 4 },
  { id: 'deepseek-reasoner', displayName: 'DeepSeek R1 (reasoner)', provider: 'deepseek', contextWindow: 128000, supportsTools: false, costPerMTokensIn: 0.28, costPerMTokensOut: 1.68, capabilityTier: 4 },

  // Groq serves open-weight models; rates are approximate and per-model.
  { id: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B (Groq)', provider: 'groq', contextWindow: 131072, supportsTools: true, costPerMTokensIn: 0.59, costPerMTokensOut: 0.79, capabilityTier: 3 },
  { id: 'qwen3-32b', displayName: 'Qwen3 32B (Groq)', provider: 'groq', contextWindow: 131072, supportsTools: true, costPerMTokensIn: 0.29, costPerMTokensOut: 0.59, capabilityTier: 3 },

  // Qwen via DashScope; figures converted from CNY list prices and approximate.
  { id: 'qwen3-max', displayName: 'Qwen3 Max', provider: 'qwen', contextWindow: 262144, supportsTools: true, costPerMTokensIn: 1.2, costPerMTokensOut: 6, capabilityTier: 4 },
  { id: 'qwen-plus', displayName: 'Qwen Plus', provider: 'qwen', contextWindow: 131072, supportsTools: true, costPerMTokensIn: 0.4, costPerMTokensOut: 1.2, capabilityTier: 3 },

  // OpenRouter-routed. Ids keep the vendor prefix, which is how
  // providerForModel() recognizes them; OpenRouter passes provider pricing
  // through with its own margin, so these are at or above the direct rates.
  { id: 'anthropic/claude-sonnet-4.5', displayName: 'Claude Sonnet 4.5 (OpenRouter)', provider: 'openrouter', contextWindow: 200000, supportsTools: true, costPerMTokensIn: 3, costPerMTokensOut: 15, capabilityTier: 5 },
  { id: 'deepseek/deepseek-chat', displayName: 'DeepSeek V3 (OpenRouter)', provider: 'openrouter', contextWindow: 128000, supportsTools: true, costPerMTokensIn: 0.28, costPerMTokensOut: 0.42, capabilityTier: 4 },
];

/**
 * Frontier models as ontology objects, with keyAvailable read from local storage
 * at the moment of the call. The value is deliberately not cached: a user adding
 * a key should see the catalog change on the next build, not after a reload.
 */
export function frontierModelObjects(hasKey: HasKey = NO_KEYS): OntologyObject[] {
  return FRONTIER_MODELS.map((spec) => ({
    type: 'Model',
    id: spec.id,
    schemaVersion: 2,
    properties: {
      id: spec.id,
      displayName: spec.displayName,
      residence: 'frontier',
      runtime: 'frontier',
      provider: spec.provider,
      contextWindow: spec.contextWindow,
      contextWindowSource: 'reported',
      supportsTools: spec.supportsTools,
      costPerMTokensIn: spec.costPerMTokensIn,
      costPerMTokensOut: spec.costPerMTokensOut,
      capabilityTier: spec.capabilityTier,
      keyAvailable: hasKey(spec.provider),
    },
  }));
}

/* ------------------------------------------------------------------- catalog */

export interface RuntimeStatus {
  runtime: 'ollama' | 'lmstudio';
  reachable: boolean;
  /** Plain statement of what was found. Never empty, including when all is well. */
  reason: string;
  modelCount: number;
  /** Which LM Studio endpoint answered, when one did. */
  api?: string;
  port?: number;
  portSource?: string;
  /** Read from LM Studio's server config, when it was readable. */
  corsEnabled?: boolean;
  configSource?: string;
  configReason?: string;
}

export interface ModelCatalog {
  models: OntologyObject[];
  local: RuntimeStatus[];
  /** True when no local runtime answered at all, which is distinct from none installed. */
  noLocalRuntime: boolean;
  /** One line naming the state of local inference on this machine. */
  localSummary: string;
  frontierKeyed: number;
  frontierTotal: number;
}

export interface CatalogInput {
  ollama?: OllamaPayload | null;
  lmStudio?: LmStudioPayload | null;
  /** Which providers are keyed. Omitted means none, so no frontier model is eligible. */
  hasKey?: HasKey;
}

function ollamaStatus(payload: OllamaPayload | null | undefined): { status: RuntimeStatus; models: OntologyObject[] } {
  if (!payload) {
    return {
      status: { runtime: 'ollama', reachable: false, reason: 'Ollama was not queried: no bridge is paired, so local models cannot be discovered.', modelCount: 0 },
      models: [],
    };
  }
  if (!payload.available) {
    return {
      status: {
        runtime: 'ollama',
        reachable: false,
        reason: payload.reason ?? 'Ollama is not reachable and gave no reason.',
        modelCount: 0,
      },
      models: [],
    };
  }

  let models: OntologyObject[] = [];
  let reason: string;
  try {
    const parsed = parseOllamaModels(payload.installed ?? []);
    models = ollamaModelObjects(parsed);
    reason = models.length
      ? `Ollama is running with ${models.length} model(s) installed.`
      : 'Ollama is running but has no models installed. Pull one with "ollama pull".';
  } catch (error) {
    // A reachable runtime returning something unreadable is neither absent nor
    // working, and saying so is more useful than an empty list either way.
    models = [];
    reason = `Ollama answered but its model listing could not be read: ${error instanceof Error ? error.message : String(error)}`;
    return { status: { runtime: 'ollama', reachable: true, reason, modelCount: 0 }, models };
  }

  return { status: { runtime: 'ollama', reachable: true, reason, modelCount: models.length }, models };
}

function lmStudioStatus(payload: LmStudioPayload | null | undefined): { status: RuntimeStatus; models: OntologyObject[] } {
  const config = payload?.settings?.server;
  const configFields = {
    port: payload?.port ?? config?.port,
    portSource: payload?.portSource,
    corsEnabled: config?.corsEnabled,
    configSource: config?.found ? config.file : undefined,
    // The reason the config could not be read matters: it is the difference
    // between reporting the real CORS setting and having to hedge about it.
    configReason: config?.found ? undefined : (config?.reason ?? 'LM Studio server config was not found, so the configured port and CORS setting are unknown.'),
  };

  if (!payload) {
    return {
      status: {
        runtime: 'lmstudio',
        reachable: false,
        reason: 'LM Studio was not queried: no bridge is paired, so local models cannot be discovered.',
        modelCount: 0,
      },
      models: [],
    };
  }
  if (!payload.available) {
    return {
      status: {
        runtime: 'lmstudio',
        reachable: false,
        reason: payload.reason ?? 'LM Studio is not reachable and gave no reason.',
        modelCount: 0,
        ...configFields,
      },
      models: [],
    };
  }

  let models: OntologyObject[] = [];
  try {
    models = lmStudioModelObjects(parseLmStudioModels(payload.models ?? []));
  } catch (error) {
    return {
      status: {
        runtime: 'lmstudio',
        reachable: true,
        reason: `LM Studio answered but its model listing could not be read: ${error instanceof Error ? error.message : String(error)}`,
        modelCount: 0,
        api: payload.api,
        ...configFields,
      },
      models: [],
    };
  }

  const via =
    payload.api === 'v1'
      ? ' Discovery used the OpenAI-compatible endpoint, so context windows are estimated and quantization is unknown.'
      : payload.api === 'api/v0'
        ? ' Context window and quantization were reported by LM Studio rather than estimated.'
        : '';

  const reason = models.length
    ? `LM Studio is running with ${models.length} model(s) available.${via}`
    : 'LM Studio is running but has no usable models loaded or downloaded.';

  return {
    status: { runtime: 'lmstudio', reachable: true, reason, modelCount: models.length, api: payload.api, ...configFields },
    models,
  };
}

/**
 * Builds the catalog from whatever the bridge returned. Pure: every input is
 * passed in, nothing here fetches, and the only ambient read is hasKey().
 */
export function buildCatalog(input: CatalogInput = {}): ModelCatalog {
  const ollama = ollamaStatus(input.ollama);
  const lmStudio = lmStudioStatus(input.lmStudio);
  const local = [ollama.status, lmStudio.status];
  const frontier = frontierModelObjects(input.hasKey ?? NO_KEYS);

  const noLocalRuntime = local.every((s) => !s.reachable);
  const localSummary = noLocalRuntime
    ? `No local runtime is reachable. ${local.map((s) => s.reason).join(' ')}`
    : local
        .filter((s) => s.reachable)
        .map((s) => s.reason)
        .join(' ');

  return {
    models: [...ollama.models, ...lmStudio.models, ...frontier],
    local,
    noLocalRuntime,
    localSummary,
    frontierKeyed: frontier.filter((m) => m.properties.keyAvailable === true).length,
    frontierTotal: frontier.length,
  };
}

/**
 * Base URL for a local runtime's OpenAI-compatible endpoint.
 *
 * Exported from here rather than duplicated in the call path: discovery knows
 * which port answered, and the caller should use that same port rather than its
 * own default. Ollama serves an OpenAI-compatible surface at /v1 alongside its
 * native API, so both runtimes can be driven the same way.
 */
export function localBaseUrl(runtime: 'ollama' | 'lmstudio', port?: number): string {
  const fallback = runtime === 'ollama' ? 11434 : 1234;
  const resolved = Number.isInteger(port) && (port as number) > 0 && (port as number) <= 65535 ? port : fallback;
  return `http://127.0.0.1:${resolved}/v1`;
}

/* ------------------------------------------------------- discovery over the bridge */

/**
 * How a bridge command is performed. Injected so tests never need Firestore, and
 * so the caller decides whether a bridge exists at all.
 */
export type BridgeCaller = (
  command: string,
  args: Record<string, unknown>,
) => Promise<{ ok: boolean; output?: string; error?: string }>;

/**
 * Turns one discovery command into a payload the catalog can read.
 *
 * Three outcomes have to stay distinct, because the catalog reports them
 * differently and the user needs to tell them apart: the bridge refused or timed
 * out, the bridge answered with something unreadable, and the bridge answered
 * that the runtime is not running. Only the last is an ordinary state, and
 * collapsing any of them into an empty list would be a lie about the machine.
 */
async function discover<T>(
  call: BridgeCaller,
  command: string,
  runtime: 'ollama' | 'lmstudio',
  args: Record<string, unknown> = {},
): Promise<T | { available: false; runtime: string; reason: string } > {
  let result: { ok: boolean; output?: string; error?: string };
  try {
    result = await call(command, args);
  } catch (e) {
    // A thrown transport is the bridge being unreachable, not the runtime.
    return { available: false, runtime, reason: `The bridge could not be reached: ${(e as Error).message}` };
  }

  if (!result.ok) {
    return { available: false, runtime, reason: result.error ?? `The bridge reported a failure for ${command} with no detail.` };
  }

  try {
    const parsed = JSON.parse(result.output ?? '');
    if (!parsed || typeof parsed !== 'object') {
      return { available: false, runtime, reason: `The bridge answered ${command} with something that is not an object.` };
    }
    return parsed as T;
  } catch {
    return {
      available: false,
      runtime,
      reason: `The bridge answered ${command} with output that is not JSON, so what is installed cannot be determined.`,
    };
  }
}

/**
 * Builds the catalog from a live host.
 *
 * Both runtimes are queried together rather than in sequence: each carries the
 * bridge's own timeout, and a user with only one installed should not wait out
 * the other before a mission can start.
 *
 * With no bridge paired this still returns a catalog. The frontier models need no
 * host to enumerate and their keyAvailable comes from the user's own stored keys,
 * so selection has real candidates either way; what is missing is only the local
 * half, and the returned statuses say so.
 */
export async function discoverCatalog(call: BridgeCaller | null, hasKey: HasKey = NO_KEYS): Promise<ModelCatalog> {
  if (!call) return buildCatalog({ hasKey });

  const [ollama, lmStudio] = await Promise.all([
    discover<OllamaPayload>(call, 'ollama_models', 'ollama'),
    discover<LmStudioPayload>(call, 'lmstudio_models', 'lmstudio'),
  ]);

  return buildCatalog({ ollama: ollama as OllamaPayload, lmStudio: lmStudio as LmStudioPayload, hasKey });
}
