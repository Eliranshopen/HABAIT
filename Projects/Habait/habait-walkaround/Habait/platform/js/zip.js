// JSZip 3.10.2, vendored at js/vendor/jszip-3.10.2.min.js (MIT; npm integrity sha512-3l+rb15I...pyTQ==),
// loaded without a bundler or a network: the UMD file is evaluated with a local module/exports pair,
// in the browser (fetch) and in Node (readFile) alike. Used by tools/build_zip.mjs (server-side ZIP per unit),
// by apartment.js (client-side fallback when no prebuilt ZIP exists) and by test/apartment.test.mjs (reading the ZIP).
export const JSZIP_VERSION = '3.10.2';
const VENDOR = new URL('./vendor/jszip-3.10.2.min.js', import.meta.url);
const isNode = typeof process !== 'undefined' && !!process.versions?.node && typeof window === 'undefined';

let _jszip = null;
export async function loadJSZip() {
  if (_jszip) return _jszip;
  let src;
  if (isNode) {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    src = await readFile(fileURLToPath(VENDOR), 'utf8');
  } else {
    const r = await fetch(VENDOR);
    if (!r.ok) throw new Error(`JSZip: HTTP ${r.status}`);
    src = await r.text();
  }
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'define', src)(module, module.exports, undefined);
  _jszip = module.exports;
  if (typeof _jszip !== 'function') throw new Error('JSZip: vendored file did not export a constructor');
  return _jszip;
}

const STORED = /\.(webp|jpe?g|png|glb|mp4|zip|woff2?)$/i; // already compressed: STORE, the rest DEFLATE

// files: [{ name, data: Uint8Array | ArrayBuffer | string, date? }] -> Uint8Array of the ZIP
export async function zipFiles(files, { comment } = {}) {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const date = new Date();
  for (const f of files) {
    zip.file(f.name, f.data, {
      date: f.date || date,
      compression: STORED.test(f.name) ? 'STORE' : 'DEFLATE',
      compressionOptions: { level: 9 },
      binary: typeof f.data !== 'string',
    });
  }
  return zip.generateAsync({ type: 'uint8array', platform: 'DOS', comment, streamFiles: false });
}

// bytes -> { names: [...files, no dirs], size(name), text(name), bytes(name) }
export async function readZip(bytes) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
  return {
    names,
    text: (n) => zip.file(n).async('string'),
    bytes: (n) => zip.file(n).async('uint8array'),
  };
}

// browser: save bytes as a file
export function downloadBytes(bytes, filename, type = 'application/zip') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
