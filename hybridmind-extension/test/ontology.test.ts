import * as assert from 'assert';
import { MemoryWorld, Ontology, type Actor, type Executor } from '@hybridmind/ontology-core';
import { HYBRIDMIND_REGISTRY } from '../src/ontology/registry';
import { OntologyError, type OntologyObject } from '@hybridmind/ontology-core';

const now = Date.now();

const host = (over: Partial<Record<string, unknown>> = {}): OntologyObject => ({
  type: 'Host',
  id: 'host1',
  properties: { id: 'host1', hostname: 'workstation', platform: 'linux', lastSeen: now, ...over },
});

const gpu = (over: Partial<Record<string, unknown>> = {}): OntologyObject => ({
  type: 'Gpu',
  id: 'gpu-uuid-1',
  properties: {
    uuid: 'gpu-uuid-1',
    index: 0,
    name: 'NVIDIA GeForce RTX 5090',
    hostId: 'host1',
    memoryTotalMb: 32768,
    memoryUsedMb: 2048,
    utilizationPct: 5,
    temperatureC: 45,
    powerLimitMinW: 200,
    powerLimitMaxW: 600,
    observedAt: now,
    ...over,
  },
});

const model = (id: string, over: Partial<Record<string, unknown>> = {}): OntologyObject => ({
  type: 'Model',
  id,
  properties: { id, displayName: id, residence: 'local', vramRequiredMb: 8192, supportsTools: true, contextWindow: 32768, ...over },
});

const alwaysOk: Executor = async () => ({ ok: true });
const agent: Actor = { id: 'specialist_1', maxReversibility: 'recoverable', maxBlastRadius: 'host' };

function setup(objects: OntologyObject[], executor: Executor = alwaysOk) {
  const world = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
  for (const o of objects) world.put(o);
  return new Ontology(world, HYBRIDMIND_REGISTRY, executor);
}

describe('schema validation', () => {
  it('rejects an unknown object type', () => {
    const world = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
    assert.throws(() => world.put({ type: 'Nonsense', id: 'x', properties: {} }), OntologyError);
  });

  it('rejects a missing required property', () => {
    const world = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
    assert.throws(() => world.put({ type: 'Gpu', id: 'g', properties: { uuid: 'g', index: 0 } }), /required/);
  });

  it('enforces numeric bounds rather than documenting them', () => {
    const world = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
    assert.throws(() => world.put(gpu({ temperatureC: 5000 })), /at most/);
  });

  it('enforces enum membership', () => {
    const world = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
    assert.throws(() => world.put(model('m', { residence: 'somewhere-else' })), /must be one of/);
  });
});

describe('authorization', () => {
  it('refuses a human_only action to an agent, however high its ceiling', async () => {
    const o = setup([host(), gpu()]);
    const powerful: Actor = { id: 'cos', maxReversibility: 'irreversible', maxBlastRadius: 'all_hosts' };
    const { decision, ok } = await o.attempt('setPowerLimit', 'gpu-uuid-1', { watts: 400 }, powerful);

    assert.strictEqual(ok, false);
    assert.strictEqual(decision.outcome, 'escalated');
    assert.strictEqual(decision.refusedBy?.[0]?.code, 'HUMAN_CONFIRMATION_REQUIRED');
  });

  it('allows a human_only action once a human has confirmed it', async () => {
    const o = setup([host(), gpu()]);
    const human: Actor = { id: 'tyler', maxReversibility: 'irreversible', maxBlastRadius: 'all_hosts', humanConfirmed: true };
    const { ok } = await o.attempt('setPowerLimit', 'gpu-uuid-1', { watts: 400 }, human);
    assert.strictEqual(ok, true);
  });

  it('refuses an action above the actor ceiling', async () => {
    const o = setup([
      { type: 'Mission', id: 'm1', properties: { id: 'm1', prompt: 'x', status: 'completed', userId: 'u', createdAt: now } },
    ]);
    const { decision } = await o.attempt('deleteMission', 'm1', {}, { id: 'reader', maxReversibility: 'reversible', maxBlastRadius: 'object' });
    assert.strictEqual(decision.outcome, 'escalated');
  });

  it('requires human confirmation for an irreversible action', async () => {
    const o = setup([
      { type: 'Mission', id: 'm1', properties: { id: 'm1', prompt: 'x', status: 'completed', userId: 'u', createdAt: now } },
    ]);
    const { decision } = await o.attempt('deleteMission', 'm1', {}, { id: 'cos', maxReversibility: 'irreversible', maxBlastRadius: 'all_hosts' });
    assert.strictEqual(decision.outcome, 'escalated');
    assert.strictEqual(decision.refusedBy?.[0]?.code, 'HUMAN_CONFIRMATION_REQUIRED');
  });
});

