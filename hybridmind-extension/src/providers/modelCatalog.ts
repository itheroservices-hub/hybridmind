/**
 * The models a user's own provider key can actually use, asked of the provider.
 *
 * The sidebar used to offer a fixed list of short names ("llama-3.3-70b",
 * "claude-sonnet-4.5") that only the hosted backend knew how to translate.
 * That backend is gone, the names were sent to providers unchanged, and no
 * provider accepts them. A fixed list of real ids would work for a while and
 * then rot the same way, so the list comes from the provider instead: it is
 * always current, and it only ever shows what this key can reach.
 *
 * Nothing here imports vscode, so it can be tested with a fake fetch.
 */

export type ProviderId = 'openai' | 'anthropic' | 'openrouter' | 'google' | 'groq' | 'deepseek' | 'qwen';

export interface CatalogModel {
  /** The id the provider's API expects, sent as is. */
  id: string;
  /** What to show. Falls back to the id. */
  name: string;
}

export interface Catalog {
  provider: ProviderId;
  providerLabel: string;
  models: CatalogModel[];
  /** A sensible first choice from `models`, or null when the list is empty. */
  defaultModel: string | null;
}

export type CatalogErrorKind = 'no-key' | 'unknown-provider' | 'rejected-key' | 'provider' | 'network';

export class CatalogError extends Error {
  constructor(public readonly kind: CatalogErrorKind, message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}

type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

interface ProviderSpec {
  label: string;
  listUrl: string;
  headers(key: string): Record<string, string>;
  parse(body: any): CatalogModel[];
  /** Tried in order against the listed ids; the first match is the default. */
  preferred: RegExp[];
  /**
   * Set when listing does not need a key, so a successful listing says nothing
   * about whether the key is good and it has to be checked somewhere else.
   */
  keyCheckUrl?: string;
}

const bearer = (key: string) => ({ Authorization: `Bearer ${key}` });

/** `{ data: [{ id, name? }] }`, the OpenAI list shape most providers copy. */
function parseOpenAiList(body: any, keep: (model: any) => boolean = () => true): CatalogModel[] {
  const rows: any[] = Array.isArray(body?.data) ? body.data : [];
  return rows
    .filter((row) => typeof row?.id === 'string' && keep(row))
    .map((row) => ({ id: row.id, name: typeof row.name === 'string' && row.name ? row.name : row.id }));
}

// A key lists every model on the account, including ones that cannot hold a
// chat. These are the kinds that are not chat models; anything new and unknown
// is kept, because hiding a usable model is worse than showing an unusable one.
const NOT_CHAT = /embed|whisper|tts|speech|dall-e|moderation|image|audio|realtime|transcri|rerank|guard|davinci|babbage|sora/i;

const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  openai: {
    label: 'OpenAI',
    listUrl: 'https://api.openai.com/v1/models',
    headers: bearer,
    parse: (body) => {
      const rows: any[] = Array.isArray(body?.data) ? [...body.data] : [];
      // OpenAI returns no particular order. Newest first puts current models
      // at the top of the list and makes the default the newest match.
      rows.sort((a, b) => (b?.created || 0) - (a?.created || 0));
      return parseOpenAiList({ data: rows }, (row) => !NOT_CHAT.test(row.id));
    },
    preferred: [/^gpt-5(\.\d+)?$/, /^gpt-4\.1$/, /^gpt-4o$/, /^gpt-/]
  },
  anthropic: {
    label: 'Anthropic',
    listUrl: 'https://api.anthropic.com/v1/models?limit=100',
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    parse: (body) => {
      const rows: any[] = Array.isArray(body?.data) ? body.data : [];
      return rows
        .filter((row) => typeof row?.id === 'string')
        .map((row) => ({ id: row.id, name: typeof row.display_name === 'string' && row.display_name ? row.display_name : row.id }));
    },
    // The API lists newest first, so this is the newest Sonnet.
    preferred: [/sonnet/]
  },
  openrouter: {
    label: 'OpenRouter',
    listUrl: 'https://openrouter.ai/api/v1/models',
    headers: bearer,
    parse: (body) => parseOpenAiList(body),
    // OpenRouter's own router: a valid choice on any account, and it never goes stale.
    preferred: [/^openrouter\/auto$/],
    keyCheckUrl: 'https://openrouter.ai/api/v1/key'
  },
  google: {
    label: 'Google',
    listUrl: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
    // A header, not the documented `?key=` parameter, so the key never sits in a URL.
    headers: (key) => ({ 'x-goog-api-key': key }),
    parse: (body) => {
      const rows: any[] = Array.isArray(body?.models) ? body.models : [];
      return rows
        .filter((row) => typeof row?.name === 'string'
          && Array.isArray(row.supportedGenerationMethods)
          && row.supportedGenerationMethods.includes('generateContent'))
        .map((row) => {
          // Listed as "models/gemini-...", but the generate call takes the bare id.
          const id = row.name.replace(/^models\//, '');
          return { id, name: typeof row.displayName === 'string' && row.displayName ? row.displayName : id };
        })
        .filter((model) => !NOT_CHAT.test(model.id));
    },
    preferred: [/^gemini-flash-latest$/, /^gemini-[\d.]+-flash$/, /flash/, /^gemini-/]
  },
  groq: {
    label: 'Groq',
    listUrl: 'https://api.groq.com/openai/v1/models',
    headers: bearer,
    parse: (body) => parseOpenAiList(body, (row) => row.active !== false && !NOT_CHAT.test(row.id)),
    preferred: [/^llama-3\.3-70b-versatile$/, /70b/, /llama/]
  },
  deepseek: {
    label: 'DeepSeek',
    listUrl: 'https://api.deepseek.com/models',
    headers: bearer,
    parse: (body) => parseOpenAiList(body),
    preferred: [/^deepseek-chat$/]
  },
  qwen: {
    label: 'Qwen',
    listUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
    headers: bearer,
    // The account lists every Model Studio model. Requests go to the text
    // generation endpoint, so only Qwen text models are offered.
    parse: (body) => parseOpenAiList(body, (row) => /^(qwen|qwq)/i.test(row.id) && !/vl|ocr|omni|mt-|asr/i.test(row.id) && !NOT_CHAT.test(row.id)),
    preferred: [/^qwen-plus$/, /^qwen-max$/, /^qwen-turbo$/, /^qwen/]
  }
};

const ALIASES: Record<string, ProviderId> = {
  gemini: 'google',
  claude: 'anthropic'
};

/** Maps a stored or typed provider name ("Google", "gemini", " Groq ") to its id. */
export function normalizeProvider(raw: string | null | undefined): ProviderId | null {
  const name = (raw || '').toLowerCase().trim();
  if (name in PROVIDERS) {
    return name as ProviderId;
  }
  return ALIASES[name] || null;
}

export function providerLabel(provider: ProviderId): string {
  return PROVIDERS[provider].label;
}

export function pickDefaultModel(provider: ProviderId, models: CatalogModel[]): string | null {
  for (const pattern of PROVIDERS[provider].preferred) {
    const match = models.find((model) => pattern.test(model.id));
    if (match) {
      return match.id;
    }
  }
  return models.length ? models[0].id : null;
}

const MAX_MODELS = 600;
const DEFAULT_TIMEOUT_MS = 10000;

async function getJson(url: string, headers: Record<string, string>, label: string, fetchImpl: FetchLike, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, { headers, signal: controller.signal });
  } catch (error: any) {
    const why = error?.name === 'AbortError' ? 'it did not answer in time' : 'the request could not be sent';
    throw new CatalogError('network', `Could not reach ${label}: ${why}. Check your connection and try again.`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new CatalogError('rejected-key', `${label} rejected this key. Check that it was copied in full and is still active.`);
  }
  if (!response.ok) {
    throw new CatalogError('provider', `${label} answered with an error (${response.status}). Try again in a moment.`);
  }

  try {
    return await response.json();
  } catch {
    throw new CatalogError('provider', `${label} sent a reply that could not be read. Try again in a moment.`);
  }
}

