// Where "open the project" goes (board platform-ui-ux, card 14): one definition for the home card and the landing's play button.
// Unchanged from the v0 index.html: the external flight (the hold, with its inline intro clip as ?orbit=), the intro page, or flow.html.
// p = { id, dir, meta } as loaded by js/config.js (loadProjects + loadProjectMeta).
export function extUrl(p, e) {
  const u = new URL(e.url, location.href);
  for (const [k, v] of Object.entries(e.params || {})) u.searchParams.set(k, v);
  u.searchParams.set('project', p.id);
  return u.toString();
}
export function projectHref(p) {
  // a project with no film (project.json film:false — a package built before its exterior step exists) opens on its landing page,
  // never on flow.html's «התחילו את הטיסה» over an empty stage (project-runner, 2026-11-04; template rule, data-driven)
  if (p.meta.film === false) return `landing.html?project=${encodeURIComponent(p.id)}`;
  const ext = p.meta.exterior;
  if (ext && ext.mode === 'external' && ext.url) {
    if (ext.intro && ext.intro.clip && ext.intro.mode === 'inline') {
      const u = new URL(extUrl(p, ext));
      u.searchParams.set('orbit', new URL(`${p.dir}/${ext.intro.clip}`, location.href).toString());
      return u.toString();
    }
    return ext.intro && ext.intro.clip ? `intro.html?project=${encodeURIComponent(p.id)}&next=${encodeURIComponent(extUrl(p, ext))}` : extUrl(p, ext);
  }
  return `flow.html?project=${encodeURIComponent(p.id)}`;
}
