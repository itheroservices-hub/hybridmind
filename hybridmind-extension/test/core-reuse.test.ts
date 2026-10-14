import * as assert from 'assert';
import {
  AGENT_AUTHORITY,
  CORE_FUNCTIONS,
  CORE_SCHEMA,
  MemoryWorld,
  Ontology,
  OntologyError,
  RISK,
  refuse,
  type Actor,
  type ActionSpec,
  type ObjectTypeSpec,
  type OntologyRegistry,
} from '@hybridmind/ontology-core';

/**
 * The test that decides whether extraction actually worked.
 *
 * This file models a domain with nothing to do with GPUs, missions, or CUDA, and
 * drives it entirely through the core. It imports nothing from src/ontology/. If
 * it ever needs to, the core is still coupled to HybridMind and a second product
 * would inherit that coupling, which is the exact problem the extraction was for.
 *
 * The domain is deliberately unglamorous: a shipment that can be dispatched. It
 * stands in for the kind of logistics object a different product would model.
 */

const SHIPMENT: ObjectTypeSpec = {
  name: 'Shipment',
  description: 'Goods moving between two places.',
  primaryKey: 'id',
  version: 1,
  properties: {
    id: { kind: 'string', description: 'Shipment identifier.', required: true },
    status: {
      kind: 'enum',
      description: 'Where it is in its lifecycle.',
      values: ['staged', 'dispatched', 'delivered'],
      required: true,
    },
    weightKg: { kind: 'number', description: 'Gross weight.', required: true, min: 0, max: 40000 },
    destination: { kind: 'string', description: 'Where it is going.', required: true },
  },
};

const dispatchShipment: ActionSpec<{ carrier: string }> = {
  name: 'dispatchShipment',
  description: 'Release a staged shipment to a carrier.',
  subject: 'Shipment',
  risk: RISK.WRITE,
  parameters: {
    carrier: { kind: 'string', description: 'Carrier taking the shipment.', required: true },
  },
  preconditions: [
    {
      name: 'isStaged',
      check: (shipment) =>
        shipment.properties.status === 'staged'
          ? null
          : refuse('NOT_STAGED', `Shipment is ${shipment.properties.status}, not staged.`, {
              subject: 'Shipment.status',
              expected: 'staged',
              actual: shipment.properties.status,
            }),
    },
  ],
  effects: ['Moves the shipment to dispatched and records the carrier.'],
};

const destroyShipment: ActionSpec = {
  name: 'destroyShipment',
  description: 'Write off a shipment permanently.',
  subject: 'Shipment',
  risk: { ...RISK.DESTRUCTIVE, humanOnly: true, humanOnlyReason: 'irreversible_loss' },
  parameters: {},
  preconditions: [],
  effects: ['Removes the shipment permanently.'],
};

const REGISTRY: OntologyRegistry = {
  schema: { ...CORE_SCHEMA, [SHIPMENT.name]: SHIPMENT },
  actions: { dispatchShipment, destroyShipment },
  functions: { ...CORE_FUNCTIONS },
};

const shipment = (over: Record<string, unknown> = {}) => ({
  type: 'Shipment',
  id: 's1',
  properties: { id: 's1', status: 'staged', weightKg: 1200, destination: 'Sarnia', ...over },
});

const agent: Actor = { id: 'logistics_agent', ...AGENT_AUTHORITY };

function setup(executor = async () => ({ ok: true })) {
  const world = new MemoryWorld(REGISTRY.schema);
  world.put(shipment());
  return { world, ontology: new Ontology(world, REGISTRY, executor) };
}

describe('the core runs an unrelated domain', () => {
  it('validates objects against a schema it has never seen before', () => {
    const world = new MemoryWorld(REGISTRY.schema);
    assert.throws(() => world.put(shipment({ weightKg: 99999 })), /at most/);
    assert.throws(() => world.put(shipment({ status: 'teleported' })), /must be one of/);
  });

  it('executes an action and applies its changes', async () => {
    const { ontology, world } = setup(async () => ({ ok: true, changes: { status: 'dispatched' } }));
    const { ok } = await ontology.attempt('dispatchShipment', 's1', { carrier: 'CN Rail' }, agent);

    assert.strictEqual(ok, true);
    assert.strictEqual(world.get('Shipment', 's1')?.properties.status, 'dispatched');
  });

  it('enforces preconditions with the same structured refusals', async () => {
    const world = new MemoryWorld(REGISTRY.schema);
    world.put(shipment({ status: 'delivered' }));
    const ontology = new Ontology(world, REGISTRY, async () => ({ ok: true }));

    const { decision } = await ontology.attempt('dispatchShipment', 's1', { carrier: 'CN Rail' }, agent);
    assert.strictEqual(decision.outcome, 'refused');
    assert.strictEqual(decision.refusedBy?.[0]?.code, 'NOT_STAGED');
    assert.strictEqual(decision.refusedBy?.[0]?.actual, 'delivered');
  });

  it('applies the same authorization rules to a domain it knows nothing about', async () => {
    const { ontology } = setup();
    const { decision } = await ontology.attempt('destroyShipment', 's1', {}, agent);
    assert.strictEqual(decision.outcome, 'escalated');
    assert.strictEqual(decision.refusedBy?.[0]?.code, 'HUMAN_CONFIRMATION_REQUIRED');
  });

  it('refuses an unknown action rather than guessing', async () => {
    const { ontology } = setup();
    await assert.rejects(ontology.attempt('teleportShipment', 's1', {}, agent), OntologyError);
  });
});

