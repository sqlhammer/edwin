#Requires -Version 5.1

<#
.SYNOPSIS
    Installs EDWIN on Windows.

.DESCRIPTION
    Checks prerequisites, installing Git and Node.js if they are missing, clones or updates
    the EDWIN repository, and runs the sync engine.

    This script replaced a batch implementation. Batch was the wrong tool: cmd.exe mis-parses
    nested `if (...) else (...)` blocks and reports nothing when it does -- it skips the inner
    lines and carries on, or aborts the shell with a message that flashes past as the window
    closes. Three separate Windows failures were traced to that, none of which any check on a
    Mac could see. PowerShell 5.1 ships with every supported Windows, has real control flow
    and exceptions, and -- the deciding factor -- can be parsed and executed on the
    maintainer's machine, so this file is covered by the test suite rather than by review.

.PARAMETER RepoUrl
    Repository to install from. Defaults to the URL in package.json when this script is run
    from inside a clone, and is prompted for otherwise. Accepts a full URL, `owner/repo`
    shorthand, or a file:// path.

.PARAMETER Branch
    Branch to clone. Defaults to the repository's default branch. Use this when the version you
    want is not the default -- cloning the default branch of a repository whose framework lives
    elsewhere produces a complete clone of the wrong thing, which reads as a corrupt download.

.PARAMETER InstallDir
    Where to install. Defaults to <user profile>\edwin.

.PARAMETER Yes
    Answer yes to every confirmation. Required for unattended runs.

.PARAMETER SkipDeps
    Report missing Git or Node.js instead of installing them.

.PARAMETER NoPause
    Accepted for compatibility. Pausing is the launcher's job (EDWIN-Install.cmd), so that a
    failure to start PowerShell at all still leaves the window open.

.EXAMPLE
    .\EDWIN-Install.ps1

.EXAMPLE
    .\EDWIN-Install.ps1 -RepoUrl owner/edwin -Yes

.EXAMPLE
    .\EDWIN-Install.ps1 -Branch v0.2

.EXAMPLE
    .\EDWIN-Install.ps1 -SkipDeps
#>

[CmdletBinding()]
param(
    [string]$RepoUrl,

    [string]$Branch,

    [string]$InstallDir,

    [Alias('y')]
    [switch]$Yes,

    [switch]$SkipDeps,

    [switch]$NoPause,

    [Alias('h')]
    [switch]$Help,

    # Legacy `--flag` spellings arrive here rather than failing parameter binding, so the
    # documented CLI keeps working and an actual typo still produces a usage error.
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:MinNodeVersion = 18
$script:HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }

# The log is deliberately NOT inside the install directory. `git clone` refuses a destination
# that exists and is not empty, so writing the log there before cloning made the installer
# create the obstacle it then tripped over -- no fresh install could succeed. A copy is placed
# in the install directory once the clone has happened.
$script:LogFile = Join-Path ([System.IO.Path]::GetTempPath()) 'edwin-install.log'

