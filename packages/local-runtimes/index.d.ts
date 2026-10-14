/**
 * The edge types for the loopback runtime clients.
 *
 * Deliberately narrow: only what a caller needs, so the untyped internals stay
 * internal. Every listing call reports an unreachable runtime as an ordinary
 * answer rather than throwing, because "not running" is a state the user needs
 * told apart from "running with nothing installed".
 */

export interface OllamaListing {
  runtime: 'ollama';
  port: number;
  installed: unknown[];
  resident: unknown[];
}

export interface LmStudioListing {
  runtime: 'lmstudio';
  port: number;
  api: string;
  models: unknown[];
}

export interface LmStudioSettings {
  root?: string;
  server?: { found?: boolean; file?: string; reason?: string; port?: number; corsEnabled?: boolean };
  settingsReason?: string;
  modelsDirectory?: { configured?: string; used?: boolean; reason?: string; path?: string };
  presets?: Array<Record<string, unknown>>;
}

export interface LoadResult {
  loaded: boolean;
  model: string;
  alreadyLoaded?: boolean;
  detail?: string;
}

export declare const ollama: {
  listModels(options?: { port?: number }): Promise<OllamaListing>;
  loadModel(model: string, options?: { port?: number; keepAliveSeconds?: number }): Promise<LoadResult>;
  isValidModelName(name: unknown): boolean;
  OllamaUnavailableError: new (message: string) => Error;
  DEFAULT_OLLAMA_PORT: number;
};

export declare const lmstudio: {
  listModels(options?: { port?: number }): Promise<LmStudioListing>;
  loadModel(model: string, options?: { port?: number }): Promise<LoadResult>;
  isValidModelId(id: unknown): boolean;
  readSettings(): LmStudioSettings;
  configuredPort(settings?: LmStudioSettings): { port: number; source: string };
  LmStudioUnavailableError: new (message: string) => Error;
  DEFAULT_LMSTUDIO_PORT: number;
};

export declare const gpu: {
  readTelemetry(): Promise<{ devices: unknown[]; driverVersion?: string; cudaVersion?: string }>;
  probeToolchain(): Promise<Record<string, unknown>>;
  parseNvidiaSmiCsv(payload: string): unknown[];
};
