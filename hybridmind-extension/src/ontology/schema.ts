import type { ObjectTypeSpec } from '@hybridmind/ontology-core';

/**
 * The semantic layer: what exists in HybridMind's world.
 *
 * Two domains modelled together on purpose. An agent reasoning about whether to
 * run a model locally needs the GPU's free VRAM and the model's footprint in the
 * same vocabulary; splitting hardware and orchestration into separate schemas is
 * what forces that reasoning back into prose.
 *
 * Every property here is something that can be measured or read. Nothing asserts
 * a capability. The old agent prompts claimed "direct access to the CUDA toolkit"
 * as a fact; here toolkit presence is a property of a Gpu object that is either
 * observed from the host or absent.
 */

export const GPU: ObjectTypeSpec = {
  name: 'Gpu',
  description: 'A physical GPU observed on a paired host, as reported by NVML.',
  primaryKey: 'uuid',
  properties: {
    uuid: { kind: 'string', description: 'NVML device UUID.', required: true },
    index: { kind: 'number', description: 'Device index on the host.', required: true, min: 0 },
    name: { kind: 'string', description: 'Marketing name, for example NVIDIA GeForce RTX 5090.', required: true },
    hostId: { kind: 'string', description: 'Bridge host this device belongs to.', required: true },
    computeCapability: { kind: 'string', description: 'CUDA compute capability, for example 12.0.' },
    memoryTotalMb: { kind: 'number', description: 'Total VRAM.', required: true, min: 0, unit: 'MiB' },
    memoryUsedMb: { kind: 'number', description: 'VRAM currently in use.', min: 0, unit: 'MiB' },
    utilizationPct: { kind: 'number', description: 'SM utilization.', min: 0, max: 100, unit: '%' },
    temperatureC: { kind: 'number', description: 'Core temperature.', min: 0, max: 150, unit: 'C' },
    powerDrawW: { kind: 'number', description: 'Instantaneous board power draw.', min: 0, unit: 'W' },
    powerLimitW: { kind: 'number', description: 'Enforced power limit.', min: 0, unit: 'W' },
    powerLimitMinW: { kind: 'number', description: 'Lowest settable power limit.', min: 0, unit: 'W' },
    powerLimitMaxW: { kind: 'number', description: 'Highest settable power limit.', min: 0, unit: 'W' },
    persistenceMode: { kind: 'boolean', description: 'Whether persistence mode is enabled.' },
    driverVersion: { kind: 'string', description: 'Installed NVIDIA driver version.' },
    cudaVersion: { kind: 'string', description: 'CUDA runtime version reported by the driver.' },
    observedAt: { kind: 'timestamp', description: 'When this snapshot was taken.', required: true },
  },
  links: {
    host: { to: 'Host', cardinality: 'one', description: 'Machine the device is installed in.' },
    runs: { to: 'Run', cardinality: 'many', description: 'Work executed on this device.' },
  },
};

export const HOST: ObjectTypeSpec = {
  name: 'Host',
  description: 'A machine reachable through a paired bridge.',
  primaryKey: 'id',
  properties: {
    id: { kind: 'string', description: 'Stable host identifier.', required: true },
    hostname: { kind: 'string', description: 'Reported hostname.', required: true },
    platform: { kind: 'enum', description: 'Operating system family.', values: ['linux', 'win32', 'darwin'] },
    workspace: { kind: 'string', description: 'Directory the bridge confines file access to.' },
    bridgeVersion: { kind: 'string', description: 'Bridge build running on the host.' },
    // Presence is observed by probing, never assumed. An absent value means "not
    // yet checked"; false means "checked and not present".
    nvccAvailable: { kind: 'boolean', description: 'Whether nvcc was found on PATH.' },
    nsightComputeAvailable: { kind: 'boolean', description: 'Whether ncu was found on PATH.' },
    lastSeen: { kind: 'timestamp', description: 'Most recent bridge heartbeat.', required: true },
  },
  links: {
    gpus: { to: 'Gpu', cardinality: 'many', description: 'Devices installed in this host.' },
  },
};

