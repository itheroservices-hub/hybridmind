import { canHostModel, freeVramMb, gpuIsHealthy } from './functions';
import { RISK, refuse, type ActionSpec } from '@hybridmind/ontology-core';

/**
 * The kinetic layer: what may happen, and under what conditions.
 *
 * An action declares its subject, its risk on two axes, its parameters, what must
 * be true before it runs, and what changes when it does. The engine enforces all
 * of it. Nothing here performs the work; these are contracts, and the executor
 * supplies the implementation. That separation is what lets a precondition refuse
 * an action before any side effect occurs.
 *
 * Refusals are structured rather than prose. The usual reader is a model deciding
 * whether to retry with a different parameter, wait, or stop, and a stable code
 * plus the expected and actual values supports that decision in a way a sentence
 * does not.
 */

/** Bridge heartbeats every 20s, so a minute of silence means the host is gone. */
const HEARTBEAT_STALE_MS = 60_000;

const staleHeartbeat = (lastSeen: number) =>
  refuse('BRIDGE_HEARTBEAT_STALE', 'The paired host has not sent a bridge heartbeat in over a minute.', {
    subject: 'Host.lastSeen',
    expected: `within ${HEARTBEAT_STALE_MS / 1000}s`,
    actual: `${Math.round((Date.now() - lastSeen) / 1000)}s ago`,
    remediation: 'Start the HybridMind Bridge on the host, then retry.',
  });

/** Paths must stay inside the workspace the bridge confines file access to. */
const escapesWorkspace = (path: string) =>
  path.startsWith('/') || path.startsWith('~') || path.includes('..');

const outsideWorkspace = (path: string, subject: string, which: string) =>
  refuse('PATH_OUTSIDE_WORKSPACE', `"${path}" resolves outside the ${which} workspace.`, {
    subject,
    actual: path,
    remediation: 'Use a path relative to the workspace root, with no leading slash, tilde, or parent traversal.',
  });

export const readGpuTelemetry: ActionSpec = {
  name: 'readGpuTelemetry',
  description: 'Sample current NVML telemetry for a device.',
  subject: 'Gpu',
  risk: RISK.READ,
  parameters: {},
  preconditions: [
    {
      name: 'hostReachable',
      check: (gpu, _params, world) => {
        const host = world.get('Host', String(gpu.properties.hostId));
        if (!host) {
          return refuse('HOST_UNKNOWN', `Host ${gpu.properties.hostId} is not known.`, {
            subject: 'Gpu.hostId',
            actual: gpu.properties.hostId,
          });
        }
        const lastSeen = Number(host.properties.lastSeen ?? 0);
        return Date.now() - lastSeen > HEARTBEAT_STALE_MS ? staleHeartbeat(lastSeen) : null;
      },
    },
  ],
  effects: ['Updates the Gpu object with a fresh telemetry snapshot.'],
};

export const setPowerLimit: ActionSpec<{ watts: number }> = {
  name: 'setPowerLimit',
  description: 'Change the enforced power limit on a device.',
  subject: 'Gpu',
  // Recoverable, since the limit can be set back, but host-wide and a thermal
  // and stability problem on the user's own machine if wrong. Not an agent call.
  risk: RISK.HARDWARE,
  parameters: {
    watts: { kind: 'number', description: 'New power limit.', required: true, min: 0, unit: 'W' },
  },
  preconditions: [
    {
      name: 'withinDeviceRange',
      check: (gpu, params) => {
        const min = Number(gpu.properties.powerLimitMinW ?? NaN);
        const max = Number(gpu.properties.powerLimitMaxW ?? NaN);
        if (Number.isNaN(min) || Number.isNaN(max)) {
          return refuse('POWER_RANGE_UNKNOWN', 'The device has not reported its settable power limit range.', {
            subject: 'Gpu.powerLimitMinW',
            remediation: 'Sample telemetry first so the device reports its range.',
          });
        }
        if (params.watts < min || params.watts > max) {
          return refuse('POWER_LIMIT_OUT_OF_RANGE', `${params.watts}W is outside this device's settable range.`, {
            subject: 'watts',
            expected: `${min}W to ${max}W`,
            actual: `${params.watts}W`,
            remediation: `Choose a value between ${min} and ${max}.`,
          });
        }
        return null;
      },
    },
    {
      name: 'deviceIdle',
      check: (gpu, _params, world) => {
        const util = Number(gpu.properties.utilizationPct ?? 0);
        if (util > 10) {
          return refuse('DEVICE_BUSY', 'Changing the power limit mid-workload can destabilize the device.', {
            subject: 'Gpu.utilizationPct',
            expected: 'at most 10%',
            actual: `${util}%`,
            remediation: 'Wait for running work to finish, then retry.',
          });
        }
        const health = gpuIsHealthy.evaluate(world, { gpuUuid: gpu.id });
        return health.value
          ? null
          : refuse('DEVICE_UNHEALTHY', health.rationale, { subject: 'Gpu', remediation: 'Let the device cool or idle, then retry.' });
      },
    },
  ],
  effects: ['Sets the device power limit, which persists until reboot or until changed again.'],
};

