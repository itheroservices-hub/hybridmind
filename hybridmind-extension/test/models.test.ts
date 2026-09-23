import * as assert from 'assert';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { MemoryWorld } from '@hybridmind/ontology-core';
import type { OntologyObject } from '@hybridmind/ontology-core';
import { HYBRIDMIND_REGISTRY } from '../src/ontology/registry';
import { selectModelForTask } from '../src/ontology/functions';

import {
  buildCatalog,
  estimateVramMb,
  frontierModelObjects,
  lmStudioModelObjects,
  localBaseUrl,
  parseLmStudioModels,
  parseOllamaModels,
  parseParameterCount,
} from '../src/services/models';
// These tests exercise the runtimes' internals (the parsers, size bounds and path
// checks), which are deliberately left out of the public types. So they load the
// modules untyped rather than widening what callers are allowed to see.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ollamaBridge: any = require('@hybridmind/local-runtimes/ollama.cjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lmStudioBridge: any = require('@hybridmind/local-runtimes/lmstudio.cjs');


/**
 * What these tests protect: the catalog never says "no models" when it means "no
 * runtime answered", a model the user has no key for is never selectable, a model
 * too large for the device is refused with the number that made it too large, and
 * nothing a local runtime or LM Studio's config directory hands us is trusted
 * before it is checked.
 */

/**
 * Which providers are keyed. The extension keeps keys in SecretStorage and hands
 * the catalog a predicate, so tests exercise that predicate directly rather than
 * faking browser storage.
 */
const keyed = new Set<string>();
const hasKey = (p: string) => keyed.has(p);
const setKey = (p: string, _v: string) => void keyed.add(p);
const clearKey = (p: string) => void keyed.delete(p);

beforeEach(() => {
  keyed.clear();
});

/* ------------------------------------------------------------- VRAM estimates */

describe('footprint estimation', () => {
  it('reads parameter counts in the forms runtimes report them', () => {
    assert.strictEqual(parseParameterCount('32B'), 32e9);
    assert.strictEqual(parseParameterCount('7.6B'), 7.6e9);
    assert.strictEqual(parseParameterCount('360M'), 360e6);
    // Mixture-of-experts sizes multiply out, since all experts are resident.
    assert.strictEqual(parseParameterCount('8x7B'), 56e9);
  });

  it('returns nothing rather than a guess for an unparseable size', () => {
    // A wrong parameter count produces a confidently wrong footprint, which is
    // worse than an absent one: canHostModel refuses a model with no requirement.
    assert.strictEqual(parseParameterCount('large'), undefined);
    assert.strictEqual(estimateVramMb({ parameterSize: 'large' }), undefined);
  });

  it('scales the estimate with quantization', () => {
    const q4 = estimateVramMb({ parameterSize: '7B', quantization: 'Q4_K_M' })!;
    const q8 = estimateVramMb({ parameterSize: '7B', quantization: 'Q8_0' })!;
    const f16 = estimateVramMb({ parameterSize: '7B', quantization: 'F16' })!;
    assert.ok((q4) < (q8), 'expected less');
    assert.ok((q8) < (f16), 'expected less');
    // A 7B at Q4 is a little over 4 GiB of weights in practice.
    assert.ok((q4) > (4000), 'expected greater');
    assert.ok((q4) < (6500), 'expected less');
  });

  it('prefers a reported file size over bit-width arithmetic', () => {
    // The weights are then observed rather than derived, so the two differ.
    const derived = estimateVramMb({ parameterSize: '7B', quantization: 'Q4_K_M' })!;
    const measured = estimateVramMb({ parameterSize: '7B', quantization: 'Q4_K_M', sizeBytes: 2 * 1024 ** 3 })!;
    assert.ok((measured) < (derived), 'expected less');
  });

  it('marks a local footprint as an estimate rather than a measurement', () => {
    const [model] = lmStudioModelObjects([{ id: 'qwen/qwen3-8b', quantization: 'Q4_K_M' }]);
    assert.strictEqual(model.properties.vramEstimated, true);
  });
});

/* ------------------------------------------------------- untrusted runtime output */

