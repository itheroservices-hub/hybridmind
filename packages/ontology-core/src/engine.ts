import { DECISION_TYPE, decisionToObject } from './decisions';
import type {
  ActionSpec,
  BlastRadius,
  Decision,
  LogicResult,
  ObjectTypeSpec,
  OntologyObject,
  OntologyRegistry,
  PropertySpec,
  Refusal,
  Reversibility,
  WorldView,
} from './types';
import { OntologyError, refuse } from './types';

/**
 * The engine that makes the three layers binding.
 *
 * Order of enforcement for every action attempt:
 *   1. the action exists and the subject is the right type
 *   2. parameters validate against their declared specs
 *   3. the actor is permitted to attempt this risk
 *   4. preconditions hold
 *   5. only then does the executor run
 *
 * A Decision is recorded in all five cases, including refusals. That is the
 * point: an agent that was stopped leaves the same kind of record as one that
 * succeeded, so "nothing happened" is never silent and never has to be inferred
 * from the absence of output.
 *
 * The engine knows no domain. Everything it needs arrives as an OntologyRegistry.
 */

const REVERSIBILITY_ORDER: Reversibility[] = ['reversible', 'recoverable', 'irreversible'];
const BLAST_ORDER: BlastRadius[] = ['object', 'host', 'all_hosts'];

const withinCeiling = <T,>(order: T[], value: T, ceiling: T): boolean =>
  order.indexOf(value) <= order.indexOf(ceiling);

/**
 * An actor's authority is two ceilings, because the axes are independent. An
 * agent can be trusted to touch every host reversibly while still not being
 * trusted to do anything irreversible to a single object.
 */
export interface Actor {
  id: string;
  maxReversibility: Reversibility;
  maxBlastRadius: BlastRadius;
  /** True only when a human has explicitly confirmed this specific attempt. */
  humanConfirmed?: boolean;
}

/** Sensible default for an autonomous agent: wide reads, recoverable local writes. */
export const AGENT_AUTHORITY: Pick<Actor, 'maxReversibility' | 'maxBlastRadius'> = {
  maxReversibility: 'recoverable',
  maxBlastRadius: 'host',
};

export type Executor = (
  action: ActionSpec<any>,
  subject: OntologyObject,
  params: Record<string, unknown>,
) => Promise<{ ok: boolean; error?: string; changes?: Partial<Record<string, unknown>> }>;

/** In-memory world. Swap for a persistent implementation without touching callers. */
export class MemoryWorld implements WorldView {
  private objects = new Map<string, OntologyObject>();

  constructor(private readonly schema: Record<string, ObjectTypeSpec>) {}

  private key(type: string, id: string) {
    return `${type}:${id}`;
  }

  put(object: OntologyObject): void {
    this.objects.set(this.key(object.type, object.id), migrateAndValidate(object, this.schema));
  }

  get(type: string, id: string): OntologyObject | undefined {
    return this.objects.get(this.key(type, id));
  }

  all(type: string): OntologyObject[] {
    return [...this.objects.values()].filter((o) => o.type === type);
  }

  /** Removes an object. Used by the decision store to evict at its cap. */
  remove(type: string, id: string): void {
    this.objects.delete(this.key(type, id));
  }

  linked(object: OntologyObject, link: string): OntologyObject[] {
    const spec = this.schema[object.type];
    const linkSpec = spec?.links?.[link];
    if (!linkSpec) throw new OntologyError(`${object.type} has no link "${link}".`, 'unknown_link');

    // Links resolve by convention: the target holds a property naming its parent,
    // or the source holds the id directly. Explicit and cheap, no index needed.
    if (linkSpec.cardinality === 'one') {
      const id = object.properties[link] ?? object.properties[`${link}Id`];
      const found = id !== undefined ? this.get(linkSpec.to, String(id)) : undefined;
      return found ? [found] : [];
    }
    return this.all(linkSpec.to).filter((t) => Object.values(t.properties).some((v) => v === object.id));
  }
}

/**
 * Brings an object up to the current schema version, then validates it.
 *
 * An object from a version the spec does not know is refused rather than
 * reinterpreted: reading it under a newer shape would silently assign meanings
 * its author never intended.
 */
