// Writes tests/fixtures/sample.pdf: ONE page with a small vector drawing (300 line segments), so that the
// first look finds a drawing in it and a job can be started for it (contract 1.1 §2, §8). The bytes are the
// same every time: no date, no id. Run it only to make the fixture again: node tests/fixtures/make-sample.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isMain } from '../../engine/lib/main.mjs';

export const SEGMENTS = 300;

// The page's content: a grid of short strokes, half of them level and half upright, like the walls of a plan.
export function content() {
  const ops = ['0.5 w'];
  for (let i = 0; i < SEGMENTS; i++) {
    const col = i % 20;
    const row = Math.floor(i / 20);
    const x = 40 + col * 38;
    const y = 40 + row * 34;
    ops.push(i % 2 === 0 ? `${x} ${y} m ${x + 30} ${y} l S` : `${x} ${y} m ${x} ${y + 26} l S`);
  }
  return `${ops.join('\n')}\n`;
}

// A whole PDF 1.4 file around that content, with a correct cross-reference table. ASCII only, so a
// character offset is a byte offset. `text` (ASCII, no parentheses or backslash) adds one line of real text
// to the page, for the tests that prove no text of a PDF reaches an answer; without it the bytes are the
// fixture's.
export function samplePdf({ text = '' } = {}) {
  if (/[^\x20-\x7e]|[()\\]/.test(text)) throw new Error('samplePdf: text must be plain ASCII without ( ) \\');
  const stream = text ? `${content()}BT /F1 14 Tf 40 560 Td (${text}) Tj ET\n` : content();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << ${text ? '/Font << /F1 5 0 R >> ' : ''}>> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    ...(text ? ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'] : []),
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

if (isMain(process.argv[1], import.meta.url)) {
  const file = fileURLToPath(new URL('./sample.pdf', import.meta.url));
  fs.writeFileSync(file, samplePdf(), 'latin1');
  process.stdout.write(`wrote ${file} (${samplePdf().length} bytes, ${SEGMENTS} segments)\n`);
}
