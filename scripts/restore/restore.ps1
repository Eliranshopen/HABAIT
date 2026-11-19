# Restore of C:\RnD on another computer, from this carry pack. Started by RESTORE.cmd (double-click).
#
# What it does, in order. Every step is safe to run again: a step that is already done is skipped.
#   1. the tools the engine needs (Git, Node, Python 3.13, Blender 4.5.10, Chrome), each installed only when missing
#      (-SkipInstalls: they are checked and nothing is installed)
#   2. the repository, from rnd-repo.bundle, at C:\RnD (every branch made local; the GitHub mirror named "github")
#   3. the engine's working folder (git worktree C:\RnD\.wt\3dengine, branch 3dengine)
#   4. what git does not keep: the furniture models, the sky picture, the engine's local settings, the demo site
#   5. Claude's notes, into Claude Code's memory folder of this project (never over existing notes)
#   6. the agent side the end-to-end test needs: the agent UI, the Pi wrapper, the Pi command line
#   7. the engine's own environment (Python libraries, Node libraries) and its readiness check, in both homes
#
# It NEVER touches the keys file. That one file is copied by hand into C:\RnD (see README-HE.md).
# It never overwrites: an existing C:\RnD that is not this repository stops the script.
#
# ASCII only on purpose (Windows PowerShell 5.1 reads a script without a byte-order mark as ANSI).
param(
  [string]$Root = 'C:\RnD',
  [string]$UiRoot = 'C:\HABAIT-Agent-UI',
  [string]$WrapperRoot = 'C:\pi-main\habait',
  [string]$NotesDir = (Join-Path $env:USERPROFILE '.claude\projects\c--RnD\memory'),
  [string]$AgentSideUrl = 'https://github.com/Eliranshopen/RnD/releases/download/engine-restore-2026-11-19/agent-side.zip',
  [switch]$SkipInstalls,
  [switch]$SkipAgentSide,
  [switch]$SkipGlobalPi
)

$ErrorActionPreference = 'Continue'
$Pack = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:Notes = New-Object System.Collections.ArrayList
$script:StepNo = 0