export function migrateAndValidate(
  object: OntologyObject,
  schema: Record<string, ObjectTypeSpec>,
): OntologyObject {
  const spec = schema[object.type];
  if (!spec) throw new OntologyError(`Unknown object type "${object.type}".`, 'unknown_type');

  const target = spec.version ?? 1;
  const from = object.schemaVersion ?? 1;

  if (from > target) {
    throw new OntologyError(
      `${object.type} object is at schema version ${from} but this build only knows version ${target}.`,
      'schema_version_ahead',
    );
  }

  let properties = object.properties;
  for (let v = from; v < target; v++) {
    const migrate = spec.migrations?.[v];
    if (!migrate) {
      throw new OntologyError(
        `${object.type} needs a migration from version ${v} to ${v + 1} and none is defined.`,
        'migration_missing',
      );
    }
    properties = migrate(properties);
  }

  const migrated: OntologyObject = { ...object, properties, schemaVersion: target };
  validateObject(migrated, schema);
  return migrated;
}

/** Validates an object against its type spec. Throws rather than coercing. */
export function validateObject(object: OntologyObject, schema: Record<string, ObjectTypeSpec>): void {
  const spec = schema[object.type];
  if (!spec) throw new OntologyError(`Unknown object type "${object.type}".`, 'unknown_type');

  for (const [name, prop] of Object.entries(spec.properties)) {
    const value = object.properties[name];
    if (value === undefined || value === null) {
      if (prop.required) throw new OntologyError(`${object.type}.${name} is required.`, 'missing_property');
      continue;
    }
    const problem = checkProperty(name, prop, value);
    if (problem) throw new OntologyError(`${object.type}.${problem}`, 'invalid_property');
  }
}

