import type { OntologyObject } from '@hybridmind/ontology-core';

/**
 * Turns a bridge telemetry payload into Gpu and Host objects.
 *
 * Kept pure and separate from the transport so the mapping can be tested without
 * a GPU, a bridge, or Firestore. The bridge already drops readings nvidia-smi
 * could not supply, and this preserves that: a property absent here means not
 * observed, which is what lets the ontology refuse to reason about it rather
 * than treating a missing reading as a zero.
 */

export interface RawDevice {
  uuid?: string;
  index?: number;
  name?: string;
  memoryTotalMb?: number;
  memoryUsedMb?: number;
  utilizationPct?: number;
  temperatureC?: number;
  powerDrawW?: number;
  powerLimitW?: number;
  powerLimitMinW?: number;
  powerLimitMaxW?: number;
  persistenceMode?: boolean;
  driverVersion?: string;
  computeCapability?: string;
}

export interface RawToolchain {
  nvccAvailable?: boolean;
  nsightComputeAvailable?: boolean;
  nsightSystemsAvailable?: boolean;
  cudaToolkitVersion?: string;
}

export class TelemetryError extends Error {}

/** Parses a bridge payload, which may be a single device or an array of them. */
export function parseDevices(payload: string): RawDevice[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new TelemetryError('Bridge returned telemetry that is not valid JSON.');
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.filter((d): d is RawDevice => !!d && typeof d === 'object' && typeof (d as RawDevice).uuid === 'string');
}

/**
 * Builds a Gpu object. Only observed properties are copied, so the result
 * validates against the schema without inventing values to satisfy it.
 */
export function toGpuObject(device: RawDevice, hostId: string, observedAt = Date.now()): OntologyObject {
  if (!device.uuid) throw new TelemetryError('Device has no uuid, so it cannot be identified.');
  if (device.index === undefined) throw new TelemetryError(`Device ${device.uuid} reported no index.`);
  if (!device.name) throw new TelemetryError(`Device ${device.uuid} reported no name.`);
  if (device.memoryTotalMb === undefined) {
    throw new TelemetryError(`Device ${device.uuid} reported no total memory, so it cannot be used for placement decisions.`);
  }

  const properties: Record<string, unknown> = {
    uuid: device.uuid,
    index: device.index,
    name: device.name,
    hostId,
    memoryTotalMb: device.memoryTotalMb,
    observedAt,
  };

  const optional: (keyof RawDevice)[] = [
    'memoryUsedMb',
    'utilizationPct',
    'temperatureC',
    'powerDrawW',
    'powerLimitW',
    'powerLimitMinW',
    'powerLimitMaxW',
    'persistenceMode',
    'driverVersion',
    'computeCapability',
  ];
  for (const key of optional) {
    const value = device[key];
    if (value !== undefined) properties[key] = value;
  }

  return { type: 'Gpu', id: device.uuid, properties };
}

export interface HostFacts {
  id: string;
  hostname: string;
  platform?: string;
  workspace?: string;
  bridgeVersion?: string;
  lastSeen: number;
}

/** Builds a Host object, folding in toolchain results when they have been probed. */
export function toHostObject(facts: HostFacts, toolchain?: RawToolchain): OntologyObject {
  const properties: Record<string, unknown> = {
    id: facts.id,
    hostname: facts.hostname,
    lastSeen: facts.lastSeen,
  };

  if (facts.platform) properties.platform = facts.platform;
  if (facts.workspace) properties.workspace = facts.workspace;
  if (facts.bridgeVersion) properties.bridgeVersion = facts.bridgeVersion;

  // Only set when actually probed. Leaving these undefined is what makes
  // compileKernel refuse with "no host has been probed for nvcc yet" instead of
  // assuming a toolchain that may not exist.
  if (toolchain?.nvccAvailable !== undefined) properties.nvccAvailable = toolchain.nvccAvailable;
  if (toolchain?.nsightComputeAvailable !== undefined) {
    properties.nsightComputeAvailable = toolchain.nsightComputeAvailable;
  }

  return { type: 'Host', id: facts.id, properties };
}

/**
 * The observed properties of a device, excluding the identity fields that do not
 * change between samples. Used to update an existing Gpu object in place.
 */
export function toGpuChanges(device: RawDevice, observedAt = Date.now()): Record<string, unknown> {
  const { uuid, index, name, ...rest } = device;
  const changes: Record<string, unknown> = { observedAt };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) changes[key] = value;
  }
  return changes;
}

/** Free VRAM, or undefined when usage was not reported. */
export function freeVram(device: RawDevice): number | undefined {
  if (device.memoryTotalMb === undefined || device.memoryUsedMb === undefined) return undefined;
  return Math.max(0, device.memoryTotalMb - device.memoryUsedMb);
}

/** One-line summary for the UI and for agent context. */
export function describeDevice(device: RawDevice): string {
  const parts: string[] = [device.name ?? 'Unknown device'];
  const free = freeVram(device);
  if (free !== undefined && device.memoryTotalMb !== undefined) {
    parts.push(`${free} of ${device.memoryTotalMb} MiB free`);
  }
  if (device.utilizationPct !== undefined) parts.push(`${device.utilizationPct}% utilized`);
  if (device.temperatureC !== undefined) parts.push(`${device.temperatureC}C`);
  if (device.powerDrawW !== undefined && device.powerLimitW !== undefined) {
    parts.push(`${Math.round(device.powerDrawW)}W of ${Math.round(device.powerLimitW)}W`);
  }
  return parts.join(', ');
}