describe('runtime output is not trusted', () => {
  it('rejects an Ollama tag listing that is not the shape it claims', () => {
    assert.throws(() => ollamaBridge.parseTags('not json'), /not valid JSON/);
    assert.throws(() => ollamaBridge.parseTags('{"models":"all of them"}'), /models array/);
  });

  it('drops an Ollama entry whose name could be read as something other than a name', () => {
    // A name is used as a load target. One carrying shell or path syntax is
    // dropped rather than cleaned up, because a name needing repair is not one to
    // act on, and passing it through would misreport the catalog as containing it.
    const hostile = JSON.stringify({
      models: [
        { name: 'qwen2.5-coder:7b', details: { parameter_size: '7.6B', quantization_level: 'Q4_K_M' } },
        { name: 'llama3; rm -rf ~' },
        { name: '../../etc/passwd' },
        { name: '$(curl evil.test)' },
        { name: 'x'.repeat(5000) },
        { name: 42 },
        null,
      ],
    });
    assert.deepStrictEqual(ollamaBridge.parseTags(hostile).map((m: { name: string }) => m.name), ['qwen2.5-coder:7b']);
  });

  it('refuses a negative or non-numeric size rather than storing it', () => {
    const [model] = ollamaBridge.parseTags(JSON.stringify({ models: [{ name: 'a:7b', size: -1 }] }));
    assert.ok(!Object.prototype.hasOwnProperty.call(model, 'sizeBytes'), 'expected no sizeBytes');
  });

  it('rejects malformed LM Studio listings from either endpoint', () => {
    assert.throws(() => lmStudioBridge.parseV0Models('{'), /not valid JSON/);
    assert.throws(() => lmStudioBridge.parseV0Models('{"models":[]}'), /data array/);
    assert.throws(() => lmStudioBridge.parseV1Models('[]'), /data array/);
  });

  it('drops LM Studio ids that are not ids', () => {
    const hostile = JSON.stringify({
      data: [
        { id: 'lmstudio-community/qwen3-8b', type: 'llm' },
        { id: '../../../secrets' },
        { id: 'a b; reboot' },
        { id: '' },
      ],
    });
    assert.deepStrictEqual(lmStudioBridge.parseV0Models(hostile).map((m: { id: string }) => m.id), [
      'lmstudio-community/qwen3-8b',
    ]);
  });

  it('refuses JSON nested deeply enough to be an attack rather than a config', () => {
    let deep = '1';
    for (let i = 0; i < 40; i++) deep = `[${deep}]`;
    assert.throws(() => lmStudioBridge.parseJsonBounded(deep, 'test payload'), /nests deeper/);
  });

  it('re-checks a bridge payload on arrival, since it crossed Firestore in between', () => {
    assert.throws(() => parseOllamaModels({ models: [] } as unknown), /not an array/);
    assert.throws(() => parseLmStudioModels('[]' as unknown), /not an array/);
    assert.deepStrictEqual(parseOllamaModels([{ name: '' }, { nope: true }]), []);
  });
});

/* ------------------------------------------------------------- catalog status */

const OLLAMA_ABSENT = {
  available: false,
  reason: 'No Ollama daemon is answering on 127.0.0.1:11434 (ECONNREFUSED). Start Ollama to use local models.',
};
const LMSTUDIO_ABSENT = {
  available: false,
  reason: 'No LM Studio server is answering on 127.0.0.1:1234 (ECONNREFUSED).',
};

const OLLAMA_TWO = {
  available: true,
  installed: [
    { name: 'qwen2.5-coder:7b', parameterSize: '7.6B', quantization: 'Q4_K_M' },
    { name: 'qwen2.5-coder:32b', parameterSize: '32B', quantization: 'Q4_K_M' },
  ],
};