describe('preconditions', () => {
  it('refuses to load a model that does not fit, and says why', async () => {
    const o = setup([host(), gpu({ memoryUsedMb: 30000 }), model('big', { vramRequiredMb: 20000 })]);
    const { decision, ok } = await o.attempt('loadModel', 'gpu-uuid-1', { modelId: 'big' }, agent);

    assert.strictEqual(ok, false);
    assert.strictEqual(decision.outcome, 'refused');
    assert.match(String(decision.refusedBy?.map((r) => r.message).join(' ')), /short of/);
  });

  it('refuses to load a frontier model onto a device', async () => {
    const o = setup([host(), gpu(), model('claude', { residence: 'frontier', vramRequiredMb: 0 })]);
    const { decision } = await o.attempt('loadModel', 'gpu-uuid-1', { modelId: 'claude' }, agent);
    assert.match(String(decision.refusedBy?.map((r) => r.message).join(' ')), /frontier model/);
  });

  it('refuses to benchmark a kernel that has not compiled', async () => {
    const o = setup([
      host(),
      gpu(),
      { type: 'Kernel', id: 'k1', properties: { id: 'k1', name: 'saxpy', sourcePath: 'src/saxpy.cu', compiled: false } },
    ]);
    const { decision } = await o.attempt('runBenchmark', 'k1', { samples: 10 }, agent);
    assert.match(String(decision.refusedBy?.map((r) => r.message).join(' ')), /not compiled|has not compiled/);
  });

  it('refuses a benchmark with too few samples to support any claim', async () => {
    const o = setup([
      host(),
      gpu(),
      { type: 'Kernel', id: 'k1', properties: { id: 'k1', name: 'saxpy', sourcePath: 'src/saxpy.cu', compiled: true } },
    ]);
    const { decision } = await o.attempt('runBenchmark', 'k1', { samples: 1 }, agent);
    assert.strictEqual(decision.outcome, 'refused');
  });

  it('will not assume a toolchain it has never probed for', async () => {
    const o = setup([
      host(),
      { type: 'Kernel', id: 'k1', properties: { id: 'k1', name: 'saxpy', sourcePath: 'src/saxpy.cu' } },
    ]);
    const { decision } = await o.attempt('compileKernel', 'k1', {}, agent);
    assert.match(String(decision.refusedBy?.map((r) => r.message).join(' ')), /never been probed|not be assumed/);
  });

  it('refuses a kernel source path outside the workspace', async () => {
    const o = setup([
      host({ nvccAvailable: true }),
      { type: 'Kernel', id: 'k1', properties: { id: 'k1', name: 'x', sourcePath: '/etc/evil.cu' } },
    ]);
    const { decision } = await o.attempt('compileKernel', 'k1', {}, agent);
    assert.match(String(decision.refusedBy?.map((r) => r.message).join(' ')), /outside the host workspace/);
  });
});

describe('parameter validation', () => {
  it('rejects a parameter outside its declared range', async () => {
    const o = setup([host(), gpu()]);
    const human: Actor = { id: 'tyler', maxReversibility: 'irreversible', maxBlastRadius: 'all_hosts', humanConfirmed: true };
    const { decision } = await o.attempt('setPowerLimit', 'gpu-uuid-1', { watts: -50 }, human);
    assert.strictEqual(decision.outcome, 'refused');
  });

  it('rejects unexpected parameters instead of ignoring them', async () => {
    const o = setup([host(), gpu(), model('m')]);
    const { decision } = await o.attempt('loadModel', 'gpu-uuid-1', { modelId: 'm', sudo: true }, agent);
    assert.match(String(decision.refusedBy?.map((r) => r.message).join(' ')), /Unexpected parameter/);
  });
});

