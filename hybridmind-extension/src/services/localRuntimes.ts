import { lmstudio, ollama } from '@hybridmind/local-runtimes';
import type { BridgeCaller } from './models';

/**
 * Discovery for the extension, which needs no bridge.
 *
 * In the web app a page cannot reach 127.0.0.1, so every discovery call was
 * queued to a paired host process and the answer came back through Firestore.
 * The extension already runs in Node on the user's machine, so that whole
 * round trip disappears: it calls the runtime directly.
 *
 * The catalog takes its discovery as an injected BridgeCaller, which is what
 * makes that substitution possible without touching the catalog. This adapter is
 * the whole of it: same command names, same JSON-string answers, no transport.
 */
export function directRuntimeCaller(): BridgeCaller {
  return async (command, args) => {
    const port = typeof args.port === 'number' ? args.port : undefined;
    try {
      if (command === 'ollama_models') {
        return { ok: true, output: JSON.stringify({ available: true, ...(await ollama.listModels({ port })) }) };
      }

      if (command === 'lmstudio_models') {
        // The configured port beats the default: LM Studio records where it
        // listens, so a moved port is followed rather than guessed.
        const settings = lmstudio.readSettings();
        const chosen = port !== undefined ? { port, source: 'caller' } : lmstudio.configuredPort(settings);
        const listing = await lmstudio.listModels({ port: chosen.port });
        return {
          ok: true,
          output: JSON.stringify({ available: true, portSource: chosen.source, settings, ...listing }),
        };
      }

      return { ok: false, error: `No local runtime handles ${command}.` };
    } catch (e) {
      // A runtime that is not running is an ordinary answer, not a failure, and
      // has to stay distinguishable from one that is running with nothing
      // installed. Reporting it as ok:true with available:false is what keeps
      // the catalog able to tell the user which of the two it is.
      const runtime = command === 'ollama_models' ? 'ollama' : 'lmstudio';
      const unavailable =
        e instanceof ollama.OllamaUnavailableError || e instanceof lmstudio.LmStudioUnavailableError;

      if (unavailable) {
        const body: Record<string, unknown> = { available: false, runtime, reason: (e as Error).message };
        if (runtime === 'ollama') {
          body.installed = [];
          body.resident = [];
        } else {
          body.models = [];
          body.settings = lmstudio.readSettings();
        }
        return { ok: true, output: JSON.stringify(body) };
      }

      return { ok: false, error: `Reading ${runtime} failed: ${(e as Error).message}` };
    }
  };
}
