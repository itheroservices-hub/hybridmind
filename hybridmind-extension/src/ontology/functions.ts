import type { LogicFunction, LogicResult, OntologyObject, WorldView } from '@hybridmind/ontology-core';

/**
 * The logic layer: pure derivations over the world.
 *
 * Nothing here writes, calls a model, or touches a network. Every function
 * returns its value together with the rationale and the specific object ids the
 * conclusion rested on, so a decision can be re-read later and checked against
 * the facts as they were, rather than re-argued from the output text.
 *
 * This is where routing logic belongs. The archived backend put the equivalent
 * in intelligenceTierRouter.js as keyword matching against a "local" tier that
 * never invoked a model, so a routing decision could neither be verified nor
 * disproved. Here a local route is only chosen when a real device with real free
 * memory is present in the world.
 */

const num = (o: OntologyObject | undefined, key: string): number | undefined => {
  const v = o?.properties[key];
  return typeof v === 'number' ? v : undefined;
};

/** Headroom kept free so a chosen model does not evict what is already resident. */
export const VRAM_HEADROOM_MB = 1024;

export function freeVramMb(gpu: OntologyObject): number {
  const total = num(gpu, 'memoryTotalMb') ?? 0;
  const used = num(gpu, 'memoryUsedMb') ?? 0;
  return Math.max(0, total - used);
}

/** Can this GPU serve this model right now, with headroom to spare? */
export const canHostModel: LogicFunction<boolean> = {
  name: 'canHostModel',
  description: 'Whether a GPU has enough free VRAM to serve a model, keeping headroom free.',
  reads: ['Gpu', 'Model'],
  evaluate: (world, input) => {
    const gpu = world.get('Gpu', String(input.gpuUuid));
    const model = world.get('Model', String(input.modelId));

    if (!gpu) return no(`No GPU ${input.gpuUuid} is known.`, []);
    if (!model) return no(`No model ${input.modelId} is known.`, [String(gpu.id)]);

    const required = num(model, 'vramRequiredMb');
    if (required === undefined) {
      return no(`Model ${model.id} has no measured VRAM requirement, so it cannot be placed.`, [gpu.id, model.id]);
    }

    const free = freeVramMb(gpu);
    const fits = free >= required + VRAM_HEADROOM_MB;
    return {
      value: fits,
      rationale: fits
        ? `${free} MiB free on ${gpu.properties.name}, model needs ${required} MiB plus ${VRAM_HEADROOM_MB} MiB headroom.`
        : `${free} MiB free on ${gpu.properties.name}, short of the ${required + VRAM_HEADROOM_MB} MiB needed.`,
      evidence: [gpu.id, model.id],
    };
  },
};

/** Is the device healthy enough to accept new work? */
export const gpuIsHealthy: LogicFunction<boolean> = {
  name: 'gpuIsHealthy',
  description: 'Whether a GPU is within safe thermal and utilization limits to take more work.',
  reads: ['Gpu'],
  evaluate: (world, input) => {
    const gpu = world.get('Gpu', String(input.gpuUuid));
    if (!gpu) return no(`No GPU ${input.gpuUuid} is known.`, []);

    const temp = num(gpu, 'temperatureC');
    const util = num(gpu, 'utilizationPct');
    const reasons: string[] = [];

    // Thermal throttling on consumer cards typically begins in the low 80s.
    if (temp !== undefined && temp >= 85) reasons.push(`temperature ${temp}C is at or past the throttling range`);
    if (util !== undefined && util >= 95) reasons.push(`utilization ${util}% leaves no headroom`);

    return {
      value: reasons.length === 0,
      rationale: reasons.length === 0
        ? `${gpu.properties.name} is within limits (${temp ?? 'unknown'}C, ${util ?? 'unknown'}% utilization).`
        : `${gpu.properties.name} is not ready: ${reasons.join('; ')}.`,
      evidence: [gpu.id],
    };
  },
};

