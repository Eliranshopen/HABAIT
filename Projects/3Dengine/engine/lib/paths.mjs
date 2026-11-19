// Path helpers: every path the engine hands out is absolute with forward slashes.
import path from 'node:path';

export function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}

export function isAbsolutePath(p) {
  return path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p);
}

// Resolve `p` against `base` unless it is already absolute; normalise; no trailing slash.
export function resolveFrom(base, p) {
  const abs = isAbsolutePath(p) ? path.resolve(p) : path.resolve(base, p);
  return toPosix(abs).replace(/(.)\/+$/, '$1');
}
