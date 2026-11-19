---
name: feedback-keys-and-paid-calls
description: "Eliran 2026-11-04 — keep the existing API keys (no rotation, \"תשתמש במה שיש\") and paid calls are approved; §7 ledger/dry-run/caps still apply, values never read"
metadata:
  node_type: memory
  type: feedback
  originSessionId: bf387f38-6eee-4def-a2b7-39554f497b4b
  modified: 2026-11-05T10:44:04.924Z
---

On 2026-11-04 Eliran said "לא צריך להחליף מפתחות אני אומר לך תשתמש במה שיש" and then "מאושר קריאות בתשלום".

**Why:** the FAL/MyArchitectAI exposure was local, and he owns the cost and risk call (OWED-013 closed; repo `memory/project/2026-11-04-keys-kept.md`, `2026-11-04-paid-calls-approved.md`).

**How to apply:**
- Don't push key rotation on him again.
- Paid calls may run without asking each time, but the root §7 rails stay: ledger first, dry-run first, soft/hard caps, stop at the soft cap.
- Never open `.env` or print a value.
- **2026-11-05, Eliran: «יש לך אישור חופשי לתקציב תתקדם כבר»** (portal acceptance run + Rainbow fixes). Don't stop to ask about budget for this work. Still set working ceilings yourself, ledger first, and report spend: portal acceptance $60 (report at $40), Rainbow fixes $40 (report at $30), sandbox proof $10.
- On 2026-11-05 he replaced FAL_KEY twice himself (the fal account locked on TOP_UP). A 403 TOP_UP means credit, not a bad key.

See [[feedback-scripts-and-secrets-hygiene]].
