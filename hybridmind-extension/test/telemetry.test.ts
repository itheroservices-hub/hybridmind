import * as assert from 'assert';
const { parseNvidiaSmiCsv, splitCsvLine } = require('@hybridmind/local-runtimes/gpu.cjs');
import { MemoryWorld, Ontology } from '@hybridmind/ontology-core';
import { HYBRIDMIND_REGISTRY } from '../src/ontology/registry';
import {
  describeDevice,
  freeVram,
  parseDevices,
  TelemetryError,
  toGpuObject,
  toHostObject,
  type RawDevice,
} from '../src/services/telemetry';

/**
 * Field order must match QUERY_FIELDS in bridge-gpu.cjs:
 * uuid, index, name, memory.total, memory.used, utilization.gpu,
 * temperature.gpu, power.draw, power.limit, power.min_limit, power.max_limit,
 * persistence_mode, driver_version, compute_cap
 */
const ROW_5090 =
  'GPU-abc123, 0, NVIDIA GeForce RTX 5090, 32607, 1842, 3, 41, 28.51, 575.00, 150.00, 600.00, Enabled, 580.65, 12.0';

describe('csv splitting', () => {
  it('handles a plain row', () => {
    assert.deepStrictEqual(splitCsvLine('a, b, c'), ['a', 'b', 'c']);
  });

  it('keeps a quoted field containing a comma intact', () => {
    // Some device names contain commas; a naive split loses every later field.
    assert.deepStrictEqual(splitCsvLine('GPU-1, "NVIDIA RTX A6000, 48GB", 49140'), [
      'GPU-1',
      'NVIDIA RTX A6000, 48GB',
      '49140',
    ]);
  });

  it('handles an escaped quote inside a quoted field', () => {
    assert.deepStrictEqual(splitCsvLine('a, "say ""hi""", b'), ['a', 'say "hi"', 'b']);
  });
});

describe('nvidia-smi parsing', () => {
  it('parses a full device row', () => {
    const [gpu] = parseNvidiaSmiCsv(ROW_5090);
    assert.deepStrictEqual((gpu as any).uuid, 'GPU-abc123');
    assert.deepStrictEqual((gpu as any).index, 0);
    assert.deepStrictEqual((gpu as any).name, 'NVIDIA GeForce RTX 5090');
    assert.deepStrictEqual((gpu as any).memoryTotalMb, 32607);
    assert.deepStrictEqual((gpu as any).memoryUsedMb, 1842);
    assert.deepStrictEqual((gpu as any).utilizationPct, 3);
    assert.deepStrictEqual((gpu as any).temperatureC, 41);
    assert.deepStrictEqual((gpu as any).powerLimitW, 575);
    assert.deepStrictEqual((gpu as any).powerLimitMinW, 150);
    assert.deepStrictEqual((gpu as any).powerLimitMaxW, 600);
    assert.deepStrictEqual((gpu as any).persistenceMode, true);
    assert.deepStrictEqual((gpu as any).driverVersion, '580.65');
    assert.deepStrictEqual((gpu as any).computeCapability, '12.0');
    assert.ok(Math.abs((gpu.powerDrawW) - (28.51)) < 0.01, 'expected close to 28.51');
  });

  it('parses multiple devices', () => {
    const second = ROW_5090.replace('GPU-abc123', 'GPU-def456').replace(' 0,', ' 1,');
    assert.strictEqual((parseNvidiaSmiCsv(`${ROW_5090}\n${second}`)).length, 2);
  });

  it('drops unavailable readings rather than coercing them to zero', () => {
    // Power draw is commonly [N/A] on laptop and virtualized GPUs. Reporting 0W
    // would look like a measurement and would be wrong.
    const row = ROW_5090.replace(' 28.51,', ' [N/A],').replace(' Enabled,', ' [Not Supported],');
    const [gpu] = parseNvidiaSmiCsv(row);
    assert.ok(!Object.prototype.hasOwnProperty.call(gpu, 'powerDrawW'), 'expected no powerDrawW');
    assert.ok(!Object.prototype.hasOwnProperty.call(gpu, 'persistenceMode'), 'expected no persistenceMode');
    assert.strictEqual(gpu.memoryTotalMb, 32607);
  });

  it('reads persistence mode as a boolean', () => {
    const [on] = parseNvidiaSmiCsv(ROW_5090);
    const [off] = parseNvidiaSmiCsv(ROW_5090.replace(' Enabled,', ' Disabled,'));
    assert.strictEqual(on.persistenceMode, true);
    assert.strictEqual(off.persistenceMode, false);
  });

  it('skips a row with the wrong number of fields instead of misaligning', () => {
    // Reading a short row positionally would assign values to wrong properties.
    assert.deepStrictEqual(parseNvidiaSmiCsv('GPU-x, 0, Some GPU, 8192'), []);
  });

  it('skips a row with no uuid', () => {
    assert.deepStrictEqual(parseNvidiaSmiCsv(ROW_5090.replace('GPU-abc123', '')), []);
  });

  it('returns nothing for empty or whitespace output', () => {
    assert.deepStrictEqual(parseNvidiaSmiCsv(''), []);
    assert.deepStrictEqual(parseNvidiaSmiCsv('\n  \n'), []);
  });
});

