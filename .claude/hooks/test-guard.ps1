# test-guard.ps1 - PreToolUse hook (matcher: Bash) for root CLAUDE.md section 12 (machine resource rules).
# Authored 2026-11-04 (OWED-003, plan development/plans/2026-11-04-owed-cleanup.md, worker D). Installed only by
# Eliran's paste of docs/OWNER-PASTE.md section b into .claude/settings.local.json.
#
# Rule enforced, and nothing more:
#   1. A test, build/typecheck, server, browser or render command runs as `timeout N <cmd>` (GNU timeout, Git Bash).
#   2. The Bash tool timeout is above N (tool_input.timeout in ms, default 120000 or BASH_DEFAULT_TIMEOUT_MS).
#   3. Foreground only: such a command is never started with run_in_background or a trailing `&`
#      (this is the hook's share of "one heavy run at a time").
# Anything else (reads, greps, git-free plumbing, short scripts) passes untouched.
#
# Contract: Claude Code hook JSON event on stdin. Allowed -> exit 0, no output. Blocked -> exit 2 with the reason on
# stderr (Claude Code shows stderr to the model and blocks the call). FAIL OPEN: any internal error -> exit 0.
# Must stay fast: .claude/skills/sync-context/metrics.mjs [8] times 3 runs with {"tool_name":"Bash",...} on stdin.
# Saved as UTF-8 with BOM (Windows PowerShell 5.1); keep the body ASCII.

$ErrorActionPreference = 'Stop'

# Programs that are heavy in any form (basename, lower case, no extension).
$HeavyAlways = @('vitest','jest','mocha','ava','pytest','playwright','cypress','tsc','vue-tsc','webpack','vite',
  'blender','ffmpeg','chrome','msedge','chromium','chromium-browser','google-chrome','lighthouse',
  'http-server','live-server','serve','uvicorn','nodemon')
# Programs that are heavy only with one of these sub-commands.
$HeavySub = @{
  'next'        = '^(build|dev|start)$'
  'remotion'    = '^(render|still|studio|preview|benchmark)$'
  'hyperframes' = '^(render|preview|dev|studio)$'
  'vercel'      = '^(dev|build)$'
  'cargo'       = '^(test|build|run|bench)$'
  'go'          = '^(test|build|run)$'
  'dotnet'      = '^(test|build|run)$'
  'turbo'       = '^(run|build|test|dev)$'
}
# Package-manager scripts that are heavy (npm run <x>, yarn <x>, pnpm <x>, bun run <x>).
$HeavyScript = '^(test|t|e2e|build|typecheck|type-check|tsc|dev|start|serve|preview|render|bench)([:._-].*)?$'

function Get-Prog([string]$tok) {
  $t = $tok -replace '\\', '/'
  $t = $t.Substring($t.LastIndexOf('/') + 1).ToLowerInvariant()
  return ($t -replace '\.(exe|cmd|bat|ps1)$', '')
}

