#Requires -Version 5.1
<#
.SYNOPSIS
    Syncs all skills from the edwin SKILLS directory to both .claude/SKILLS destinations.

.DESCRIPTION
    Copies all files from each skill subdirectory under SKILLS/ to:
      1. The global Claude Code skills directory (~/.claude/SKILLS)
      2. The local repo .claude/SKILLS directory (<repo-root>/.claude/SKILLS)

    Fully portable — no hardcoded paths. Run on any device after pulling the repo.

.EXAMPLE
    .\Sync-EdwinSkills.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot   = Split-Path $PSScriptRoot -Parent
$SkillsSource = Join-Path $RepoRoot "SKILLS"

$Destinations = @(
    @{ Label = "Global (~/.claude/SKILLS)";    Path = Join-Path (Join-Path $HOME ".claude") "SKILLS" },
    @{ Label = "Local  (repo/.claude/SKILLS)"; Path = Join-Path (Join-Path $RepoRoot ".claude") "SKILLS" }
)

if (-not (Test-Path $SkillsSource)) {
    Write-Error "SKILLS source directory not found: $SkillsSource"
    exit 1
}

$skillDirs = Get-ChildItem -Path $SkillsSource -Directory
if ($skillDirs.Count -eq 0) {
    Write-Warning "No skill directories found in $SkillsSource"
    exit 0
}

$totalCopied = 0

foreach ($dest in $Destinations) {
    Write-Host ""
    Write-Host "==> $($dest.Label)" -ForegroundColor Cyan
    Write-Host "    $($dest.Path)"

    foreach ($skillDir in $skillDirs) {
        $destSkillDir = Join-Path $dest.Path $skillDir.Name

        # Ensure destination skill directory exists
        if (-not (Test-Path $destSkillDir)) {
            New-Item -ItemType Directory -Path $destSkillDir -Force | Out-Null
        }

        # Copy all files recursively from the skill directory
        $files = Get-ChildItem -Path $skillDir.FullName -Recurse -File
        foreach ($file in $files) {
            $relativePath = $file.FullName.Substring($skillDir.FullName.Length).TrimStart('\', '/')
            $destFile = Join-Path $destSkillDir $relativePath

            # Ensure subdirectory exists (for nested files)
            $destFileDir = Split-Path $destFile -Parent
            if (-not (Test-Path $destFileDir)) {
                New-Item -ItemType Directory -Path $destFileDir -Force | Out-Null
            }

            Copy-Item -Path $file.FullName -Destination $destFile -Force
            Write-Host "    [+] $($skillDir.Name)/$relativePath" -ForegroundColor Green
            $totalCopied++
        }
    }
}

Write-Host ""
Write-Host "Done. $totalCopied file(s) copied across $($Destinations.Count) destination(s)." -ForegroundColor Yellow
