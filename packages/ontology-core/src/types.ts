/**
 * Ontology primitives.
 *
 * Three layers, kept deliberately separate:
 *
 *   Semantic  what exists      object types, properties, links
 *   Logic     what is true     pure functions over objects, no side effects
 *   Kinetic   what may happen  actions with preconditions, effects, permissions
 *
 * The reason this exists rather than a plain tool layer: loose tools return
 * strings, and a string cannot be checked. An agent that called a tool which did
 * nothing and returned "Simulated result for terminal_execute" read as a success,
 * because success was a matter of wording. Here an action either satisfies its
 * declared preconditions and produces its declared effects, or it fails with a
 * reason, and either way the decision is recorded with the facts that produced it.
 */

export type PropertyKind = 'string' | 'number' | 'boolean' | 'timestamp' | 'enum' | 'json';

export interface PropertySpec {
  kind: PropertyKind;
  description: string;
  required?: boolean;
  /** Permitted values when kind is 'enum'. */
  values?: readonly string[];
  /** Inclusive bounds for 'number'. Enforced on write, not merely documented. */
  min?: number;
  max?: number;
  unit?: string;
}

/** A typed reference from one object to another. */
export interface LinkSpec {
  to: string;
  cardinality: 'one' | 'many';
  description: string;
}

export interface ObjectTypeSpec {
  name: string;
  description: string;
  /** Which property uniquely identifies an instance. */
  primaryKey: string;
  properties: Record<string, PropertySpec>;
  links?: Record<string, LinkSpec>;
  /**
   * Bumped only for a breaking change. Three things break a type and nothing
   * else does: changing a property's kind, changing the primary key, and making
   * an optional property required. Adding an optional property is additive and
   * needs no bump, which is why most schema evolution costs nothing here.
   */
  version?: number;
  /**
   * Forward migrations, keyed by the version they migrate FROM. An object stored
   * at version 1 under a spec at version 3 runs migrations[1] then migrations[2].
   * Without one, an object from an older version is refused rather than silently
   * reinterpreted under a shape it was not written for.
   */
  migrations?: Record<number, (properties: Record<string, unknown>) => Record<string, unknown>>;
}

/** A concrete instance. Properties are validated against its ObjectTypeSpec. */
export interface OntologyObject {
  type: string;
  id: string;
  properties: Record<string, unknown>;
  /** Schema version this object was written at. Absent means version 1. */
  schemaVersion?: number;
}

/**
 * A machine-readable refusal.
 *
 * The consumer of a refusal is usually a language model deciding whether to
 * retry, adjust a parameter, or stop. Prose alone forces it to re-parse English
 * to make that call, which is unreliable. So a refusal carries a stable code, the
 * thing at fault, the expected and actual values where they exist, and a
 * remediation when one is knowable. The message stays for humans reading a log.
 */
export interface Refusal {
  /** Stable identifier. Safe to branch on; wording is not. */
  code: string;
  message: string;
  /** Property or parameter that failed, as "Type.property" or a parameter name. */
  subject?: string;
  expected?: unknown;
  actual?: unknown;
  /** What would make this succeed, when that is knowable. */
  remediation?: string;
}

export const refuse = (code: string, message: string, extra: Partial<Refusal> = {}): Refusal => ({
  code,
  message,
  ...extra,
});

/**
 * Risk is two independent axes, not one scale.
 *
 * A single ladder conflates them and produces wrong answers: flashing firmware
 * and overwriting one checkpoint are both "destructive", but one is unrecoverable
 * and machine-wide while the other is a single object a backup could restore.
 * Separating them lets an actor be trusted with wide but reversible work, or with
 * narrow but irreversible work, without being trusted with both.
 */
export type Reversibility = 'reversible' | 'recoverable' | 'irreversible';
export type BlastRadius = 'object' | 'host' | 'all_hosts';

export interface ActionRisk {
  reversibility: Reversibility;
  blastRadius: BlastRadius;
  /** Requires a human regardless of any actor ceiling. */
  humanOnly?: boolean;
  /**
   * Why a human is required. Dangerous and expensive are different problems and
   * a caller may want to treat them differently.
   */
  humanOnlyReason?: 'hardware_state' | 'irreversible_loss' | 'cost';
}