export const loadModel: ActionSpec<{ modelId: string; runtime?: string; keepAliveSeconds?: number }> = {
  name: 'loadModel',
  description: 'Load a local model onto a device for serving.',
  subject: 'Gpu',
  risk: RISK.WRITE,
  parameters: {
    modelId: { kind: 'string', description: 'Model to load.', required: true },
    // The two local runtimes load differently: Ollama has a load endpoint, LM
    // Studio JIT-loads on first request. The executor is handed the subject and
    // the parameters but not the world, so the runtime arrives either as this
    // parameter or, when it is omitted, by the bridge resolving which runtime
    // actually holds the model. Naming the wrong one is refused below.
    runtime: {
      kind: 'enum',
      description: 'Local runtime that will serve the model.',
      values: ['ollama', 'lmstudio'],
    },
    keepAliveSeconds: {
      kind: 'number',
      description: 'How long Ollama should keep the model resident after loading. Ignored by LM Studio.',
      min: 1,
    },
  },
  preconditions: [
    {
      name: 'modelIsLocal',
      check: (_gpu, params, world) => {
        const model = world.get('Model', params.modelId);
        if (!model) {
          return refuse('MODEL_UNKNOWN', `Model ${params.modelId} is not known.`, {
            subject: 'modelId',
            actual: params.modelId,
          });
        }
        return model.properties.residence === 'local'
          ? null
          : refuse('MODEL_NOT_LOCAL', `${params.modelId} is a frontier model and cannot be loaded onto a device.`, {
              subject: 'Model.residence',
              expected: 'local',
              actual: model.properties.residence,
              remediation: 'Call it through its provider instead of loading it.',
            });
      },
    },
    {
      name: 'fitsInVram',
      check: (gpu, params, world) => {
        const result = canHostModel.evaluate(world, { gpuUuid: gpu.id, modelId: params.modelId });
        if (result.value) return null;
        const model = world.get('Model', params.modelId);
        return refuse('INSUFFICIENT_VRAM', result.rationale, {
          subject: 'Gpu.memoryUsedMb',
          expected: model ? `${model.properties.vramRequiredMb} MiB plus headroom` : undefined,
          actual: `${freeVramMb(gpu)} MiB free`,
          remediation: 'Free VRAM by unloading another model, or choose a smaller one.',
        });
      },
    },
    {
      name: 'deviceHealthy',
      check: (gpu, _params, world) => {
        const health = gpuIsHealthy.evaluate(world, { gpuUuid: gpu.id });
        return health.value ? null : refuse('DEVICE_UNHEALTHY', health.rationale, { subject: 'Gpu' });
      },
    },
    {
      name: 'runtimeMatchesModel',
      check: (_gpu, params, world) => {
        const declared = world.get('Model', params.modelId)?.properties.runtime;
        if (typeof declared !== 'string' || declared === 'frontier') {
          return refuse('MODEL_RUNTIME_UNKNOWN', `${params.modelId} does not record which local runtime serves it.`, {
            subject: 'Model.runtime',
            expected: 'ollama or lmstudio',
            actual: declared ?? 'absent',
            remediation: 'Rebuild the model catalog from the bridge so the runtime is recorded.',
          });
        }
        // Absent is allowed: the bridge then resolves which runtime holds the
        // model. Naming the wrong one is not, since it would load something else.
        if (params.runtime === undefined) return null;
        return params.runtime === declared
          ? null
          : refuse('RUNTIME_MISMATCH', `${params.modelId} is served by ${declared}, not ${params.runtime}.`, {
              subject: 'runtime',
              expected: declared,
              actual: params.runtime,
            });
      },
    },
  ],
  effects: [
    'Loads model weights into device memory.',
    'Reduces free VRAM by the model footprint, as the following telemetry sample reports.',
  ],
};

