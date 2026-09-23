/**
 * LM Studio access for the bridge.
 *
 * LM Studio is the second local runtime, sitting beside Ollama: the user picks it
 * as a provider and the models they have downloaded appear next to the frontier
 * ones. Two endpoints matter. /api/v0/models is LM Studio's own REST API and
 * reports quantization, maximum context length, model type and load state, so
 * those figures are read rather than estimated. /v1/models is the OpenAI-
 * compatible listing and carries ids only; it is the fallback for builds that
 * predate /api/v0, and a catalog built from it has estimated context and no
 * quantization, which the caller is told rather than left to assume.
 *
 * As with Ollama, this speaks HTTP on loopback from Node directly. Nothing here
 * shells out, nothing is added to bridge-command-validator.cjs's allowlist, and
 * no caller-supplied string reaches a shell. Responses are treated as untrusted:
 * shapes are checked, strings bounded, bodies size-capped, requests timed out.
 *
 * It also reads LM Studio's on-disk configuration, which is what turns a failed
 * browser fetch from a guess into a diagnosis: the server config file records the
 * configured port and whether CORS is enabled, so "nothing answered on 1234" can
 * be reported as "the server is configured for 1234 with CORS disabled" instead
 * of a sentence that hedges between two causes. Those paths are undocumented
 * internals that move between versions and platforms, so every one of them is
 * optional: absent, oversized or unparseable configuration is an ordinary state
 * reported plainly, never a thrown error and never half-applied. Reads only. This
 * process never writes into LM Studio's directory, and nothing read from it is
 * logged wholesale or sent anywhere: it exists to populate the local UI.
 */

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const LMSTUDIO_HOST = "127.0.0.1";
/** LM Studio's default server port. Overridden by the configured port when readable. */
const DEFAULT_LMSTUDIO_PORT = 1234;

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 5000;
/** A JIT load pulls weights from disk, which is slow for a large model. */
const LOAD_TIMEOUT_MS = 120000;
const MAX_FIELD_CHARS = 200;

/** Config files are small; anything larger is not the file this expects. */
const MAX_CONFIG_BYTES = 256 * 1024;
const MAX_PRESET_BYTES = 64 * 1024;
const MAX_PRESETS = 20;
/** Deeply nested JSON is a denial-of-service shape, not a settings file. */
const MAX_JSON_DEPTH = 12;

/**
 * LM Studio ids look like "publisher/repo" or "publisher/repo@q4_k_m". Rejected
 * rather than sanitized: an id needing repair is not one to act on.
 */
const MODEL_ID = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+){0,2}(@[A-Za-z0-9._-]+)?$/;

function isValidModelId(id) {
  return typeof id === "string" && id.length > 0 && id.length <= MAX_FIELD_CHARS && MODEL_ID.test(id);
}

/** Raised when no server is answering, which is an ordinary state, not a fault. */
class LmStudioUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "LmStudioUnavailableError";
  }
}

function resolvePort(port) {
  const n = Number(port ?? process.env.LMSTUDIO_PORT ?? DEFAULT_LMSTUDIO_PORT);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : DEFAULT_LMSTUDIO_PORT;
}

function request(method, path_, { port, body, timeoutMs } = {}) {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body), "utf8");
  const limit = timeoutMs ?? (method === "POST" ? LOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  const target = resolvePort(port);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: LMSTUDIO_HOST,
        port: target,
        path: path_,
        method,
        headers: payload
          ? { "content-type": "application/json", "content-length": String(payload.length) }
          : {},
      },
      (res) => {
        let size = 0;
        const chunks = [];
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            req.destroy();
            reject(new Error(`LM Studio returned more than ${MAX_RESPONSE_BYTES} bytes for ${path_}; response discarded.`));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          if (status >= 400) {
            // The status is carried on the error so the caller can tell a missing
            // endpoint (fall back to /v1) from a server that is genuinely unwell.
            const error = new Error(`LM Studio replied ${status} to ${path_}: ${text.slice(0, 300)}`);
            error.statusCode = status;
            reject(error);
            return;
          }
          resolve(text);
        });
      },
    );

    req.setTimeout(limit, () => {
      req.destroy();
      reject(new Error(`LM Studio did not respond to ${path_} within ${limit / 1000}s.`));
    });

    req.on("error", (error) => {
      if (error.code === "ECONNREFUSED" || error.code === "EHOSTUNREACH" || error.code === "ECONNRESET") {
        reject(
          new LmStudioUnavailableError(
            `No LM Studio server is answering on ${LMSTUDIO_HOST}:${target} (${error.code}). Start the local server from LM Studio's Developer tab.`,
          ),
        );
      } else {
        reject(error);
      }
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function asField(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_FIELD_CHARS) return undefined;
  return trimmed;
}

function asCount(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.floor(value);
}

/**
 * /api/v0/models. The fields that matter are measured by LM Studio rather than
 * inferred here: quantization, max_context_length, and whether the model is
 * already resident.
 */
function parseV0Models(text) {
  const parsed = parseJsonBounded(text, "LM Studio model listing");
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.data)) {
    throw new Error("LM Studio /api/v0/models has no data array; the response shape is not one this bridge recognizes.");
  }

  const out = [];
  for (const entry of parsed.data) {
    if (!entry || typeof entry !== "object") continue;
    const id = asField(entry.id);
    if (!isValidModelId(id)) continue;

    const model = { id, source: "api/v0" };
    const type = asField(entry.type);
    if (type) model.type = type;
    const quantization = asField(entry.quantization);
    if (quantization) model.quantization = quantization;
    const arch = asField(entry.arch);
    if (arch) model.arch = arch;
    const publisher = asField(entry.publisher);
    if (publisher) model.publisher = publisher;
    const maxContext = asCount(entry.max_context_length);
    if (maxContext !== undefined) model.maxContextLength = maxContext;
    const loadedContext = asCount(entry.loaded_context_length);
    if (loadedContext !== undefined) model.loadedContextLength = loadedContext;
    const state = asField(entry.state);
    if (state) model.state = state;
    out.push(model);
  }
  return out;
}