export interface RouteDecision {
  residence: 'local' | 'frontier';
  modelId: string | null;
  gpuUuid?: string;
}

/**
 * Choose where a task should run.
 *
 * Local is preferred when a real device can actually host a suitable model,
 * because it costs nothing and keeps the work on the user's hardware. Frontier
 * is the fallback, and only when the user has supplied a key for it: BYOK is a
 * hard constraint in this product, so a keyless frontier model is not a
 * candidate no matter how capable it is.
 */
export const routeInference: LogicFunction<RouteDecision> = {
  name: 'routeInference',
  description: 'Selects local GPU inference when a device can host a suitable model, otherwise a keyed frontier model.',
  reads: ['Gpu', 'Model'],
  evaluate: (world, input) => {
    const needsTools = input.needsTools === true;
    const minContext = typeof input.minContext === 'number' ? input.minContext : 0;
    const evidence: string[] = [];

    const suitable = (m: OntologyObject) => {
      if (needsTools && m.properties.supportsTools !== true) return false;
      const ctx = num(m, 'contextWindow');
      return !(minContext > 0 && (ctx === undefined || ctx < minContext));
    };

    const localModels = world.all('Model').filter((m) => m.properties.residence === 'local' && suitable(m));
    const gpus = world.all('Gpu');

    for (const gpu of gpus) {
      evidence.push(gpu.id);
      if (!gpuIsHealthy.evaluate(world, { gpuUuid: gpu.id }).value) continue;

      // Largest model that still fits wins: the biggest thing the hardware can
      // actually hold is the best local answer available.
      const fitting = localModels
        .filter((m) => canHostModel.evaluate(world, { gpuUuid: gpu.id, modelId: m.id }).value)
        .sort((a, b) => (num(b, 'vramRequiredMb') ?? 0) - (num(a, 'vramRequiredMb') ?? 0));

      const chosen = fitting[0];
      if (chosen) {
        evidence.push(chosen.id);
        return {
          value: { residence: 'local', modelId: chosen.id, gpuUuid: gpu.id },
          rationale: `${chosen.properties.displayName} fits on ${gpu.properties.name} with ${freeVramMb(gpu)} MiB free, so it runs locally at no cost.`,
          evidence,
        };
      }
    }

    const frontier = world
      .all('Model')
      .filter((m) => m.properties.residence === 'frontier' && m.properties.keyAvailable === true && suitable(m))
      .sort((a, b) => (num(a, 'costPerMTokensOut') ?? Infinity) - (num(b, 'costPerMTokensOut') ?? Infinity));

    const cheapest = frontier[0];
    if (cheapest) {
      evidence.push(cheapest.id);
      return {
        value: { residence: 'frontier', modelId: cheapest.id },
        rationale: `No local device can host a suitable model, so routing to ${cheapest.properties.displayName}, the cheapest frontier model with a key available.`,
        evidence,
      };
    }

    const keyless = world.all('Model').filter((m) => m.properties.residence === 'frontier' && m.properties.keyAvailable !== true);
    return {
      value: { residence: 'frontier', modelId: null },
      rationale: keyless.length
        ? `No local device can host a suitable model, and no frontier model has a key. ${keyless.length} frontier model(s) are configured but unkeyed; the user must supply one.`
        : 'No local device can host a suitable model and no frontier model is configured.',
      evidence,
    };
  },
};

export interface ModelChoice {
  modelId: string | null;
  residence: 'local' | 'frontier' | null;
  runtime?: string;
  gpuUuid?: string;
  prefer: 'cheapest' | 'capable' | 'balanced';
}