function Say([string]$text) { Write-Host $text }
function Step([string]$text) { $script:StepNo++; Write-Host ''; Write-Host ("[{0}/7] {1}" -f $script:StepNo, $text) -ForegroundColor Cyan }
function Note([string]$text) { [void]$script:Notes.Add($text); Write-Host ("      NOTE: " + $text) -ForegroundColor Yellow }
function Stop-Restore([string]$why) {
  Write-Host ''
  Write-Host ("STOPPED at step {0}: {1}" -f $script:StepNo, $why) -ForegroundColor Red
  Write-Host 'Nothing was overwritten. Fix what the line above names and start RESTORE.cmd again: finished steps are skipped.'
  exit 1
}
function Update-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = ($machine, $user | Where-Object { $_ }) -join ';'
}
function Test-Command([string]$name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function Install-WithWinget([string]$id, [string]$version) {
  if ($SkipInstalls -or -not (Test-Command 'winget')) { return $false }
  $a = @('install', '--id', $id, '-e', '--source', 'winget', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
  if ($version) { $a += @('--version', $version) }
  Say ("      installing " + $id + $(if ($version) { ' ' + $version } else { '' }) + ' (Windows may ask for permission)')
  & winget @a | Out-Null
  $code = $LASTEXITCODE
  Update-Path
  return ($code -eq 0)
}
function Copy-Tree([string]$from, [string]$to) {
  if (-not (Test-Path $from)) { Stop-Restore ("the pack has no " + $from) }
  New-Item -ItemType Directory -Force $to | Out-Null
  & robocopy $from $to /E /R:2 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { Stop-Restore ("copying " + $from + " to " + $to + " failed (robocopy " + $LASTEXITCODE + ")") }
}
function Restore-Bundle([string]$bundle, [string]$target, [string]$needBranch) {
  # A clone of a bundle, with every branch made a local branch BEFORE the link to the bundle file is removed.
  if (Test-Path (Join-Path $target '.git')) {
    & git -C $target rev-parse --verify --quiet $needBranch | Out-Null
    if ($LASTEXITCODE -ne 0) { Stop-Restore ($target + ' is a git repository without the branch ' + $needBranch + ': it is not the one of this pack') }
    Say ("      already there: " + $target)
    return $false
  }
  if ((Test-Path $target) -and (Get-ChildItem -Force $target | Select-Object -First 1)) {
    Stop-Restore ($target + ' exists and is not a git repository. Move it away (do not delete it) and start again')
  }
  if (-not (Test-Path $bundle)) { Stop-Restore ('the pack has no ' + $bundle) }
  & git -c core.autocrlf=true clone --quiet $bundle $target
  if ($LASTEXITCODE -ne 0) { Stop-Restore ('git clone of ' + $bundle + ' failed') }
  $remote = & git -C $target for-each-ref --format='%(refname:short)' refs/remotes/origin
  foreach ($r in $remote) {
    $name = $r -replace '^origin/', ''
    if ($name -eq 'HEAD' -or $name -eq 'origin') { continue }
    & git -C $target rev-parse --verify --quiet ("refs/heads/" + $name) | Out-Null
    if ($LASTEXITCODE -ne 0) { & git -C $target branch --quiet $name $r | Out-Null }
  }
  & git -C $target remote remove origin
  return $true
}

Say 'Restore of C:\RnD from the carry pack'
Say ("pack:   " + $Pack)
Say ("target: " + $Root)
foreach ($need in 'rnd-repo.bundle', 'not-in-git', 'claude-memory') {
  if (-not (Test-Path (Join-Path $Pack $need))) { Write-Host ("The pack is not whole: " + $need + " is missing beside this script.") -ForegroundColor Red; exit 1 }
}

# ---------------------------------------------------------------- 1. tools
Step 'The tools the engine needs'
if ($SkipInstalls) { Say '      checked only, nothing is installed (on request)' }
if ($true) {
  if (-not $SkipInstalls) { Update-Path }
  if (-not (Test-Command 'git')) { [void](Install-WithWinget 'Git.Git' '') }
  if (-not (Test-Command 'git')) { Stop-Restore 'Git is not installed and could not be installed. Install "Git for Windows" from https://git-scm.com/download/win' }
  Say ('      git      ' + (& git --version))

  # Node: the engine was built and tested on 24.22.1; its own minimum is 22.8.
  if (-not $SkipInstalls -and -not (Test-Command 'node')) {
    $msi = Join-Path $env:TEMP 'node-v24.22.1-x64.msi'
    try {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Say '      installing Node.js 24.22.1 (Windows will ask for permission)'
      Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/v24.22.1/node-v24.22.1-x64.msi' -OutFile $msi
      Start-Process msiexec.exe -ArgumentList @('/i', ('"' + $msi + '"'), '/passive', '/norestart') -Wait
    } catch { }
    Update-Path
  }
  if (-not (Test-Command 'node')) { Stop-Restore 'Node.js is not installed and could not be installed. Install version 24 from https://nodejs.org/dist/v24.22.1/node-v24.22.1-x64.msi' }
  $nodeV = (& node --version)
  Say ('      node     ' + $nodeV)
  if ($nodeV -notmatch '^v24\.') { Note ('Node here is ' + $nodeV + '; the engine was tested on v24.22.1. Its readiness check accepts 22.8 and later.') }

  # Python 3.13 as "python" on the PATH (the Windows Store stub does not count).
  function Get-PythonVersion {
    $c = Get-Command python -ErrorAction SilentlyContinue
    if (-not $c -or $c.Source -like '*WindowsApps*') { return '' }
    return ((& python --version 2>$null) | Out-String).Trim()
  }
  if ((Get-PythonVersion) -notmatch '^Python 3\.13\.') {
    [void](Install-WithWinget 'Python.Python.3.13' '')
    if (-not $SkipInstalls -and (Get-PythonVersion) -notmatch '^Python 3\.13\.') {
      foreach ($dir in (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313'), 'C:\Program Files\Python313') {
        if (Test-Path (Join-Path $dir 'python.exe')) {
          $user = [Environment]::GetEnvironmentVariable('Path', 'User')
          [Environment]::SetEnvironmentVariable('Path', ($dir + ';' + (Join-Path $dir 'Scripts') + ';' + $user), 'User')
          Update-Path
          $env:Path = $dir + ';' + (Join-Path $dir 'Scripts') + ';' + $env:Path
          Note ('Python 3.13 was put first on your PATH: ' + $dir)
          break
        }
      }
    }
  }
  $pyV = Get-PythonVersion
  if ($pyV -notmatch '^Python 3\.13\.') { Stop-Restore ('"python" on the PATH must be Python 3.13 (found: "' + $pyV + '"). Install it from https://www.python.org/downloads/ with "Add python.exe to PATH" ticked') }
  Say ('      python   ' + $pyV)

  # Blender: the engine asks for 4.5.10 exactly, at the default place.
  $blender = 'C:\Program Files\Blender Foundation\Blender 4.5\blender.exe'
  if (-not (Test-Path $blender)) { [void](Install-WithWinget 'BlenderFoundation.Blender.LTS.4.5' '4.5.10') }
  if (Test-Path $blender) {
    $bv = ((& $blender --version 2>$null) | Select-Object -First 1 | Out-String).Trim()
    Say ('      blender  ' + $bv)
    if ($bv -notmatch '4\.5\.10') { Note ('Blender here is "' + $bv + '"; the engine asks for 4.5.10 exactly and its readiness check will say so. Install 4.5.10 from https://download.blender.org/release/Blender4.5/') }
  } else { Note 'Blender 4.5.10 is not installed (the automatic install did not work). Install blender-4.5.10-windows-x64.msi from https://download.blender.org/release/Blender4.5/ and start RESTORE.cmd again' }

  $chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
  if (-not (Test-Path $chrome)) { [void](Install-WithWinget 'Google.Chrome' '') }
  if (Test-Path $chrome) { Say '      chrome   installed' } else { Note 'Google Chrome is not at its default place; install it from https://www.google.com/chrome/' }

  # Claude Code itself: wanted, never a reason to stop.
  if (Test-Command 'claude') { Say '      claude   installed' }
  elseif (Install-WithWinget 'Anthropic.ClaudeCode' '') { Say '      claude   installed (sign in the first time you start it)' }
  else { Note 'the Claude Code command line was not installed by this script; install Claude Code the way it is installed on the first computer' }
}

# ---------------------------------------------------------------- 2. the repository
Step ('The repository at ' + $Root)
$fresh = Restore-Bundle (Join-Path $Pack 'rnd-repo.bundle') $Root 'main'
if ($fresh) {
  & git -C $Root config user.name 'Eliran Shopen'
  & git -C $Root config user.email 'eliran@habait.ai'
  & git -C $Root remote add github 'https://github.com/Eliranshopen/HABAIT.git'
  Say ('      restored: ' + ((& git -C $Root branch --list | Measure-Object).Count) + ' branches, main at ' + (& git -C $Root rev-parse --short=8 main))
}

# ---------------------------------------------------------------- 3. the engine's working folder
Step 'The engine working folder (branch 3dengine)'
$Wt = Join-Path $Root '.wt\3dengine'
if (Test-Path (Join-Path $Wt '.git')) { Say ('      already there: ' + $Wt) }
else {
  New-Item -ItemType Directory -Force (Join-Path $Root '.wt') | Out-Null
  & git -C $Root worktree add --quiet $Wt 3dengine
  if ($LASTEXITCODE -ne 0) { Stop-Restore 'git worktree add of the branch 3dengine failed' }
  Say ('      made: ' + $Wt)
}

# ---------------------------------------------------------------- 4. what git does not keep
Step 'What git does not keep (furniture models, sky picture, local settings, demo site)'
$assets = Join-Path $Pack 'not-in-git\Projects\3Dengine'
Copy-Tree $assets (Join-Path $Root 'Projects\3Dengine')
Copy-Tree $assets (Join-Path $Wt 'Projects\3Dengine')
$site = Join-Path $Pack 'not-in-git\.wt\deploy-P-7'
if (Test-Path $site) { Copy-Tree $site (Join-Path $Root '.wt\deploy-P-7') } else { Note 'the pack has no demo site (not-in-git\.wt\deploy-P-7): the end-to-end test will name it as missing' }
Say '      copied'

# ---------------------------------------------------------------- 5. Claude's notes
Step "Claude's notes"
if (Test-Path (Join-Path $NotesDir 'MEMORY.md')) { Say ('      notes already exist in ' + $NotesDir + ' - left as they are'); Note ("Claude's notes on this computer were NOT replaced. The pack's copy is in claude-memory\ and in " + $Root + '\docs\claude-memory-export\') }
else {
  New-Item -ItemType Directory -Force $NotesDir | Out-Null
  Copy-Item (Join-Path $Pack 'claude-memory\*.md') $NotesDir
  Say ('      ' + ((Get-ChildItem $NotesDir -Filter *.md | Measure-Object).Count) + ' notes in ' + $NotesDir)
}

# ---------------------------------------------------------------- 6. the agent side
Step 'The agent side (agent UI, Pi wrapper, Pi command line) - needed by the end-to-end test'
# The agent side comes in one of two forms beside this script, in the folder agent-side\:
#   *.bundle  whole git repositories (the local carry pack), or
#   *.tgz     the source files only, no history (the download from GitHub).
# When neither is there, the files are asked from the GitHub release once; no answer is not an error.
$agentDir = Join-Path $Pack 'agent-side'
$agentRepos = @(@{ name = 'habait-agent-ui'; target = $UiRoot; probe = 'bridge\src\server.mjs' }, @{ name = 'pi-habait-wrapper'; target = $WrapperRoot; probe = 'install-global.py' })
function Test-AgentFiles([string]$ext) { return -not ($agentRepos | Where-Object { -not (Test-Path (Join-Path $agentDir ($_.name + $ext))) }) }
$agentDone = $false
if ($SkipAgentSide) { Say '      skipped on request' }
else {
  if (-not (Test-AgentFiles '.bundle') -and -not (Test-AgentFiles '.tgz') -and $AgentSideUrl) {
    try {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $zip = Join-Path $env:TEMP 'habait-agent-side.zip'
      Invoke-WebRequest -UseBasicParsing -Uri $AgentSideUrl -OutFile $zip
      New-Item -ItemType Directory -Force $agentDir | Out-Null
      Expand-Archive -Path $zip -DestinationPath $agentDir -Force
      Say '      the agent-side files were downloaded from GitHub'
    } catch { }
  }
  if (Test-AgentFiles '.bundle') {
    foreach ($repo in $agentRepos) {
      $parent = Split-Path -Parent $repo.target
      if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Force $parent | Out-Null }
      [void](Restore-Bundle (Join-Path $agentDir ($repo.name + '.bundle')) $repo.target 'engine-mcp')
      $exclude = Join-Path $repo.target '.git\info\exclude'
      if (-not (Select-String -Path $exclude -Pattern '^\.wt/$' -Quiet -ErrorAction SilentlyContinue)) { Add-Content -Path $exclude -Value '.wt/' -Encoding ascii }
      $w = Join-Path $repo.target '.wt\engine-mcp'
      if (-not (Test-Path (Join-Path $w '.git'))) {
        New-Item -ItemType Directory -Force (Join-Path $repo.target '.wt') | Out-Null
        & git -C $repo.target worktree add --quiet $w engine-mcp
        if ($LASTEXITCODE -ne 0) { Stop-Restore ('git worktree add in ' + $repo.target + ' failed') }
      }
      Say ('      ' + $repo.target + ' with its working folder .wt\engine-mcp')
    }
    $agentDone = $true
  }
  elseif (Test-AgentFiles '.tgz') {
    foreach ($repo in $agentRepos) {
      $w = Join-Path $repo.target '.wt\engine-mcp'
      if (Test-Path (Join-Path $w $repo.probe)) { Say ('      already there: ' + $w); continue }
      if ((Test-Path $w) -and (Get-ChildItem -Force $w | Select-Object -First 1)) { Stop-Restore ($w + ' exists and holds other files. Move it away (do not delete it) and start again') }
      New-Item -ItemType Directory -Force $w | Out-Null
      & (Join-Path $env:SystemRoot 'System32\tar.exe') -xzf (Join-Path $agentDir ($repo.name + '.tgz')) -C $w
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $w $repo.probe))) { Stop-Restore ('unpacking ' + $repo.name + '.tgz into ' + $w + ' failed') }
      Say ('      ' + $w + ' (source files, no git history)')
    }
    $agentDone = $true
  }
  else { Note 'the agent-side files are not beside this script and were not found on GitHub: the end-to-end test (npm run test:e2e) cannot run on this computer yet' }
}
if ($agentDone) {
  $app = Join-Path $UiRoot '.wt\engine-mcp\app'
  if (-not (Test-Path (Join-Path $app 'node_modules\vite\bin\vite.js'))) {
    Say '      installing the agent UI libraries (npm ci, needs the internet)'
    Push-Location $app
    & cmd /c 'npm ci --no-audit --no-fund >nul 2>&1'
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) { Note ('npm ci failed in ' + $app + ': run it there by hand before the end-to-end test') }
  }
  if (-not $SkipGlobalPi) {
    $pi = Join-Path $env:APPDATA 'npm\node_modules\@earendil-works\pi-coding-agent\package.json'
    if (-not (Test-Path $pi)) {
      Say '      installing the Pi command line 1.5.2 (npm, needs the internet)'
      & cmd /c 'npm install -g @earendil-works/pi-coding-agent@1.5.2 --no-audit --no-fund >nul 2>&1'
      if (-not (Test-Path $pi)) { Note 'the Pi command line was not installed: run "npm install -g @earendil-works/pi-coding-agent@1.5.2" before the end-to-end test' }
    }
    if (Test-Path $pi) { Say '      Pi command line installed' }
  }
}

