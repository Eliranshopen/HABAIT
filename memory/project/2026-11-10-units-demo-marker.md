---
date: 2026-11-10
layer: project
author: rnd-9d (main session)
second-reader: habait-deploy-qa; compliance-warden (disclosure wording)
---
# Ruling: non-846 units keep their demo numbers, marked «נתוני הדגמה»

**Fact.** `Habait/platform/fixtures/rainbow/units.json`: only 846 is sourced (sales plan DBLK 15.10.2025: 3 rooms, 106.72 m², sun terrace 26.15 m²). The other eleven units (826/836/856/866 type L = 4 rooms 118 m²; K = 92; M = 142; PH 876 = 210) are template numbers with no sales-plan source. Prices are already hidden (`prices_public: false`).

**Eliran, 2026-11-10 10:45**, offered (a) hide unsourced numbers, (b) send the sales table, (c) keep as demo with a marker — chose **(c) «להשאיר כהדגמה עם סימון»**.

**How to apply.** `units.json` carries `source: "sales-plan" | "demo"`; every render of rooms/area/terrace shows a small «נתוני הדגמה» / "Sample data" badge when `source === "demo"`; 846 never gets it. Worktree `units-demo-marker`, $0, test link first, habait-flow on his word. When he sends the sales table for other units, the source flips per unit and the badge drops by itself.
