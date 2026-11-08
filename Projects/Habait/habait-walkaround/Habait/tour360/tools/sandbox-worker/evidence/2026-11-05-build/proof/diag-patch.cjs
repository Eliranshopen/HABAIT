const fs = require('fs');
const f = 'Habait/tour360/fidelity.json'; const j = JSON.parse(fs.readFileSync(f, 'utf8')); j.max_deviation_pct = 60; fs.writeFileSync(f, JSON.stringify(j, null, 1));
const c = 'Habait/tour360/copy/tour360-copy.json'; const k = JSON.parse(fs.readFileSync(c, 'utf8'));
k.conceptLine.he = String(k.conceptLine.he).replace(/עד \d+(\.\d+)?%/, 'עד 60%'); fs.writeFileSync(c, JSON.stringify(k, null, 1));
console.log('patched (VM only):', k.conceptLine.he.match(/עד \d+%/)?.[0]);