# ---------------------------------------------------------------- 7. the engine's environment
Step 'The engine environment and its readiness check (a few minutes, needs the internet)'
$verdicts = @()
foreach ($home3d in (Join-Path $Wt 'Projects\3Dengine'), (Join-Path $Root 'Projects\3Dengine')) {
  Push-Location $home3d
  Say ('      ' + $home3d)
  & node engine/cli.mjs setup-env --go | Out-Null
  $setup = $LASTEXITCODE
  $doctor = & node engine/cli.mjs doctor
  Pop-Location
  $last = ($doctor | Select-Object -Last 1 | Out-String).Trim()
  foreach ($line in $doctor) { if ($line -notmatch '^ok\s') { Say ('        ' + $line) } }
  if ($setup -ne 0) { Note ('setup-env did not finish in ' + $home3d + ' (run "node engine/cli.mjs setup-env --go" there to see why)') }
  $verdicts += $last
}

Write-Host ''
Write-Host '================ RESULT ================'
Write-Host ('engine working folder: ' + $verdicts[0])
Write-Host ('engine live home:      ' + $verdicts[1])
foreach ($n in $script:Notes) { Write-Host ('NOTE: ' + $n) -ForegroundColor Yellow }
$allReady = -not ($verdicts | Where-Object { $_ -ne 'READY' })
if ($allReady) {
  Write-Host 'DONE - the computer is ready.' -ForegroundColor Green
  Write-Host ('Open Claude Code in ' + $Root + ' and write: continue from where you stopped')
  exit 0
}
if (-not ($verdicts | Where-Object { $_ -notmatch '^READY' })) {
  Write-Host 'ALMOST DONE - only the keys are missing.' -ForegroundColor Yellow
  Write-Host ('Copy the keys file from the first computer into ' + $Root + ' (README-HE.md, step 2), then start RESTORE.cmd again.')
  exit 2
}
Write-Host 'NOT READY - the lines above say what is missing. Fix it and start RESTORE.cmd again, or open Claude Code in this folder and ask it to finish the restore.' -ForegroundColor Red
exit 1
