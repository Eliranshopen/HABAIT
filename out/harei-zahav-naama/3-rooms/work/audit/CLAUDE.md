# work/audit/ — context file
<!-- last-updated: 2026-11-18 -->

## What's here
Scratch for the render audit (`qa/360/RENDER-AUDIT.md`, 2026-11-18): downscaled renders (`r_*`), downscaled panoramas (`p_*`), the plan (`plan.jpg`), crops (`c_*`) and contact sheets. Two tools, both run from the job root: `proj.py` projects plan-cm boxes onto every 360 (eye 155 cm, yaw 0 = +u) and writes `projections.json`; `crops.py <region> <room>...` crops them and builds the side-by-sides. Nothing here is a deliverable; safe to regenerate.