export const MODEL: ObjectTypeSpec = {
  name: 'Model',
  description: 'A language model available to agents, either served locally or through a provider key.',
  primaryKey: 'id',
  properties: {
    id: { kind: 'string', description: 'Identifier, for example qwen2.5-coder:32b or anthropic/claude-opus-4.', required: true },
    displayName: { kind: 'string', description: 'Human-facing name.', required: true },
    residence: {
      kind: 'enum',
      description: 'Where inference happens. Local models run on a Gpu; frontier models run at a provider.',
      values: ['local', 'frontier'],
      required: true,
    },
    provider: { kind: 'string', description: 'Serving runtime or API provider, for example ollama, vllm, anthropic.' },
    // residence says where inference happens; runtime says what will serve it.
    // Two local runtimes are supported and they are not interchangeable: the load
    // path, the metadata available, and the base URL all differ.
    runtime: {
      kind: 'enum',
      description: 'Which runtime serves this model.',
      values: ['ollama', 'lmstudio', 'frontier'],
      required: true,
    },
    contextWindow: { kind: 'number', description: 'Maximum context in tokens.', min: 0, unit: 'tokens' },
    contextWindowSource: {
      kind: 'enum',
      description: 'Whether contextWindow was reported by the runtime or estimated from the model family.',
      values: ['reported', 'estimated'],
    },
    vramRequiredMb: { kind: 'number', description: 'VRAM needed to serve locally at the configured quantization.', min: 0, unit: 'MiB' },
    // A local footprint derived from parameter count and quantization is an
    // estimate, not a measurement. Recording which it is keeps a placement
    // decision from reading as if the number had been observed on the device.
    vramEstimated: { kind: 'boolean', description: 'True when vramRequiredMb was calculated rather than measured.' },
    parameterSize: { kind: 'string', description: 'Parameter count as the runtime reports it, for example 32B.' },
    quantization: { kind: 'string', description: 'Quantization scheme, for example Q4_K_M or fp16.' },
    // An ordinal, not a score. It exists so "most capable" is a comparison the
    // logic layer can make across local and frontier models without inventing a
    // benchmark it has not run.
    capabilityTier: {
      kind: 'number',
      description: 'Relative capability, 1 (smallest) to 5 (flagship). Ordinal, assigned by catalog, not measured.',
      min: 1,
      max: 5,
    },
    supportsTools: { kind: 'boolean', description: 'Whether the model supports native tool calling.' },
    costPerMTokensIn: { kind: 'number', description: 'Input cost per million tokens. Zero for local.', min: 0, unit: 'USD' },
    costPerMTokensOut: { kind: 'number', description: 'Output cost per million tokens. Zero for local.', min: 0, unit: 'USD' },
    // BYOK is a hard constraint in this product: a frontier model is only usable
    // when the user has supplied their own key. This property is what makes that
    // checkable rather than assumed.
    keyAvailable: { kind: 'boolean', description: 'Whether the user has supplied a key for this provider.' },
  },
  // Version 2 added runtime as a required property. Everything else added with it
  // is optional and additive, which on its own would need no bump; making one
  // property required does, because an object written at version 1 has no value
  // for it and the engine refuses an object it cannot bring forward.
  version: 2,
  migrations: {
    1: (properties) => ({
      ...properties,
      // Version 1 had only one local runtime, so every local model stored then
      // was an Ollama model. Frontier models take the frontier runtime.
      runtime: properties.residence === 'local' ? 'ollama' : 'frontier',
    }),
  },
};

export const KERNEL: ObjectTypeSpec = {
  name: 'Kernel',
  description: 'A CUDA kernel authored or modified by an agent.',
  primaryKey: 'id',
  properties: {
    id: { kind: 'string', description: 'Kernel identifier.', required: true },
    name: { kind: 'string', description: 'Kernel function name.', required: true },
    sourcePath: { kind: 'string', description: 'Path to the source, inside the host workspace.', required: true },
    targetArch: { kind: 'string', description: 'Compute capability compiled for, for example sm_90.' },
    compiled: { kind: 'boolean', description: 'Whether the current source compiled successfully.' },
    compileError: { kind: 'string', description: 'nvcc diagnostics from the last failed compile.' },
    blockSize: { kind: 'number', description: 'Threads per block in the current configuration.', min: 1 },
    occupancyPct: { kind: 'number', description: 'Achieved occupancy measured by the profiler.', min: 0, max: 100, unit: '%' },
  },
  links: {
    benchmarks: { to: 'Benchmark', cardinality: 'many', description: 'Measurements of this kernel.' },
  },
};

export const BENCHMARK: ObjectTypeSpec = {
  name: 'Benchmark',
  description: 'A measured result. The only acceptable evidence for a performance claim.',
  primaryKey: 'id',
  properties: {
    id: { kind: 'string', description: 'Benchmark identifier.', required: true },
    subjectType: { kind: 'enum', description: 'What was measured.', values: ['Kernel', 'Model'], required: true },
    subjectId: { kind: 'string', description: 'Identifier of the measured object.', required: true },
    gpuUuid: { kind: 'string', description: 'Device the measurement ran on.' },
    metric: {
      kind: 'enum',
      description: 'Quantity measured.',
      values: ['latency_ms', 'throughput_tokens_s', 'throughput_gb_s', 'occupancy_pct'],
      required: true,
    },
    value: { kind: 'number', description: 'Measured value.', required: true },
    // A single sample is not a measurement. Recording the sample count keeps
    // "it got faster" from resting on one noisy run.
    samples: { kind: 'number', description: 'Number of runs aggregated.', min: 1, required: true },
    stdDev: { kind: 'number', description: 'Standard deviation across samples.', min: 0 },
    baselineValue: { kind: 'number', description: 'Value this is being compared against, when it is a before-and-after.' },
    ranAt: { kind: 'timestamp', description: 'When the measurement was taken.', required: true },
  },
};

