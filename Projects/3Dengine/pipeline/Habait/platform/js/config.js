// Loads projects.json -> fixtures/<id>/project.json + flow.json + units.json, applies white-label vars.
async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

export async function loadProjects() {
  const j = await getJSON('projects.json');
  return j.projects || [];
}

export async function loadProjectMeta(dir) {
  return getJSON(`${dir}/project.json`);
}

export async function loadProject(id) {
  const list = await loadProjects();
  const entry = list.find((p) => p.id === id);
  if (!entry) throw new Error(`unknown project "${id}"`);
  const dir = entry.dir.replace(/\/$/, '');
  const meta = await loadProjectMeta(dir);
  const [flow, units] = await Promise.all([
    getJSON(`${dir}/${meta.flow || 'flow.json'}`),
    getJSON(`${dir}/${meta.units || 'units.json'}`),
  ]);
  const segById = new Map(flow.segments.map((s) => [s.id, s]));
  const unitById = new Map(units.units.map((u) => [u.id, u]));
  return {
    id,
    dir,
    meta,
    flow,
    units,
    segById,
    unitById,
    asset: (p) => (/^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : `${dir}/${p}`),
    // the descend/enter segment for a unit, falling back to flow.defaults
    unitSegment(unit, kind) {
      const own = unit.segments?.[kind] || `${kind}-${unit.id}`;
      if (segById.has(own)) return { segment: segById.get(own), placeholder: false };
      const def = flow.defaults?.[kind];
      if (def && segById.has(def)) return { segment: segById.get(def), placeholder: true };
      return { segment: null, placeholder: true };
    },
  };
}

export function applyBrand(meta, dir, { logoEls = [], nameEls = [] } = {}) {
  const b = meta.brand || {};
  const root = document.documentElement;
  if (b.primary) root.style.setProperty('--primary', b.primary);
  if (b.accent) root.style.setProperty('--accent', b.accent);
  if (b.background) {
    root.style.setProperty('--bg', b.background);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', b.background);
  }
  for (const el of logoEls) {
    if (b.logo) { el.src = `${dir}/${b.logo}`; el.hidden = false; } else el.hidden = true;
  }
  for (const el of nameEls) el.textContent = typeof meta.name === 'string' ? meta.name : (meta.name?.[root.lang] || meta.name?.en || '');
}