describe('a catalog with no local runtime', () => {
  it('says which runtime was unreachable and why, rather than returning an empty list', () => {
    // An empty local list is indistinguishable from "no models installed", which
    // sends the user looking for a problem they do not have.
    const catalog = buildCatalog({ ollama: OLLAMA_ABSENT, lmStudio: LMSTUDIO_ABSENT });
    assert.strictEqual(catalog.noLocalRuntime, true);
    assert.strictEqual((catalog.models.filter((m) => m.properties.residence === 'local')).length, 0);
    assert.deepStrictEqual(catalog.local.map((s) => s.runtime), ['ollama', 'lmstudio']);
    assert.strictEqual(catalog.local.every((s) => s.reachable === false && s.reason.length > 0), true);
    assert.match(String(catalog.localSummary), /ECONNREFUSED/);
    // The frontier half of the catalog is unaffected by a missing local runtime.
    assert.ok((catalog.frontierTotal) > (0), 'expected greater');
  });

  it('distinguishes "not queried" from "queried and refused"', () => {
    const unpaired = buildCatalog({});
    assert.match(String(unpaired.local[0].reason), /no bridge is paired/);
    assert.ok(!(/ECONNREFUSED/).test(String(unpaired.local[0].reason)), 'expected not to match /ECONNREFUSED/');
  });

  it('distinguishes a running runtime with nothing installed from an absent one', () => {
    const empty = buildCatalog({ ollama: { available: true, installed: [] }, lmStudio: LMSTUDIO_ABSENT });
    assert.strictEqual(empty.noLocalRuntime, false);
    assert.match(String(empty.local[0].reason), /running but has no models installed/);
    assert.match(String(empty.local[1].reason), /No LM Studio server is answering/);
  });

  it('reports each runtime separately when only one is up', () => {
    const lmOnly = buildCatalog({
      ollama: OLLAMA_ABSENT,
      lmStudio: { available: true, api: 'api/v0', models: [{ id: 'qwen/qwen3-8b', type: 'llm', maxContextLength: 40960 }] },
    });
    assert.strictEqual(lmOnly.local[0].reachable, false);
    assert.strictEqual(lmOnly.local[1].reachable, true);
    assert.match(String(lmOnly.localSummary), /LM Studio is running/);
    assert.ok(!(/Ollama is running/).test(String(lmOnly.localSummary)), 'expected not to match /Ollama is running/');

    const ollamaOnly = buildCatalog({ ollama: OLLAMA_TWO, lmStudio: LMSTUDIO_ABSENT });
    assert.strictEqual(ollamaOnly.local[0].reachable, true);
    assert.strictEqual(ollamaOnly.local[1].reachable, false);
    assert.match(String(ollamaOnly.localSummary), /Ollama is running with 2 model/);
  });

  it('says so when a reachable runtime answers with something unreadable', () => {
    // Reachable and unreadable is neither absent nor working, and collapsing it
    // into either one hides the real problem.
    const broken = buildCatalog({ ollama: { available: true, installed: 'surprise' }, lmStudio: LMSTUDIO_ABSENT });
    assert.strictEqual(broken.local[0].reachable, true);
    assert.strictEqual(broken.local[0].modelCount, 0);
    assert.match(String(broken.local[0].reason), /could not be read/);
  });
});

describe('runtime metadata in the catalog', () => {
  it('prefers LM Studio\'s reported context window over an estimate', () => {
    const [reported] = lmStudioModelObjects([{ id: 'qwen/qwen3-8b', maxContextLength: 40960 }]);
    assert.strictEqual(reported.properties.contextWindow, 40960);
    assert.strictEqual(reported.properties.contextWindowSource, 'reported');

    // /v1/models carries ids only, so the same model discovered that way falls
    // back to an assumption, and says that it did.
    const [estimated] = lmStudioModelObjects([{ id: 'qwen/qwen3-8b', source: 'v1' }]);
    assert.strictEqual(estimated.properties.contextWindowSource, 'estimated');
    assert.ok((estimated.properties.contextWindow as number) < 40960, 'expected the estimate below the reported window');
  });

  it('tells the user when discovery fell back to the thinner endpoint', () => {
    const catalog = buildCatalog({
      ollama: OLLAMA_ABSENT,
      lmStudio: { available: true, api: 'v1', models: [{ id: 'qwen/qwen3-8b' }] },
    });
    assert.match(String(catalog.local[1].reason), /OpenAI-compatible endpoint/);
  });

  it('leaves embedding models out, since they cannot serve a chat task', () => {
    const models = lmStudioModelObjects([
      { id: 'qwen/qwen3-8b', type: 'llm' },
      { id: 'nomic-ai/nomic-embed-text-v1.5', type: 'embeddings' },
    ]);
    assert.deepStrictEqual(models.map((m) => m.id), ['qwen/qwen3-8b']);
  });

  it('names the runtime on every model, so a choice says what will serve it', () => {
    const catalog = buildCatalog({
      ollama: OLLAMA_TWO,
      lmStudio: { available: true, api: 'api/v0', models: [{ id: 'qwen/qwen3-8b', maxContextLength: 40960 }] },
    });
    const runtimes = new Set(catalog.models.map((m) => m.properties.runtime));
    assert.deepStrictEqual(runtimes, new Set(['ollama', 'lmstudio', 'frontier']));
  });

  it('points the inference caller at the port discovery actually used', () => {
    assert.strictEqual(localBaseUrl('lmstudio', 1357), 'http://127.0.0.1:1357/v1');
    assert.strictEqual(localBaseUrl('ollama'), 'http://127.0.0.1:11434/v1');
    assert.strictEqual(localBaseUrl('lmstudio', 99999), 'http://127.0.0.1:1234/v1');
  });
});