export const MISSION: ObjectTypeSpec = {
  name: 'Mission',
  description: 'A unit of work requested by the user and planned by the Chief of Staff.',
  primaryKey: 'id',
  properties: {
    id: { kind: 'string', description: 'Mission identifier.', required: true },
    prompt: { kind: 'string', description: 'What the user asked for.', required: true },
    strategy: { kind: 'string', description: 'The plan the orchestrator produced.' },
    status: {
      kind: 'enum',
      description: 'Lifecycle state.',
      values: ['planning', 'executing', 'completed', 'failed'],
      required: true,
    },
    userId: { kind: 'string', description: 'Owner.', required: true },
    createdAt: { kind: 'timestamp', description: 'Creation time.', required: true },
  },
  links: {
    tasks: { to: 'Task', cardinality: 'many', description: 'Steps in this mission.' },
    decisions: { to: 'Decision', cardinality: 'many', description: 'Decisions taken during this mission.' },
  },
};

export const AGENT: ObjectTypeSpec = {
  name: 'Agent',
  description: 'A specialist, manager, or orchestrator that can be assigned work.',
  primaryKey: 'id',
  properties: {
    id: { kind: 'string', description: 'Agent identifier.', required: true },
    name: { kind: 'string', description: 'Display name.', required: true },
    role: { kind: 'string', description: 'What this agent does.', required: true },
    tier: { kind: 'enum', description: 'Position in the hierarchy.', values: ['specialist', 'manager', 'chief_of_staff'], required: true },
    modelId: { kind: 'string', description: 'Model currently backing this agent.' },
    // Capability comes from the actions an agent is granted, never from prose in
    // its system prompt. This is the property that stops an agent being told it
    // has CUDA access it does not have.
    grantedActions: { kind: 'json', description: 'Action names this agent is permitted to invoke.' },
    maxRisk: { kind: 'enum', description: 'Highest risk level this agent may attempt.', values: ['read', 'write', 'destructive', 'human_only'] },
  },
};

export const TASK: ObjectTypeSpec = {
  name: 'Task',
  description: 'One step of a mission, assigned to a single agent.',
  primaryKey: 'id',
  properties: {
    id: { kind: 'string', description: 'Task identifier.', required: true },
    missionId: { kind: 'string', description: 'Parent mission.', required: true },
    agentId: { kind: 'string', description: 'Assigned agent.', required: true },
    instruction: { kind: 'string', description: 'What the agent was asked to do.', required: true },
    status: { kind: 'enum', description: 'Lifecycle state.', values: ['pending', 'running', 'succeeded', 'failed', 'skipped'], required: true },
    output: { kind: 'string', description: 'What the agent produced.' },
    dependsOn: { kind: 'json', description: 'Task ids that must finish first. Empty means it can run immediately.' },
  },
};

export const RUN: ObjectTypeSpec = {
  name: 'Run',
  description: 'An execution of work on a host, whether a compile, a benchmark, or model inference.',
  primaryKey: 'id',
  properties: {
    id: { kind: 'string', description: 'Run identifier.', required: true },
    kind: { kind: 'enum', description: 'What kind of work ran.', values: ['compile', 'benchmark', 'inference', 'profile'], required: true },
    hostId: { kind: 'string', description: 'Host it ran on.', required: true },
    gpuUuid: { kind: 'string', description: 'Device it ran on, when GPU work.' },
    status: { kind: 'enum', description: 'Result.', values: ['queued', 'running', 'succeeded', 'failed'], required: true },
    startedAt: { kind: 'timestamp', description: 'Start time.', required: true },
    durationMs: { kind: 'number', description: 'Wall clock duration.', min: 0, unit: 'ms' },
    exitCode: { kind: 'number', description: 'Process exit code.' },
    stderr: { kind: 'string', description: 'Captured error output.' },
  },
};

export const SCHEMA: Record<string, ObjectTypeSpec> = Object.fromEntries(
  [GPU, HOST, MODEL, KERNEL, BENCHMARK, MISSION, AGENT, TASK, RUN].map((t) => [t.name, t]),
);
