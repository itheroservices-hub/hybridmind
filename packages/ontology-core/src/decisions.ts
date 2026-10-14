import type { Decision, DecisionOutcome, LogicFunction, ObjectTypeSpec, OntologyObject } from './types';

/**
 * Decisions as queryable objects.
 *
 * A decision that is only logged is invisible to the agent that made it. An agent
 * that was refused, lost its context, and came back will attempt the same refused
 * action again, because nothing in its world says otherwise. Making decisions part
 * of the ontology closes that loop: the record of what was tried is readable by
 * the same query path as everything else.
 *
 * Palantir does the same thing, describing its action log as modelling "all action
 * submissions as object types... to capture decisions made by submitting actions
 * and make these decisions available as data in the Ontology". The difference here
 * is that this was designed in rather than added onto a human compliance audit, so
 * refusals are as queryable as successes and carry the same structure.
 */

export const DECISION_TYPE: ObjectTypeSpec = {
  name: 'Decision',
  description: 'A recorded attempt at an action, whether it ran, was refused, escalated, or failed.',
  primaryKey: 'id',
  version: 1,
  properties: {
    id: { kind: 'string', description: 'Decision identifier.', required: true },
    action: { kind: 'string', description: 'Action that was attempted.', required: true },
    subjectType: { kind: 'string', description: 'Object type acted on.', required: true },
    subjectId: { kind: 'string', description: 'Object acted on.', required: true },
    actor: { kind: 'string', description: 'Who attempted it.', required: true },
    outcome: {
      kind: 'enum',
      description: 'What happened.',
      values: ['executed', 'refused', 'escalated', 'failed'],
      required: true,
    },
    /** Stable codes, so a query can find every attempt blocked for the same reason. */
    refusalCodes: { kind: 'json', description: 'Codes of the refusals that blocked it, if any.' },
    summary: { kind: 'string', description: 'One line stating what happened and why.', required: true },
    parameters: { kind: 'json', description: 'Parameters the action was attempted with.' },
    at: { kind: 'timestamp', description: 'When the attempt was made.', required: true },
  },
};

/** Projects a Decision into the object shape the world stores. */
export function decisionToObject(decision: Decision): OntologyObject {
  return {
    type: DECISION_TYPE.name,
    id: decision.id,
    schemaVersion: DECISION_TYPE.version,
    properties: {
      id: decision.id,
      action: decision.action,
      subjectType: decision.subjectType,
      subjectId: decision.subjectId,
      actor: decision.actor,
      outcome: decision.outcome,
      refusalCodes: decision.refusedBy?.map((r) => r.code) ?? [],
      summary: summarize(decision),
      parameters: decision.parameters,
      at: decision.at,
    },
  };
}

function summarize(decision: Decision): string {
  switch (decision.outcome) {
    case 'executed':
      return `${decision.action} ran on ${decision.subjectId}.`;
    case 'failed':
      return `${decision.action} failed on ${decision.subjectId}: ${decision.error ?? 'no reason given'}.`;
    default:
      // Refusals and escalations are the ones worth reading back, so they carry
      // the reason rather than just the outcome.
      return `${decision.action} was ${decision.outcome} on ${decision.subjectId}: ${
        decision.refusedBy?.map((r) => r.message).join(' ') ?? 'no reason given'
      }`;
  }
}

export interface PastDecisionsQuery {
  action?: string;
  subjectId?: string;
  outcome?: DecisionOutcome;
  /** Only decisions with this refusal code. Useful for "has this been blocked before". */
  refusalCode?: string;
  limit?: number;
}

/**
 * What has already been attempted, most recent first.
 *
 * Intended to be consulted before retrying: an action refused three times for the
 * same reason will be refused a fourth, and the agent can say so instead of
 * burning another attempt.
 */
export const pastDecisions: LogicFunction<Array<Record<string, unknown>>> = {
  name: 'pastDecisions',
  description: 'Previous attempts, filtered by action, subject, outcome, or refusal code.',
  reads: [DECISION_TYPE.name],
  evaluate: (world, input) => {
    const q = input as PastDecisionsQuery;
    const limit = typeof q.limit === 'number' ? q.limit : 20;

    const matches = world
      .all(DECISION_TYPE.name)
      .filter((d) => {
        if (q.action && d.properties.action !== q.action) return false;
        if (q.subjectId && d.properties.subjectId !== q.subjectId) return false;
        if (q.outcome && d.properties.outcome !== q.outcome) return false;
        if (q.refusalCode) {
          const codes = Array.isArray(d.properties.refusalCodes) ? (d.properties.refusalCodes as string[]) : [];
          if (!codes.includes(q.refusalCode)) return false;
        }
        return true;
      })
      .sort((a, b) => Number(b.properties.at ?? 0) - Number(a.properties.at ?? 0))
      .slice(0, limit);

    const filters = [
      q.action ? `action ${q.action}` : null,
      q.subjectId ? `subject ${q.subjectId}` : null,
      q.outcome ? `outcome ${q.outcome}` : null,
      q.refusalCode ? `refusal ${q.refusalCode}` : null,
    ].filter(Boolean);

    return {
      value: matches.map((d) => d.properties),
      rationale: matches.length
        ? `${matches.length} previous attempt(s)${filters.length ? ` matching ${filters.join(', ')}` : ''}.`
        : `No previous attempt${filters.length ? ` matching ${filters.join(', ')}` : ''}.`,
      evidence: matches.map((d) => d.id),
    };
  },
};

/** Registry entries every domain gets for free. */
export const CORE_SCHEMA: Record<string, ObjectTypeSpec> = { [DECISION_TYPE.name]: DECISION_TYPE };
export const CORE_FUNCTIONS: Record<string, LogicFunction<any>> = { pastDecisions };