function checkProperty(name: string, spec: PropertySpec, value: unknown): string | null {
  switch (spec.kind) {
    case 'string':
      return typeof value === 'string' ? null : `${name} must be a string.`;
    case 'boolean':
      return typeof value === 'boolean' ? null : `${name} must be a boolean.`;
    case 'timestamp':
      return typeof value === 'number' && Number.isFinite(value) ? null : `${name} must be a timestamp in milliseconds.`;
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${name} must be a finite number.`;
      if (spec.min !== undefined && value < spec.min) return `${name} must be at least ${spec.min}.`;
      if (spec.max !== undefined && value > spec.max) return `${name} must be at most ${spec.max}.`;
      return null;
    }
    case 'enum':
      return typeof value === 'string' && spec.values?.includes(value)
        ? null
        : `${name} must be one of: ${spec.values?.join(', ')}.`;
    case 'json':
      return null;
    default:
      return `${name} has an unrecognized kind.`;
  }
}

export interface AttemptResult {
  decision: Decision;
  ok: boolean;
}

export interface OntologyOptions {
  /**
   * How many Decisions stay queryable. Decisions accumulate on every attempt and
   * live in the same world preconditions read, so an unbounded store is both a
   * leak and a slow all('Decision'). Oldest are evicted.
   */
  decisionCap?: number;
}

const DEFAULT_DECISION_CAP = 500;

export class Ontology {
  private decisions: Decision[] = [];
  private readonly cap: number;

  constructor(
    readonly world: MemoryWorld,
    private readonly registry: OntologyRegistry,
    private readonly execute: Executor,
    options: OntologyOptions = {},
  ) {
    this.cap = options.decisionCap ?? DEFAULT_DECISION_CAP;
  }

  /** Run a logic function by name. Pure: never mutates, never records a decision. */
  evaluate(functionName: string, input: Record<string, unknown>): LogicResult {
    const fn = this.registry.functions[functionName];
    if (!fn) throw new OntologyError(`Unknown function "${functionName}".`, 'unknown_function');
    return fn.evaluate(this.world, input);
  }

  history(): readonly Decision[] {
    return this.decisions;
  }

  /** Attempt an action. Always produces a Decision, whatever the outcome. */
  async attempt(
    actionName: string,
    subjectId: string,
    params: Record<string, unknown>,
    actor: Actor,
  ): Promise<AttemptResult> {
    const action = this.registry.actions[actionName];
    if (!action) throw new OntologyError(`Unknown action "${actionName}".`, 'unknown_action');

    const subject = this.world.get(action.subject, subjectId);
    const base = {
      id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action: actionName,
      subjectType: action.subject,
      subjectId,
      actor: actor.id,
      parameters: params,
      reasoning: [] as LogicResult[],
      at: Date.now(),
      schemaVersions: { [action.subject]: this.registry.schema[action.subject]?.version ?? 1 },
    };

    if (!subject) {
      return this.record({ ...base, outcome: 'failed', error: `No ${action.subject} with id "${subjectId}".` });
    }

    const paramProblem = validateParameters(action, params);
    if (paramProblem) {
      return this.record({ ...base, outcome: 'refused', refusedBy: [paramProblem] });
    }

    // Authorization before preconditions: an actor who may not attempt this at all
    // should not learn from the refusal which preconditions would have failed.
    const authProblem = authorize(action, actor);
    if (authProblem) {
      return this.record({ ...base, outcome: 'escalated', refusedBy: [authProblem] });
    }

    const failures: Refusal[] = [];
    const reasoning: LogicResult[] = [];
    for (const precondition of action.preconditions) {
      const reason = precondition.check(subject, params as any, this.world);
      reasoning.push({
        value: reason === null,
        rationale: reason?.message ?? `${precondition.name} holds.`,
        evidence: [subject.id],
      });
      if (reason !== null) failures.push(reason);
    }

    if (failures.length) {
      return this.record({ ...base, outcome: 'refused', reasoning, refusedBy: failures });
    }

    try {
      const result = await this.execute(action, subject, params);
      if (!result.ok) {
        return this.record({
          ...base,
          outcome: 'failed',
          reasoning,
          error: result.error ?? 'Executor reported failure without a reason.',
        });
      }
      if (result.changes) {
        this.world.put({ ...subject, properties: { ...subject.properties, ...result.changes } });
      }
      return this.record({ ...base, outcome: 'executed', reasoning, effects: action.effects });
    } catch (error) {
      return this.record({
        ...base,
        outcome: 'failed',
        reasoning,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Records a decision and makes it queryable as an object, so an agent can ask
   * what it already tried before retrying something that was already refused.
   */
  private record(decision: Decision): AttemptResult {
    this.decisions.push(decision);

    if (this.registry.schema[DECISION_TYPE.name]) {
      this.world.put(decisionToObject(decision));

      while (this.decisions.length > this.cap) {
        const evicted = this.decisions.shift();
        if (evicted) this.world.remove(DECISION_TYPE.name, evicted.id);
      }
    }

    return { decision, ok: decision.outcome === 'executed' };
  }
}

function validateParameters(action: ActionSpec<any>, params: Record<string, unknown>): Refusal | null {
  for (const [name, spec] of Object.entries(action.parameters)) {
    const value = params[name];
    if (value === undefined || value === null) {
      if (spec.required) {
        return refuse('PARAMETER_REQUIRED', `Parameter "${name}" is required.`, {
          subject: name,
          remediation: `Supply ${name}: ${spec.description}`,
        });
      }
      continue;
    }
    const problem = checkProperty(name, spec, value);
    if (problem) {
      return refuse('PARAMETER_INVALID', problem, { subject: name, actual: value });
    }
  }
  const unknown = Object.keys(params).filter((k) => !(k in action.parameters));
  return unknown.length
    ? refuse('PARAMETER_UNEXPECTED', `Unexpected parameter(s): ${unknown.join(', ')}.`, {
        subject: unknown[0],
        expected: Object.keys(action.parameters),
        actual: unknown,
      })
    : null;
}

const HUMAN_ONLY_EXPLANATION: Record<string, string> = {
  hardware_state: 'it changes hardware state on the user machine',
  irreversible_loss: 'it destroys data that cannot be recovered',
  cost: 'it incurs cost the user has not agreed to',
};

function authorize(action: ActionSpec<any>, actor: Actor): Refusal | null {
  const { reversibility, blastRadius, humanOnly, humanOnlyReason } = action.risk;

  // An explicit human_only flag, or anything irreversible, needs a human to have
  // confirmed this specific attempt. No actor ceiling substitutes for that.
  if ((humanOnly || reversibility === 'irreversible') && !actor.humanConfirmed) {
    const why = humanOnlyReason ? HUMAN_ONLY_EXPLANATION[humanOnlyReason] : 'it cannot be undone';
    return refuse('HUMAN_CONFIRMATION_REQUIRED', `"${action.name}" requires explicit human confirmation because ${why}.`, {
      subject: action.name,
      expected: 'humanConfirmed',
      actual: false,
      remediation: 'Ask the user to confirm this specific action, then retry with their confirmation.',
    });
  }

  if (!withinCeiling(REVERSIBILITY_ORDER, reversibility, actor.maxReversibility)) {
    return refuse('REVERSIBILITY_ABOVE_CEILING', `"${action.name}" is ${reversibility}, above the ceiling for ${actor.id}.`, {
      subject: action.name,
      expected: `at most ${actor.maxReversibility}`,
      actual: reversibility,
      remediation: 'Escalate to an actor with higher authority, or ask the user.',
    });
  }

  if (!withinCeiling(BLAST_ORDER, blastRadius, actor.maxBlastRadius)) {
    return refuse('BLAST_RADIUS_ABOVE_CEILING', `"${action.name}" affects ${blastRadius}, wider than ${actor.id} may reach.`, {
      subject: action.name,
      expected: `at most ${actor.maxBlastRadius}`,
      actual: blastRadius,
      remediation: 'Escalate to an actor with higher authority, or ask the user.',
    });
  }

  return null;
}