export interface CatalogOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/**
 * Asks the provider which models this key can use.
 * Throws a CatalogError whose message is safe to show the user: it never
 * contains the key.
 */
export async function loadCatalog(rawProvider: string | null | undefined, key: string | null | undefined, options: CatalogOptions = {}): Promise<Catalog> {
  const provider = normalizeProvider(rawProvider);
  if (!provider) {
    throw new CatalogError('unknown-provider', rawProvider
      ? `"${rawProvider}" is not a provider HybridMind can use.`
      : 'No provider is set. Add a key in the Keys tab.');
  }
  if (!key) {
    throw new CatalogError('no-key', 'No API key is set. Add one in the Keys tab.');
  }

  const spec = PROVIDERS[provider];
  const fetchImpl = options.fetchImpl || (fetch as unknown as FetchLike);
  const body = await getJson(spec.listUrl, spec.headers(key), spec.label, fetchImpl, options.timeoutMs || DEFAULT_TIMEOUT_MS);

  const seen = new Set<string>();
  const models: CatalogModel[] = [];
  for (const model of spec.parse(body)) {
    if (!seen.has(model.id) && models.length < MAX_MODELS) {
      seen.add(model.id);
      models.push(model);
    }
  }

  return { provider, providerLabel: spec.label, models, defaultModel: pickDefaultModel(provider, models) };
}

/**
 * Checks a key without spending anything: listing models is free, where the
 * old check sent a real completion (and used a model name no provider had).
 * Resolves when the key works and throws a CatalogError when it does not.
 */
export async function verifyKey(rawProvider: string | null | undefined, key: string | null | undefined, options: CatalogOptions = {}): Promise<Catalog> {
  const catalog = await loadCatalog(rawProvider, key, options);
  const spec = PROVIDERS[catalog.provider];
  if (spec.keyCheckUrl) {
    const fetchImpl = options.fetchImpl || (fetch as unknown as FetchLike);
    await getJson(spec.keyCheckUrl, spec.headers(key as string), spec.label, fetchImpl, options.timeoutMs || DEFAULT_TIMEOUT_MS);
  }
  return catalog;
}
