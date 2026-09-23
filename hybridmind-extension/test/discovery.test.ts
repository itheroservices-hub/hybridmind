import * as assert from 'assert';
import { discoverCatalog, type BridgeCaller } from '../src/services/models';

/**
 * Discovery sits between a host that may not be there and a logic function that
 * will act on whatever it is told. The property worth protecting is that the
 * three ways this can go wrong stay distinguishable:
 *
 *   the bridge never answered        the host is unreachable
 *   the bridge answered with junk    the host is there, the answer is unusable
 *   the runtime is not running       an ordinary state, nothing is wrong
 *
 * Collapsing any of these into "no models" would be a lie about the machine, and
 * would have the user hunting for a model they never installed, or reinstalling
 * Ollama because the bridge dropped.
 */

/** Which providers are keyed. Injected, so no browser storage is involved. */
const keyed = new Set<string>();
const hasKey = (p: string) => keyed.has(p);

beforeEach(() => {
  keyed.clear();
});

const ok = (payload: unknown) => ({ ok: true, output: JSON.stringify(payload) });

/** Answers each command from a map, so one runtime can be up and the other not. */
function caller(answers: Record<string, ReturnType<typeof ok> | { ok: false; error?: string }>): BridgeCaller {
  return async (command) =>
    answers[command] ?? { ok: false, error: `No stub for ${command}.` };
}

describe('with no bridge paired', () => {
  it('still builds a catalog, and says the local half was not queried', async () => {
    const catalog = await discoverCatalog(null, hasKey as never);

    // The frontier models need no host, so selection is not left with nothing.
    assert.ok((catalog.models.length) > (0), 'expected greater');
    assert.strictEqual(catalog.noLocalRuntime, true);
    assert.strictEqual(catalog.local.every((s) => !s.reachable), true);
  });
});

describe('when the bridge does not answer', () => {
  it('reports the bridge rather than blaming the runtime', async () => {
    const catalog = await discoverCatalog(caller({
        ollama_models: { ok: false, error: 'Bridge did not respond within 30s.' },
        lmstudio_models: { ok: false, error: 'Bridge did not respond within 30s.' },
      }),
    );

    assert.strictEqual(catalog.noLocalRuntime, true);
    assert.strictEqual(catalog.local.some((s) => /did not respond/.test(s.reason)), true);
  });

  it('survives a transport that throws instead of returning', async () => {
    const thrower: BridgeCaller = async () => {
      throw new Error('Firestore is offline.');
    };
    const catalog = await discoverCatalog(thrower);

    assert.strictEqual(catalog.noLocalRuntime, true);
    assert.strictEqual(catalog.local.some((s) => /could not be reached/.test(s.reason)), true);
  });
});

describe('when the bridge answers with something unusable', () => {
  it('does not read unparseable output as an empty install', async () => {
    const catalog = await discoverCatalog(caller({
        ollama_models: { ok: true, output: '<html>proxy error</html>' } as never,
        lmstudio_models: { ok: true, output: 'null' } as never,
      }),
    );

    // Both are failures of the answer, not statements about what is installed.
    assert.strictEqual(catalog.noLocalRuntime, true);
    assert.strictEqual(catalog.local.some((s) => /not JSON/.test(s.reason)), true);
    assert.strictEqual(catalog.local.some((s) => /not an object/.test(s.reason)), true);
  });
});

describe('when a runtime is simply not running', () => {
  it('treats it as an ordinary state and keeps the other runtime', async () => {
    const catalog = await discoverCatalog(caller({
        ollama_models: ok({ available: false, runtime: 'ollama', reason: 'Ollama is not running on port 11434.' }),
        lmstudio_models: ok({
          available: true,
          port: 1234,
          models: [{ id: 'qwen2.5-coder-7b-instruct', type: 'llm', quantization: 'Q4_K_M', max_context_length: 32768 }],
        }),
      }),
    );

    // One up and one down is a real configuration, and the user needs to see it
    // as that rather than as a partial failure.
    assert.strictEqual(catalog.noLocalRuntime, false);
    assert.strictEqual(catalog.models.some((m) => m.properties.runtime === 'lmstudio'), true);
    assert.strictEqual(catalog.models.some((m) => m.properties.runtime === 'ollama'), false);
    assert.match(String(catalog.local.find((s) => s.runtime === 'ollama')?.reason), /not running/);
  });

  it('distinguishes a running runtime with nothing installed from one that is absent', async () => {
    const empty = await discoverCatalog(caller({
        ollama_models: ok({ available: true, installed: [], resident: [] }),
        lmstudio_models: ok({ available: true, models: [] }),
      }),
    );

    // Reachable, so this is "you have not pulled a model yet", which is a
    // different instruction to the user than "start Ollama".
    assert.strictEqual(empty.noLocalRuntime, false);
    assert.strictEqual(empty.local.some((s) => s.reachable && s.modelCount === 0), true);
  });
});

describe('both runtimes are queried together', () => {
  it('does not make one wait on the other', async () => {
    const started: number[] = [];
    const slow: BridgeCaller = async (command) => {
      started.push(Date.now());
      await new Promise((r) => setTimeout(r, 20));
      return ok(command === 'ollama_models' ? { available: true, installed: [] } : { available: true, models: [] });
    };

    await discoverCatalog(slow);

    // Sequential discovery would put the bridge's timeout in front of a mission
    // twice over for a user who has only one runtime installed.
    assert.strictEqual((started).length, 2);
    assert.ok((Math.abs(started[1] - started[0])) < (15), 'expected less');
  });
});