/** Common shapes, so an action declares intent rather than restating two axes. */
export const RISK = {
  READ: { reversibility: 'reversible', blastRadius: 'object' },
  WRITE: { reversibility: 'recoverable', blastRadius: 'object' },
  HOST_WRITE: { reversibility: 'recoverable', blastRadius: 'host' },
  DESTRUCTIVE: { reversibility: 'irreversible', blastRadius: 'object' },
  HARDWARE: { reversibility: 'recoverable', blastRadius: 'host', humanOnly: true, humanOnlyReason: 'hardware_state' },
} as const satisfies Record<string, ActionRisk>;

export interface ActionSpec<P = Record<string, unknown>> {
  name: string;
  description: string;
  /** Object type this action operates on. */
  subject: string;
  risk: ActionRisk;
  parameters: Record<string, PropertySpec>;
  /**
   * Must all hold before the action runs. Each returns a structured Refusal when
   * it fails, so a refusal explains itself to the model in a form it can branch on.
   */
  preconditions: Precondition<P>[];
  /** Human-readable statement of what changes. Recorded on the decision. */
  effects: string[];
  /** Schema version of the subject type this action was written against. */
  schemaVersion?: number;
}

export interface Precondition<P = Record<string, unknown>> {
  name: string;
  /** Returns null when satisfied, or a structured Refusal when not. */
  check: (subject: OntologyObject, params: P, world: WorldView) => Refusal | null;
}

/**
 * Read-only access to the current state of the ontology. Logic functions and
 * preconditions receive this; neither may mutate it.
 */
export interface WorldView {
  get(type: string, id: string): OntologyObject | undefined;
  all(type: string): OntologyObject[];
  linked(object: OntologyObject, link: string): OntologyObject[];
}

/** A pure derivation over the world. No side effects, no writes. */
export interface LogicFunction<T = unknown> {
  name: string;
  description: string;
  /** Object types this function reads, for provenance on the decision record. */
  reads: string[];
  evaluate: (world: WorldView, input: Record<string, unknown>) => LogicResult<T>;
}

export interface LogicResult<T = unknown> {
  value: T;
  /** Why the function reached this value, in terms a human can audit. */
  rationale: string;
  /** Object ids the conclusion actually depended on. */
  evidence: string[];
  /** 0 to 1. Absent when the derivation is exact rather than estimated. */
  confidence?: number;
}

export type DecisionOutcome = 'executed' | 'refused' | 'escalated' | 'failed';

/**
 * The record that makes a decision auditable. Every action attempt produces one
 * whether it ran or not, so a refusal is as legible as a success.
 */
export interface Decision {
  id: string;
  action: string;
  subjectType: string;
  subjectId: string;
  actor: string;
  parameters: Record<string, unknown>;
  outcome: DecisionOutcome;
  /** Logic results consulted, in the order they were consulted. */
  reasoning: LogicResult[];
  /** Precondition or authorization failures, when the action did not run. */
  refusedBy?: Refusal[];
  effects?: string[];
  error?: string;
  at: number;
  /**
   * Versions of the object types this decision referenced, so a record stays
   * interpretable after the live schema moves on. Without it a year-old refusal
   * cites property names that may no longer mean what they did.
   */
  schemaVersions?: Record<string, number>;
}

export class OntologyError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'OntologyError';
  }
}

/**
 * Everything the engine needs to know about a domain.
 *
 * This is the whole reason the core is reusable. The engine previously imported
 * SCHEMA, ACTIONS and FUNCTIONS as module globals from HybridMind's GPU domain,
 * which made it the HybridMind engine rather than a core: a second product could
 * not use it without forking it or carrying Gpu and Kernel types it has no use
 * for. Passing the domain in instead means one implementation serves any number
 * of domains.
 */
export interface OntologyRegistry {
  schema: Record<string, ObjectTypeSpec>;
  actions: Record<string, ActionSpec<any>>;
  functions: Record<string, LogicFunction<any>>;
}