/* ------------------------------------------------------------------ BYOK state */

describe('keyAvailable', () => {
  it('flips as a key is added and removed', () => {
    const unkeyed = frontierModelObjects(hasKey as never).find((m) => m.properties.provider === 'anthropic')!;
    assert.strictEqual(unkeyed.properties.keyAvailable, false);

    setKey('anthropic', 'sk-ant-test');
    const keyed = frontierModelObjects(hasKey as never).find((m) => m.id === unkeyed.id)!;
    assert.strictEqual(keyed.properties.keyAvailable, true);

    clearKey('anthropic');
    assert.strictEqual(frontierModelObjects(hasKey as never).find((m) => m.id === unkeyed.id)!.properties.keyAvailable, false);
  });

  it('covers every provider the key store knows, so no key is unusable', () => {
    const providers = new Set(frontierModelObjects(hasKey as never).map((m) => m.properties.provider));
    for (const provider of ['anthropic', 'openai', 'google', 'deepseek', 'groq', 'qwen', 'openrouter']) {
      assert.ok(providers.has(provider), `expected ${provider} in the catalog`);
    }
  });

  it('counts keyed models so the UI can say how much of the catalog is usable', () => {
    setKey('google', 'AIza-test');
    const catalog = buildCatalog({ ollama: OLLAMA_ABSENT, lmStudio: LMSTUDIO_ABSENT, hasKey: hasKey as never });
    assert.ok((catalog.frontierKeyed) > (0), 'expected greater');
    assert.ok((catalog.frontierKeyed) < (catalog.frontierTotal), 'expected less');
  });
});

/* -------------------------------------------------------------- model selection */

const now = Date.now();

const gpu = (over: Record<string, unknown> = {}): OntologyObject => ({
  type: 'Gpu',
  id: 'gpu-1',
  properties: {
    uuid: 'gpu-1',
    index: 0,
    name: 'NVIDIA GeForce RTX 4070',
    hostId: 'host1',
    memoryTotalMb: 12288,
    memoryUsedMb: 1024,
    utilizationPct: 4,
    temperatureC: 43,
    observedAt: now,
    ...over,
  },
});

const local = (id: string, over: Record<string, unknown> = {}): OntologyObject => ({
  type: 'Model',
  id,
  schemaVersion: 2,
  properties: {
    id,
    displayName: id,
    residence: 'local',
    runtime: 'ollama',
    vramRequiredMb: 5500,
    contextWindow: 32768,
    supportsTools: true,
    capabilityTier: 2,
    costPerMTokensIn: 0,
    costPerMTokensOut: 0,
    keyAvailable: true,
    ...over,
  },
});

const frontier = (id: string, over: Record<string, unknown> = {}): OntologyObject => ({
  type: 'Model',
  id,
  schemaVersion: 2,
  properties: {
    id,
    displayName: id,
    residence: 'frontier',
    runtime: 'frontier',
    contextWindow: 200000,
    supportsTools: true,
    capabilityTier: 5,
    costPerMTokensIn: 3,
    costPerMTokensOut: 15,
    keyAvailable: true,
    ...over,
  },
});

function world(objects: OntologyObject[]) {
  const w = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
  for (const o of objects) w.put(o);
  return w;
}