# Replace every quoted string with a placeholder token __Qn__ (contents kept in $script:Q) so that text inside
# quotes (grep patterns, echo text, commit-free messages) is never read as a command. Heredoc bodies are dropped.
function Protect-Text([string]$cmd) {
  $lines = $cmd -split "`n"
  $kept = New-Object System.Collections.Generic.List[string]
  $tag = $null
  foreach ($ln in $lines) {
    if ($tag) { if ($ln.Trim() -eq $tag) { $tag = $null }; continue }
    $kept.Add($ln)
    $m = [regex]::Match($ln, "<<-?\s*['""]?([A-Za-z_][A-Za-z0-9_]*)['""]?")
    if ($m.Success) { $tag = $m.Groups[1].Value }
  }
  $s = ($kept -join "`n")
  $sb = New-Object System.Text.StringBuilder
  $i = 0
  while ($i -lt $s.Length) {
    $c = $s[$i]
    if ($c -eq "'" -or $c -eq '"') {
      $j = $i + 1
      $buf = New-Object System.Text.StringBuilder
      while ($j -lt $s.Length -and $s[$j] -ne $c) {
        if ($c -eq '"' -and $s[$j] -eq '\' -and ($j + 1) -lt $s.Length) { [void]$buf.Append($s[$j + 1]); $j += 2; continue }
        [void]$buf.Append($s[$j]); $j++
      }
      $script:Q.Add($buf.ToString())
      [void]$sb.Append(' __Q' + ($script:Q.Count - 1) + '__ ')
      $i = $j + 1
      continue
    }
    [void]$sb.Append($c); $i++
  }
  return $sb.ToString()
}

function Expand-Tok([string]$tok) {
  $m = [regex]::Match($tok, '^__Q(\d+)__$')
  if ($m.Success) { return $script:Q[[int]$m.Groups[1].Value] }
  return $tok
}

function Get-DurationSec([string]$d) {
  $m = [regex]::Match($d, '^(\d+(?:\.\d+)?)([smhd]?)$')
  if (-not $m.Success) { return $null }
  $n = [double]$m.Groups[1].Value
  switch ($m.Groups[2].Value) { 'm' { $n *= 60 } 'h' { $n *= 3600 } 'd' { $n *= 86400 } }
  return $n
}

# Returns the heavy-category label of a token list, or $null.
function Get-Heavy([string[]]$t) {
  $k = 0
  while ($k -lt $t.Count) {
    $p = Get-Prog (Expand-Tok $t[$k])
    if ($t[$k] -match '^[A-Za-z_][A-Za-z0-9_]*=') { $k++; continue }
    if ($p -in @('env','time','exec','nohup','command','nice')) { $k++; continue }
    if ($p -in @('npx','bunx')) { $k++; while ($k -lt $t.Count -and $t[$k].StartsWith('-')) { $k++ }; continue }
    if ($p -in @('pnpm','yarn','npm') -and ($k + 1) -lt $t.Count -and $t[$k + 1] -in @('exec','dlx')) { $k += 2; continue }
    break
  }
  if ($k -ge $t.Count) { return $null }
  $all = ($t[$k..($t.Count - 1)] | ForEach-Object { Expand-Tok $_ }) -join ' '
  if ($all -match '(^|\s)--headless(=|\s|$)') { return 'browser' }
  $p = Get-Prog (Expand-Tok $t[$k])
  $rest = @(); if (($k + 1) -lt $t.Count) { $rest = @($t[($k + 1)..($t.Count - 1)] | Where-Object { -not $_.StartsWith('-') }) }
  $sub = if ($rest.Count -gt 0) { (Expand-Tok $rest[0]).ToLowerInvariant() } else { '' }
  if ($HeavyAlways -contains $p) { return $p }
  if ($HeavySub.ContainsKey($p) -and $sub -match $HeavySub[$p]) { return "$p $sub" }
  if ($p -in @('npm','pnpm','yarn','bun')) {
    if ($sub -in @('run','run-script') -and $rest.Count -gt 1) { $sub = (Expand-Tok $rest[1]).ToLowerInvariant(); $p = "$p run" }
    elseif ($p -eq 'npm' -and $sub -notin @('test','t','start')) { return $null }
    elseif ($p -eq 'bun' -and $sub -notin @('test')) { return $null }
    if ($sub -match $HeavyScript) { return "$p $sub" }
    return $null
  }
  if ($p -eq 'node' -and $all -match '(^|\s)--test(\s|$)') { return 'node --test' }
  if ($p -in @('python','python3','py') -and $all -match '(^|\s)-m\s+(pytest|http\.server|uvicorn)(\s|$)') { return "$p -m $($Matches[2])" }
  return $null
}

# Analyse one command string. $boundN = the enclosing `timeout N` (or $null). Adds findings to $script:Hits.
function Test-Command([string]$cmd, $boundN, [int]$depth) {
  if ($depth -gt 3) { return }
  $s = Protect-Text $cmd
  $s = $s -replace '\|&', '|' -replace '[0-9]*>&[0-9-]*', ' ' -replace '&>>?', '>'
  $parts = [regex]::Split($s, '(&&|\|\||;|\||&|\r?\n|\$\(|[(){}`])')
  for ($i = 0; $i -lt $parts.Count; $i += 2) {
    $seg = $parts[$i].Trim()
    if (-not $seg) { continue }
    $delim = if (($i + 1) -lt $parts.Count) { $parts[$i + 1] } else { '' }
    $t = @($seg -split '\s+' | Where-Object { $_ -ne '' })
    $k = 0
    while ($k -lt $t.Count -and ($t[$k] -match '^[A-Za-z_][A-Za-z0-9_]*=' -or (Get-Prog $t[$k]) -in @('env','time','exec','nohup','command'))) { $k++ }
    $n = $boundN
    if ($k -lt $t.Count -and (Get-Prog $t[$k]) -eq 'timeout') {
      $k++
      while ($k -lt $t.Count -and $t[$k].StartsWith('-')) {
        if ($t[$k] -in @('-k','-s','--kill-after','--signal')) { $k += 2 } else { $k++ }
      }
      if ($k -lt $t.Count) { $d = Get-DurationSec $t[$k]; if ($null -ne $d) { $n = $d; $k++ } }
    }
    if ($k -ge $t.Count) { continue }
    $t = @($t[$k..($t.Count - 1)])
    $p = Get-Prog (Expand-Tok $t[0])
    # Shell wrappers: look inside the -c / -Command string with the same bound.
    if ($t.Count -ge 3 -and (($p -in @('bash','sh','zsh') -and $t[1] -eq '-c') -or ($p -in @('powershell','pwsh') -and $t[1] -match '^-c(ommand)?$') -or ($p -eq 'cmd' -and $t[1] -match '^/[cCkK]$'))) {
      Test-Command (($t[2..($t.Count - 1)] | ForEach-Object { Expand-Tok $_ }) -join ' ') $n ($depth + 1)
      continue
    }
    $h = Get-Heavy $t
    if (-not $h) { continue }
    $shown = (($t | ForEach-Object { Expand-Tok $_ }) -join ' ')
    if ($shown.Length -gt 120) { $shown = $shown.Substring(0, 117) + '...' }
    if ($null -eq $n) { $script:Hits.Add("unbounded ($h): ``$shown`` - wrap it as ``timeout N $shown``") }
    else {
      if ($n -gt $script:MaxN) { $script:MaxN = $n }
      if ($delim -eq '&') { $script:Hits.Add("backgrounded with '&' ($h): ``$shown`` - foreground only") }
    }
  }
}

$block = $null
try {
  [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
  $raw = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
  $evt = $raw | ConvertFrom-Json
  if ($evt.tool_name -ne 'Bash' -or $null -eq $evt.tool_input) { exit 0 }
  $cmd = [string]$evt.tool_input.command
  if ([string]::IsNullOrWhiteSpace($cmd)) { exit 0 }

  $script:Q = New-Object System.Collections.Generic.List[string]
  $script:Hits = New-Object System.Collections.Generic.List[string]
  $script:MaxN = 0
  Test-Command $cmd $null 0

  $heavyBounded = $script:MaxN -gt 0
  if ($heavyBounded -and $evt.tool_input.run_in_background -eq $true) {
    $script:Hits.Add('run_in_background is true for a heavy command - foreground only; never sleep-poll a backgrounded run')
  }
  if ($heavyBounded) {
    $toolMs = 120000
    if ($env:BASH_DEFAULT_TIMEOUT_MS -match '^\d+$') { $toolMs = [double]$env:BASH_DEFAULT_TIMEOUT_MS }
    $given = $evt.tool_input.timeout
    if ($null -ne $given -and "$given" -match '^\d+(\.\d+)?$') { $toolMs = [double]$given }
    if ($toolMs -le ($script:MaxN * 1000)) {
      $script:Hits.Add("Bash tool timeout $toolMs ms is not above timeout $($script:MaxN) s - pass the tool timeout above N (e.g. $([int]($script:MaxN * 1000 + 60000)) ms)")
    }
  }
  if ($script:Hits.Count -gt 0) {
    $block = "BLOCKED by test-guard (root CLAUDE.md section 12, machine resource rules):`n" +
      (($script:Hits | ForEach-Object { " - $_" }) -join "`n") +
      "`nEvery test, build, server, browser or render command runs in Git Bash as ``timeout N <cmd>`` (tests 300 s, build/typecheck 540, servers/sweeps/renders 540 per chunk, 1800 once BASH_MAX_TIMEOUT_MS is raised) with the tool timeout above N; one heavy run at a time; foreground only. Re-issue the command in that form."
  }
} catch {
  exit 0
}
if ($block) {
  [Console]::Error.WriteLine($block)
  exit 2
}
exit 0
