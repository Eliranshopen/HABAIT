// sha256 of a file (hex). Large render assets never load into memory whole: the async one streams,
// the sync one reads in 1 MB chunks.
import fs, { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

export function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    const s = createReadStream(file);
    s.on('error', reject);
    s.on('data', (chunk) => h.update(chunk));
    s.on('end', () => resolve(h.digest('hex')));
  });
}

export function sha256FileSync(file) {
  const h = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(1 << 20);
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      h.update(buf.subarray(0, n));
    }
  } finally {
    fs.closeSync(fd);
  }
  return h.digest('hex');
}

export const sha256Text = (text) => createHash('sha256').update(text).digest('hex');