describe('decisions are queryable', () => {
  it('records an executed attempt as an object an agent can find', async () => {
    const { ontology } = setup();
    await ontology.attempt('dispatchShipment', 's1', { carrier: 'CN Rail' }, agent);

    const past = ontology.evaluate('pastDecisions', { subjectId: 's1' });
    assert.strictEqual((past.value as unknown[]).length, 1);
    assert.strictEqual((past.value as Record<string, unknown>[])[0]?.outcome, 'executed');
  });

  it('records a refusal too, with the code that blocked it', async () => {
    const world = new MemoryWorld(REGISTRY.schema);
    world.put(shipment({ status: 'delivered' }));
    const ontology = new Ontology(world, REGISTRY, async () => ({ ok: true }));

    await ontology.attempt('dispatchShipment', 's1', { carrier: 'CN Rail' }, agent);

    // This is the loop that matters: an agent can ask whether this was already
    // blocked, and why, instead of attempting it again from a fresh context.
    const blocked = ontology.evaluate('pastDecisions', { refusalCode: 'NOT_STAGED' });
    assert.strictEqual((blocked.value as unknown[]).length, 1);
    assert.match(String(blocked.rationale), /1 previous attempt/);
  });

  it('filters by action and by outcome', async () => {
    const { ontology } = setup();
    await ontology.attempt('dispatchShipment', 's1', { carrier: 'A' }, agent);
    await ontology.attempt('destroyShipment', 's1', {}, agent);

    assert.strictEqual(((ontology.evaluate('pastDecisions', { action: 'destroyShipment' }).value as unknown[])).length, 1);
    assert.strictEqual(((ontology.evaluate('pastDecisions', { outcome: 'escalated' }).value as unknown[])).length, 1);
    assert.strictEqual(((ontology.evaluate('pastDecisions', {}).value as unknown[])).length, 2);
  });

  it('says plainly when nothing matches', () => {
    const { ontology } = setup();
    const past = ontology.evaluate('pastDecisions', { action: 'dispatchShipment' });
    assert.deepStrictEqual(past.value, []);
    assert.match(String(past.rationale), /No previous attempt/);
  });

  it('evicts the oldest once the cap is reached', async () => {
    const world = new MemoryWorld(REGISTRY.schema);
    world.put(shipment());
    // The store lives in the same world preconditions read, so it has to be bounded.
    const ontology = new Ontology(world, REGISTRY, async () => ({ ok: true }), { decisionCap: 3 });

    for (let i = 0; i < 5; i++) {
      await ontology.attempt('dispatchShipment', 's1', { carrier: `carrier-${i}` }, agent);
    }

    assert.strictEqual((world.all('Decision')).length, 3);
    const carriers = ontology
      .history()
      .map((d) => (d.parameters as { carrier: string }).carrier);
    assert.deepStrictEqual(carriers, ['carrier-2', 'carrier-3', 'carrier-4']);
  });
});

describe('schema versioning', () => {
  const V2: ObjectTypeSpec = {
    ...SHIPMENT,
    version: 2,
    properties: {
      ...SHIPMENT.properties,
      // Renaming is a breaking change, so it needs a migration.
      destinationCity: { kind: 'string', description: 'Where it is going.', required: true },
    },
    migrations: {
      1: (props) => ({ ...props, destinationCity: props.destination }),
    },
  };

  const v2Schema = { ...CORE_SCHEMA, Shipment: V2 };

  it('migrates an object written at an older version', () => {
    const world = new MemoryWorld(v2Schema);
    world.put({ ...shipment(), schemaVersion: 1 });

    const stored = world.get('Shipment', 's1');
    assert.strictEqual(stored?.properties.destinationCity, 'Sarnia');
    assert.strictEqual(stored?.schemaVersion, 2);
  });

  it('refuses an object from a version this build does not know', () => {
    const world = new MemoryWorld(v2Schema);
    assert.throws(() => world.put({ ...shipment(), schemaVersion: 7 }), /only knows version 2/);
  });

  it('refuses to guess when a migration is missing', () => {
    const noMigration: ObjectTypeSpec = { ...V2, migrations: {} };
    const world = new MemoryWorld({ ...CORE_SCHEMA, Shipment: noMigration });
    // Silently reinterpreting old data under a new shape is worse than refusing.
    assert.throws(() => world.put({ ...shipment(), schemaVersion: 1 }), /needs a migration/);
  });

  it('treats an unversioned object as version 1', () => {
    const world = new MemoryWorld(v2Schema);
    world.put(shipment());
    assert.strictEqual(world.get('Shipment', 's1')?.properties.destinationCity, 'Sarnia');
  });

  it('stamps the subject schema version onto the decision', async () => {
    const { ontology } = setup();
    const { decision } = await ontology.attempt('dispatchShipment', 's1', { carrier: 'CN Rail' }, agent);
    assert.deepStrictEqual(decision.schemaVersions, { Shipment: 1 });
  });
});