/**
 * Choose a model for a task under a stated preference.
 *
 * This is routeInference's question asked the other way round: routeInference
 * decides where work runs and prefers local because it is free, while this picks
 * a model against an explicit trade and says which figures decided it.
 *
 * Three rules, and the point of writing them down is that the caller can check
 * the choice against them afterwards:
 *
 *   cheapest   a local model that fits, since that costs nothing; otherwise the
 *              lowest cost per million output tokens among keyed models.
 *   capable    the highest capabilityTier available, cost disregarded, ties
 *              broken by the larger context window.
 *   balanced   a local fit unless a keyed frontier model is at least two tiers
 *              more capable. Two tiers rather than one because a single tier is
 *              inside the noise of an ordinal nobody benchmarked, while a
 *              two-tier gap is the difference between a small local model and a
 *              flagship, which is worth paying for.
 *
 * BYOK holds absolutely in every branch: a frontier model without a key is not a
 * candidate, including under 'capable', where it would otherwise win.
 */
export const selectModelForTask: LogicFunction<ModelChoice> = {
  name: 'selectModelForTask',
  description: 'Selects a model for a task under a cheapest, capable, or balanced preference, respecting BYOK and device limits.',
  reads: ['Gpu', 'Model'],
  evaluate: (world, input) => {
    const needsTools = input.needsTools === true;
    const minContext = typeof input.minContext === 'number' ? input.minContext : 0;
    const prefer: ModelChoice['prefer'] =
      input.prefer === 'cheapest' || input.prefer === 'capable' || input.prefer === 'balanced'
        ? input.prefer
        : 'balanced';

    const evidence: string[] = [];
    const unmet: string[] = [];

    const suitable = (m: OntologyObject) => {
      if (needsTools && m.properties.supportsTools !== true) {
        unmet.push(`${m.id} is not known to support tool calling`);
        return false;
      }
      const ctx = num(m, 'contextWindow');
      if (minContext > 0 && (ctx === undefined || ctx < minContext)) {
        unmet.push(`${m.id} offers ${ctx ?? 'an unreported'} context against the ${minContext} tokens required`);
        return false;
      }
      return true;
    };

    const tier = (m: OntologyObject) => num(m, 'capabilityTier') ?? 0;
    const context = (m: OntologyObject) => num(m, 'contextWindow') ?? 0;
    const outCost = (m: OntologyObject) => num(m, 'costPerMTokensOut') ?? Infinity;

    // A local model is only a candidate on a device that is healthy and has room
    // for it. Both checks are canHostModel and gpuIsHealthy rather than reimplemented
    // here, so one definition of "fits" and "healthy" serves every caller.
    const placements: Array<{ model: OntologyObject; gpu: OntologyObject }> = [];
    const refusals: string[] = [];

    const localModels = world.all('Model').filter((m) => m.properties.residence === 'local');
    for (const gpu of world.all('Gpu')) {
      evidence.push(gpu.id);
      const health = gpuIsHealthy.evaluate(world, { gpuUuid: gpu.id });
      if (!health.value) {
        refusals.push(health.rationale);
        continue;
      }
      for (const model of localModels) {
        if (!suitable(model)) continue;
        const fit = canHostModel.evaluate(world, { gpuUuid: gpu.id, modelId: model.id });
        if (fit.value) placements.push({ model, gpu });
        // The refusal carries the measured free VRAM, which is the figure the
        // user needs to see: "too large" without a number is not actionable.
        else refusals.push(`${model.properties.displayName}: ${fit.rationale}`);
      }
    }

    const keyedFrontier = world
      .all('Model')
      .filter((m) => m.properties.residence === 'frontier' && m.properties.keyAvailable === true && suitable(m));

    const unkeyedSuitable = world
      .all('Model')
      .filter((m) => m.properties.residence === 'frontier' && m.properties.keyAvailable !== true);

    const byCapability = [...keyedFrontier].sort((a, b) => tier(b) - tier(a) || context(b) - context(a));
    const byCost = [...keyedFrontier].sort((a, b) => outCost(a) - outCost(b) || tier(b) - tier(a));
    const bestLocal = [...placements].sort(
      (a, b) => tier(b.model) - tier(a.model) || (num(b.model, 'vramRequiredMb') ?? 0) - (num(a.model, 'vramRequiredMb') ?? 0),
    )[0];

    const chooseLocal = (place: { model: OntologyObject; gpu: OntologyObject }, why: string) => {
      evidence.push(place.model.id);
      return {
        value: {
          modelId: place.model.id,
          residence: 'local' as const,
          runtime: typeof place.model.properties.runtime === 'string' ? place.model.properties.runtime : undefined,
          gpuUuid: place.gpu.id,
          prefer,
        },
        rationale: `${why} ${place.model.properties.displayName} runs on ${place.gpu.properties.name} under ${place.model.properties.runtime}, with ${freeVramMb(place.gpu)} MiB free against a ${num(place.model, 'vramRequiredMb') ?? 'unknown'} MiB estimated footprint, at no token cost.`,
        evidence,
      };
    };

    const chooseFrontier = (model: OntologyObject, why: string) => {
      evidence.push(model.id);
      return {
        value: {
          modelId: model.id,
          residence: 'frontier' as const,
          runtime: 'frontier',
          prefer,
        },
        rationale: `${why} ${model.properties.displayName} is tier ${tier(model)} with a ${context(model)} token context at $${num(model, 'costPerMTokensIn') ?? '?'}/$${outCost(model)} per million tokens in and out, and the user has a ${model.properties.provider} key.`,
        evidence,
      };
    };

    if (prefer === 'cheapest') {
      if (bestLocal) return chooseLocal(bestLocal, 'Cheapest: local inference costs nothing, and');
      const cheapest = byCost[0];
      if (cheapest) {
        return chooseFrontier(
          cheapest,
          `Cheapest: no local model fits${refusals.length ? ` (${refusals[0]})` : ''}, so the lowest output price among keyed models wins.`,
        );
      }
    } else if (prefer === 'capable') {
      const frontier = byCapability[0];
      const localTier = bestLocal ? tier(bestLocal.model) : -1;
      if (frontier && tier(frontier) >= localTier) {
        return chooseFrontier(frontier, 'Most capable: the highest tier available with a key, cost disregarded.');
      }
      if (bestLocal) {
        return chooseLocal(
          bestLocal,
          `Most capable: tier ${localTier} locally beats the best keyed frontier model${frontier ? ` (tier ${tier(frontier)})` : ' (none has a key)'}, and`,
        );
      }
    } else {
      const frontier = byCapability[0];
      if (bestLocal && (!frontier || tier(frontier) - tier(bestLocal.model) < 2)) {
        return chooseLocal(
          bestLocal,
          `Balanced: the best keyed frontier model is ${frontier ? `${tier(frontier) - tier(bestLocal.model)} tier(s)` : 'not available'} above the local fit, short of the two-tier gap that justifies paying, so`,
        );
      }
      if (frontier) {
        return chooseFrontier(
          frontier,
          bestLocal
            ? `Balanced: ${tier(frontier) - tier(bestLocal.model)} tiers above the best local fit (tier ${tier(bestLocal.model)}), which is worth the token cost.`
            : `Balanced: no local model fits${refusals.length ? ` (${refusals[0]})` : ''}, so the most capable keyed model wins.`,
        );
      }
      if (bestLocal) return chooseLocal(bestLocal, 'Balanced: no frontier model has a key, and');
    }

    // Nothing qualified. The reason matters more than the null: an unkeyed
    // catalog, a device with no room, and a context requirement nothing meets are
    // three different problems with three different fixes.
    const parts: string[] = [];
    if (refusals.length) parts.push(`No local model could be placed: ${refusals.join('; ')}.`);
    else if (placements.length === 0) parts.push('No local model is available.');
    if (unkeyedSuitable.length) {
      parts.push(`${unkeyedSuitable.length} frontier model(s) are configured but unkeyed; BYOK means none of them is a candidate.`);
    }
    if (unmet.length) parts.push(`Requirements excluded: ${unmet.join('; ')}.`);

    return {
      value: { modelId: null, residence: null, prefer },
      rationale: parts.length ? parts.join(' ') : 'No model in the catalog meets the request.',
      evidence,
    };
  },
};

