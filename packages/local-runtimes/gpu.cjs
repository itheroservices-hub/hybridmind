/**
 * GPU telemetry for the bridge.
 *
 * Everything here reads. Nothing changes device state, and nothing interpolates
 * a caller-supplied string into a command: the nvidia-smi invocation is fixed
 * argv constructed here, never assembled from model output. That is why these
 * handlers sit outside the command allowlist and outside the approval prompt.
 * The allowlist exists to gate commands an agent composes; a parameterless read
 * the bridge composes itself is a different thing, and prompting for every
 * telemetry sample would make live monitoring unusable.
 *
 * Values nvidia-smi cannot supply come back as "[N/A]" or "[Not Supported]".
 * Those are dropped rather than coerced to zero: a missing reading and a reading
 * of zero mean very different things, and the ontology treats an absent property
 * as "not observed" rather than as a measurement.
 */

const { execFile } = require('child_process');

const QUERY_FIELDS = [
  'uuid',
  'index',
  'name',
  'memory.total',
  'memory.used',
  'utilization.gpu',
  'temperature.gpu',
  'power.draw',
  'power.limit',
  'power.min_limit',
  'power.max_limit',
  'persistence_mode',
  'driver_version',
  'compute_cap',
];

/** Maps an nvidia-smi field onto the Gpu property it populates, and how to read it. */
const FIELD_MAP = [
  { key: 'uuid', parse: asString },
  { key: 'index', parse: asNumber },
  { key: 'name', parse: asString },
  { key: 'memoryTotalMb', parse: asNumber },
  { key: 'memoryUsedMb', parse: asNumber },
  { key: 'utilizationPct', parse: asNumber },
  { key: 'temperatureC', parse: asNumber },
  { key: 'powerDrawW', parse: asNumber },
  { key: 'powerLimitW', parse: asNumber },
  { key: 'powerLimitMinW', parse: asNumber },
  { key: 'powerLimitMaxW', parse: asNumber },
  { key: 'persistenceMode', parse: asEnabled },
  { key: 'driverVersion', parse: asString },
  { key: 'computeCapability', parse: asString },
];

const UNAVAILABLE = new Set(['[n/a]', 'n/a', '[not supported]', 'not supported', '[unknown error]', '']);

function isUnavailable(raw) {
  return UNAVAILABLE.has(String(raw ?? '').trim().toLowerCase());
}

function asString(raw) {
  return isUnavailable(raw) ? undefined : String(raw).trim();
}

function asNumber(raw) {
  if (isUnavailable(raw)) return undefined;
  // nounits still leaves decimals on power draw, and some locales pad with spaces.
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : undefined;
}

function asEnabled(raw) {
  if (isUnavailable(raw)) return undefined;
  const v = String(raw).trim().toLowerCase();
  if (v === 'enabled') return true;
  if (v === 'disabled') return false;
  return undefined;
}

/**
 * Splits a CSV line honouring quoted fields. Device names can contain commas,
 * so a plain split on "," loses every field after the name on those cards.
 */
function splitCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim());
}

/** Parses `--format=csv,noheader,nounits` output into one object per device. */
function parseNvidiaSmiCsv(stdout) {
  const lines = String(stdout || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const devices = [];
  for (const line of lines) {
    const cells = splitCsvLine(line);
    // A short row means the field set did not come back as asked for. Reading it
    // positionally anyway would assign values to the wrong properties.
    if (cells.length !== FIELD_MAP.length) continue;

    const device = {};
    FIELD_MAP.forEach((field, i) => {
      const value = field.parse(cells[i]);
      if (value !== undefined) device[field.key] = value;
    });

    // Without a uuid there is nothing to key the object on.
    if (device.uuid) devices.push(device);
  }
  return devices;
}

function run(bin, args, timeoutMs = 10000) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: error.code === 'ENOENT' ? `${bin} not found on PATH` : String(stderr || error.message).trim() });
      } else {
        resolve({ ok: true, stdout: String(stdout) });
      }
    });
  });
}

/** Reads telemetry for every visible device. */
async function readTelemetry() {
  const result = await run('nvidia-smi', [`--query-gpu=${QUERY_FIELDS.join(',')}`, '--format=csv,noheader,nounits']);

  if (!result.ok) {
    throw new Error(
      result.error.includes('not found on PATH')
        ? 'nvidia-smi is not on PATH, so no NVIDIA driver is visible on this host.'
        : `nvidia-smi failed: ${result.error}`,
    );
  }

  const devices = parseNvidiaSmiCsv(result.stdout);
  if (devices.length === 0) {
    throw new Error('nvidia-smi returned no parseable device rows.');
  }
  return devices;
}

/**
 * Reports which CUDA tools are present. Explicitly false when probed and absent,
 * which the ontology distinguishes from never probed: an unprobed toolchain is
 * not evidence that one exists.
 */
async function probeToolchain() {
  const [nvcc, ncu, nsys] = await Promise.all([
    run('nvcc', ['--version']),
    run('ncu', ['--version']),
    run('nsys', ['--version']),
  ]);

  const toolkit = {
    nvccAvailable: nvcc.ok,
    nsightComputeAvailable: ncu.ok,
    nsightSystemsAvailable: nsys.ok,
  };

  // nvcc reports the toolkit version, which is what a kernel is compiled against,
  // and is not the same as the driver's supported runtime version.
  if (nvcc.ok) {
    const match = /release ([0-9.]+)/i.exec(nvcc.stdout);
    if (match) toolkit.cudaToolkitVersion = match[1];
  }
  return toolkit;
}

module.exports = { parseNvidiaSmiCsv, splitCsvLine, readTelemetry, probeToolchain, QUERY_FIELDS };
