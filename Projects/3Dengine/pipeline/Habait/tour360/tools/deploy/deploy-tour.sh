#!/usr/bin/env bash
# deploy-tour.sh — deploy ONE staged tour folder to its OWN Vercel project (the project is named after the folder).
# Rescued 2026-11-01 (board walkaround-production, WP-02) from the 846 round's deploy-846.sh (an old session's %TEMP% scratchpad,
# 2026-10-28). The steps are the same: link the folder → set the keys by NAME from an env file, on standard input → deploy.
# The scope, the env file and the folder are parameters now, nothing names a machine path, and three holes are closed:
#   1. the CLI's logs were written INTO the staged folder and went up with the site (the live 846 site serves link.log, env-*.log
#      and deploy.out/err — no key value inside, measured 2026-11-01): the logs now go to a temp folder outside it, and a staged
#      folder holding *.log, *.out, *.err, .env* or *link*.txt files is refused before the upload;
#   2. production was the only mode: a preview is the default and --prod is explicit (every production deploy has Slava's own
#      go, standing law 2); keys are set only for production, so a preview holds no paid key;
#   3. the folder could sit anywhere: a folder inside a git work tree is refused (standing law 3: no Vercel command in a repo tree).
# A value is read from the env file by name and piped to `vercel env add` on standard input: never printed, echoed, logged or
# passed as an argument.
set -uo pipefail

usage() { cat <<'EOF'
deploy-tour.sh — deploy one staged tour folder to its own Vercel project (named after the folder).

usage: bash Habait/tour360/tools/deploy/deploy-tour.sh --stage-dir <dir> --scope <vercel-scope> [--tour <built-dir>]
           [--env-file <path>] [--vars "A B C"] [--prod] [--skip-env] [--dry] [--help]

  --stage-dir <dir>   (env STAGE_DIR)    the staged folder to deploy, OUTSIDE every git work tree; its name is the project's name
  --scope <slug>      (env VERCEL_SCOPE) the Vercel scope (team slug); required, no default
  --tour <dir>        (env TOUR)         optional: a built tour folder (e.g. Habait/tour360/dist/<id>/) copied into --stage-dir
                                         first; --stage-dir must not exist yet. Omit it to deploy a folder staged already.
  --env-file <path>   (env ENV_FILE)     the env file the keys are read from, by NAME; no default; needed with --prod
                                         unless --skip-env
  --vars "A B C"                         the variables set on the project (default: FAL_KEY OPENROUTER_API_KEY TOUR_EDIT_CODE)
  --prod                                 deploy to PRODUCTION: only on Slava's own go for this deploy (standing law 2).
                                         Without it: a preview deploy, which sets no key.
  --skip-env                             set no variable
  --dry                                  print the commands it would run and run none of them (the read-only checks still run)
  --help                                 this text

The Vercel CLI is pinned: npx --yes vercel@65.1.0. Its logs go to a temp folder outside the staged folder, printed at the end.
EOF
}

die() { echo "deploy-tour: $*" >&2; exit 2; }
need() { [ $# -ge 2 ] && [ -n "$2" ] || die "$1 needs a value"; }

STAGE_DIR="${STAGE_DIR:-}"; VERCEL_SCOPE="${VERCEL_SCOPE:-}"; TOUR="${TOUR:-}"; ENV_FILE="${ENV_FILE:-}"
VARS_STR=""; PROD=0; SKIP_ENV=0; DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --stage-dir) need "$@"; STAGE_DIR="$2"; shift 2 ;;
    --scope)     need "$@"; VERCEL_SCOPE="$2"; shift 2 ;;
    --tour)      need "$@"; TOUR="$2"; shift 2 ;;
    --env-file)  need "$@"; ENV_FILE="$2"; shift 2 ;;
    --vars)      need "$@"; VARS_STR="$2"; shift 2 ;;
    --prod)      PROD=1; shift ;;
    --skip-env)  SKIP_ENV=1; shift ;;
    --dry)       DRY=1; shift ;;
    -h|--help)   usage; exit 0 ;;
    *)           echo "deploy-tour: unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$STAGE_DIR" ] || die "--stage-dir (STAGE_DIR) is required"
[ -n "$VERCEL_SCOPE" ] || die "--scope (VERCEL_SCOPE) is required; there is no default"
STAGE_DIR="${STAGE_DIR%/}"
PROJECT="$(basename "$STAGE_DIR")"
if [ -n "$VARS_STR" ]; then read -r -a VARS <<< "$VARS_STR"; else VARS=(FAL_KEY OPENROUTER_API_KEY TOUR_EDIT_CODE); fi
SET_ENV=0; [ "$PROD" = 1 ] && [ "$SKIP_ENV" = 0 ] && SET_ENV=1
if [ "$SET_ENV" = 1 ]; then
  [ -n "$ENV_FILE" ] || die "--env-file (ENV_FILE) is required with --prod (or pass --skip-env)"
  [ -f "$ENV_FILE" ] || die "no env file at the path given"
fi
CLI=(npx --yes vercel@65.1.0)

