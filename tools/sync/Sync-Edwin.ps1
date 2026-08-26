#Requires -Version 5.1

<#
.SYNOPSIS
    EDWIN sync engine (PowerShell port).

.DESCRIPTION
    Feature-reduced PowerShell implementation of the EDWIN sync engine.
    Supports: skills copy, CLAUDE.md composition with managed markers.
    Does not support: manifest tracking, pruning, legacy cleanup, --uninstall.

.PARAMETER Target
    Target harness: code, desktop, or all (default: all).

.PARAMETER DryRun
    Show what would be done without making changes.

.PARAMETER Force
    Overwrite existing files without checking.

.PARAMETER WhatIf
    Same as -DryRun (standard PowerShell convention).

.EXAMPLE
    .\Sync-Edwin.ps1

.EXAMPLE
    .\Sync-Edwin.ps1 -DryRun

.EXAMPLE
    .\Sync-Edwin.ps1 -Target code -Force
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter()]
    [ValidateSet('code', 'desktop', 'all')]
    [string]$Target = 'all',

    [Parameter()]
    [switch]$DryRun,

    [Parameter()]
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Feature notice
Write-Host @"
EDWIN PowerShell Sync Engine (feature-reduced)

Supports:
  ✓ Skills copy
  ✓ CLAUDE.md composition with managed markers

Not supported (use Node version for these):
  ✗ Manifest tracking and pruning
  ✗ Legacy SKILLS/ cleanup
  ✗ --uninstall mode
  ✗ --json output

"@ -ForegroundColor Cyan

if ($DryRun -or $WhatIf) {
    Write-Host "Dry run mode — no changes will be made.`n" -ForegroundColor Yellow
}

# Resolve paths
$RepoRoot = Join-Path $PSScriptRoot '..' '..' | Resolve-Path
$CoreDir = Join-Path $RepoRoot 'core'
$PersonaDir = Join-Path $CoreDir 'persona'
$SkillsDir = Join-Path $CoreDir 'skills'
$TemplatesDir = Join-Path $CoreDir 'templates'
$TemplatePath = Join-Path $TemplatesDir 'CLAUDE.md.tmpl'
$VersionPath = Join-Path $CoreDir 'VERSION'
$ContextsPath = Join-Path $CoreDir 'contexts' 'contexts.json'
$UserDir = Join-Path $RepoRoot 'user'
$ConfigPath = Join-Path $UserDir 'config.json'
$StatePath = Join-Path $UserDir 'state.json'

$ClaudeRoot = Join-Path $env:USERPROFILE '.claude'
$SkillsTarget = Join-Path $ClaudeRoot 'skills'
$ClaudeMdTarget = Join-Path $ClaudeRoot 'CLAUDE.md'

# Check if target exists
if (-not (Test-Path $ClaudeRoot)) {
    Write-Error "Claude directory not found at: $ClaudeRoot"
    exit 1
}

Write-Host "Target: $ClaudeRoot`n" -ForegroundColor Green

# Read persona files
function Get-PersonaBody {
    $files = @(
        (Join-Path $PersonaDir 'identity.md'),
        (Join-Path $PersonaDir 'operating-rules.md'),
        (Join-Path $PersonaDir 'harness-detection.md')
    )

    # Add hooks
    $hooksDir = Join-Path $PersonaDir 'hooks'
    if (Test-Path $hooksDir) {
        $hookFiles = Get-ChildItem -Path $hooksDir -Filter '*.md' | Sort-Object Name
        $files += $hookFiles.FullName
    }

    $content = @()
    foreach ($file in $files) {
        if (Test-Path $file) {
            $content += (Get-Content -Path $file -Raw).Trim()
        }
    }

    return ($content -join "`n`n---`n`n")
}

