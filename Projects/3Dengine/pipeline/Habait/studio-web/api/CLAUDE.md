# Habait/studio-web/api — the /api/studio-* functions
<!-- last-updated: 2026-11-04 -->
<!-- context file · written 2026-11-04 by session rnd-67 -->
Web-standard handlers (`export async function GET/POST(request)`) for Vercel's Node runtime; `_studio.mjs` is shared (an underscore
file is not a route). Every route checks the Clerk session and touches only `studio/u/<uid>/…` in the private Blob store.
Parent: [../CLAUDE.md](../CLAUDE.md)
