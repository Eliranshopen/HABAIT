// Stage "gating" (contract 0.3 §1): implementations by mode. Today only the stub; a later milestone adds the
// real one beside it without changing the runner.
import { stubStage } from './stub.mjs';

export const name = 'gating';
export const stub = stubStage(name);
