/**
 * Loopback clients for local model runtimes and GPU telemetry.
 *
 * These were written for the web app's paired host process, where the browser
 * could not reach 127.0.0.1 itself. The extension runs in Node and can, so it
 * calls them directly with nothing in between.
 *
 * They are carried over verbatim rather than rewritten in TypeScript on purpose:
 * they hold the checks that make reading another application's files safe (an
 * exact-filename allowlist, a root-escape check after path normalization, size
 * and JSON-depth bounds) and the validation that keeps a runtime's own response
 * from reaching a command line. Retyping that by hand is how such a check gets
 * quietly dropped, so the tested code is kept as it stands and typed at the edge
 * by index.d.ts.
 */
module.exports = {
  ollama: require('./ollama.cjs'),
  lmstudio: require('./lmstudio.cjs'),
  gpu: require('./gpu.cjs'),
};