# standing law 3: never a Vercel command inside a repo tree (checks the nearest existing folder of the path)
inside_git() { local d="$1"; while [ ! -d "$d" ]; do d="$(dirname "$d")"; done; [ "$(git -C "$d" rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ]; }
inside_git "$STAGE_DIR" && die "refusing: $STAGE_DIR is inside a git work tree; stage the tour into a folder outside every repo"

# nothing but the site goes up: no logs, no env files, no link notes
check_clean() {
  local d="$1" bad
  [ -f "$d/index.html" ] || die "no index.html in $d"
  bad="$(find "$d" -path "$d/.vercel" -prune -o \( -name '*.log' -o -name '*.out' -o -name '*.err' -o -name '.env*' -o -iname '*link*.txt' \) -print)"
  if [ -n "$bad" ]; then
    echo "deploy-tour: refusing: these files would be uploaded with the site (names only):" >&2
    printf '%s\n' "$bad" | sed 's/^/  /' >&2
    exit 2
  fi
}

if [ "$PROD" = 1 ]; then MODE="PRODUCTION deploy, on Slava's go for this deploy"; else MODE="preview deploy"; fi
[ "$DRY" = 1 ] && MODE="$MODE · DRY"
echo "== $PROJECT: $MODE · scope $VERCEL_SCOPE =="

# 1. stage
if [ -n "$TOUR" ]; then
  [ -d "$TOUR" ] || die "no built tour folder at $TOUR"
  [ ! -e "$STAGE_DIR" ] || die "--stage-dir exists already; stage into a fresh folder (or omit --tour to deploy it as it is)"
  if [ "$DRY" = 1 ]; then echo "+ cp -r $TOUR $STAGE_DIR"; check_clean "$TOUR"
  else cp -r "$TOUR" "$STAGE_DIR" || die "copy failed"; fi
fi
if [ -d "$STAGE_DIR" ]; then check_clean "$STAGE_DIR"
elif [ "$DRY" = 0 ]; then die "no staged folder at $STAGE_DIR"
fi

if [ "$DRY" = 0 ]; then LOGDIR="$(mktemp -d)"; else LOGDIR='<a temp folder>'; fi

# 2. link the folder to its own project (the CLI names it after the folder)
echo "== link =="
if [ "$DRY" = 1 ]; then
  echo "+ (cd $STAGE_DIR && ${CLI[*]} link --yes --scope $VERCEL_SCOPE) > $LOGDIR/link.log 2>&1"
  echo "+ rm -f $STAGE_DIR/.env.local"
else
  ( cd "$STAGE_DIR" && "${CLI[@]}" link --yes --scope "$VERCEL_SCOPE" ) > "$LOGDIR/link.log" 2>&1
  sed -E 's/\x1b\[[0-9;]*m//g' "$LOGDIR/link.log" | grep -i -E "linked|created|error" | head -5
  [ -f "$STAGE_DIR/.vercel/project.json" ] || die "no .vercel/project.json after link (see $LOGDIR/link.log)"
  rm -f "$STAGE_DIR/.env.local"   # the env-rewriting Vercel family (standing law 3)
fi

# 3. the keys, production only, values on standard input
getv() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }
if [ "$SET_ENV" = 1 ]; then
  echo "== env (production, sensitive; each value on standard input, never printed) =="
  for v in "${VARS[@]}"; do
    if [ "$DRY" = 1 ]; then echo "+ <the value of $v from the env file> | (cd $STAGE_DIR && ${CLI[*]} env add $v production --sensitive --scope $VERCEL_SCOPE)"; continue; fi
    val="$(getv "$v")"
    if [ -z "$val" ]; then echo "$v: MISSING in the env file"; continue; fi
    ( cd "$STAGE_DIR" && printf '%s' "$val" | "${CLI[@]}" env add "$v" production --sensitive --scope "$VERCEL_SCOPE" ) > "$LOGDIR/env-$v.log" 2>&1
    rc=$?
    if [ $rc -ne 0 ]; then
      # retry without --sensitive (older projects), still on standard input
      ( cd "$STAGE_DIR" && printf '%s' "$val" | "${CLI[@]}" env add "$v" production --scope "$VERCEL_SCOPE" ) > "$LOGDIR/env-$v.log" 2>&1
      rc=$?
    fi
    unset val
    echo "$v: exit $rc — $(sed -E 's/\x1b\[[0-9;]*m//g' "$LOGDIR/env-$v.log" | grep -i -E 'added|exists|error' | head -1)"
  done
elif [ "$PROD" = 1 ]; then echo "== env: skipped (--skip-env) =="
else echo "== env: none (a preview deploy sets no key) =="
fi

# 4. deploy
DEPLOY=(deploy --yes --scope "$VERCEL_SCOPE"); [ "$PROD" = 1 ] && DEPLOY=(deploy --prod --yes --scope "$VERCEL_SCOPE")
echo "== ${DEPLOY[*]:0:2} =="
if [ "$DRY" = 1 ]; then
  echo "+ (cd $STAGE_DIR && ${CLI[*]} ${DEPLOY[*]}) > $LOGDIR/deploy.out 2> $LOGDIR/deploy.err"
  echo "(dry) nothing was run"
  exit 0
fi
check_clean "$STAGE_DIR"   # the last look before the upload
( cd "$STAGE_DIR" && "${CLI[@]}" "${DEPLOY[@]}" ) > "$LOGDIR/deploy.out" 2> "$LOGDIR/deploy.err"
rc=$?
echo "deploy exit $rc"
sed -E 's/\x1b\[[0-9;]*m//g' "$LOGDIR/deploy.err" | grep -E "Production|Preview|Inspect|Error|error|Aliased" | head -8
echo "url: $(tr -d '\r' < "$LOGDIR/deploy.out")"
echo "logs (outside the staged folder): $LOGDIR"
exit $rc