# Read skill frontmatter (simplified YAML parser)
function Get-SkillFrontmatter {
    param([string]$SkillPath)

    if (-not (Test-Path $SkillPath)) {
        return $null
    }

    $lines = Get-Content -Path $SkillPath
    if ($lines[0] -ne '---') {
        return $null
    }

    $endIdx = -1
    for ($i = 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -eq '---') {
            $endIdx = $i
            break
        }
    }

    if ($endIdx -eq -1) {
        return $null
    }

    $frontmatter = @{}
    for ($i = 1; $i -lt $endIdx; $i++) {
        if ($lines[$i] -match '^([a-z-]+):\s*(.+)$') {
            $key = $Matches[1]
            $value = $Matches[2].Trim()

            if ($value -eq 'all') {
                $frontmatter[$key] = 'all'
            }
            elseif ($value -match '^\[(.+)\]$') {
                # Flow sequence
                $frontmatter[$key] = $Matches[1] -split ',' | ForEach-Object { $_.Trim() }
            }
            else {
                $frontmatter[$key] = $value
            }
        }
    }

    return $frontmatter
}

# Build skill index
function Get-SkillIndex {
    $skills = @()
    $needsMigration = @()

    $skillDirs = Get-ChildItem -Path $SkillsDir -Directory

    foreach ($dir in $skillDirs) {
        $skillPath = Join-Path $dir.FullName 'SKILL.md'
        if (-not (Test-Path $skillPath)) {
            continue
        }

        $frontmatter = Get-SkillFrontmatter -SkillPath $skillPath

        if (-not $frontmatter) {
            $needsMigration += $dir.Name
            $skills += @{
                name        = $dir.Name
                description = "[Migration needed: $($dir.Name)]"
                contexts    = 'all'
                type        = $null
            }
            continue
        }

        $skills += @{
            name        = if ($frontmatter['name']) { $frontmatter['name'] } else { $dir.Name }
            description = if ($frontmatter['description']) { $frontmatter['description'] } else { '' }
            contexts    = if ($frontmatter['contexts']) { $frontmatter['contexts'] } else { 'all' }
            type        = if ($frontmatter['type']) { $frontmatter['type'] } else { $null }
        }
    }

    return @{
        Skills          = $skills
        NeedsMigration  = $needsMigration
    }
}

# Group skills by context
function Get-GroupedSkills {
    param(
        [array]$Skills,
        [string]$ActiveContext
    )

    # Load contexts
    $contextNames = @('Global')
    if (Test-Path $ContextsPath) {
        $contextsData = Get-Content -Path $ContextsPath -Raw | ConvertFrom-Json
        $contextNames = $contextsData.contexts | ForEach-Object { $_.name }
    }

    $groups = @{}
    foreach ($ctx in $contextNames) {
        $groups[$ctx] = @()
    }
    $groups['Always available'] = @()
    $groups['Personas'] = @()

    # Sort skills
    foreach ($skill in $Skills) {
        if ($skill.type -eq 'persona') {
            $groups['Personas'] += $skill
            continue
        }

        if ($skill.contexts -eq 'all') {
            $groups['Always available'] += $skill
            continue
        }

        $skillContexts = if ($skill.contexts -is [array]) { $skill.contexts } else { @($skill.contexts) }

        foreach ($ctx in $skillContexts) {
            if ($groups.ContainsKey($ctx)) {
                $groups[$ctx] += $skill
            }
        }
    }

    # Order groups
    $orderedGroups = @()

    if ($ActiveContext -and $groups.ContainsKey($ActiveContext)) {
        $orderedGroups += @{ Name = $ActiveContext; Skills = $groups[$ActiveContext] }
    }

    foreach ($ctx in $contextNames) {
        if ($ctx -ne $ActiveContext -and $groups[$ctx].Count -gt 0) {
            $orderedGroups += @{ Name = $ctx; Skills = $groups[$ctx] }
        }
    }

    if ($groups['Always available'].Count -gt 0) {
        $orderedGroups += @{ Name = 'Always available'; Skills = $groups['Always available'] }
    }

    if ($groups['Personas'].Count -gt 0) {
        $orderedGroups += @{ Name = 'Personas'; Skills = $groups['Personas'] }
    }

    return $orderedGroups
}