export const compileKernel: ActionSpec<{ arch?: string }> = {
  name: 'compileKernel',
  description: 'Compile a CUDA kernel with nvcc on the host.',
  subject: 'Kernel',
  risk: RISK.HOST_WRITE,
  parameters: {
    arch: { kind: 'string', description: 'Target architecture, for example sm_90. Defaults to the device capability.' },
  },
  preconditions: [
    {
      name: 'nvccPresent',
      check: (_kernel, _params, world) => {
        const hosts = world.all('Host');
        if (hosts.some((h) => h.properties.nvccAvailable === true)) return null;
        // Explicitly false means probed and absent. Undefined means never probed,
        // and an unprobed toolchain is not evidence that one exists.
        const probed = hosts.some((h) => h.properties.nvccAvailable === false);
        return probed
          ? refuse('NVCC_ABSENT', 'No paired host has nvcc on PATH.', {
              subject: 'Host.nvccAvailable',
              expected: true,
              actual: false,
              remediation: 'Install the CUDA toolkit on the host.',
            })
          : refuse('TOOLCHAIN_UNPROBED', 'No host has been probed for nvcc, so the toolchain cannot be assumed present.', {
              subject: 'Host.nvccAvailable',
              actual: 'not probed',
              remediation: 'Probe the host toolchain first.',
            });
      },
    },
    {
      name: 'sourceInWorkspace',
      check: (kernel) => {
        const path = String(kernel.properties.sourcePath ?? '');
        if (!path) {
          return refuse('KERNEL_NO_SOURCE', 'Kernel has no source path.', { subject: 'Kernel.sourcePath' });
        }
        return escapesWorkspace(path) ? outsideWorkspace(path, 'Kernel.sourcePath', 'host') : null;
      },
    },
  ],
  effects: ['Runs nvcc on the host.', 'Updates the Kernel compiled flag and any diagnostics.'],
};

export const runBenchmark: ActionSpec<{ samples: number }> = {
  name: 'runBenchmark',
  description: 'Measure a kernel or model, producing a Benchmark object.',
  subject: 'Kernel',
  risk: RISK.HOST_WRITE,
  parameters: {
    samples: { kind: 'number', description: 'How many runs to aggregate.', required: true, min: 3 },
  },
  preconditions: [
    {
      name: 'kernelCompiled',
      check: (kernel) =>
        kernel.properties.compiled === true
          ? null
          : refuse('KERNEL_NOT_COMPILED', 'Kernel has not compiled successfully, so there is nothing to measure.', {
              subject: 'Kernel.compiled',
              expected: true,
              actual: kernel.properties.compiled ?? 'never attempted',
              remediation: 'Compile the kernel first.',
            }),
    },
    {
      name: 'enoughSamples',
      check: (_kernel, params) =>
        // Matches benchmarkSupportsClaim, which will not accept fewer than three.
        params.samples >= 3
          ? null
          : refuse('TOO_FEW_SAMPLES', `${params.samples} sample(s) cannot support a performance claim.`, {
              subject: 'samples',
              expected: 'at least 3',
              actual: params.samples,
              remediation: 'Raise samples to 3 or more.',
            }),
    },
    {
      name: 'aDeviceIsFree',
      check: (_kernel, _params, world) => {
        const ready = world.all('Gpu').filter((g) => gpuIsHealthy.evaluate(world, { gpuUuid: g.id }).value);
        return ready.length > 0
          ? null
          : refuse('NO_HEALTHY_DEVICE', 'No device is in a healthy state; a loaded device would distort the measurement.', {
              subject: 'Gpu',
              expected: 'at least one healthy device',
              actual: `${world.all('Gpu').length} device(s), none healthy`,
              remediation: 'Wait for a device to cool or idle.',
            });
      },
    },
  ],
  effects: ['Executes the kernel repeatedly on a device.', 'Creates a Benchmark object with the aggregated result.'],
};

export const assignTask: ActionSpec<{ agentId: string }> = {
  name: 'assignTask',
  description: 'Assign a pending task to an agent and begin it.',
  subject: 'Task',
  risk: RISK.WRITE,
  parameters: {
    agentId: { kind: 'string', description: 'Agent to assign.', required: true },
  },
  preconditions: [
    {
      name: 'taskPending',
      check: (task) =>
        task.properties.status === 'pending'
          ? null
          : refuse('TASK_NOT_PENDING', `Task is ${task.properties.status}, not pending.`, {
              subject: 'Task.status',
              expected: 'pending',
              actual: task.properties.status,
            }),
    },
    {
      name: 'dependenciesSatisfied',
      check: (task, _params, world) => {
        const deps = Array.isArray(task.properties.dependsOn) ? (task.properties.dependsOn as string[]) : [];
        const unmet = deps.filter((d) => world.get('Task', d)?.properties.status !== 'succeeded');
        return unmet.length
          ? refuse('DEPENDENCIES_UNMET', `Waiting on ${unmet.length} unfinished dependency.`, {
              subject: 'Task.dependsOn',
              expected: 'all dependencies succeeded',
              actual: unmet,
              remediation: `Finish ${unmet.join(', ')} first.`,
            })
          : null;
      },
    },
    {
      name: 'agentExists',
      check: (_task, params, world) =>
        world.get('Agent', params.agentId)
          ? null
          : refuse('AGENT_UNKNOWN', `Agent ${params.agentId} is not known.`, {
              subject: 'agentId',
              actual: params.agentId,
            }),
    },
  ],
  effects: ['Moves the task to running and records the assigned agent.'],
};