/**
 * /v1/models, the OpenAI-compatible listing. Ids only, so a catalog built from
 * this carries no quantization and no real context window.
 */
function parseV1Models(text) {
  const parsed = parseJsonBounded(text, "LM Studio OpenAI-compatible model listing");
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.data)) {
    throw new Error("LM Studio /v1/models has no data array; the response shape is not one this bridge recognizes.");
  }

  const out = [];
  for (const entry of parsed.data) {
    if (!entry || typeof entry !== "object") continue;
    const id = asField(entry.id);
    if (!isValidModelId(id)) continue;
    out.push({ id, source: "v1" });
  }
  return out;
}

/**
 * Lists models, preferring the richer endpoint. A 404 means an LM Studio old
 * enough to have only the OpenAI-compatible route; any other failure is a real
 * problem and is not papered over by falling back.
 */
async function listModels({ port } = {}) {
  const target = resolvePort(port);
  try {
    const models = parseV0Models(await request("GET", "/api/v0/models", { port: target }));
    return { runtime: "lmstudio", port: target, api: "api/v0", models };
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    const models = parseV1Models(await request("GET", "/v1/models", { port: target }));
    return {
      runtime: "lmstudio",
      port: target,
      api: "v1",
      models,
      note: "This LM Studio build has no /api/v0/models, so quantization and context window were not reported and are estimated.",
    };
  }
}

/**
 * LM Studio has no separate load route: it JIT-loads a model on the first
 * inference request. So a model already reported as loaded is left alone and said
 * to be so, and otherwise a single-token completion is what brings it in. The
 * VRAM it occupies is not guessed here; a telemetry sample after the load
 * reports it.
 */
async function loadModel(id, { port } = {}) {
  if (!isValidModelId(id)) {
    throw new Error(`"${String(id).slice(0, 80)}" is not a valid LM Studio model id and was not sent to the server.`);
  }
  const target = resolvePort(port);

  let before;
  try {
    before = (await listModels({ port: target })).models.find((m) => m.id === id);
  } catch {
    before = undefined;
  }
  if (before?.state === "loaded") {
    return { runtime: "lmstudio", model: id, alreadyLoaded: true, resident: true };
  }

  await request("POST", "/v1/chat/completions", {
    port: target,
    body: { model: id, messages: [{ role: "user", content: "." }], max_tokens: 1, stream: false },
  });

  let after;
  try {
    after = (await listModels({ port: target })).models.find((m) => m.id === id);
  } catch {
    after = undefined;
  }
  return {
    runtime: "lmstudio",
    model: id,
    alreadyLoaded: false,
    // Undefined state on a /v1-only build means the load was requested and not
    // contradicted, which is not the same as confirmed resident.
    resident: after?.state === "loaded" ? true : after?.state === undefined ? undefined : false,
  };
}

/* ------------------------------------------------------------------ settings */

function homeDir() {
  // HOME and USERPROFILE are honoured before os.homedir() so a relocated profile
  // is followed rather than guessed at from a platform default.
  const fromEnv = process.env.HOME || process.env.USERPROFILE;
  if (fromEnv && typeof fromEnv === "string") return fromEnv;
  try {
    return os.homedir();
  } catch {
    return undefined;
  }
}

