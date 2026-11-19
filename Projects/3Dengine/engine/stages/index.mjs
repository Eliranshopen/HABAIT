// The stage registry: one module per stage under engine/stages/, each exporting its implementations by
// mode (`stub` today). The runner asks implFor(stage, job.mode).
import { STAGES } from '../jobs.mjs';
import * as tracing from './tracing.mjs';
import * as building from './building.mjs';
import * as rendering from './rendering.mjs';
import * as skinning from './skinning.mjs';
import * as gating from './gating.mjs';
import * as finishing from './finishing.mjs';
import * as packaging from './packaging.mjs';
import * as qa from './qa.mjs';

export const REGISTRY = Object.freeze({ tracing, building, rendering, skinning, gating, finishing, packaging, qa });

// An implementation { run(ctx) } of a stage in a mode; throws when there is none.
export function implFor(stage, mode, registry = REGISTRY) {
  const mod = registry[stage];
  if (!mod) throw new Error(`no stage "${stage}"`);
  const impl = mod[mode];
  if (!impl || typeof impl.run !== 'function') throw new Error(`stage "${stage}" has no "${mode}" implementation`);
  return impl;
}

export { STAGES };