export const deleteMission: ActionSpec = {
  name: 'deleteMission',
  description: 'Permanently remove a mission and everything recorded under it.',
  subject: 'Mission',
  risk: { ...RISK.DESTRUCTIVE, humanOnly: true, humanOnlyReason: 'irreversible_loss' },
  parameters: {},
  preconditions: [
    {
      name: 'notRunning',
      check: (mission) =>
        mission.properties.status === 'executing'
          ? refuse('MISSION_RUNNING', 'Mission is still executing.', {
              subject: 'Mission.status',
              expected: 'not executing',
              actual: 'executing',
              remediation: 'Stop the mission before deleting it.',
            })
          : null,
    },
  ],
  effects: ['Removes the mission, its tasks, and its decision history.'],
};

/**
 * The tools agents already use, expressed as actions, so there is one path rather
 * than two. Anything that bypasses the ontology bypasses its preconditions and its
 * decision record, and the guarantees stop being guarantees.
 */

export const runCommand: ActionSpec<{ command: string; cwd?: string }> = {
  name: 'runCommand',
  description: 'Run a shell command on a paired host through the bridge.',
  subject: 'Host',
  risk: RISK.HOST_WRITE,
  parameters: {
    command: { kind: 'string', description: 'Command to run.', required: true },
    cwd: { kind: 'string', description: 'Working directory, relative to the host workspace.' },
  },
  preconditions: [
    {
      name: 'bridgeAlive',
      check: (host) => {
        const lastSeen = Number(host.properties.lastSeen ?? 0);
        return Date.now() - lastSeen > HEARTBEAT_STALE_MS ? staleHeartbeat(lastSeen) : null;
      },
    },
    {
      name: 'commandPresent',
      check: (_host, params) =>
        params.command?.trim()
          ? null
          : refuse('COMMAND_EMPTY', 'A command is required.', { subject: 'command', actual: params.command ?? null }),
    },
    {
      name: 'cwdInsideWorkspace',
      check: (_host, params) =>
        // The bridge enforces this too. Refusing here means the reason reaches the
        // model as a precondition it can act on, not an opaque bridge error later.
        params.cwd && escapesWorkspace(params.cwd) ? outsideWorkspace(params.cwd, 'cwd', 'host') : null,
    },
  ],
  effects: ['Executes a command on the host, subject to the bridge allowlist and the user approving it.'],
};

export const readWorkspaceFile: ActionSpec<{ path: string }> = {
  name: 'readWorkspaceFile',
  description: 'Read a file from the mission workspace.',
  subject: 'Mission',
  risk: RISK.READ,
  parameters: {
    path: { kind: 'string', description: 'Path within the mission workspace.', required: true },
  },
  preconditions: [
    {
      name: 'pathInsideWorkspace',
      check: (_mission, params) =>
        escapesWorkspace(params.path) ? outsideWorkspace(params.path, 'path', 'mission') : null,
    },
  ],
  effects: ['Returns the stored contents of the file.'],
};

export const writeWorkspaceFile: ActionSpec<{ path: string; content: string }> = {
  name: 'writeWorkspaceFile',
  description: 'Write a file into the mission workspace.',
  subject: 'Mission',
  risk: RISK.WRITE,
  parameters: {
    path: { kind: 'string', description: 'Path within the mission workspace.', required: true },
    content: { kind: 'string', description: 'File contents.', required: true },
  },
  preconditions: [
    {
      name: 'pathInsideWorkspace',
      check: (_mission, params) =>
        escapesWorkspace(params.path) ? outsideWorkspace(params.path, 'path', 'mission') : null,
    },
    {
      name: 'missionNotFinished',
      check: (mission) => {
        const status = mission.properties.status;
        return status === 'completed' || status === 'failed'
          ? refuse('MISSION_CLOSED', `Mission is ${status}; its workspace is closed.`, {
              subject: 'Mission.status',
              expected: 'planning or executing',
              actual: status,
            })
          : null;
      },
    },
  ],
  effects: ['Stores the file contents against the mission.'],
};

export const ACTIONS: Record<string, ActionSpec<any>> = Object.fromEntries(
  [
    readGpuTelemetry, setPowerLimit, loadModel, compileKernel, runBenchmark, assignTask, deleteMission,
    runCommand, readWorkspaceFile, writeWorkspaceFile,
  ].map((a) => [a.name, a]),
);

export { freeVramMb };