function Get-UsageText {
    @'
EDWIN-Install.ps1 -- install EDWIN on Windows

Usage:
  EDWIN-Install.cmd [options]              (double-click, or from cmd)
  .\EDWIN-Install.ps1 [options]            (from PowerShell)

Options:
  -RepoUrl <url>     Repository to install from (otherwise read from package.json or prompted)
  -Branch <name>     Branch to clone (default: the repository's default branch)
  -InstallDir <dir>  Where to install (default: <user profile>\edwin)
  -Yes               Answer yes to every confirmation; required for unattended runs
  -SkipDeps          Report missing Git or Node.js instead of installing them
  -NoPause           Do not wait for a keypress before closing
  -Help              Show this help

The --repo-url, --branch, --install-dir, --yes, --skip-deps, --no-pause and --help spellings
are also accepted.

Missing prerequisites are installed for you. Git and Node.js come from winget when it is
available; otherwise they are downloaded from their official sources and installed silently.
Nothing is downloaded through a web browser.
'@
}

# ============================================================================
# Legacy argument folding
# ============================================================================

# Translates `--repo-url X` style arguments into the parameters above. Returns the updated
# values rather than mutating, so this is a pure function the test suite can drive directly.
function Merge-LegacyArguments {
    param(
        [string[]]$Arguments,
        [hashtable]$Bound
    )

    $result = @{
        RepoUrl    = $Bound.RepoUrl
        Branch     = $Bound.Branch
        InstallDir = $Bound.InstallDir
        Yes        = $Bound.Yes
        SkipDeps   = $Bound.SkipDeps
        NoPause    = $Bound.NoPause
        Help       = $Bound.Help
        Unknown    = $null
    }

    if (-not $Arguments) { return $result }

    for ($i = 0; $i -lt $Arguments.Count; $i++) {
        $arg = $Arguments[$i]
        switch -Regex ($arg) {
            '^--repo-url$' {
                if ($i + 1 -ge $Arguments.Count -or -not $Arguments[$i + 1]) {
                    $result.Unknown = '--repo-url requires a URL'
                    return $result
                }
                $result.RepoUrl = $Arguments[$i + 1]
                $i++
            }
            '^--branch$' {
                if ($i + 1 -ge $Arguments.Count -or -not $Arguments[$i + 1]) {
                    $result.Unknown = '--branch requires a branch name'
                    return $result
                }
                $result.Branch = $Arguments[$i + 1]
                $i++
            }
            '^--install-dir$' {
                if ($i + 1 -ge $Arguments.Count -or -not $Arguments[$i + 1]) {
                    $result.Unknown = '--install-dir requires a path'
                    return $result
                }
                $result.InstallDir = $Arguments[$i + 1]
                $i++
            }
            '^--yes$'       { $result.Yes = $true }
            '^--skip-deps$' { $result.SkipDeps = $true }
            '^--no-pause$'  { $result.NoPause = $true }
            '^--help$'      { $result.Help = $true }
            default {
                $result.Unknown = "unknown option: $arg"
                return $result
            }
        }
    }

    return $result
}

# ============================================================================
# Logging
# ============================================================================

$script:LogWritable = $false

# Writing to the log must never be able to fail the install, and above all must never fail
# inside the error handler: the first version of this script lost a real error message because
# Add-Content threw while trying to report it. TEMP is normally guaranteed, but "normally" is
# not a guarantee -- a redirected TEMP that does not exist is enough to hit this.
function Initialize-Log {
    try {
        $dir = Split-Path -Parent $script:LogFile
        if ($dir -and -not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        Add-Content -Path $script:LogFile -Value ''
        $script:LogWritable = $true
    }
    catch {
        $script:LogWritable = $false
        Write-Host "Note: cannot write the log at $script:LogFile ($($_.Exception.Message))." -ForegroundColor Yellow
        Write-Host 'Continuing without a log file.' -ForegroundColor Yellow
    }
}

function Add-LogLine {
    param([string[]]$Lines)
    if (-not $script:LogWritable) { return }
    try {
        Add-Content -Path $script:LogFile -Value $Lines
    }
    catch {
        $script:LogWritable = $false
    }
}

function Write-Log {
    param([string]$Message)
    Add-LogLine "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Write-Host $Message
}

function Write-LogError {
    param([string]$Message)
    Add-LogLine "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: $Message"
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

# A step marker, log only -- the console stays clean. If this ever dies without a message,
# the last STEP line in the log names where it got to, which is the difference between a
# diagnosis and another blind test cycle on someone else's machine.
function Write-Step {
    param([string]$Name)
    Add-LogLine "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] STEP: $Name"
}

function Write-Banner {
    param([string]$Title)
    Write-Host ''
    Write-Host '========================================================================'
    Write-Host "  $Title"
    Write-Host '========================================================================'
    Write-Host ''
}

# ============================================================================
# Native command wrapper
# ============================================================================

# Runs an external command, logs its output, and returns the exit code. Native stderr under
# $ErrorActionPreference = 'Stop' turns into a NativeCommandError on Windows PowerShell 5.1,
# which would abort on tools that merely chat to stderr, so it is relaxed for the call itself.
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

    if ($output) {
        Add-LogLine @($output | ForEach-Object { "    $_" })
        if (-not $Quiet) {
            foreach ($line in @($output)) { Write-Host "  $line" }
        }
    }

    return [pscustomobject]@{
        ExitCode = if ($null -eq $code) { 0 } else { $code }
        Output   = @($output) -join "`n"
    }
}

function Test-Command {
    param([Parameter(Mandatory)][string]$Name)
    return [bool](Get-Command -Name $Name -CommandType Application -ErrorAction SilentlyContinue)
}

# ============================================================================
# Consent
# ============================================================================

# Without a console there is nobody to ask, and an unattended run must not consent to
# software installation by accident. Redirected input is the case the batch version had to
# detect through `choice` returning 255; here it is a direct question.
function Confirm-Action {
    param([Parameter(Mandatory)][string]$Question)

    if ($Yes) {
        Write-Host "$Question [Y/n] y  (-Yes)"
        return $true
    }

    if ([Console]::IsInputRedirected -or -not [Environment]::UserInteractive) {
        Write-Log "No console available to ask: `"$Question`""
        return $false
    }

    $answer = Read-Host "$Question [Y/n]"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $true }
    return $answer.Trim() -match '^(y|yes)$'
}

# ============================================================================
# Prerequisites
# ============================================================================

# Installed Node major version, or 0 when node is absent or unreadable.
function Get-NodeMajor {
    if (-not (Test-Command 'node')) { return 0 }

    $result = Invoke-Native -Exe 'node' -Arguments @('-v') -Quiet
    if ($result.ExitCode -ne 0) { return 0 }

    if ($result.Output -match '^\s*v?(\d+)\.') { return [int]$Matches[1] }
    return 0
}

# winget ships with Windows 10 1809+ and Windows 11, but it can also exist as a broken App
# Execution Alias, so being on PATH is not enough -- it has to actually answer.
function Test-Winget {
    if (-not (Test-Command 'winget')) { return $false }
    $result = Invoke-Native -Exe 'winget' -Arguments @('--version') -Quiet
    return $result.ExitCode -eq 0
}

# A freshly installed tool is not on this process's PATH: the environment block was captured
# at startup and neither winget nor an MSI can change it retroactively. Appending the known
# install locations is more reliable than re-reading the registry, whose Path holds
# unexpanded %SystemRoot%-style entries that break when copied verbatim.
function Update-ToolPath {
    $candidates = @(
        (Join-Path $env:ProgramFiles 'nodejs'),
        (Join-Path $env:LOCALAPPDATA 'Programs\nodejs'),
        (Join-Path $env:ProgramFiles 'Git\cmd'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd')
    )
    foreach ($dir in $candidates) {
        if ($dir -and (Test-Path $dir) -and ($env:PATH -notlike "*$dir*")) {
            $env:PATH = "$env:PATH;$dir"
        }
    }
}

# Newest Node release carrying an LTS codename. index.tab is whitespace-separated with lts in
# column 10 ("-" when the release is not an LTS), so this needs no JSON parser -- which
# matters when the reason we are here is that there is no node to parse JSON with.
function Get-LatestNodeLts {
    $tab = Invoke-WebRequest -Uri 'https://nodejs.org/dist/index.tab' -UseBasicParsing -TimeoutSec 60
    $lines = ($tab.Content -split "`n") | Select-Object -Skip 1
    foreach ($line in $lines) {
        $fields = $line -split "`t"
        if ($fields.Count -ge 10 -and $fields[9].Trim() -ne '-' -and $fields[9].Trim() -ne '') {
            return $fields[0].Trim()
        }
    }
    return $null
}

function Install-NodeFromMsi {
    $version = Get-LatestNodeLts
    if (-not $version) {
        throw 'Could not determine the current Node.js LTS version from nodejs.org'
    }

    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $msi = "node-$version-$arch.msi"
    $base = "https://nodejs.org/dist/$version"
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("edwin-node-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    try {
        Write-Log "Downloading $msi..."
        $msiPath = Join-Path $tempDir $msi
        Invoke-WebRequest -Uri "$base/$msi" -OutFile $msiPath -UseBasicParsing -TimeoutSec 900

        # This installer is about to run elevated, so check it against Node's published
        # checksum first. A truncated or substituted download must not be installed. The guard
        # is only worth having because it has been made to fire: corrupt the file and this
        # refuses. Get-FileHash replaces parsing certutil's spaced-out digest by hand.
        Write-Log 'Verifying checksum...'
        $sums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -UseBasicParsing -TimeoutSec 120).Content
        $expected = $null
        foreach ($line in ($sums -split "`n")) {
            $parts = $line.Trim() -split '\s+'
            if ($parts.Count -ge 2 -and $parts[1] -eq $msi) { $expected = $parts[0].ToLower() }
        }
        if (-not $expected) {
            throw "No published checksum for $msi -- refusing to install it"
        }

        $actual = (Get-FileHash -Path $msiPath -Algorithm SHA256).Hash.ToLower()
        if ($actual -ne $expected) {
            throw "Checksum mismatch for $msi -- refusing to install it"
        }

        Write-Log "Checksum verified. Installing $msi..."
        $result = Invoke-Native -Exe 'msiexec.exe' -Arguments @('/i', $msiPath, '/qn', '/norestart')
        if ($result.ExitCode -ne 0) {
            throw "msiexec failed for $msi (exit code $($result.ExitCode))"
        }
    }
    finally {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# The current Git for Windows tag. The releases API is tried first because it is a documented
# contract; unauthenticated calls are rate limited per IP, so the /releases/latest redirect is
# kept as a fallback. Both give the tag without needing a JSON parser on the batch side, which
# is what the old implementation had to work around.
function Get-GitForWindowsTag {
    try {
        $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/git-for-windows/git/releases/latest' -UseBasicParsing -TimeoutSec 60
        if ($release.tag_name) { return $release.tag_name }
    }
    catch {
        Write-Log "GitHub API unavailable ($($_.Exception.Message)); falling back to the release redirect"
    }

    $response = Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/latest' -UseBasicParsing -TimeoutSec 60 -MaximumRedirection 5
    $final = $null
    if ($response.BaseResponse.PSObject.Properties['ResponseUri']) {
        $final = $response.BaseResponse.ResponseUri.AbsoluteUri          # Windows PowerShell 5.1
    }
    elseif ($response.BaseResponse.PSObject.Properties['RequestMessage']) {
        $final = $response.BaseResponse.RequestMessage.RequestUri.AbsoluteUri   # PowerShell 7
    }

    if ($final -match '/releases/tag/(.+)$') { return $Matches[1] }
    return $null
}

function Install-GitForWindows {
    $tag = Get-GitForWindowsTag
    if (-not $tag) {
        throw 'Could not determine the current Git for Windows release'
    }

    # Git for Windows names its tag v<ver>.windows.<n> and its asset Git-<ver>.<n>, so the
    # asset version is the tag with ".windows." collapsed to ".".
    $version = $tag.TrimStart('v').Replace('.windows.', '.')
    $asset = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { "Git-$version-arm64.exe" } else { "Git-$version-64-bit.exe" }
    $url = "https://github.com/git-for-windows/git/releases/download/$tag/$asset"

    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("edwin-git-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    try {
        Write-Log "Downloading $asset..."
        $exePath = Join-Path $tempDir $asset
        Invoke-WebRequest -Uri $url -OutFile $exePath -UseBasicParsing -TimeoutSec 900

        Write-Log "Installing $asset..."
        $result = Invoke-Native -Exe $exePath -Arguments @(
            '/VERYSILENT', '/NORESTART', '/NOCANCEL', '/SP-', '/SUPPRESSMSGBOXES', '/CLOSEAPPLICATIONS'
        )
        if ($result.ExitCode -ne 0) {
            throw "The Git installer failed (exit code $($result.ExitCode))"
        }
    }
    finally {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Install-GitPrerequisite {
    Write-Step 'prereq-git-install'
    Write-Banner 'Git is not installed'
    Write-Host 'EDWIN needs Git to download and update its files. I can install it.'
    Write-Host ''

    if ($SkipDeps) {
        throw 'Git is not installed (run without -SkipDeps to install it)'
    }

    if (-not (Confirm-Action 'Install Git now?')) {
        Write-Host ''
        Write-Host 'Nothing installed. Install Git yourself and run this installer again,'
        Write-Host 'or re-run with -Yes to install it without being asked.'
        Write-Host ''
        throw 'Git is not installed and installation was declined'
    }

    if (Test-Winget) {
        Write-Log 'Installing Git with winget...'
        $result = Invoke-Native -Exe 'winget' -Arguments @(
            'install', '--exact', '--id', 'Git.Git', '--source', 'winget', '--silent',
            '--accept-package-agreements', '--accept-source-agreements'
        )
        if ($result.ExitCode -ne 0) {
            Write-Log 'winget machine-scope install failed; retrying in user scope...'
            $result = Invoke-Native -Exe 'winget' -Arguments @(
                'install', '--exact', '--id', 'Git.Git', '--source', 'winget', '--scope', 'user',
                '--silent', '--accept-package-agreements', '--accept-source-agreements'
            )
        }
        if ($result.ExitCode -ne 0) {
            Write-Log 'winget could not install Git; falling back to the official release...'
            Install-GitForWindows
        }
    }
    else {
        Write-Log 'winget is unavailable; installing Git from its official release...'
        Install-GitForWindows
    }

    Update-ToolPath

    if (-not (Test-Command 'git')) {
        Write-Host ''
        Write-Host "Git still isn't available after the install attempt."
        Write-Host 'If it did install, close this window and run the installer again --'
        Write-Host 'a new window picks up the updated PATH.'
        Write-Host ''
        throw 'Git installation did not produce a working git'
    }

    Write-Log 'Git installed'
}

function Install-NodePrerequisite {
    param([int]$Current)

    Write-Step 'prereq-node-install'
    if ($Current -eq 0) {
        Write-Banner 'Node.js is not installed'
    }
    else {
        Write-Banner 'Node.js is too old'
    }
    Write-Host "EDWIN needs Node.js $script:MinNodeVersion or higher. I can install it."
    Write-Host ''

    if ($SkipDeps) {
        throw "Node.js $script:MinNodeVersion or higher is required (run without -SkipDeps to install it)"
    }

    if (-not (Confirm-Action 'Install Node.js now?')) {
        Write-Host ''
        Write-Host "Nothing installed. Install Node.js $script:MinNodeVersion or higher yourself and run"
        Write-Host 'this installer again, or re-run with -Yes to install it without being asked.'
        Write-Host ''
        throw 'Node.js is missing or too old and installation was declined'
    }

    if (Test-Winget) {
        Write-Log 'Installing Node.js with winget...'
        $result = Invoke-Native -Exe 'winget' -Arguments @(
            'install', '--exact', '--id', 'OpenJS.NodeJS.LTS', '--source', 'winget', '--silent',
            '--accept-package-agreements', '--accept-source-agreements'
        )
        if ($result.ExitCode -ne 0) {
            Write-Log 'winget install failed; falling back to the official MSI...'
            Install-NodeFromMsi
        }
    }
    else {
        Write-Log 'winget is unavailable; installing Node.js from its official MSI...'
        Install-NodeFromMsi
    }

    Update-ToolPath

    if ((Get-NodeMajor) -lt $script:MinNodeVersion) {
        Write-Host ''
        Write-Host "Node.js still isn't usable after the install attempt."
        Write-Host 'If it did install, close this window and run the installer again --'
        Write-Host 'a new window picks up the updated PATH.'
        Write-Host ''
        throw 'Node.js installation did not produce a usable node'
    }

    Write-Log 'Node.js installed'
}

function Test-Prerequisites {
    Write-Log 'Checking prerequisites...'
    Write-Step 'prereq-start'

    if (Test-Command 'git') {
        $version = (Invoke-Native -Exe 'git' -Arguments @('--version') -Quiet).Output.Trim()
        Write-Log "Found $version"
    }
    else {
        Install-GitPrerequisite
    }

    Write-Step 'prereq-node'
    $nodeMajor = Get-NodeMajor
    if ($nodeMajor -ge $script:MinNodeVersion) {
        $version = (Invoke-Native -Exe 'node' -Arguments @('-v') -Quiet).Output.Trim()
        Write-Log "Found Node.js $version"
    }
    else {
        Install-NodePrerequisite -Current $nodeMajor
    }

    Write-Step 'prereq-claude'
    $claudeDir = Join-Path $script:HomeDir '.claude'
    if (Test-Path $claudeDir) {
        Write-Log "Claude detected at $claudeDir"
    }
    else {
        Write-Banner 'Claude Code or Claude Desktop not detected'
        Write-Host 'EDWIN is a personal assistant framework for Claude.'
        Write-Host ''
        Write-Host "I couldn't find Claude Code or Claude Desktop on this machine."
        Write-Host 'If you have Claude Desktop installed, it should work -- the installer'
        Write-Host "just can't confirm it yet."
        Write-Host ''
        Write-Host 'If you have neither, install Claude Code (the command-line tool)'
        Write-Host 'or Claude Desktop (the app) first.'
        Write-Host ''
        Write-Host 'Download Claude Code: https://code.claude.ai/'
        Write-Host 'Download Claude Desktop: https://claude.ai/download'
        Write-Host ''
        Write-Log "Warning: Claude Code/Desktop not detected at $claudeDir"
        Write-Host 'Continuing installation anyway...'
        Write-Host ''
    }

    Write-Log 'Prerequisites OK'
}

# ============================================================================
# Repository URL
# ============================================================================

# Normalises whatever the user gave us into something `git clone` accepts, or returns $null.
# Must be idempotent: a URL that came back from the prompt is validated again by the caller.
# The batch version tested the .git suffix with `echo %VAR% | findstr "\.git$"`, which can
# never match -- echo emits the space that sits before the pipe -- so every call appended
# another suffix and produced edwin.git.git.git. A regex on a string has no such trap.
function Resolve-RepoUrl {
    param([string]$Value)

    if (-not $Value) { return $null }
    $url = $Value.Trim().Trim('"').Trim()
    if (-not $url) { return $null }

    # A local path is taken exactly as given. file:// is accepted so the clone path can be
    # exercised against a local repository rather than only against the live network.
    if ($url -match '^file://') { return $url }

    if ($url -match '^(https://|http://|ssh://|git@)') {
        if ($url -notmatch '\.git$') { $url = "$url.git" }
        return $url
    }

    # owner/repo shorthand: one slash, nothing exotic either side.
    if ($url -match '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$') {
        $url = "https://github.com/$url"
        if ($url -notmatch '\.git$') { $url = "$url.git" }
        return $url
    }

    return $null
}

# repository.url out of package.json, or $null. PowerShell has a JSON parser, so this is one
# call. The batch version split the line on ":" and got "git+https" for its trouble.
function Get-PackageJsonRepoUrl {
    param([string]$Path)

    if (-not (Test-Path $Path)) { return $null }

    try {
        $package = Get-Content -Path $Path -Raw | ConvertFrom-Json
    }
    catch {
        Write-Log "Could not parse $Path ($($_.Exception.Message)); will ask instead"
        return $null
    }

    $url = $null
    if ($package.PSObject.Properties['repository']) {
        if ($package.repository -is [string]) { $url = $package.repository }
        elseif ($package.repository.PSObject.Properties['url']) { $url = $package.repository.url }
    }

    if (-not $url) { return $null }
    return ($url -replace '^git\+', '')
}

function Read-RepoUrlFromUser {
    Write-Banner 'Repository URL Needed'
    Write-Host 'I need to know which EDWIN repository to install from.'
    Write-Host ''
    Write-Host 'Please enter the GitHub repository URL or owner/repo:'
    Write-Host ''
    Write-Host 'Examples:'
    Write-Host '  https://github.com/username/edwin.git'
    Write-Host '  username/edwin'
    Write-Host ''

    if ([Console]::IsInputRedirected -or -not [Environment]::UserInteractive) {
        Write-Log 'No console available to ask for a repository URL'
        return $null
    }

    $answer = Read-Host 'Repository'
    if (-not $answer) { return $null }

    $resolved = Resolve-RepoUrl -Value $answer
    if (-not $resolved) {
        Write-Host ''
        Write-Host "That doesn't look like a valid repository URL."
        Write-Host ''
    }
    return $resolved
}

function Resolve-RepoUrlOrThrow {
    param([string]$Given, [string]$ScriptDir)

    Write-Step 'repo-resolve-url'

    $candidate = $Given
    if (-not $candidate) {
        # Running from inside a clone: take the remote from package.json.
        $packageJson = Join-Path (Split-Path -Parent (Split-Path -Parent $ScriptDir)) 'package.json'
        $candidate = Get-PackageJsonRepoUrl -Path $packageJson
    }

    if (-not $candidate) {
        Write-Step 'repo-prompt-url'
        $candidate = Read-RepoUrlFromUser
    }

    $resolved = Resolve-RepoUrl -Value $candidate
    if (-not $resolved) {
        if (-not $candidate) {
            Write-Banner 'Repository URL Required'
            Write-Host 'This installer needs to know which repository to clone from.'
            Write-Host ''
            Write-Host 'Please either:'
            Write-Host '  1. Run this installer normally (double-click), or'
            Write-Host '  2. Pass the repository URL as an argument:'
            Write-Host '     EDWIN-Install.cmd -RepoUrl https://github.com/owner/edwin.git'
            Write-Host ''
            throw 'No repository URL provided'
        }
        throw "Invalid repository URL: $candidate"
    }

    return $resolved
}

# ============================================================================
# Repository
# ============================================================================

function Update-ExistingRepository {
    param([string]$Dir)

    Write-Step 'repo-update'
    Write-Log "Found existing repository at $Dir"

    if (-not (Test-Path (Join-Path $Dir 'core'))) {
        Write-Banner "Directory exists but doesn't look like EDWIN"
        Write-Host "The directory $Dir exists but doesn't appear to be"
        Write-Host 'an EDWIN installation (missing core/ directory).'
        Write-Host ''
        Write-Host 'Please either:'
        Write-Host '  1. Remove or rename that directory, or'
        Write-Host '  2. Choose a different installation location'
        Write-Host ''
        throw "Invalid repository at $Dir"
    }

    Write-Log 'Updating repository...'
    Push-Location $Dir
    try {
        $dirty = Invoke-Native -Exe 'git' -Arguments @('diff-index', '--quiet', 'HEAD', '--') -Quiet
        if ($dirty.ExitCode -ne 0) {
            Write-Banner 'Uncommitted changes detected'
            Write-Host 'Your EDWIN installation has uncommitted changes.'
            Write-Host "The installer won't overwrite them."
            Write-Host ''
            Write-Host 'To update, either:'
            Write-Host '  1. Commit or stash your changes manually, or'
            Write-Host '  2. Remove the directory and run the installer again'
            Write-Host ''
            throw "Uncommitted changes in $Dir"
        }

        Write-Step 'repo-pull'
        $pull = Invoke-Native -Exe 'git' -Arguments @('pull', '--ff-only')
        if ($pull.ExitCode -ne 0) {
            Write-LogError 'Failed to update repository'
            Write-Host ''
            Write-Host 'Failed to update the repository. This might happen if:'
            Write-Host '  - Your local changes conflict with updates'
            Write-Host "  - You're not connected to the internet"
            Write-Host ''
            throw 'Git pull failed'
        }
    }
    finally {
        Pop-Location
    }

    Write-Log 'Repository updated successfully'
}

function Install-Repository {
    param([string]$Dir, [string]$Url, [string]$Branch)

    Write-Step 'repo-clone'
    if ($Branch) {
        Write-Log "Cloning repository from $Url (branch $Branch)..."
    }
    else {
        Write-Log "Cloning repository from $Url..."
    }

    $arguments = @('clone')
    if ($Branch) { $arguments += @('--branch', $Branch) }
    $arguments += @($Url, $Dir)

    $clone = Invoke-Native -Exe 'git' -Arguments $arguments
    if ($clone.ExitCode -ne 0) {
        Write-LogError 'Failed to clone repository'
        Write-Host ''
        Write-Host 'Failed to download EDWIN. This might happen if:'
        Write-Host "  - You're not connected to the internet"
        Write-Host '  - The repository URL is incorrect'
        Write-Host "  - You don't have access to the repository"
        if ($Branch) {
            Write-Host "  - The branch $Branch does not exist in that repository"
        }
        Write-Host ''
        Write-Host "Repository URL: $Url"
        if ($Branch) { Write-Host "Branch: $Branch" }
        Write-Host ''
        throw 'Git clone failed'
    }

    Write-Log 'Repository cloned successfully'
}

# Best-effort, for error messages only: naming the branch that was actually checked out is the
# difference between "your download is corrupt" and "you cloned the wrong version".
function Get-CheckedOutBranch {
    param([string]$Dir)
    try {
        $result = Invoke-Native -Exe 'git' -Arguments @('-C', $Dir, 'rev-parse', '--abbrev-ref', 'HEAD') -Quiet
        if ($result.ExitCode -eq 0) { return $result.Output.Trim() }
    }
    catch {
        Write-Verbose "Could not determine the checked-out branch: $($_.Exception.Message)"
    }
    return ''
}

function Initialize-Repository {
    param([string]$Dir, [string]$Given, [string]$ScriptDir, [string]$Branch)

    Write-Log 'Setting up EDWIN repository...'
    Write-Step 'repo-start'

    if (Test-Path (Join-Path $Dir '.git')) {
        Update-ExistingRepository -Dir $Dir
        return
    }

    # git clone refuses a destination that exists and is not empty. -Force counts hidden
    # entries, because git counts those too. An earlier version exempted install.log, which
    # only masked the fact that the installer had just written that log here itself.
    if (Test-Path $Dir) {
        Write-Step 'repo-dir-exists'
        if (@(Get-ChildItem -Path $Dir -Force -ErrorAction SilentlyContinue).Count -gt 0) {
            Write-Banner 'Directory already exists'
            Write-Host "The directory $Dir already exists but is not a"
            Write-Host 'Git repository.'
            Write-Host ''
            Write-Host 'Please remove or rename it before installing EDWIN.'
            Write-Host ''
            throw "Non-git directory exists at $Dir"
        }
    }

    $url = Resolve-RepoUrlOrThrow -Given $Given -ScriptDir $ScriptDir
    Install-Repository -Dir $Dir -Url $url -Branch $Branch
}

# ============================================================================
# Sync engine
# ============================================================================

function Invoke-SyncEngine {
    param([string]$Dir)

    Write-Log 'Running EDWIN sync engine...'
    Write-Step 'sync-start'

    $enginePath = Join-Path (Join-Path (Join-Path $Dir 'tools') 'sync') 'engine.mjs'
    if (-not (Test-Path $enginePath)) {
        # This used to say the download was "incomplete or corrupted", which sent a user hunting
        # for a broken clone that was in fact perfect: the repository's default branch simply
        # held an older layout with no sync engine in it. A complete clone of the wrong version
        # looks identical to a truncated one unless the message says so.
        $branch = Get-CheckedOutBranch -Dir $Dir
        Write-Banner 'This does not look like EDWIN'
        Write-Host 'The clone succeeded, but there is no sync engine in it, so this is not an'
        Write-Host 'EDWIN v0.2 repository.'
        Write-Host ''
        Write-Host "Expected location: $enginePath"
        if ($branch) { Write-Host "Branch cloned:     $branch" }
        Write-Host ''
        Write-Host 'The likely cause is the branch, not a bad download. If the version you want'
        Write-Host "is not the repository's default branch, clone it explicitly:"
        Write-Host ''
        Write-Host '  EDWIN-Install.cmd -Branch <name>'
        Write-Host ''
        Write-Host "Remove $Dir first -- an existing clone is updated, not replaced."
        Write-Host ''
        throw 'No sync engine in the cloned repository'
    }

    Write-Host ''
    Write-Host 'Installing EDWIN skills and persona...'
    Write-Host ''

    # --create-target: the engine refuses a missing ~/.claude by default, which is right for a
    # manual sync but wrong here. Someone running a double-click installer may not have started
    # Claude yet, and failing at the last step would leave them with a clone and nothing else.
    $result = Invoke-Native -Exe 'node' -Arguments @($enginePath, '--target', 'all', '--create-target')
    if ($result.ExitCode -ne 0) {
        Write-LogError 'Sync engine failed'
        Write-Host ''
        Write-Host 'The sync engine encountered an error.'
        Write-Host "Check the log file for details: $script:LogFile"
        Write-Host ''
        throw 'Sync engine failed'
    }

    Write-Log 'Sync engine completed successfully'
}

# ============================================================================
# Main
# ============================================================================

$merged = Merge-LegacyArguments -Arguments $Rest -Bound @{
    RepoUrl    = $RepoUrl
    Branch     = $Branch
    InstallDir = $InstallDir
    Yes        = [bool]$Yes
    SkipDeps   = [bool]$SkipDeps
    NoPause    = [bool]$NoPause
    Help       = [bool]$Help
}

if ($merged.Unknown) {
    Write-Host "Error: $($merged.Unknown)" -ForegroundColor Red
    Write-Host ''
    Write-Host (Get-UsageText)
    exit 2
}

if ($merged.Help) {
    Write-Host (Get-UsageText)
    exit 0
}

$RepoUrl = $merged.RepoUrl
$Branch = $merged.Branch
$Yes = [bool]$merged.Yes
$SkipDeps = [bool]$merged.SkipDeps
$installDir = if ($merged.InstallDir) { $merged.InstallDir } else { Join-Path $script:HomeDir 'edwin' }

Initialize-Log

try {
    Write-Host '========================================================================'
    Write-Host '  EDWIN Installer'
    Write-Host '========================================================================'
    Write-Host ''
    Write-Host 'This will install EDWIN on your machine.'
    Write-Host ''
    Write-Host "Installation directory: $installDir"
    if ($Branch) { Write-Host "Branch: $Branch" }
    Write-Host "Log file: $script:LogFile"
    Write-Host ''

    Add-LogLine @(
        '========================================',
        'EDWIN Installation Started',
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')]",
        '========================================'
    )

    Test-Prerequisites
    Initialize-Repository -Dir $installDir -Given $RepoUrl -ScriptDir $PSScriptRoot -Branch $Branch
    Invoke-SyncEngine -Dir $installDir

    Write-Banner 'Installation Complete!'
    Write-Host 'EDWIN has been installed successfully.'
    Write-Host ''
    Write-Host 'Next step:'
    Write-Host '  1. Open Claude (Desktop or Code)'
    Write-Host '  2. Say: set up EDWIN'
    Write-Host ''
    Write-Host 'That will complete the initial configuration.'
    Write-Host ''

    Add-LogLine @(
        'Installation completed successfully',
        '========================================'
    )

    # The log lived outside the install directory so it could not block the clone. Put a copy
    # where the documentation says to look. Best-effort: a failed copy must not fail a good
    # install.
    if (Test-Path $installDir) {
        try {
            Copy-Item -Path $script:LogFile -Destination (Join-Path $installDir 'install.log') -Force
            Write-Host "Install log: $(Join-Path $installDir 'install.log')"
            Write-Host ''
        }
        catch {
            Write-Verbose "Could not copy the log into $installDir : $($_.Exception.Message)"
        }
    }

    exit 0
}
catch {
    # Every failure path lands here, including ones nobody anticipated. That is the whole
    # reason this is not a batch file: a `throw` cannot be silently skipped, and an unexpected
    # error cannot walk past its own handler.
    Write-LogError $_.Exception.Message
    Write-Host ''
    Write-Host 'Installation failed. Check the log file for details:' -ForegroundColor Red
    Write-Host "  $script:LogFile"
    Write-Host ''
    exit 1
}
