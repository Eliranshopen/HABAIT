/* The walkaround engine bundle (board habait-walkaround; WALKAROUND-QUALITY-PLAN.md cards Q06 and Q08). v0.1 = step 1 of D-T360-46:
   window.pannellum answered by Photo Sphere Viewer, so the tour page runs unchanged on the new renderer. v0.2 = the tiles (a cube
   cut by tools/make-tiles.mjs, streamed through the hybrid adapter) and the tier-1 walk-in on a door. */
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import './compat.css';
import { viewer, CompatViewer } from './pannellum-compat';

export const VERSION = '0.2.0';
const api = { viewer, CompatViewer, VERSION, engine: 'photo-sphere-viewer 5.15.1', tiles: true, walkIn: true };
(window as any).pannellum = api;
export { api };
