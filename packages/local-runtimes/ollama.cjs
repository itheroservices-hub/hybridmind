/**
 * Ollama access for the bridge.
 *
 * Local model discovery goes through the bridge rather than the browser for two
 * reasons. It keeps discovery on the same path as GPU telemetry, so "what this
 * machine can run" is answered by one component that actually sits on the
 * machine; and it avoids requiring the user to set OLLAMA_ORIGINS before the web
 * app can see their models, which is a configuration step that looks like a bug
 * when it is missing.
 *
 * Nothing here shells out. Ollama is spoken to over HTTP on the loopback
 * interface from Node directly, so no part of this widens the command allowlist
 * in bridge-command-validator.cjs and no caller-supplied string is ever handed
 * to a shell. A model name arriving from the app is matched against a strict
 * pattern before it is placed in a request body, and is never interpolated
 * anywhere else.
 *
 * Ollama's own responses are treated as untrusted input. The daemon is local but
 * it is a separate process serving whatever a model registry gave it, so every
 * field is shape-checked, strings are length-bounded, the response body is size-
 * capped, and every request times out. A malformed entry is dropped rather than
 * passed through for someone downstream to interpret.
 *
 * The loopback request helper is repeated in bridge-lmstudio.cjs rather than
 * shared. Each bridge module stays independently requireable, as bridge-gpu.cjs
 * is, and the two runtimes differ enough in endpoints and timeouts that a shared
 * abstraction would be parameterized to the point of being two functions anyway.
 */

const http = require("http");

const OLLAMA_HOST = "127.0.0.1";
/** Ollama's default. Overridable because people move it off a busy port. */
const DEFAULT_OLLAMA_PORT = 11434;

/** Enough for a few hundred installed models; past this the daemon is misbehaving. */
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 5000;
/** A cold load pulls weights from disk into VRAM, which is slow on a large model. */
const LOAD_TIMEOUT_MS = 120000;

/** Longest string accepted from any response field, to bound what gets stored. */
const MAX_FIELD_CHARS = 200;

/**
 * Ollama names are "model[:tag]" with optional registry and namespace segments.
 * Anything outside this is rejected rather than sanitized, because a name that
 * needs sanitizing is not a name this bridge should be acting on.
 */
const MODEL_NAME = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+){0,2}(:[A-Za-z0-9._-]+)?$/;

function isValidModelName(name) {
  return typeof name === "string" && name.length > 0 && name.length <= MAX_FIELD_CHARS && MODEL_NAME.test(name);
}

/** Raised when no daemon is answering, which is an ordinary state, not a fault. */
class OllamaUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "OllamaUnavailableError";
  }
}

function resolvePort(port) {
  const n = Number(port ?? process.env.OLLAMA_PORT ?? DEFAULT_OLLAMA_PORT);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : DEFAULT_OLLAMA_PORT;
}

