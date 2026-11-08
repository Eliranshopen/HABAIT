// grid.mjs <in> <out> <pxPerCm> <outWidth> [left top width height] — a 100 cm grid with labels over the plan crop (or a sub-crop) for tracing
import path from "node:path"; import { fileURLToPath } from "node:url"; import { appRequire } from "./app-require.mjs";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".."); const sharp = appRequire(REPO)("sharp");
const [, , inp, out, pxPerCmS, outWS, l, t, w, h] = process.argv; const pxPerCm = Number(pxPerCmS); const outW = Number(outWS);
let img = sharp(inp); const meta = await img.metadata();
const crop = l !== undefined ? { left: +l, top: +t, width: +w, height: +h } : { left: 0, top: 0, width: meta.width, height: meta.height };
img = img.extract(crop);
const step = 100 * pxPerCm; // 100 cm
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${crop.width}" height="${crop.height}">`;
// --plan <plan.general.json>: draw its fixtures (orange), openings (red) and camera points (green) over the sheet, so a
// hand-read box can be checked against the drawing before the builder extrudes it (card Q02b)
const planArg = process.argv.indexOf("--plan"); if (planArg > 0) { const fs = await import("node:fs"); const P = JSON.parse(fs.readFileSync(process.argv[planArg + 1], "utf8")); const px = ([x, y]) => `${x * pxPerCm - crop.left},${y * pxPerCm - crop.top}`;
  for (const f of P.fixtures || []) { svg += `<polygon points="${f.polygon_cm.map(px).join(" ")}" fill="rgba(255,140,0,0.25)" stroke="#f80" stroke-width="4"/><text x="${f.centre_cm[0] * pxPerCm - crop.left}" y="${f.centre_cm[1] * pxPerCm - crop.top}" font-size="26" fill="#c50" font-family="Arial" text-anchor="middle">${f.id}</text>`; }
  for (const o of P.openings || []) if (o.kind !== "opening") svg += `<line x1="${o.a_cm[0] * pxPerCm - crop.left}" y1="${o.a_cm[1] * pxPerCm - crop.top}" x2="${o.b_cm[0] * pxPerCm - crop.left}" y2="${o.b_cm[1] * pxPerCm - crop.top}" stroke="#f00" stroke-width="8"/>`;
  for (const c of P.camera_points || []) svg += `<circle cx="${c.x * pxPerCm - crop.left}" cy="${c.y * pxPerCm - crop.top}" r="14" fill="#0a0"/>`; }
for (let x = Math.ceil(crop.left / step) * step; x < crop.left + crop.width; x += step) { const X = x - crop.left; const major = Math.round(x / step) % 5 === 0; svg += `<line x1="${X}" y1="0" x2="${X}" y2="${crop.height}" stroke="${major ? "#d00" : "#f66"}" stroke-width="${major ? 3 : 1.5}" opacity="0.8"/><text x="${X + 4}" y="28" font-size="26" fill="#c00" font-family="Arial">${Math.round(x / pxPerCm)}</text>`; }
for (let y = Math.ceil(crop.top / step) * step; y < crop.top + crop.height; y += step) { const Y = y - crop.top; const major = Math.round(y / step) % 5 === 0; svg += `<line x1="0" y1="${Y}" x2="${crop.width}" y2="${Y}" stroke="${major ? "#00c" : "#66f"}" stroke-width="${major ? 3 : 1.5}" opacity="0.8"/><text x="4" y="${Y - 6}" font-size="26" fill="#00a" font-family="Arial">${Math.round(y / pxPerCm)}</text>`; }
svg += `</svg>`;
const buf = await img.composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer(); const r = await sharp(buf).resize({ width: outW }).png().toFile(out);
console.log(out, r.width + "x" + r.height, "crop", JSON.stringify(crop), "grid step px", step);