describe('selectModelForTask', () => {
  it('refuses a model too large for the device, naming the free VRAM that made it so', () => {
    // "Too large" without a number is not actionable: the user needs to know how
    // much room there actually is before deciding what to unload.
    const w = world([gpu(), local('huge:70b', { vramRequiredMb: 40000, capabilityTier: 4 })]);
    const result = selectModelForTask.evaluate(w, { prefer: 'cheapest' });
    assert.strictEqual(result.value.modelId, null);
    assert.match(String(result.rationale), /11264 MiB free/);
    assert.match(String(result.rationale), /40000|41024/);
    assert.ok((result.evidence).includes('gpu-1'), 'expected to contain');
  });

  it('chooses differently under cheapest than under capable', () => {
    const w = world([gpu(), local('qwen:7b'), frontier('claude-opus-4-5', { capabilityTier: 5 })]);
    const cheapest = selectModelForTask.evaluate(w, { prefer: 'cheapest' });
    const capable = selectModelForTask.evaluate(w, { prefer: 'capable' });

    assert.strictEqual(cheapest.value.modelId, 'qwen:7b');
    assert.strictEqual(cheapest.value.residence, 'local');
    assert.strictEqual(capable.value.modelId, 'claude-opus-4-5');
    assert.notStrictEqual(capable.value.modelId, cheapest.value.modelId);
  });

  it('never selects an unkeyed frontier model, however capable it is', () => {
    // BYOK is absolute: a model the user cannot call is not a candidate, and
    // 'capable' is where that would otherwise be overridden.
    const w = world([
      gpu(),
      local('qwen:7b', { capabilityTier: 1 }),
      frontier('unkeyed-flagship', { capabilityTier: 5, keyAvailable: false }),
    ]);
    for (const prefer of ['cheapest', 'capable', 'balanced'] as const) {
      const result = selectModelForTask.evaluate(w, { prefer });
      assert.strictEqual(result.value.modelId, 'qwen:7b');
    }

    const noLocal = world([frontier('unkeyed-flagship', { keyAvailable: false })]);
    const refused = selectModelForTask.evaluate(noLocal, { prefer: 'capable' });
    assert.strictEqual(refused.value.modelId, null);
    assert.match(String(refused.rationale), /unkeyed/);
  });

  it('pays for a frontier model under balanced only when the capability gap is wide', () => {
    const narrow = world([gpu(), local('qwen:32b', { capabilityTier: 4 }), frontier('flagship', { capabilityTier: 5 })]);
    assert.strictEqual(selectModelForTask.evaluate(narrow, { prefer: 'balanced' }).value.modelId, 'qwen:32b');

    const wide = world([gpu(), local('tiny:1b', { capabilityTier: 1 }), frontier('flagship', { capabilityTier: 5 })]);
    const chosen = selectModelForTask.evaluate(wide, { prefer: 'balanced' });
    assert.strictEqual(chosen.value.modelId, 'flagship');
    assert.match(String(chosen.rationale), /tiers above/);
  });

  it('will not place a model on an unhealthy device', () => {
    const w = world([gpu({ temperatureC: 91 }), local('qwen:7b'), frontier('flagship')]);
    const result = selectModelForTask.evaluate(w, { prefer: 'cheapest' });
    assert.strictEqual(result.value.residence, 'frontier');
    assert.match(String(result.rationale), /throttling|no local model fits/i);
  });

  it('honours a tool and context requirement, and says what each excluded', () => {
    const w = world([
      gpu(),
      local('no-tools:7b', { supportsTools: false }),
      frontier('small-context', { contextWindow: 8192 }),
    ]);
    const result = selectModelForTask.evaluate(w, { needsTools: true, minContext: 100000, prefer: 'capable' });
    assert.strictEqual(result.value.modelId, null);
    assert.match(String(result.rationale), /tool calling/);
    assert.match(String(result.rationale), /8192/);
  });

  it('names the runtime that will serve a local choice', () => {
    const w = world([gpu(), local('qwen/qwen3-8b', { runtime: 'lmstudio' })]);
    const result = selectModelForTask.evaluate(w, { prefer: 'cheapest' });
    assert.strictEqual(result.value.runtime, 'lmstudio');
    assert.match(String(result.rationale), /lmstudio/);
  });

  it('is registered, so an agent can reach it through the ontology', () => {
    assert.ok((HYBRIDMIND_REGISTRY.functions.selectModelForTask) !== undefined, 'expected defined');
  });
});