describe('executor honesty', () => {
  it('records a failure when the executor reports one, and does not apply changes', async () => {
    const failing: Executor = async () => ({ ok: false, error: 'nvcc exited 1' });
    const o = setup([host(), gpu(), model('m')], failing);
    const { decision, ok } = await o.attempt('loadModel', 'gpu-uuid-1', { modelId: 'm' }, agent);

    assert.strictEqual(ok, false);
    assert.strictEqual(decision.outcome, 'failed');
    assert.strictEqual(decision.error, 'nvcc exited 1');
  });

  it('records a failure when the executor throws', async () => {
    const throwing: Executor = async () => {
      throw new Error('bridge offline');
    };
    const o = setup([host(), gpu(), model('m')], throwing);
    const { decision } = await o.attempt('loadModel', 'gpu-uuid-1', { modelId: 'm' }, agent);
    assert.strictEqual(decision.outcome, 'failed');
    assert.strictEqual(decision.error, 'bridge offline');
  });

  it('applies declared changes to the world on success', async () => {
    const loading: Executor = async () => ({ ok: true, changes: { memoryUsedMb: 10240 } });
    const o = setup([host(), gpu(), model('m')], loading);
    await o.attempt('loadModel', 'gpu-uuid-1', { modelId: 'm' }, agent);
    assert.strictEqual(o.world.get('Gpu', 'gpu-uuid-1')?.properties.memoryUsedMb, 10240);
  });
});

describe('decision record', () => {
  it('records a decision for every attempt, including refusals', async () => {
    const o = setup([host(), gpu({ memoryUsedMb: 32000 }), model('big', { vramRequiredMb: 20000 })]);
    await o.attempt('loadModel', 'gpu-uuid-1', { modelId: 'big' }, agent);
    await o.attempt('readGpuTelemetry', 'gpu-uuid-1', {}, agent);

    const history = o.history();
    assert.strictEqual((history).length, 2);
    assert.strictEqual(history[0]?.outcome, 'refused');
    assert.strictEqual(history[1]?.outcome, 'executed');
    // A refusal carries the same provenance a success does.
    assert.ok((history[0]?.reasoning.length) > (0), 'expected greater');
    assert.strictEqual(history[0]?.actor, 'specialist_1');
  });

  it('refuses telemetry when the bridge heartbeat is stale', async () => {
    const o = setup([host({ lastSeen: now - 5 * 60_000 }), gpu()]);
    const { decision } = await o.attempt('readGpuTelemetry', 'gpu-uuid-1', {}, agent);
    assert.match(String(decision.refusedBy?.map((r) => r.message).join(' ')), /heartbeat/);
  });
});

describe('routing logic', () => {
  it('prefers a local model that fits', () => {
    const o = setup([host(), gpu(), model('qwen-32b', { vramRequiredMb: 20000 })]);
    const result = o.evaluate('routeInference', {});
    assert.deepStrictEqual((result.value as any).residence, 'local');
    assert.deepStrictEqual((result.value as any).modelId, 'qwen-32b');
  });

  it('picks the largest local model that fits, not the first', () => {
    const o = setup([host(), gpu(), model('small', { vramRequiredMb: 4000 }), model('large', { vramRequiredMb: 20000 })]);
    assert.strictEqual((o.evaluate('routeInference', {}).value as any).modelId, 'large');
  });

  it('falls back to the cheapest keyed frontier model when nothing fits locally', () => {
    const o = setup([
      host(),
      gpu({ memoryUsedMb: 32000 }),
      model('local-big', { vramRequiredMb: 20000 }),
      model('pricey', { residence: 'frontier', keyAvailable: true, costPerMTokensOut: 75, vramRequiredMb: 0 }),
      model('cheap', { residence: 'frontier', keyAvailable: true, costPerMTokensOut: 15, vramRequiredMb: 0 }),
    ]);
    assert.strictEqual((o.evaluate('routeInference', {}).value as any).modelId, 'cheap');
  });

  it('will not route to a frontier model without a key, and says so', () => {
    const o = setup([
      host(),
      gpu({ memoryUsedMb: 32000 }),
      model('keyless', { residence: 'frontier', keyAvailable: false, costPerMTokensOut: 1, vramRequiredMb: 0 }),
    ]);
    const result = o.evaluate('routeInference', {});
    assert.strictEqual((result.value as any).modelId, null);
    assert.match(String(result.rationale), /unkeyed|must supply/);
  });

  it('skips an overheating device', () => {
    const o = setup([host(), gpu({ temperatureC: 90 }), model('m', { vramRequiredMb: 1000 })]);
    assert.strictEqual((o.evaluate('routeInference', {}).value as any).residence, 'frontier');
  });

  it('excludes local models that cannot do tool calling when tools are required', () => {
    const o = setup([host(), gpu(), model('no-tools', { supportsTools: false, vramRequiredMb: 1000 })]);
    assert.strictEqual((o.evaluate('routeInference', { needsTools: true }).value as any).modelId, null);
  });
});