describe('building ontology objects', () => {
  const device = (): RawDevice => parseNvidiaSmiCsv(ROW_5090)[0];

  it('builds a Gpu that validates against the schema', () => {
    const world = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
    assert.doesNotThrow(() => world.put(toGpuObject(device(), 'host1')));
    assert.strictEqual(world.get('Gpu', 'GPU-abc123')?.properties.hostId, 'host1');
  });

  it('omits properties that were not observed rather than defaulting them', () => {
    const partial: RawDevice = { uuid: 'g1', index: 0, name: 'Test GPU', memoryTotalMb: 8192 };
    const obj = toGpuObject(partial, 'host1');
    assert.ok(!Object.prototype.hasOwnProperty.call(obj.properties, 'temperatureC'), 'expected no temperatureC');
    assert.ok(!Object.prototype.hasOwnProperty.call(obj.properties, 'powerDrawW'), 'expected no powerDrawW');
  });

  it('refuses a device with no total memory, since placement cannot be decided without it', () => {
    const noMem: RawDevice = { uuid: 'g1', index: 0, name: 'Test GPU' };
    assert.throws(() => toGpuObject(noMem, 'host1'), TelemetryError);
  });

  it('leaves toolchain flags unset when the host has not been probed', () => {
    const host = toHostObject({ id: 'h1', hostname: 'box', lastSeen: Date.now() });
    assert.ok(!Object.prototype.hasOwnProperty.call(host.properties, 'nvccAvailable'), 'expected no nvccAvailable');
  });

  it('records a probed absence as false, which is different from unprobed', () => {
    const host = toHostObject({ id: 'h1', hostname: 'box', lastSeen: Date.now() }, { nvccAvailable: false });
    assert.strictEqual(host.properties.nvccAvailable, false);
  });
});

describe('derived readings', () => {
  it('computes free VRAM', () => {
    assert.strictEqual(freeVram({ memoryTotalMb: 32607, memoryUsedMb: 1842 }), 30765);
  });

  it('returns undefined when usage was not reported', () => {
    assert.strictEqual(freeVram({ memoryTotalMb: 32607 }), undefined);
  });

  it('describes a device without inventing missing readings', () => {
    const summary = describeDevice({ uuid: 'g', name: 'RTX 5090', memoryTotalMb: 32607 });
    assert.strictEqual(summary, 'RTX 5090');
  });

  it('describes a fully reported device', () => {
    assert.match(String(describeDevice(parseNvidiaSmiCsv(ROW_5090)[0])), /30765 of 32607 MiB free, 3% utilized, 41C/);
  });
});

describe('payload parsing', () => {
  it('accepts a single device object', () => {
    assert.strictEqual((parseDevices(JSON.stringify({ uuid: 'g1', name: 'x' }))).length, 1);
  });

  it('accepts an array', () => {
    assert.strictEqual((parseDevices(JSON.stringify([{ uuid: 'g1' }, { uuid: 'g2' }]))).length, 2);
  });

  it('rejects non-JSON rather than returning an empty list', () => {
    assert.throws(() => parseDevices('nvidia-smi: command not found'), TelemetryError);
  });

  it('drops entries with no uuid', () => {
    assert.strictEqual((parseDevices(JSON.stringify([{ uuid: 'g1' }, { name: 'nameless' }]))).length, 1);
  });
});

describe('telemetry makes routing operate on measured facts', () => {
  it('routes locally once a real device and a fitting model are known', () => {
    const world = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
    world.put(toHostObject({ id: 'host1', hostname: 'workstation', lastSeen: Date.now() }));
    world.put(toGpuObject(parseNvidiaSmiCsv(ROW_5090)[0], 'host1'));
    world.put({
      type: 'Model',
      id: 'qwen2.5-coder:32b',
      properties: {
        id: 'qwen2.5-coder:32b',
        displayName: 'Qwen2.5 Coder 32B',
        residence: 'local',
        vramRequiredMb: 20000,
        supportsTools: true,
      },
    });

    const ontology = new Ontology(world, HYBRIDMIND_REGISTRY, async () => ({ ok: true }));
    const result = ontology.evaluate('routeInference', {});

    assert.deepStrictEqual((result.value as any).residence, 'local');
    assert.deepStrictEqual((result.value as any).modelId, 'qwen2.5-coder:32b');
    // The rationale cites the measured figure, not a guess.
    assert.match(String(result.rationale), /30765 MiB free/);
  });

  it('will not route to a device that telemetry shows is too hot', () => {
    const world = new MemoryWorld(HYBRIDMIND_REGISTRY.schema);
    world.put(toHostObject({ id: 'host1', hostname: 'workstation', lastSeen: Date.now() }));
    const hot = { ...parseNvidiaSmiCsv(ROW_5090)[0], temperatureC: 88 };
    world.put(toGpuObject(hot, 'host1'));
    world.put({
      type: 'Model',
      id: 'small',
      properties: { id: 'small', displayName: 'Small', residence: 'local', vramRequiredMb: 2000, supportsTools: true },
    });

    const ontology = new Ontology(world, HYBRIDMIND_REGISTRY, async () => ({ ok: true }));
    assert.strictEqual((ontology.evaluate('routeInference', {}).value as any).residence, 'frontier');
  });
});