# Format skill index
function Format-SkillIndex {
    param([array]$Groups)

    $lines = @()

    foreach ($group in $Groups) {
        $lines += "### $($group.Name)"
        $lines += ""

        foreach ($skill in $group.Skills) {
            $lines += "**$($skill.name)** — $($skill.description)"
            $lines += ""
        }
    }

    return ($lines -join "`n")
}

# Compose CLAUDE.md
function Get-ComposedCLAUDEMd {
    # Read template
    $template = Get-Content -Path $TemplatePath -Raw

    # Strip header comment
    $template = $template -replace '(?s)\{\{!--.*?--\}\}', ''
    $template = $template.Trim()

    # Get persona body
    $personaBody = Get-PersonaBody

    # Build skill index
    $skillData = Get-SkillIndex
    $skills = $skillData.Skills
    $needsMigration = $skillData.NeedsMigration

    # Get active context
    $activeContext = 'Global'
    $addressAs = ''

    if (Test-Path $StatePath) {
        $state = Get-Content -Path $StatePath -Raw | ConvertFrom-Json
        $activeContext = if ($state.activeContext) { $state.activeContext } else { 'Global' }
    }

    if (Test-Path $ConfigPath) {
        $config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
        $addressAs = if ($config.addressAs) { $config.addressAs } else { '' }
    }

    $groups = Get-GroupedSkills -Skills $skills -ActiveContext $activeContext
    $skillIndex = Format-SkillIndex -Groups $groups

    # Get version
    $version = (Get-Content -Path $VersionPath -Raw).Trim()

    # Timestamp
    $lastSync = (Get-Date).ToUniversalTime().ToString('o')

    # Substitute tokens
    $composed = $template `
        -replace '\{\{PERSONA_BODY\}\}', $personaBody `
        -replace '\{\{SKILL_INDEX\}\}', $skillIndex `
        -replace '\{\{ACTIVE_CONTEXT\}\}', $activeContext `
        -replace '\{\{FRAMEWORK_VERSION\}\}', $version `
        -replace '\{\{LAST_SYNC\}\}', $lastSync

    # Handle ADDRESS_AS
    if (-not $addressAs) {
        $composed = ($composed -split "`n" | Where-Object { $_ -notmatch '\{\{ADDRESS_AS\}\}' }) -join "`n"
    }
    else {
        $composed = $composed -replace '\{\{ADDRESS_AS\}\}', $addressAs
    }

    return @{
        Composed        = $composed
        NeedsMigration  = $needsMigration
    }
}

# Inject composed content with managed markers
function Set-CLAUDEMdWithMarkers {
    param(
        [string]$TargetPath,
        [string]$ComposedContent
    )

    $beginMarker = '<!-- EDWIN:BEGIN -->'
    $endMarker = '<!-- EDWIN:END -->'
    $memoryBegin = '<!-- EDWIN:MEMORY:BEGIN -->'
    $memoryEnd = '<!-- EDWIN:MEMORY:END -->'
    $contextBegin = '<!-- EDWIN:CONTEXT:BEGIN -->'
    $contextEnd = '<!-- EDWIN:CONTEXT:END -->'

    $existingMemory = ''
    $existingContext = ''

    if (Test-Path $TargetPath) {
        $existing = Get-Content -Path $TargetPath -Raw

        # Preserve MEMORY and CONTEXT sections
        if ($existing -match "(?s)$memoryBegin(.*?)$memoryEnd") {
            $existingMemory = $Matches[1].Trim()
        }
        if ($existing -match "(?s)$contextBegin(.*?)$contextEnd") {
            $existingContext = $Matches[1].Trim()
        }

        # Check for markers
        $hasMarkers = ($existing -match [regex]::Escape($beginMarker)) -and ($existing -match [regex]::Escape($endMarker))

        if ($hasMarkers) {
            # Replace between markers
            $beforeMarker = $existing.Substring(0, $existing.IndexOf($beginMarker))
            $afterMarkerIdx = $existing.IndexOf($endMarker) + $endMarker.Length
            $afterMarker = $existing.Substring($afterMarkerIdx)

            # Restore preserved sections
            $finalComposed = $ComposedContent
            if ($existingMemory) {
                $finalComposed = $finalComposed -replace "$memoryBegin\s*$memoryEnd", "$memoryBegin`n$existingMemory`n$memoryEnd"
            }
            if ($existingContext) {
                $finalComposed = $finalComposed -replace "$contextBegin\s*$contextEnd", "$contextBegin`n$existingContext`n$contextEnd"
            }

            return "$beforeMarker$beginMarker`n$finalComposed`n$endMarker$afterMarker"
        }
        else {
            # Append markers
            return "$existing`n`n$beginMarker`n$ComposedContent`n$endMarker`n"
        }
    }
    else {
        # New file or --Force
        return "$beginMarker`n$ComposedContent`n$endMarker`n"
    }
}