describe('benchmark claims', () => {
  const bench = (over: Partial<Record<string, unknown>>): OntologyObject => ({
    type: 'Benchmark',
    id: 'b1',
    properties: {
      id: 'b1',
      subjectType: 'Kernel',
      subjectId: 'k1',
      metric: 'latency_ms',
      value: 8,
      baselineValue: 10,
      samples: 30,
      ranAt: now,
      ...over,
    },
  });

  it('accepts a real improvement backed by enough samples', () => {
    const o = setup([bench({ stdDev: 0.1 })]);
    const r = o.evaluate('benchmarkSupportsClaim', { benchmarkId: 'b1' });
    assert.strictEqual(r.value, true);
    assert.match(String(r.rationale), /20.0%/);
  });

  it('rejects a difference inside the noise band', () => {
    const o = setup([bench({ value: 9.9, stdDev: 1.5 })]);
    assert.strictEqual(o.evaluate('benchmarkSupportsClaim', { benchmarkId: 'b1' }).value, false);
  });

  it('rejects a single sample', () => {
    const o = setup([bench({ samples: 1 })]);
    assert.strictEqual(o.evaluate('benchmarkSupportsClaim', { benchmarkId: 'b1' }).value, false);
  });

  it('rejects a claim with no baseline to compare against', () => {
    const o = setup([bench({ baselineValue: undefined })]);
    const r = o.evaluate('benchmarkSupportsClaim', { benchmarkId: 'b1' });
    assert.strictEqual(r.value, false);
    assert.match(String(r.rationale), /no baseline/i);
  });

  it('knows higher is better for throughput', () => {
    const o = setup([bench({ metric: 'throughput_tokens_s', value: 120, baselineValue: 100, stdDev: 1 })]);
    assert.strictEqual(o.evaluate('benchmarkSupportsClaim', { benchmarkId: 'b1' }).value, true);
  });
});

describe('task readiness', () => {
  const task = (id: string, status: string, dependsOn: string[] = []): OntologyObject => ({
    type: 'Task',
    id,
    properties: { id, missionId: 'm1', agentId: 'a1', instruction: 'do it', status, dependsOn },
  });

  it('reports tasks whose dependencies have all succeeded', () => {
    const o = setup([task('t1', 'succeeded'), task('t2', 'pending', ['t1']), task('t3', 'pending', ['t2'])]);
    assert.deepStrictEqual(o.evaluate('readyTasks', { missionId: 'm1' }).value, ['t2']);
  });

  it('reports independent tasks together so they can run in parallel', () => {
    const o = setup([task('t1', 'pending'), task('t2', 'pending'), task('t3', 'pending', ['t1'])]);
    assert.deepStrictEqual(o.evaluate('readyTasks', { missionId: 'm1' }).value, ['t1', 't2']);
  });

  it('refuses to assign a task with an unmet dependency', async () => {
    const o = setup([
      task('t1', 'running'),
      task('t2', 'pending', ['t1']),
      { type: 'Agent', id: 'a1', properties: { id: 'a1', name: 'Coder', role: 'writes code', tier: 'specialist' } },
    ]);
    const { decision } = await o.attempt('assignTask', 't2', { agentId: 'a1' }, agent);
    assert.match(String(decision.refusedBy?.map((r) => r.message).join(' ')), /unfinished dependency/);
  });
});

