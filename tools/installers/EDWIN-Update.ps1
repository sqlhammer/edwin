#Requires -Version 5.1

<#
.SYNOPSIS
    Updates an existing EDWIN installation.

.DESCRIPTION
    Fast-forwards the EDWIN repository and re-runs the sync engine. Personal data in user/ is
    preserved: uncommitted changes confined to that directory are expected and survive the
    update, while changes anywhere else stop it.

    PowerShell rather than batch for the reasons given in EDWIN-Install.ps1 -- chiefly that
    cmd.exe mis-parses nested blocks without reporting it, and that this can be executed and
    tested on the maintainer's machine.

.PARAMETER InstallDir
    Where EDWIN is installed. Defaults to <user profile>\edwin.

.PARAMETER NoPause
    Accepted for compatibility. Pausing is the launcher's job (EDWIN-Update.cmd).

.EXAMPLE
    .\EDWIN-Update.ps1

.EXAMPLE
    .\EDWIN-Update.ps1 -InstallDir D:\edwin
#>

[CmdletBinding()]
param(
    [string]$InstallDir,

    [switch]$NoPause,

    [Alias('h')]
    [switch]$Help,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$script:InstallDir = if ($InstallDir) { $InstallDir } else { Join-Path $script:HomeDir 'edwin' }
$script:LogFile = Join-Path $script:InstallDir 'install.log'

$usage = @'
EDWIN-Update.ps1 -- update an existing EDWIN installation

Usage:
  EDWIN-Update.cmd [options]               (double-click, or from cmd)
  .\EDWIN-Update.ps1 [options]             (from PowerShell)

Options:
  -InstallDir <dir>  Where EDWIN is installed (default: <user profile>\edwin)
  -NoPause           Do not wait for a keypress before closing
  -Help              Show this help
'@

foreach ($arg in @($Rest)) {
    if (-not $arg) { continue }
    switch -Regex ($arg) {
        '^--no-pause$' { }
        '^--help$'     { $Help = $true }
        default {
            Write-Host "Error: unknown option: $arg" -ForegroundColor Red
            Write-Host ''
            Write-Host $usage
            exit 2
        }
    }
}

if ($Help) {
    Write-Host $usage
    exit 0
}

function Write-Log {
    param([string]$Message)
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    if (Test-Path (Split-Path -Parent $script:LogFile)) {
        Add-Content -Path $script:LogFile -Value "[$stamp] $Message"
    }
    Write-Host $Message
}

function Write-LogError {
    param([string]$Message)
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    if (Test-Path (Split-Path -Parent $script:LogFile)) {
        Add-Content -Path $script:LogFile -Value "[$stamp] ERROR: $Message"
    }
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

function Write-Step {
    param([string]$Name)
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    if (Test-Path (Split-Path -Parent $script:LogFile)) {
        Add-Content -Path $script:LogFile -Value "[$stamp] STEP: $Name"
    }
}

function Write-Banner {
    param([string]$Title)
    Write-Host ''
    Write-Host '========================================================================'
    Write-Host "  $Title"
    Write-Host '========================================================================'
    Write-Host ''
}

# See EDWIN-Install.ps1: native stderr under $ErrorActionPreference = 'Stop' becomes a
# NativeCommandError on Windows PowerShell 5.1, so it is relaxed around the call itself.
function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$Exe,
        [string[]]$Arguments = @(),
        [switch]$Quiet
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Exe @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    if ($output -and (Test-Path (Split-Path -Parent $script:LogFile))) {
        foreach ($line in @($output)) {
            Add-Content -Path $script:LogFile -Value "    $line"
        }
    }
    if ($output -and -not $Quiet) {
        foreach ($line in @($output)) { Write-Host "  $line" }
    }

    return [pscustomobject]@{
        ExitCode = if ($null -eq $code) { 0 } else { $code }
        Output   = @($output) -join "`n"
    }
}

# Paths reported by git are relative to the repository root and use forward slashes on Windows
# too, so a prefix test on "user/" is exact.
function Get-ChangesOutsideUserDir {
    $result = Invoke-Native -Exe 'git' -Arguments @('diff-index', '--name-only', 'HEAD', '--') -Quiet
    if ($result.ExitCode -ne 0) { return @() }
    return @($result.Output -split "`n" | Where-Object { $_.Trim() -and $_ -notmatch '^user/' })
}

try {
    Write-Host '========================================================================'
    Write-Host '  EDWIN Update'
    Write-Host '========================================================================'
    Write-Host ''

    Write-Step 'check-installed'
    if (-not (Test-Path $script:InstallDir)) {
        Write-Host ''
        Write-Host "EDWIN is not installed at $script:InstallDir"
        Write-Host ''
        Write-Host 'Please run the installer first (EDWIN-Install.cmd).'
        Write-Host ''
        throw "EDWIN not found at $script:InstallDir"
    }

    Add-Content -Path $script:LogFile -Value @(
        '========================================',
        'EDWIN Update Started',
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')]",
        '========================================'
    )

    if (-not (Test-Path (Join-Path $script:InstallDir '.git'))) {
        Write-Host ''
        Write-Host "The directory $script:InstallDir exists but is not a Git repository."
        Write-Host ''
        Write-Host 'Cannot update. Please reinstall EDWIN.'
        Write-Host ''
        throw "Not a git repository: $script:InstallDir"
    }

    if (-not (Test-Path (Join-Path $script:InstallDir 'core'))) {
        Write-Host ''
        Write-Host "The directory $script:InstallDir doesn't appear to be an EDWIN installation."
        Write-Host ''
        Write-Host 'Cannot update. Please reinstall EDWIN.'
        Write-Host ''
        throw "Invalid EDWIN installation at $script:InstallDir"
    }

    Write-Log "Found EDWIN installation at $script:InstallDir"

    Push-Location $script:InstallDir
    try {
        Write-Step 'check-dirty'
        Write-Log 'Checking for uncommitted changes...'

        $dirty = Invoke-Native -Exe 'git' -Arguments @('diff-index', '--quiet', 'HEAD', '--') -Quiet
        if ($dirty.ExitCode -ne 0) {
            # @() around the call, not just inside the function: PowerShell unrolls a
            # single-element array on return, so one changed file comes back as a bare string and
            # `.Count` throws under Set-StrictMode -- which is exactly the case this branch is for.
            $outside = @(Get-ChangesOutsideUserDir)
            if ($outside.Count -gt 0) {
                Write-Banner 'Uncommitted changes detected'
                Write-Host 'You have uncommitted changes outside of user/:'
                Write-Host ''
                foreach ($file in $outside) { Write-Host "  $file" }
                Write-Host ''
                Write-Host "The updater won't overwrite them."
                Write-Host ''
                Write-Host 'To update, either:'
                Write-Host '  1. Commit or stash your changes manually'
                Write-Host '  2. Discard them (if you know what you are doing)'
                Write-Host ''
                throw 'Uncommitted changes detected'
            }
            Write-Log 'Changes are only in user/ directory (preserved)'
        }

        Write-Step 'pull'
        Write-Log 'Pulling latest changes...'
        Write-Host ''
        Write-Host 'Downloading updates...'
        Write-Host ''

        $pull = Invoke-Native -Exe 'git' -Arguments @('pull', '--ff-only')
        if ($pull.ExitCode -ne 0) {
            Write-LogError 'Failed to pull updates'
            Write-Host ''
            Write-Host 'Failed to download updates. This might happen if:'
            Write-Host '  - Your local changes conflict with updates'
            Write-Host "  - You're not connected to the internet"
            Write-Host '  - The branch has diverged from the remote'
            Write-Host ''
            Write-Host "Check the log file for details: $script:LogFile"
            Write-Host ''
            throw 'Git pull failed'
        }

        Write-Log 'Updates pulled successfully'

        if (Test-Path (Join-Path $script:InstallDir 'user')) {
            Write-Log 'Verified user/ directory is intact'
        }
        else {
            Write-Log 'Note: user/ directory does not exist (normal for a fresh install)'
        }

        Write-Step 'sync'
        Write-Log 'Running sync engine...'
        Write-Host ''
        Write-Host 'Syncing EDWIN skills and persona...'
        Write-Host ''

        $enginePath = Join-Path (Join-Path (Join-Path $script:InstallDir 'tools') 'sync') 'engine.mjs'
        if (-not (Test-Path $enginePath)) {
            Write-Host ''
            Write-Host "Sync engine not found at $enginePath"
            Write-Host 'The update may have failed or the repository structure changed.'
            Write-Host ''
            throw 'Sync engine not found'
        }

        $sync = Invoke-Native -Exe 'node' -Arguments @($enginePath, '--target', 'all')
        if ($sync.ExitCode -ne 0) {
            Write-LogError 'Sync engine failed'
            Write-Host ''
            Write-Host 'The sync engine encountered an error.'
            Write-Host "Check the log file for details: $script:LogFile"
            Write-Host ''
            throw 'Sync engine failed'
        }

        Write-Log 'Sync completed successfully'
    }
    finally {
        Pop-Location
    }

    Write-Banner 'Update Complete!'
    Write-Host 'EDWIN has been updated successfully.'
    Write-Host ''
    Write-Host 'Your personal data in the user/ directory has been preserved.'
    Write-Host ''
    Write-Host 'Restart Claude to load the changes.'
    Write-Host ''

    Add-Content -Path $script:LogFile -Value @(
        'Update completed successfully',
        '========================================'
    )

    exit 0
}
catch {
    Write-LogError $_.Exception.Message
    Write-Host ''
    Write-Host 'Update failed. Check the log file for details:' -ForegroundColor Red
    Write-Host "  $script:LogFile"
    Write-Host ''
    exit 1
}