describe('Model schema version 2', () => {
  it('stamps a runtime onto an object written before the property existed', () => {
    // A version 1 object has no runtime, and the engine refuses an object it
    // cannot bring forward, so the migration is what keeps stored models loadable.
    const w = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
    w.put({
      type: 'Model',
      id: 'legacy:7b',
      properties: { id: 'legacy:7b', displayName: 'legacy', residence: 'local', vramRequiredMb: 4096 },
    });
    assert.strictEqual(w.get('Model', 'legacy:7b')?.properties.runtime, 'ollama');
    assert.strictEqual(w.get('Model', 'legacy:7b')?.schemaVersion, 2);

    w.put({
      type: 'Model',
      id: 'legacy-api',
      properties: { id: 'legacy-api', displayName: 'legacy api', residence: 'frontier' },
    });
    assert.strictEqual(w.get('Model', 'legacy-api')?.properties.runtime, 'frontier');
  });

  it('accepts every catalog-built object against the live schema', () => {
    // The catalog is the main producer of Model objects, so a property it sets
    // that the schema does not know would surface here rather than at runtime.
    const catalog = buildCatalog({
      ollama: OLLAMA_TWO,
      lmStudio: { available: true, api: 'api/v0', models: [{ id: 'qwen/qwen3-8b', maxContextLength: 40960, quantization: 'Q4_K_M' }] },
    });
    const w = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
    assert.doesNotThrow(() => catalog.models.forEach((m) => w.put(m)));
  });
});

/* --------------------------------------------------- LM Studio on-disk settings */

let tempHome: string;
let originalHome: string | undefined;
let originalProfile: string | undefined;

function writeConfig(contents: string, { file = 'http-server-config.json' } = {}) {
  const dir = path.join(tempHome, '.lmstudio', '.internal');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), contents);
}