describe('the two risk axes are independent', () => {
  const mission = (status = 'completed'): OntologyObject => ({
    type: 'Mission',
    id: 'm1',
    properties: { id: 'm1', prompt: 'x', status, userId: 'u', createdAt: now },
  });

  it('allows wide reach when the work is reversible', async () => {
    // runCommand is host-wide but recoverable. An actor trusted that far may run it.
    const o = setup([host()]);
    const wide: Actor = { id: 'wide', maxReversibility: 'recoverable', maxBlastRadius: 'host' };
    const { ok } = await o.attempt('runCommand', 'host1', { command: 'ls' }, wide);
    assert.strictEqual(ok, true);
  });

  it('refuses the same reach when the ceiling is narrower', async () => {
    const o = setup([host()]);
    const narrow: Actor = { id: 'narrow', maxReversibility: 'irreversible', maxBlastRadius: 'object' };
    const { decision } = await o.attempt('runCommand', 'host1', { command: 'ls' }, narrow);

    // Irreversible-capable but object-scoped: blast radius is what stops it, and
    // a single ladder could not express this actor at all.
    assert.strictEqual(decision.outcome, 'escalated');
    assert.strictEqual(decision.refusedBy?.[0]?.code, 'BLAST_RADIUS_ABOVE_CEILING');
  });

  it('names reversibility when that is the binding constraint', async () => {
    const o = setup([mission()]);
    const broad: Actor = { id: 'broad', maxReversibility: 'recoverable', maxBlastRadius: 'all_hosts', humanConfirmed: true };
    const { decision } = await o.attempt('deleteMission', 'm1', {}, broad);
    assert.strictEqual(decision.refusedBy?.[0]?.code, 'REVERSIBILITY_ABOVE_CEILING');
  });

  it('distinguishes why a human is required', async () => {
    const o = setup([host(), gpu()]);
    const { decision } = await o.attempt('setPowerLimit', 'gpu-uuid-1', { watts: 400 }, agent);
    // Hardware state, not irreversible loss. A caller may treat these differently.
    assert.match(String(decision.refusedBy?.[0]?.message), /changes hardware state/);
  });
});

describe('refusals are machine-readable', () => {
  it('carries a stable code, the subject, and the bounds that were violated', async () => {
    const o = setup([host(), gpu()]);
    const human: Actor = { id: 'tyler', maxReversibility: 'irreversible', maxBlastRadius: 'all_hosts', humanConfirmed: true };
    const { decision } = await o.attempt('setPowerLimit', 'gpu-uuid-1', { watts: 5000 }, human);

    const refusal = decision.refusedBy?.[0];
    assert.strictEqual(refusal?.code, 'POWER_LIMIT_OUT_OF_RANGE');
    assert.strictEqual(refusal?.subject, 'watts');
    assert.strictEqual(refusal?.expected, '200W to 600W');
    assert.strictEqual(refusal?.actual, '5000W');
    // An agent can act on this without parsing prose.
    assert.match(String(refusal?.remediation), /between 200 and 600/);
  });

  it('reports free VRAM as the actual value when a model does not fit', async () => {
    const o = setup([host(), gpu({ memoryUsedMb: 30000 }), model('big', { vramRequiredMb: 20000 })]);
    const { decision } = await o.attempt('loadModel', 'gpu-uuid-1', { modelId: 'big' }, agent);

    const refusal = decision.refusedBy?.[0];
    assert.strictEqual(refusal?.code, 'INSUFFICIENT_VRAM');
    assert.strictEqual(refusal?.actual, '2768 MiB free');
  });

  it('distinguishes an unprobed toolchain from a probed absent one', async () => {
    const kernel: OntologyObject = {
      type: 'Kernel',
      id: 'k1',
      properties: { id: 'k1', name: 'saxpy', sourcePath: 'src/saxpy.cu' },
    };

    const unprobed = await setup([host(), kernel]).attempt('compileKernel', 'k1', {}, agent);
    assert.strictEqual(unprobed.decision.refusedBy?.[0]?.code, 'TOOLCHAIN_UNPROBED');

    const absent = await setup([host({ nvccAvailable: false }), kernel]).attempt('compileKernel', 'k1', {}, agent);
    assert.strictEqual(absent.decision.refusedBy?.[0]?.code, 'NVCC_ABSENT');
    assert.match(String(absent.decision.refusedBy?.[0]?.remediation), /Install the CUDA toolkit/);
  });

  it('names the unmet dependencies so an agent can act on them', async () => {
    const task = (id: string, status: string, dependsOn: string[] = []): OntologyObject => ({
      type: 'Task',
      id,
      properties: { id, missionId: 'm1', agentId: 'a1', instruction: 'do it', status, dependsOn },
    });
    const o = setup([
      task('t1', 'running'),
      task('t2', 'pending', ['t1']),
      { type: 'Agent', id: 'a1', properties: { id: 'a1', name: 'Coder', role: 'writes code', tier: 'specialist' } },
    ]);
    const { decision } = await o.attempt('assignTask', 't2', { agentId: 'a1' }, agent);

    const refusal = decision.refusedBy?.[0];
    assert.strictEqual(refusal?.code, 'DEPENDENCIES_UNMET');
    assert.deepStrictEqual(refusal?.actual, ['t1']);
  });
});
