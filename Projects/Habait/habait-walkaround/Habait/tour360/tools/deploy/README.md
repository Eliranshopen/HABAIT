# tools/deploy — deploy one staged tour to its own Vercel project

`deploy-tour.sh` deploys ONE staged tour folder to its own Vercel project, named after the folder:
1. link the folder;
2. production only: set the keys by name from an env file, each value on standard input;
3. deploy.

It was rescued on 2026-11-01 (board `walkaround-production`, WP-02) from the 846 round's `deploy-846.sh`. That script lived only in an old session's temp scratchpad and hard-coded the scope, the env file and the folder.

```
bash Habait/tour360/tools/deploy/deploy-tour.sh --help
bash Habait/tour360/tools/deploy/deploy-tour.sh --stage-dir <outside-every-repo>/habait-tour-846 --scope "$VERCEL_SCOPE" --dry
bash Habait/tour360/tools/deploy/deploy-tour.sh --stage-dir <outside-every-repo>/habait-tour-846 --scope "$VERCEL_SCOPE" \
     --env-file <the owner's env file> --prod          # production: only on Slava's own go for THIS deploy
```

## Rules it enforces

| Rule | How |
|---|---|
| No Vercel command inside a repo tree (standing law 3) | a `--stage-dir` inside any git work tree is refused |
| Every production deploy has its own go (standing law 2) | a preview is the default; `--prod` is explicit and is passed only on Slava's go for that deploy |
| Only the site goes up | the CLI logs go to a temp folder outside the staged folder. A staged folder holding `*.log`, `*.out`, `*.err`, `.env*` or `*link*.txt` is refused before the upload, and checked again just before it. |
| Secrets by name only | a value is read from `--env-file` by name and piped to `vercel env add` on standard input. It is never printed, logged or passed as an argument. A preview sets no key, so a preview holds no paid key. |
| No hidden defaults | `--scope` and `--env-file` have no default; the scope's slug is never written into this tree |
| The CLI pinned | `npx --yes vercel@65.1.0` |

## Why the logs moved out

`deploy-846.sh` wrote `link.log`, `env-<NAME>.log` and `deploy.out`/`deploy.err` into the folder it then deployed. On 2026-11-01 the live 846 site served all six files (HTTP 200).
- **They hold no key value.** The three `env-*.log` files are identical apart from the variable name and one per-run `invocationId`, checked without printing a line.
- **They still expose CLI output** that is not part of the tour.
- **They come off the live site with the next 846 deploy**, which needs Slava's go.

## The staged folder

The staged folder is a copy of a built tour (`Habait/tour360/dist/<id>/` from `tools/build-tour.mjs`, or a folder made by `tools/stage-tour.mjs` / `tools/stage-walkaround.mjs`).
- **Where it lives:** outside every repo. Its name is the Vercel project's name (`habait-tour-846`).
- **`--tour <built-dir>`** makes the copy into a fresh `--stage-dir`. Without it, the script deploys a folder that is staged already.
- **846's last staged folder** (2026-10-28) is kept in the walkaround backup and moves to the shared drive's `staged/habait-tour-846/<build>/` at WP-22. It never enters git.
  - It still holds the old script's `deploy.out` and `deploy.err`, so this script refuses it as it is (checked 2026-11-01).
  - Before redeploying it, delete those two files, or re-stage from a fresh build.