describe('LM Studio settings on disk', () => {
  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lmstudio-home-'));
    originalHome = process.env.HOME;
    originalProfile = process.env.USERPROFILE;
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalProfile;
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('reads the configured port and CORS flag, which is what makes a failed fetch diagnosable', () => {
    // Without these two figures, a browser fetch that fails cannot be told apart
    // from a server that is not running, and the error has to hedge.
    writeConfig(JSON.stringify({ port: 4321, cors: true }));
    const settings = lmStudioBridge.readSettings();
    assert.strictEqual(settings.server.found, true);
    assert.strictEqual(settings.server.port, 4321);
    assert.strictEqual(settings.server.corsEnabled, true);
    assert.ok((settings.server.file).includes('http-server-config.json'), 'expected to contain');
    assert.deepStrictEqual(lmStudioBridge.configuredPort(settings), { port: 4321, source: 'http-server-config.json' });
  });

  it('accepts the key spellings different versions have used, and says which matched', () => {
    writeConfig(JSON.stringify({ serverPort: 5678, corsEnabled: false }));
    const settings = lmStudioBridge.readSettings();
    assert.strictEqual(settings.server.port, 5678);
    assert.strictEqual(settings.server.portKey, 'serverPort');
    assert.strictEqual(settings.server.corsEnabled, false);
    assert.strictEqual(settings.server.corsKey, 'corsEnabled');
  });

  it('reports an absent config plainly and falls back to the default port', () => {
    const settings = lmStudioBridge.readSettings();
    assert.strictEqual(settings.server.found, false);
    assert.match(String(settings.server.reason), /No LM Studio server config was found/);
    assert.deepStrictEqual(lmStudioBridge.configuredPort(settings), { port: 1234, source: 'default' });
  });

  it('reports malformed config as unreadable rather than throwing or half-applying', () => {
    writeConfig('{"port": 4321,');
    const settings = lmStudioBridge.readSettings();
    assert.strictEqual(settings.server.found, false);
    assert.match(String(settings.server.reason), /not valid JSON/);
    assert.strictEqual(settings.server.port, undefined);
  });

  it('refuses a config larger than a config should be, before reading it', () => {
    writeConfig('x'.repeat(lmStudioBridge.MAX_CONFIG_BYTES + 1));
    const settings = lmStudioBridge.readSettings();
    assert.strictEqual(settings.server.found, false);
    assert.match(String(settings.server.reason), /larger than/);
  });

  it('refuses a models directory that escapes the LM Studio root', () => {
    // A path read from a file is untrusted input; following one containing ".."
    // would have this process reading wherever that file pointed it.
    writeConfig(JSON.stringify({ port: 1234 }));
    fs.writeFileSync(
      path.join(tempHome, '.lmstudio', '.internal', 'settings.json'),
      JSON.stringify({ modelsDirectory: '../../../../etc' }),
    );
    const settings = lmStudioBridge.readSettings();
    assert.deepStrictEqual((settings.modelsDirectory as any).used, false);
    assert.match(String(settings.modelsDirectory.reason), /outside/);
  });

  it('keeps a legitimate models directory inside the root', () => {
    writeConfig(JSON.stringify({ port: 1234 }));
    fs.writeFileSync(
      path.join(tempHome, '.lmstudio', '.internal', 'settings.json'),
      JSON.stringify({ modelsDirectory: 'models' }),
    );
    assert.deepStrictEqual((lmStudioBridge.readSettings().modelsDirectory as any).used, true);
  });

  it('reads presets for prefilling, and never surfaces anything credential-shaped', () => {
    const dir = path.join(tempHome, '.lmstudio', 'config-presets');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'coding.preset.json'),
      JSON.stringify({ fields: { temperature: 0.2, top_k: 40, context_length: 16384, apiKey: 'sk-should-not-appear' } }),
    );
    const [preset] = lmStudioBridge.readPresets();
    assert.deepStrictEqual((preset as any).name, 'coding');
    assert.deepStrictEqual((preset as any).temperature, 0.2);
    assert.deepStrictEqual((preset as any).topK, 40);
    assert.deepStrictEqual((preset as any).contextLength, 16384);
    assert.ok(!(/sk-should-not-appear/).test(String(JSON.stringify(preset))), 'expected not to match /sk-should-not-appear/');
  });

  it('surfaces the config figures on the catalog status, where the caller can use them', () => {
    const catalog = buildCatalog({
      ollama: OLLAMA_ABSENT,
      lmStudio: {
        available: false,
        port: 4321,
        portSource: 'http-server-config.json',
        reason: 'No LM Studio server is answering on 127.0.0.1:4321 (ECONNREFUSED).',
        settings: { server: { found: true, file: '/home/u/.lmstudio/.internal/http-server-config.json', port: 4321, corsEnabled: false } },
      },
    });
    const status = catalog.local[1];
    assert.strictEqual(status.port, 4321);
    assert.strictEqual(status.corsEnabled, false);
    assert.match(String(status.configSource), /http-server-config\.json/);
    assert.strictEqual(status.configReason, undefined);
  });

  it('says the CORS setting is unknown when the config could not be read', () => {
    const catalog = buildCatalog({ ollama: OLLAMA_ABSENT, lmStudio: { available: false, reason: 'refused', settings: { server: { found: false, reason: 'absent on this machine' } } } });
    assert.strictEqual(catalog.local[1].corsEnabled, undefined);
    assert.strictEqual(catalog.local[1].configReason, 'absent on this machine');
  });
});

/* ----------------------------------------------- discovery against a real server */

