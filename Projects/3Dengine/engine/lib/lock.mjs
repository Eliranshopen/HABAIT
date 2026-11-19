// The Python requirements lock: `name==version` lines; comments and blanks ignored.

export function normalizeName(name) {
  return String(name).trim().toLowerCase().replace(/[_.]+/g, '-');
}

export function parseLock(text) {
  const pins = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*==\s*([^\s;]+)$/);
    if (!m) throw new Error(`requirements lock: not a name==version line: "${line}"`);
    pins.push({ name: normalizeName(m[1]), dist: m[1], version: m[2] });
  }
  return pins;
}