function request(method, path, { port, body, timeoutMs } = {}) {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body), "utf8");
  const limit = timeoutMs ?? (method === "POST" ? LOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  const target = resolvePort(port);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: OLLAMA_HOST,
        port: target,
        path,
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
            reject(new Error(`Ollama returned more than ${MAX_RESPONSE_BYTES} bytes for ${path}; response discarded.`));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Ollama replied ${res.statusCode} to ${path}: ${text.slice(0, 300)}`));
            return;
          }
          resolve(text);
        });
      },
    );

    req.setTimeout(limit, () => {
      req.destroy();
      reject(new Error(`Ollama did not respond to ${path} within ${limit / 1000}s.`));
    });

    req.on("error", (error) => {
      // A refused connection is the ordinary state of a machine with no Ollama
      // installed or running. It is reported as such, not as a fault, so the app
      // can distinguish it from "Ollama is there and has no models".
      if (error.code === "ECONNREFUSED" || error.code === "EHOSTUNREACH" || error.code === "ECONNRESET") {
        reject(
          new OllamaUnavailableError(
            `No Ollama daemon is answering on ${OLLAMA_HOST}:${target} (${error.code}). Start Ollama to use local models.`,
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

function asBytes(value) {
  // Sizes are used for display and for sanity-checking an estimate, so a
  // negative or non-finite value is worse than an absent one.
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

/**
 * Normalizes /api/tags. Exported separately from the transport so hostile or
 * malformed payloads can be exercised without a daemon.
 */
function parseTags(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch {
    throw new Error("Ollama returned a tag listing that is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.models)) {
    throw new Error("Ollama tag listing has no models array; the response shape is not one this bridge recognizes.");
  }

  const out = [];
  for (const entry of parsed.models) {
    if (!entry || typeof entry !== "object") continue;
    const name = asField(entry.name ?? entry.model);
    // An unparseable name is dropped rather than cleaned up: it cannot be used
    // as a load target, so carrying it forward would only misreport the catalog.
    if (!isValidModelName(name)) continue;

    const details = entry.details && typeof entry.details === "object" ? entry.details : {};
    const model = { name };
    const sizeBytes = asBytes(entry.size);
    if (sizeBytes !== undefined) model.sizeBytes = sizeBytes;
    const parameterSize = asField(details.parameter_size);
    if (parameterSize) model.parameterSize = parameterSize;
    const quantization = asField(details.quantization_level);
    if (quantization) model.quantization = quantization;
    const family = asField(details.family);
    if (family) model.family = family;
    out.push(model);
  }
  return out;
}

/** Normalizes /api/ps, which lists what is currently resident in memory. */
function parseProcesses(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch {
    throw new Error("Ollama returned a process listing that is not valid JSON.");
  }
  const list = parsed && typeof parsed === "object" && Array.isArray(parsed.models) ? parsed.models : [];

  const out = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const name = asField(entry.name ?? entry.model);
    if (!isValidModelName(name)) continue;
    const resident = { name };
    const sizeBytes = asBytes(entry.size);
    if (sizeBytes !== undefined) resident.sizeBytes = sizeBytes;
    // size_vram is what the model actually occupies on the device, which is the
    // one number here that is measured rather than estimated.
    const vramBytes = asBytes(entry.size_vram);
    if (vramBytes !== undefined) resident.vramBytes = vramBytes;
    out.push(resident);
  }
  return out;
}

/**
 * Installed models, plus what is resident right now. The resident listing is
 * best-effort: an older daemon without /api/ps still yields a usable catalog.
 */
async function listModels({ port } = {}) {
  const installed = parseTags(await request("GET", "/api/tags", { port }));

  let resident = [];
  try {
    resident = parseProcesses(await request("GET", "/api/ps", { port }));
  } catch {
    resident = [];
  }

  return { runtime: "ollama", port: resolvePort(port), installed, resident };
}

/**
 * Asks Ollama to bring a model into memory without generating anything. An empty
 * prompt is Ollama's own load path; keep_alive is how long it stays resident.
 * The VRAM this actually consumes is not guessed here: a telemetry sample after
 * the load reports it.
 */
async function loadModel(name, { port, keepAliveSeconds } = {}) {
  if (!isValidModelName(name)) {
    throw new Error(`"${String(name).slice(0, 80)}" is not a valid Ollama model name and was not sent to the daemon.`);
  }
  const keepAlive = Number.isFinite(keepAliveSeconds) && keepAliveSeconds > 0 ? Math.floor(keepAliveSeconds) : 300;

  await request("POST", "/api/generate", { port, body: { model: name, prompt: "", keep_alive: `${keepAlive}s` } });

  const resident = await listModels({ port })
    .then((r) => r.resident)
    .catch(() => []);
  const loaded = resident.find((m) => m.name === name);
  return {
    runtime: "ollama",
    model: name,
    keepAliveSeconds: keepAlive,
    resident: Boolean(loaded),
    vramBytes: loaded?.vramBytes,
  };
}

module.exports = {
  listModels,
  loadModel,
  parseTags,
  parseProcesses,
  isValidModelName,
  OllamaUnavailableError,
  OLLAMA_HOST,
  DEFAULT_OLLAMA_PORT,
};
