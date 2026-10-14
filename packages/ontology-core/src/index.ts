/**
 * A domain-agnostic decision ontology.
 *
 * Three layers, kept separate:
 *   Semantic  what exists      object types with typed properties and links
 *   Logic     what is true     pure functions returning value, rationale, evidence
 *   Kinetic   what may happen  actions with preconditions, risk, and effects
 *
 * Nothing here knows about any particular domain. A consumer supplies an
 * OntologyRegistry and gets validation, authorization, precondition enforcement,
 * and a recorded decision for every attempt, including the ones that were refused.
 */

export type {
  ActionRisk,
  ActionSpec,
  BlastRadius,
  Decision,
  DecisionOutcome,
  LinkSpec,
  LogicFunction,
  LogicResult,
  ObjectTypeSpec,
  OntologyObject,
  OntologyRegistry,
  Precondition,
  PropertyKind,
  PropertySpec,
  Refusal,
  Reversibility,
  WorldView,
} from './types';

export { OntologyError, RISK, refuse } from './types';

export {
  AGENT_AUTHORITY,
  MemoryWorld,
  Ontology,
  migrateAndValidate,
  validateObject,
  type Actor,
  type AttemptResult,
  type Executor,
  type OntologyOptions,
} from './engine';

export {
  CORE_FUNCTIONS,
  CORE_SCHEMA,
  DECISION_TYPE,
  decisionToObject,
  pastDecisions,
  type PastDecisionsQuery,
} from './decisions';
