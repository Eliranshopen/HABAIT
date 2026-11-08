# agent-model-guard.ps1 - PreToolUse hook (matcher: Agent|Task) for root CLAUDE.md section 10.2 / 10.4.
# Authored 2026-11-04 (OWED-003, plan development/plans/2026-11-04-owed-cleanup.md, worker D). Installed only by
# Eliran's paste of docs/OWNER-PASTE.md section b into .claude/settings.local.json.
#
# Two rules, and nothing more:
#   A. Model (root 10.4, inherited R-1..R-16: "model: sonnet or opus, never inherit"): a spawn whose model resolves to
#      `inherit` is denied. Resolution order = Claude Code's own: tool_input.model -> the definition's `model:` frontmatter
#      (.claude/agents/<type>.md under the session cwd, under C:\RnD, under ~/.claude/agents) -> CLAUDE_CODE_SUBAGENT_MODEL
#      -> inherit. `general-purpose` (also the type when none is given) and `Plan` have no definition on disk and inherit.
#      Exempt: `fork` (it always runs on the parent's model and takes no override). Other built-in or plugin types whose
#      definition is not on disk are let through - their model is not knowable here (fail open).
#   B. Rate (D-AUD-36, plan-to-tasks Step 6): the sixth Agent launch inside sixty seconds from one session is denied.
#      Allowed launches are stamped per session_id in %TEMP%\rnd-hooks\ (outside the repo), under a named mutex.
#
# Contract: Claude Code PreToolUse event on stdin. Allowed -> exit 0, no output. Denied -> exit 2 with the reason on
# stderr (Claude Code blocks the call and shows stderr to the model). FAIL OPEN: any internal error -> exit 0.
# Saved as UTF-8 with BOM (Windows PowerShell 5.1); keep the body ASCII.

$ErrorActionPreference = 'Stop'
$WindowMs = 60000
$MaxInWindow = 5
$Rule = 'D-AUD-36: "At most five workers run in parallel from one session; budget the whole session; every brief is resumable by construction."'

function Get-DefinitionModel([string]$type, [string]$cwd, [string]$root) {
  $dirs = @()
  if ($cwd) { $dirs += (Join-Path $cwd '.claude\agents') }
  $dirs += (Join-Path $root '.claude\agents')
  if ($env:USERPROFILE) { $dirs += (Join-Path $env:USERPROFILE '.claude\agents') }
  foreach ($d in $dirs) {
    if (-not (Test-Path -LiteralPath $d)) { continue }
    $cands = @()
    $f = Join-Path $d ($type + '.md')
    if (Test-Path -LiteralPath $f) { $cands += $f }
    $cands += @(Get-ChildItem -LiteralPath $d -Filter '*.md' -File | ForEach-Object { $_.FullName })
    foreach ($c in $cands) {
      $lines = [IO.File]::ReadAllLines($c)
      if ($lines.Count -lt 2 -or $lines[0].TrimStart([char]0xFEFF).Trim() -ne '---') { continue }
      $nm = $null; $model = $null
      for ($i = 1; $i -lt $lines.Count -and $lines[$i].Trim() -ne '---'; $i++) {
        $m = [regex]::Match($lines[$i], '^(name|model)\s*:\s*[''"]?([^''"#]*?)[''"]?\s*(#.*)?$')
        if ($m.Success) { if ($m.Groups[1].Value -eq 'name') { $nm = $m.Groups[2].Value } else { $model = $m.Groups[2].Value } }
      }
      if ($nm -eq $type -or ((-not $nm) -and $c -eq $f)) {
        return @{ found = $true; model = $model; file = $c }
      }
    }
  }
  return @{ found = $false; model = $null; file = $null }
}

$deny = $null
try {
  [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
  $raw = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
  $evt = $raw | ConvertFrom-Json
  if ($evt.tool_name -notin @('Agent', 'Task') -or $null -eq $evt.tool_input) { exit 0 }
  $ti = $evt.tool_input
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
  $type = [string]$ti.subagent_type
  if (-not $type) { $type = 'general-purpose' }

  # ---- A. model resolution ----
  if ($type -ne 'fork') {
    $why = $null
    $given = [string]$ti.model
    if ($given) {
      if ($given.Trim().ToLowerInvariant() -eq 'inherit') { $why = "the spawn passes model: inherit" }
    } else {
      $def = Get-DefinitionModel $type ([string]$evt.cwd) $root
      $dm = if ($def.found -and $def.model) { $def.model.Trim().ToLowerInvariant() } else { '' }
      $resolvesToDefault = ($def.found -and ($dm -eq '' -or $dm -eq 'inherit')) -or ((-not $def.found) -and $type -in @('general-purpose', 'Plan'))
      if ($resolvesToDefault) {
        $envModel = [string]$env:CLAUDE_CODE_SUBAGENT_MODEL
        if (-not $envModel -or $envModel.Trim().ToLowerInvariant() -eq 'inherit') {
          if ($def.found) { $src = "its definition $($def.file) has " + $(if ($dm) { "model: $dm" } else { 'no model: key' }) }
          else { $src = "built-in type '$type' has no model of its own" }
          $why = "no model passed at the spawn and $src, so it resolves to inherit"
        }
      }
    }
    if ($why) {
      $deny = "BLOCKED by agent-model-guard (root CLAUDE.md section 10.4 - models: sonnet for reading, verifying and mechanical legs; opus for drafting and judging; never inherit): sub-agent '$type' - $why. Re-issue the Agent call with model: `"sonnet`" or model: `"opus`" (a board may pin the model at the spawn)."
    }
  }

  # ---- B. sixth launch inside sixty seconds ----
  if (-not $deny) {
    $sid = ([string]$evt.session_id) -replace '[^A-Za-z0-9_-]', ''
    if (-not $sid) { $sid = 'no-session' }
    $dir = Join-Path $env:TEMP 'rnd-hooks'
    if (-not (Test-Path -LiteralPath $dir)) { [void](New-Item -ItemType Directory -Path $dir -Force) }
    $log = Join-Path $dir ("agent-spawns-" + $sid + '.txt')
    $mtx = New-Object System.Threading.Mutex($false, 'Local\rnd-agent-model-guard')
    $held = $false
    try {
      $held = $mtx.WaitOne(3000)
      $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      $recent = @()
      if (Test-Path -LiteralPath $log) {
        $recent = @([IO.File]::ReadAllLines($log) | Where-Object { $_ -match '^\d+$' -and ($now - [int64]$_) -lt $WindowMs })
      }
      if ($recent.Count -ge $MaxInWindow) {
        $deny = "BLOCKED by agent-model-guard (root CLAUDE.md section 10.2): this would be Agent launch number $($recent.Count + 1) inside sixty seconds from this session. $Rule Wait for a running worker to return, then launch the next one."
      } else {
        $recent += "$now"
        [IO.File]::WriteAllLines($log, [string[]]$recent)
      }
    } finally {
      if ($held) { $mtx.ReleaseMutex() }
      $mtx.Dispose()
    }
  }
} catch {
  exit 0
}
if ($deny) {
  [Console]::Error.WriteLine($deny)
  exit 2
}
exit 0
