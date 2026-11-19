# contracts/tools/ — the eight tools' schemas
<!-- last-updated: 2026-11-17 -->

## What's here
`<tool>.input.schema.json` and `<tool>.output.schema.json` for `engine_status`, `inspect_plan`, `start_simulation`, `get_job`, `approve_paid_stage`, `get_result`, `cancel_job`, `list_jobs` (contract 0.2 §2). `mcp/tools.mjs` serves them in `tools/list`.

(1.1) `inspect_plan` output: `mode` is `"real"`, with `pages`, `kind` (`sheet` / `booklet`), `page_rows` and richer `candidates` (`source`, `vector_paths`, `large_images`, `px`, `thumb`). `start_simulation` input: `apartment` has no default any more (left out = the only candidate).

## Conventions / gotchas
- A Job inside an output is written `{ "$ref": "../job.schema.json" }`; the server inlines it, so `tools/list` holds no `$ref`. No other `$ref` is accepted.
- Inputs are strict (`additionalProperties: false`): an unknown argument is a JSON-RPC `-32602`, as is a `job_id` that is not 16 hex characters.
- Outputs describe the success result only; a failure is `{ error: { code, message } }` with `isError: true`.
- `tests/unit/mcp-tools.test.mjs` proves `tools/list` equals these files.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
