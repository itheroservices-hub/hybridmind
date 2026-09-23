import { CORE_FUNCTIONS, CORE_SCHEMA, type OntologyRegistry } from '@hybridmind/ontology-core';
import { ACTIONS } from './actions';
import { FUNCTIONS } from './functions';
import { SCHEMA } from './schema';

/**
 * HybridMind's domain, assembled for the core engine.
 *
 * The core knows nothing about GPUs, missions, or kernels. This is the only place
 * the two meet, which is what lets a second product supply an entirely different
 * schema and reuse the same engine. CORE_SCHEMA and CORE_FUNCTIONS are folded in
 * so every domain gets queryable Decisions without having to model them itself.
 */
export const HYBRIDMIND_REGISTRY: OntologyRegistry = {
  schema: { ...CORE_SCHEMA, ...SCHEMA },
  actions: ACTIONS,
  functions: { ...CORE_FUNCTIONS, ...FUNCTIONS },
};