# Copy directory recursively
function Copy-DirectoryRecursive {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path $Destination)) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    }

    $items = Get-ChildItem -Path $Source -Recurse

    foreach ($item in $items) {
        $target = Join-Path $Destination $item.FullName.Substring($Source.Length)

        if ($item.PSIsContainer) {
            if (-not (Test-Path $target)) {
                New-Item -ItemType Directory -Path $target -Force | Out-Null
            }
        }
        else {
            Copy-Item -Path $item.FullName -Destination $target -Force
        }
    }
}

# Main sync
Write-Host "Composing CLAUDE.md..." -ForegroundColor Cyan
$composedData = Get-ComposedCLAUDEMd
$composed = $composedData.Composed
$needsMigration = $composedData.NeedsMigration

Write-Host "Injecting into target..." -ForegroundColor Cyan
$injected = Set-CLAUDEMdWithMarkers -TargetPath $ClaudeMdTarget -ComposedContent $composed

$changed = $true
if (Test-Path $ClaudeMdTarget) {
    $existing = Get-Content -Path $ClaudeMdTarget -Raw
    $changed = $existing -ne $injected
}

if ($changed) {
    if (-not $DryRun -and -not $WhatIf) {
        Set-Content -Path $ClaudeMdTarget -Value $injected -NoNewline
        Write-Host "✓ CLAUDE.md updated ($($injected.Length) bytes)" -ForegroundColor Green
    }
    else {
        Write-Host "[DRY RUN] Would update CLAUDE.md ($($injected.Length) bytes)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "✓ CLAUDE.md unchanged" -ForegroundColor Green
}

# Copy skills
Write-Host "`nCopying skills..." -ForegroundColor Cyan
$skillDirs = Get-ChildItem -Path $SkillsDir -Directory
$copied = 0

foreach ($dir in $skillDirs) {
    $destDir = Join-Path $SkillsTarget $dir.Name

    if (-not $DryRun -and -not $WhatIf) {
        Copy-DirectoryRecursive -Source $dir.FullName -Destination $destDir
        $copied++
    }
    else {
        Write-Host "[DRY RUN] Would copy: $($dir.Name)" -ForegroundColor Yellow
        $copied++
    }
}

Write-Host "✓ $copied skill(s) copied" -ForegroundColor Green

if ($needsMigration.Count -gt 0) {
    Write-Host "`n⚠️  $($needsMigration.Count) skill(s) need frontmatter migration:" -ForegroundColor Yellow
    foreach ($skill in $needsMigration) {
        Write-Host "  - $skill" -ForegroundColor Yellow
    }
}

if (-not $DryRun -and -not $WhatIf) {
    Write-Host "`n✓ Done. Restart Claude to load the changes." -ForegroundColor Green
}
else {
    Write-Host "`nDry run complete — no changes made." -ForegroundColor Yellow
}