/**
 * Whether a benchmark actually supports a claim of improvement. A single sample,
 * or a change inside the noise band, does not.
 */
export const benchmarkSupportsClaim: LogicFunction<boolean> = {
  name: 'benchmarkSupportsClaim',
  description: 'Whether a benchmark shows a real improvement over its baseline rather than noise.',
  reads: ['Benchmark'],
  evaluate: (world, input) => {
    const b = world.get('Benchmark', String(input.benchmarkId));
    if (!b) return no(`No benchmark ${input.benchmarkId} is known.`, []);

    const value = num(b, 'value');
    const baseline = num(b, 'baselineValue');
    const samples = num(b, 'samples') ?? 0;
    const stdDev = num(b, 'stdDev');

    if (baseline === undefined) return no('No baseline was recorded, so there is nothing to compare against.', [b.id]);
    if (samples < 3) return no(`Only ${samples} sample(s); at least 3 are needed before a difference means anything.`, [b.id]);
    if (value === undefined) return no('No measured value was recorded.', [b.id]);

    // Lower is better for latency, higher for throughput and occupancy.
    const lowerIsBetter = b.properties.metric === 'latency_ms';
    const delta = lowerIsBetter ? baseline - value : value - baseline;
    const improved = delta > 0;

    if (!improved) {
      return {
        value: false,
        rationale: `Measured ${value} against a baseline of ${baseline}; this is not an improvement.`,
        evidence: [b.id],
      };
    }

    if (stdDev !== undefined && Math.abs(delta) < stdDev) {
      return {
        value: false,
        rationale: `Difference of ${delta.toFixed(3)} is smaller than the ${stdDev} standard deviation across ${samples} samples, so it is inside the noise.`,
        evidence: [b.id],
      };
    }

    const pct = baseline !== 0 ? ((delta / baseline) * 100).toFixed(1) : 'n/a';
    return {
      value: true,
      rationale: `Improved by ${pct}% over baseline across ${samples} samples${stdDev !== undefined ? ` (sd ${stdDev})` : ''}.`,
      evidence: [b.id],
      confidence: stdDev !== undefined && stdDev > 0 ? Math.min(1, Math.abs(delta) / (stdDev * 3)) : undefined,
    };
  },
};