function serve(routes: Record<string, { status: number; body: string }>): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const route = routes[req.url ?? ''];
    if (!route) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":"not found"}');
      return;
    }
    res.writeHead(route.status, { 'content-type': 'application/json' });
    res.end(route.body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const portOf = (server: http.Server) => (server.address() as { port: number }).port;

describe('LM Studio discovery over HTTP', () => {
  it('uses the configured port rather than the default', async () => {
    const server = await serve({
      '/api/v0/models': { status: 200, body: JSON.stringify({ data: [{ id: 'qwen/qwen3-8b', type: 'llm', max_context_length: 40960, quantization: 'Q4_K_M', state: 'loaded' }] }) },
    });
    try {
      const listing = await lmStudioBridge.listModels({ port: portOf(server) });
      assert.strictEqual(listing.port, portOf(server));
      assert.strictEqual(listing.api, 'api/v0');
      assert.deepStrictEqual((listing.models[0] as any).id, 'qwen/qwen3-8b');
    assert.deepStrictEqual((listing.models[0] as any).maxContextLength, 40960);
    assert.deepStrictEqual((listing.models[0] as any).state, 'loaded');
    } finally {
      server.close();
    }
  });

  it('falls back to the OpenAI-compatible listing when the richer endpoint is absent', async () => {
    // Only on a 404. Any other failure is a real problem, and falling back would
    // turn a broken server into a catalog with silently worse metadata.
    const server = await serve({
      '/v1/models': { status: 200, body: JSON.stringify({ data: [{ id: 'qwen/qwen3-8b', object: 'model' }] }) },
    });
    try {
      const listing = await lmStudioBridge.listModels({ port: portOf(server) });
      assert.strictEqual(listing.api, 'v1');
      assert.deepStrictEqual(listing.models, [{ id: 'qwen/qwen3-8b', source: 'v1' }]);
      assert.match(String(listing.note), /estimated/);
    } finally {
      server.close();
    }
  });

  it('does not fall back when the server is broken rather than old', async () => {
    const server = await serve({ '/api/v0/models': { status: 500, body: '{"error":"internal"}' } });
    try {
      await assert.rejects(lmStudioBridge.listModels({ port: portOf(server) }), /replied 500/);
    } finally {
      server.close();
    }
  });

  it('reports an unreachable server as an ordinary state with the port it tried', async () => {
    const server = await serve({});
    const port = portOf(server);
    await new Promise((resolve) => server.close(resolve));
    await assert.rejects(lmStudioBridge.listModels({ port }), lmStudioBridge.LmStudioUnavailableError);
  });

  it('will not send an invalid model id to either runtime', async () => {
    await assert.rejects(lmStudioBridge.loadModel('a; reboot'), /not a valid LM Studio model id/);
    await assert.rejects(ollamaBridge.loadModel('$(reboot)'), /not a valid Ollama model name/);
  });

  it('reports an already-loaded LM Studio model as a no-op rather than a load', async () => {
    const server = await serve({
      '/api/v0/models': { status: 200, body: JSON.stringify({ data: [{ id: 'qwen/qwen3-8b', type: 'llm', state: 'loaded' }] }) },
    });
    try {
      const result = await lmStudioBridge.loadModel('qwen/qwen3-8b', { port: portOf(server) });
      assert.deepStrictEqual((result as any).alreadyLoaded, true);
    assert.deepStrictEqual((result as any).resident, true);
    } finally {
      server.close();
    }
  });
});

describe('Ollama discovery over HTTP', () => {
  it('reads installed and resident models from the daemon', async () => {
    const server = await serve({
      '/api/tags': { status: 200, body: JSON.stringify({ models: [{ name: 'qwen2.5-coder:7b', size: 4_700_000_000, details: { parameter_size: '7.6B', quantization_level: 'Q4_K_M' } }] }) },
      '/api/ps': { status: 200, body: JSON.stringify({ models: [{ name: 'qwen2.5-coder:7b', size_vram: 5_000_000_000 }] }) },
    });
    try {
      const listing = await ollamaBridge.listModels({ port: portOf(server) });
      assert.deepStrictEqual((listing.installed[0] as any).name, 'qwen2.5-coder:7b');
    assert.deepStrictEqual((listing.installed[0] as any).parameterSize, '7.6B');
    assert.deepStrictEqual((listing.installed[0] as any).quantization, 'Q4_K_M');
      assert.deepStrictEqual((listing.resident[0] as any).name, 'qwen2.5-coder:7b');
    assert.deepStrictEqual((listing.resident[0] as any).vramBytes, 5_000_000_000);
    } finally {
      server.close();
    }
  });

  it('still yields a catalog when the daemon has no process listing', async () => {
    // /api/ps is a newer route; an older daemon without it is still usable.
    const server = await serve({
      '/api/tags': { status: 200, body: JSON.stringify({ models: [{ name: 'llama3:8b' }] }) },
    });
    try {
      const listing = await ollamaBridge.listModels({ port: portOf(server) });
      assert.strictEqual((listing.installed).length, 1);
      assert.deepStrictEqual(listing.resident, []);
    } finally {
      server.close();
    }
  });
});
