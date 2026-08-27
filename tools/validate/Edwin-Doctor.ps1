#!/usr/bin/env pwsh
<#
.SYNOPSIS
    EDWIN structure validator (PowerShell wrapper)

.DESCRIPTION
    Thin wrapper that invokes Node.js-based edwin-doctor.mjs when available.
    Falls back to a pure-PowerShell frontmatter-only check when Node is absent.

.PARAMETER Skill
    Path to a single skill to validate (directory or SKILL.md file)

.PARAMETER Json
    Output JSON to stdout

.PARAMETER Quiet
    Show errors only

.PARAMETER Root
    Use alternate repo root (for testing)

.PARAMETER Help
    Show help message

.EXAMPLE
    .\Edwin-Doctor.ps1
    Validate entire repo

.EXAMPLE
    .\Edwin-Doctor.ps1 -Skill core/skills/analyst
    Validate single skill
#>

param(
    [string]$Skill,
    [switch]$Json,
    [switch]$Quiet,
    [string]$Root,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# Determine repo root
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

if ($Root) {
    $RepoRoot = $Root
} else {
    $RepoRoot = Resolve-Path (Join-Path $ScriptDir "../..")
}

# Check if Node is available
$nodeAvailable = $false
try {
    $nodeVersion = & node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $nodeAvailable = $true
    }
} catch {
    $nodeAvailable = $false
}

# If Node available, delegate to the Node script
if ($nodeAvailable) {
    $doctorScript = Join-Path $ScriptDir "edwin-doctor.mjs"

    $args = @()
    if ($Skill) { $args += @("--skill", $Skill) }
    if ($Json) { $args += "--json" }
    if ($Quiet) { $args += "--quiet" }
    if ($Root) { $args += @("--root", $Root) }
    if ($Help) { $args += "--help" }

    & node $doctorScript @args
    exit $LASTEXITCODE
}

# Node not available - fall back to PowerShell-only frontmatter check
Write-Host "⚠ Node.js not found - running reduced PowerShell-only validation" -ForegroundColor Yellow
Write-Host "  Install Node.js 18+ for full validation coverage" -ForegroundColor Yellow
Write-Host ""

if ($Help) {
    Write-Host "Edwin-Doctor (PowerShell fallback mode)"
    Write-Host ""
    Write-Host "This is a reduced-coverage fallback when Node.js is not available."
    Write-Host "It checks only skill frontmatter presence and basic structure."
    Write-Host ""
    Write-Host "Install Node.js 18 or higher for full validation."
    exit 0
}

# PowerShell-only frontmatter check
$errors = 0
$warnings = 0

function Test-SkillFrontmatter {
    param([string]$SkillPath)

    $content = Get-Content -Path $SkillPath -Raw -ErrorAction SilentlyContinue
    if (-not $content) {
        Write-Host "  ✗ Skill file not readable: $SkillPath" -ForegroundColor Red
        return $false
    }

    # Check for frontmatter fences
    if ($content -notmatch '(?s)^---\r?\n(.+?)\r?\n---') {
        Write-Host "  ✗ Missing frontmatter: $SkillPath" -ForegroundColor Red
        return $false
    }

    $frontmatter = $Matches[1]

    # Check required keys (basic substring search)
    $requiredKeys = @('name:', 'description:', 'contexts:', 'version:', 'requires:', 'author:')
    $missing = @()

    foreach ($key in $requiredKeys) {
        if ($frontmatter -notmatch $key) {
            $missing += $key.TrimEnd(':')
        }
    }

    if ($missing.Count -gt 0) {
        Write-Host "  ✗ Missing frontmatter keys in $SkillPath : $($missing -join ', ')" -ForegroundColor Red
        return $false
    }

    Write-Host "  ✓ $SkillPath" -ForegroundColor Green
    return $true
}

# Find skills
$skillsDir = Join-Path $RepoRoot "core/skills"
if (-not (Test-Path $skillsDir)) {
    Write-Host "✗ Skills directory not found: $skillsDir" -ForegroundColor Red
    exit 1
}

if ($Skill) {
    # Validate single skill
    $skillPath = $Skill
    if ($skillPath.EndsWith("SKILL.md")) {
        $skillPath = Split-Path -Parent $skillPath
    }

    $skillFile = Join-Path $skillPath "SKILL.md"
    if (-not (Test-Path $skillFile)) {
        Write-Host "✗ Skill file not found: $skillFile" -ForegroundColor Red
        exit 1
    }

    Write-Host "Checking skill: $skillPath"
    $result = Test-SkillFrontmatter -SkillPath $skillFile
    if (-not $result) { $errors++ }
} else {
    # Validate all skills
    Write-Host "Checking all skills in: $skillsDir"
    $skillDirs = Get-ChildItem -Path $skillsDir -Directory

    foreach ($dir in $skillDirs) {
        $skillFile = Join-Path $dir.FullName "SKILL.md"
        if (Test-Path $skillFile) {
            $result = Test-SkillFrontmatter -SkillPath $skillFile
            if (-not $result) { $errors++ }
        } else {
            Write-Host "  ⚠ No SKILL.md in: $($dir.Name)" -ForegroundColor Yellow
            $warnings++
        }
    }
}

Write-Host ""
if ($errors -eq 0) {
    Write-Host "✓ Frontmatter checks passed (limited coverage)" -ForegroundColor Green
    Write-Host "  Install Node.js for full validation" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "✗ $errors error(s), $warnings warning(s)" -ForegroundColor Red
    Write-Host "  Install Node.js for full validation" -ForegroundColor Yellow
    exit 1
}