/** Which tasks in a mission are ready to run right now? */
export const readyTasks: LogicFunction<string[]> = {
  name: 'readyTasks',
  description: 'Tasks whose dependencies have all succeeded, so they may run, potentially in parallel.',
  reads: ['Task'],
  evaluate: (world, input) => {
    const missionId = String(input.missionId);
    const tasks = world.all('Task').filter((t) => t.properties.missionId === missionId);
    const byId = new Map<string, OntologyObject>(tasks.map((t) => [t.id, t] as const));

    const ready = tasks.filter((t) => {
      if (t.properties.status !== 'pending') return false;
      const deps = Array.isArray(t.properties.dependsOn) ? (t.properties.dependsOn as string[]) : [];
      return deps.every((d) => byId.get(d)?.properties.status === 'succeeded');
    });

    return {
      value: ready.map((t) => t.id),
      rationale: ready.length
        ? `${ready.length} of ${tasks.length} task(s) have all dependencies satisfied and can run now.`
        : `No task is ready; ${tasks.filter((t) => t.properties.status === 'pending').length} pending task(s) are still waiting on dependencies.`,
      evidence: ready.map((t) => t.id),
    };
  },
};

function no(rationale: string, evidence: string[]): LogicResult<boolean> {
  return { value: false, rationale, evidence };
}

export const FUNCTIONS: Record<string, LogicFunction<any>> = {
  canHostModel,
  gpuIsHealthy,
  routeInference,
  selectModelForTask,
  benchmarkSupportsClaim,
  readyTasks,
};

export type { WorldView };