/**
 * Candidate LM Studio roots, newest layout first. Older builds kept everything
 * under ~/.cache/lm-studio.
 */
function candidateRoots() {
  const home = homeDir();
  if (!home) return [];
  return [path.join(home, ".lmstudio"), path.join(home, ".cache", "lm-studio")];
}

/** Exact filenames, relative to a root. Nothing is globbed and no directory is walked. */
const SERVER_CONFIG_FILES = [
  path.join(".internal", "http-server-config.json"),
  path.join(".internal", "server-config.json"),
];
const SETTINGS_FILES = [path.join(".internal", "settings.json"), path.join(".internal", "user-settings.json")];
const PRESET_DIR = "config-presets";

/** Keeps a resolved path inside its root, so a value read from a file cannot escape. */
function insideRoot(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);
  const rel = path.relative(resolvedRoot, resolved);
  if (rel === "") return resolved;
  return rel.startsWith("..") || path.isAbsolute(rel) ? undefined : resolved;
}

function depthOf(value, depth = 0) {
  if (depth > MAX_JSON_DEPTH) return depth;
  if (!value || typeof value !== "object") return depth;
  let deepest = depth;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const d = depthOf(child, depth + 1);
    if (d > deepest) deepest = d;
    if (deepest > MAX_JSON_DEPTH) break;
  }
  return deepest;
}

function parseJsonBounded(text, what) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch {
    throw new Error(`${what} is not valid JSON.`);
  }
  if (depthOf(parsed) > MAX_JSON_DEPTH) {
    throw new Error(`${what} nests deeper than ${MAX_JSON_DEPTH} levels and was refused.`);
  }
  return parsed;
}

/**
 * Reads one allowlisted file. Returns a reason rather than throwing, because
 * every one of these paths is an undocumented internal that may simply not
 * exist on this machine or this version.
 */
function readBoundedJson(file, maxBytes) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return { ok: false, reason: "absent" };
  }
  if (!stat.isFile()) return { ok: false, reason: "not a regular file" };
  // Size is checked before the read so an oversized file is never loaded.
  if (stat.size > maxBytes) {
    return { ok: false, reason: `larger than ${maxBytes} bytes (${stat.size}), so it was not read` };
  }
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    return { ok: false, reason: `unreadable (${error.code || error.message})` };
  }
  try {
    return { ok: true, value: parseJsonBounded(text, path.basename(file)) };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

/** Anything that looks like a credential is not surfaced at all. */
const CREDENTIAL_KEY = /key|token|secret|password|passphrase|credential|auth/i;

function firstNumber(object, keys) {
  for (const key of keys) {
    const n = asCount(object?.[key]);
    if (n !== undefined) return { value: n, key };
  }
  return undefined;
}

function firstBoolean(object, keys) {
  for (const key of keys) {
    if (typeof object?.[key] === "boolean") return { value: object[key], key };
  }
  return undefined;
}

/**
 * The server config, which is the one file worth reading carefully: it records
 * the configured port and whether CORS is enabled, which together decide whether
 * a browser fetch to the local server can succeed at all. Key spellings have
 * moved between versions, so a small set of them is accepted and the one that
 * matched is reported, rather than silently assuming a single shape.
 */
function readServerConfig() {
  for (const root of candidateRoots()) {
    for (const relative of SERVER_CONFIG_FILES) {
      const file = insideRoot(root, relative);
      if (!file) continue;
      const result = readBoundedJson(file, MAX_CONFIG_BYTES);
      if (!result.ok) {
        if (result.reason === "absent") continue;
        return { found: false, root, file, reason: `${relative}: ${result.reason}` };
      }
      const config = result.value && typeof result.value === "object" ? result.value : {};
      const port = firstNumber(config, ["port", "serverPort", "httpServerPort"]);
      const cors = firstBoolean(config, ["cors", "corsEnabled", "enableCors", "allowCors"]);
      return {
        found: true,
        root,
        file,
        port: port?.value,
        portKey: port?.key,
        corsEnabled: cors?.value,
        corsKey: cors?.key,
      };
    }
  }
  return {
    found: false,
    reason: candidateRoots().length
      ? "No LM Studio server config was found under ~/.lmstudio or ~/.cache/lm-studio."
      : "No home directory is resolvable, so LM Studio's configuration directory cannot be located.",
  };
}

/**
 * The models directory, when a settings file names one. A value read from a file
 * is untrusted, so a path that leaves the LM Studio root after normalization is
 * reported as refused rather than followed. Nothing here needs that directory;
 * it is reported for the UI, and refusing it costs only a display string.
 */
function readModelsDirectory(root, settings) {
  const raw = asField(settings?.modelsDirectory ?? settings?.modelsPath ?? settings?.downloadsDirectory);
  if (!raw) return undefined;
  const resolved = insideRoot(root, raw);
  if (!resolved) {
    return { configured: raw, used: false, reason: "resolves outside the LM Studio directory and was refused" };
  }
  return { configured: raw, used: true, path: resolved };
}

/**
 * Inference presets, for prefilling our own settings instead of asking the user
 * to retype temperature and context length. Only the numeric fields we can act
 * on are copied; anything credential-shaped is skipped entirely.
 */
function readPresets() {
  const presets = [];
  for (const root of candidateRoots()) {
    const dir = insideRoot(root, PRESET_DIR);
    if (!dir) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (presets.length >= MAX_PRESETS) break;
      if (!entry.isFile() || !entry.name.endsWith(".preset.json")) continue;
      const file = insideRoot(dir, entry.name);
      if (!file) continue;
      const result = readBoundedJson(file, MAX_PRESET_BYTES);
      if (!result.ok) continue;
      const preset = flattenPreset(entry.name.replace(/\.preset\.json$/, ""), result.value);
      if (preset) presets.push(preset);
    }
  }
  return presets;
}

