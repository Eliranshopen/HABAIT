// pathtrace.js — the "realistic" look: while you walk you see the fast picture; the moment you stop, the same scene is
// path traced in the browser (three-gpu-pathtracer, MIT, vendor/pt/) and fades in within seconds — real bounced light,
// soft shadows, reflections in the marble. Same model, same furniture, $0. Eliran 2026-11-17: «נראה כמו משחק מחשב».
// In this mode the stand-ins for bounced light (room fill lamps, the ceiling glow) are turned down: the tracer computes it.
import * as THREE from 'three';

export async function initPathTracer({ renderer, scene, camera, composer, MAT, phone }) {
  const { WebGLPathTracer } = await import('three-gpu-pathtracer');
  const pt = new WebGLPathTracer(renderer);
  pt.renderScale = phone ? 0.5 : 0.75;
  pt.minSamples = 3; pt.renderDelay = 300; pt.fadeDuration = 700;
  pt.bounces = 6; pt.filterGlossyFactor = 0.4; pt.dynamicLowRes = false;
  pt.rasterizeSceneCallback = () => (composer ? composer.render() : renderer.render(scene, camera));
  const fills = scene.children.filter((o) => o.isPointLight);
  function quiet() {   // after daynight.js set the stand-ins: keep a tenth of them (the tracer adds the real bounce)
    for (const l of fills) { if (l.userData.dn == null) l.userData.dn = l.intensity; l.intensity = l.userData.dn * 0.1; }
    if (MAT.ceiling) MAT.ceiling.emissiveIntensity = 0;
  }
  quiet();
  pt.setScene(scene, camera);   // synchronous: the async build needs a BVH worker file
  const last = new THREE.Matrix4(); let busy = false, env = scene.environment;
  return {
    pt,
    frame() {
      if (scene.environment !== env) { env = scene.environment; pt.updateEnvironment(); }   // the HDR arrives after the scene
      if (!camera.matrixWorld.equals(last)) { last.copy(camera.matrixWorld); pt.updateCamera(); }
      pt.renderSample();
    },
    async rebuild() { if (busy) return; busy = true; try { quiet(); pt.setScene(scene, camera); } finally { busy = false; } },
    lights() { quiet(); pt.updateLights(); pt.updateMaterials(); pt.updateEnvironment && pt.updateEnvironment(); },
    get samples() { return pt.samples; },
  };
}
