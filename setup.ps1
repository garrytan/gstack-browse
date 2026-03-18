#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$GstackDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillsDir = Split-Path -Parent $GstackDir
$HomeDir = [Environment]::GetFolderPath('UserProfile')
$CodexHomeDir = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HomeDir '.codex' }

function Get-BrowseBinaryPath {
  $distDir = Join-Path $GstackDir 'browse/dist'
  $candidates = @(
    (Join-Path $distDir 'browse'),
    (Join-Path $distDir 'browse.exe')
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }
  return $candidates[0]
}

function Test-CommandAvailable {
  param([string]$CommandName)
  return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Ensure-BunInstalled {
  if (-not (Test-CommandAvailable 'bun')) {
    throw 'gstack setup failed: bun is not installed or not in PATH'
  }
}

function Ensure-PlaywrightBrowser {
  $playwrightDir = Join-Path $env:LOCALAPPDATA 'ms-playwright'
  if (-not (Test-Path -LiteralPath $playwrightDir)) {
    return $false
  }

  $headlessShell = Get-ChildItem -LiteralPath $playwrightDir -Directory -Filter 'chromium_headless_shell-*' -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'chrome-headless-shell-win64\chrome-headless-shell.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1

  return $null -ne $headlessShell
}

function Needs-Build {
  param([string]$BrowseBinary)

  if (-not (Test-Path -LiteralPath $BrowseBinary)) {
    return $true
  }

  $browseMtime = (Get-Item -LiteralPath $BrowseBinary).LastWriteTimeUtc
  $watchRoots = @(
    (Join-Path $GstackDir 'browse/src'),
    (Join-Path $GstackDir 'package.json'),
    (Join-Path $GstackDir 'bun.lock')
  )

  foreach ($path in $watchRoots) {
    if (-not (Test-Path -LiteralPath $path)) {
      continue
    }
    $item = Get-Item -LiteralPath $path
    if ($item.PSIsContainer) {
      $newer = Get-ChildItem -LiteralPath $path -File -Recurse | Where-Object { $_.LastWriteTimeUtc -gt $browseMtime } | Select-Object -First 1
      if ($newer) { return $true }
    } elseif ($item.LastWriteTimeUtc -gt $browseMtime) {
      return $true
    }
  }

  return $false
}

function Ensure-CompatLink {
  param(
    [string]$Target,
    [string]$Source,
    [string]$Label
  )

  if (Test-Path -LiteralPath $Target) {
    $item = Get-Item -LiteralPath $Target -Force
    if (-not $item.Attributes.ToString().Contains('ReparsePoint')) {
      Write-Host "  skipped $Label`: $Target exists and is not a symlink"
      return
    }
    Remove-Item -LiteralPath $Target -Force -Recurse
  }

  $parent = Split-Path -Parent $Target
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }

  try {
    New-Item -ItemType SymbolicLink -Path $Target -Target $Source -Force | Out-Null
    Write-Host "  linked $Label`: $Target -> $Source (symlink)"
  } catch {
    try {
      New-Item -ItemType Junction -Path $Target -Target $Source -Force | Out-Null
      Write-Host "  linked $Label`: $Target -> $Source (junction)"
    } catch {
      Write-Host "  skipped $Label`: failed to link at $Target ($($_.Exception.Message))"
    }
  }
}

Ensure-BunInstalled
$BrowseBinary = Get-BrowseBinaryPath

# 1. Build browse binary if needed
if (Needs-Build -BrowseBinary $BrowseBinary) {
  Write-Host 'Building browse binary...'
  Push-Location $GstackDir
  try {
    & bun install
    if ($LASTEXITCODE -ne 0) { throw 'bun install failed' }
    & bun run build
    if ($LASTEXITCODE -ne 0) { throw 'bun run build failed' }
  } finally {
    Pop-Location
  }
}

$BrowseBinary = Get-BrowseBinaryPath
if (-not (Test-Path -LiteralPath $BrowseBinary)) {
  throw "gstack setup failed: browse binary missing at $BrowseBinary"
}

# 2. Ensure Playwright Chromium is available
if (-not (Ensure-PlaywrightBrowser)) {
  Write-Host 'Installing Playwright Chromium...'
  Push-Location $GstackDir
  try {
    & bunx playwright install chromium chromium-headless-shell
    if ($LASTEXITCODE -ne 0) { throw 'playwright install failed' }
  } finally {
    Pop-Location
  }
}

if (-not (Ensure-PlaywrightBrowser)) {
  throw 'gstack setup failed: Playwright Chromium could not be launched'
}

# 3. Ensure ~/.gstack global state directory exists
New-Item -ItemType Directory -Path (Join-Path $HomeDir '.gstack/projects') -Force | Out-Null

# 4. Only create skill symlinks if we're inside a */skills directory
if ((Split-Path -Leaf $SkillsDir) -eq 'skills') {
  $linked = New-Object System.Collections.Generic.List[string]
  Get-ChildItem -LiteralPath $GstackDir -Directory | ForEach-Object {
    $skillDir = $_.FullName
    $skillName = $_.Name
    if ($skillName -eq 'node_modules') { return }
    if (-not (Test-Path -LiteralPath (Join-Path $skillDir 'SKILL.md'))) { return }

    $target = Join-Path $SkillsDir $skillName
    if (Test-Path -LiteralPath $target) {
      $item = Get-Item -LiteralPath $target -Force
      if (-not $item.Attributes.ToString().Contains('ReparsePoint')) {
        return
      }
      Remove-Item -LiteralPath $target -Force
    }

    $targetRel = Join-Path 'gstack' $skillName
    $targetAbs = Join-Path $GstackDir $skillName
    try {
      New-Item -ItemType SymbolicLink -Path $target -Target $targetRel -Force | Out-Null
      $linked.Add($skillName) | Out-Null
    } catch {
      try {
        New-Item -ItemType Junction -Path $target -Target $targetAbs -Force | Out-Null
        $linked.Add($skillName) | Out-Null
      } catch {
        # Skip when link creation is unavailable.
      }
    }
  }

  Write-Host 'gstack ready.'
  Write-Host "  browse: $BrowseBinary"
  if ($linked.Count -gt 0) {
    Write-Host ("  linked skills: " + ($linked -join ' '))
  }
} else {
  Write-Host 'gstack ready.'
  Write-Host "  browse: $BrowseBinary"
  Write-Host '  (skipped skill symlinks — not inside .claude/skills/)'
}

# 5. Claude/Codex cross-runtime compatibility shims
$codexSkillsDir = Join-Path $CodexHomeDir 'skills'
$claudeSkillsDir = Join-Path $HomeDir '.claude/skills'
if ($SkillsDir -eq $codexSkillsDir) {
  Ensure-CompatLink -Target (Join-Path $claudeSkillsDir 'gstack') -Source $GstackDir -Label 'claude-compat'
} elseif ($SkillsDir -eq $claudeSkillsDir) {
  Ensure-CompatLink -Target (Join-Path $codexSkillsDir 'gstack') -Source $GstackDir -Label 'codex-compat'
}

# 6. First-time welcome + legacy cleanup
$gstackRoot = Join-Path $HomeDir '.gstack'
if (-not (Test-Path -LiteralPath $gstackRoot)) {
  New-Item -ItemType Directory -Path $gstackRoot -Force | Out-Null
  Write-Host '  Welcome! Run /gstack-upgrade anytime to stay current.'
}

$tmpMarker = Join-Path $env:TEMP 'gstack-latest-version'
if (Test-Path -LiteralPath $tmpMarker) {
  Remove-Item -LiteralPath $tmpMarker -Force -ErrorAction SilentlyContinue
}