function flattenPreset(name, value) {
  if (!value || typeof value !== "object") return undefined;
  // Presets have carried their fields at the top level and under "fields" or
  // "load"/"inference" sections depending on version; only a shallow merge of
  // plain values is considered, and credential-shaped keys are dropped.
  const merged = {};
  const absorb = (object) => {
    if (!object || typeof object !== "object") return;
    for (const [key, v] of Object.entries(object)) {
      if (CREDENTIAL_KEY.test(key)) continue;
      if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") merged[key] = v;
    }
  };
  absorb(value);
  absorb(value.fields);
  absorb(value.load);
  absorb(value.inference);

  const preset = { name };
  const temperature = typeof merged.temperature === "number" && Number.isFinite(merged.temperature) ? merged.temperature : undefined;
  if (temperature !== undefined) preset.temperature = temperature;
  const topP = typeof merged.top_p === "number" ? merged.top_p : typeof merged.topP === "number" ? merged.topP : undefined;
  if (topP !== undefined && Number.isFinite(topP)) preset.topP = topP;
  const topK = asCount(merged.top_k ?? merged.topK);
  if (topK !== undefined) preset.topK = topK;
  const contextLength = asCount(merged.context_length ?? merged.contextLength ?? merged.n_ctx);
  if (contextLength !== undefined) preset.contextLength = contextLength;
  const gpuLayers = asCount(merged.gpu_offload_layers ?? merged.gpuOffloadLayers ?? merged.n_gpu_layers);
  if (gpuLayers !== undefined) preset.gpuOffloadLayers = gpuLayers;
  return Object.keys(preset).length > 1 ? preset : undefined;
}

/**
 * Everything readable about this machine's LM Studio installation. Always
 * returns a value: a machine with no LM Studio yields found:false and a reason,
 * which is an ordinary state and not an error.
 */
function readSettings() {
  const server = readServerConfig();
  const root = server.root ?? candidateRoots()[0];

  let settings;
  let settingsReason;
  if (root) {
    for (const relative of SETTINGS_FILES) {
      const file = insideRoot(root, relative);
      if (!file) continue;
      const result = readBoundedJson(file, MAX_CONFIG_BYTES);
      if (result.ok) {
        settings = result.value;
        break;
      }
      if (result.reason !== "absent") settingsReason = `${relative}: ${result.reason}`;
    }
  }

  return {
    runtime: "lmstudio",
    root,
    server,
    settingsReason,
    modelsDirectory: root ? readModelsDirectory(root, settings) : undefined,
    presets: readPresets(),
  };
}

/**
 * The port to talk to: the configured one when it could be read, otherwise the
 * default. The source is reported so a failure can say where the number came from.
 */
function configuredPort(settings) {
  const fromConfig = settings?.server?.found ? settings.server.port : undefined;
  return fromConfig !== undefined
    ? { port: fromConfig, source: "http-server-config.json" }
    : { port: resolvePort(undefined), source: "default" };
}

module.exports = {
  listModels,
  loadModel,
  parseV0Models,
  parseV1Models,
  isValidModelId,
  readSettings,
  readServerConfig,
  readPresets,
  configuredPort,
  insideRoot,
  parseJsonBounded,
  LmStudioUnavailableError,
  LMSTUDIO_HOST,
  DEFAULT_LMSTUDIO_PORT,
  MAX_CONFIG_BYTES,
};
