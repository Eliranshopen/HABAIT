# subagent-context.ps1 - SubagentStart hook (no matcher: every sub-agent) for root CLAUDE.md section 0.2 rule 1.
# Authored 2026-11-04 (OWED-003, plan development/plans/2026-11-04-owed-cleanup.md, worker D). Installed only by
# Eliran's paste of docs/OWNER-PASTE.md section b into .claude/settings.local.json.
#
# What it does, and nothing more: at spawn it prints the sub-agent's BOUNDED read-first slice into the sub-agent's
# context - memory/HOT.md (<= 60 lines by rule), then the LAST ~150 lines of memory/agents/<name>.md plus its
# archive-index block (when the file has one above that tail). It never reads memory/INDEX.md and never a whole layer.
# <name> = the spawn's agent_type (plugin prefix dropped); orchestrator -> orchestrator-lessons (_MEMORY_PREAMBLE.md).
#
# Contract: Claude Code SubagentStart event on stdin ({agent_id, agent_type, ...}). Output: one JSON object on stdout,
# {"hookSpecificOutput":{"hookEventName":"SubagentStart","additionalContext":"..."}}, ASCII-escaped so the console code
# page cannot garble Hebrew. SubagentStart cannot block. Claude Code caps additionalContext at 10,000 characters, so the
# slice is held under 9,000: the agent slice is built first and held to 4,000 (its tail cut from the oldest end), HOT.md
# gets the rest, cut at a line boundary; every cut is announced with the line range to read from the file.
# FAIL OPEN: any internal error -> exit 0 with no output. Saved as UTF-8 with BOM (Windows PowerShell 5.1); keep ASCII.

$ErrorActionPreference = 'Stop'
$TailLines = 150
$Cap = 9000          # total, under Claude Code's 10,000-char additionalContext cap
$AgentCap = 4000     # the agent's own slice is assembled first and held to this; HOT.md gets the rest

function ConvertTo-AsciiJson([string]$json) {
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $json.ToCharArray()) {
    if ([int]$ch -gt 127) { [void]$sb.AppendFormat('\u{0:x4}', [int]$ch) } else { [void]$sb.Append($ch) }
  }
  return $sb.ToString()
}

try {
  [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
  $raw = [Console]::In.ReadToEnd()
  $evt = $null
  if (-not [string]::IsNullOrWhiteSpace($raw)) { $evt = $raw | ConvertFrom-Json }

  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent      # C:\RnD (hooks live in <root>\.claude\hooks)
  $utf8 = New-Object System.Text.UTF8Encoding $false
  $name = ''
  if ($evt -and $evt.agent_type) { $name = [string]$evt.agent_type }
  if ($name.Contains(':')) { $name = $name.Substring($name.LastIndexOf(':') + 1) }
  $name = $name -replace '[^A-Za-z0-9._-]', ''
  if ($name -eq 'orchestrator') { $name = 'orchestrator-lessons' }

  $intro = '[subagent-context hook] Bounded read-first slice (root CLAUDE.md section 0.2 rule 1), printed at spawn. Never read memory/INDEX.md whole - grep it. Before returning: one memory entry + one INDEX pointer line (section 0.2 rule 2).'

  # Budget: the agent's own slice is built first and capped at $AgentCap; HOT.md gets what is left of $Cap.
  $agentText = ''
  if ($name) {
    $rel = "memory/agents/$name.md"
    $af = Join-Path $root ("memory\agents\" + $name + '.md')
    if (Test-Path -LiteralPath $af) {
      $lines = [IO.File]::ReadAllLines($af, $utf8)
      if ($lines.Count -gt 0) { $lines[0] = $lines[0].TrimStart([char]0xFEFF) }
      $start = [Math]::Max(0, $lines.Count - $TailLines)
      # Archive-index block: a heading naming an archive index, up to the next heading of the same or higher level.
      $arch = ''
      for ($i = 0; $i -lt $start; $i++) {
        $m = [regex]::Match($lines[$i], '^(#+)\s.*archive.?index', 'IgnoreCase')
        if (-not $m.Success) { continue }
        $lvl = $m.Groups[1].Value.Length
        $j = $i + 1
        while ($j -lt $lines.Count) {
          $h = [regex]::Match($lines[$j], '^(#+)\s')
          if ($h.Success -and $h.Groups[1].Value.Length -le $lvl) { break }
          $j++
        }
        $arch = ($lines[$i..([Math]::Min($j, $start) - 1)] -join "`n")
        break
      }
      $tail = $lines[$start..($lines.Count - 1)]
      $head = "===== $rel - lines $($start + 1)-$($lines.Count) of $($lines.Count) (last ~$TailLines) ====="
      $room = $AgentCap - $arch.Length - 300
      $body = ($tail -join "`n")
      if ($body.Length -gt $room -and $room -gt 0) {
        $body = $body.Substring($body.Length - $room)
        $body = $body.Substring([Math]::Max(0, $body.IndexOf("`n") + 1))
        $head += " (cut to its newest $room chars by the 10,000-char hook cap - read the rest of the window from the file)"
      }
      if ($arch) { $agentText += "===== $rel - archive-index block =====`n$arch`n`n" }
      $agentText += "$head`n$body"
    } else {
      $agentText = "$rel`: not on disk yet - on first run create it from memory/_TEMPLATE.md and add its INDEX line (memory/agents/_about.md)."
    }
  } else {
    $agentText = 'agent_type missing from the event - read your own memory/agents/<name>.md tail by hand.'
  }
  # HOT.md gets what the agent slice leaves of the cap; when it does not fit it is cut at a line boundary and the
  # cut names the first line not shown, so the sub-agent reads the rest from the file itself.
  $hotText = 'memory/HOT.md: not on disk.'
  $hot = Join-Path $root 'memory\HOT.md'
  if (Test-Path -LiteralPath $hot) {
    $hl = [IO.File]::ReadAllLines($hot, $utf8)
    if ($hl.Count -gt 0) { $hl[0] = $hl[0].TrimStart([char]0xFEFF) }
    $hroom = $Cap - $intro.Length - $agentText.Length - 400
    $kept = New-Object System.Collections.Generic.List[string]
    $used = 0
    foreach ($l in $hl) { if (($used + $l.Length + 1) -gt $hroom) { break }; $kept.Add($l); $used += $l.Length + 1 }
    $hotText = "===== memory/HOT.md - $($hl.Count) lines =====`n" + ($kept -join "`n")
    if ($kept.Count -lt $hl.Count) {
      $hotText += "`n[subagent-context hook] HOT.md cut after line $($kept.Count) of $($hl.Count) by the 10,000-char hook cap - READ memory/HOT.md lines $($kept.Count + 1)-$($hl.Count) yourself before acting."
    }
  }

  $ctx = $intro + "`n`n" + $hotText + "`n`n" + $agentText
  if ($ctx.Length -gt $Cap) { $ctx = $ctx.Substring(0, $Cap) + "`n[subagent-context hook] cut at $Cap chars." }
  $obj = @{ hookSpecificOutput = @{ hookEventName = 'SubagentStart'; additionalContext = $ctx } }
  $json = ConvertTo-AsciiJson ($obj | ConvertTo-Json -Depth 5 -Compress)
  [Console]::Out.Write($json)
  exit 0
} catch {
  exit 0
}
