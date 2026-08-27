#!/usr/bin/env pwsh

<#
.SYNOPSIS
Manages scheduled tasks via Task Scheduler on Windows.

.DESCRIPTION
Creates scheduled tasks under EDWIN\ namespace, reads prompts from files to avoid quoting issues.

.PARAMETER Name
Human-readable task name

.PARAMETER Schedule
Schedule expression (e.g., "DAILY", "WEEKLY", "ONCE")

.PARAMETER Time
Time to run (e.g., "08:00")

.PARAMETER Days
Days of week for WEEKLY schedule (e.g., "MON,TUE,WED,THU,FRI")

.PARAMETER PromptFile
Path to file containing the prompt (relative to repo root or absolute)

.PARAMETER LogFile
Path to log file (relative to repo root or absolute)

.PARAMETER List
List all EDWIN scheduled tasks

.PARAMETER Remove
Remove a scheduled task by ID

.PARAMETER DryRun
Print what would be done without doing it

.PARAMETER Help
Show this help

.EXAMPLE
./register-task.ps1 -Name "morning-brief" -Schedule "DAILY" -Time "08:00" -PromptFile "user/schedule-prompts/task.txt" -LogFile "user/schedule-logs/task.log"

.EXAMPLE
./register-task.ps1 -List

.EXAMPLE
./register-task.ps1 -Remove "edwin-1640000000-morning-brief"

.NOTES
Exit codes:
  0 - Success
  1 - Expected failure (task not found, schtasks failed)
  2 - Bad usage
#>

[CmdletBinding()]
param(
    [string]$Name,
    [string]$Schedule,
    [string]$Time,
    [string]$Days,
    [string]$PromptFile,
    [string]$LogFile,
    [switch]$List,
    [string]$Remove,
    [switch]$DryRun,
    [switch]$Help
)

# Headless claude invocation - SINGLE SOURCE OF TRUTH for scheduled task commands
# If claude flags change, update this constant only.
$CLAUDE_HEADLESS_CMD = 'claude -p "$(Get-Content %PROMPT_FILE% -Raw)" --output-format text --permission-mode dontAsk'

# Resolve script directory and repo root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$TaskNamespace = "EDWIN"

# Help
if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

# List mode
if ($List) {
    Write-Output "EDWIN scheduled tasks:"
    try {
        $tasks = schtasks /Query /FO CSV /V | ConvertFrom-Csv | Where-Object { $_."TaskName" -like "\$TaskNamespace\*" }
        if ($tasks) {
            foreach ($task in $tasks) {
                $taskName = $task."TaskName"
                $status = $task."Status"
                Write-Output "  $taskName ($status)"
            }
        } else {
            Write-Output "  (none)"
        }
    } catch {
        Write-Output "  (none)"
    }
    exit 0
}

# Remove mode
if ($Remove) {
    $taskName = "\$TaskNamespace\$Remove"

    # Check if task exists
    try {
        $exists = schtasks /Query /TN $taskName 2>$null
        if (-not $exists) {
            Write-Error "Task not found: $Remove"
            exit 1
        }
    } catch {
        Write-Error "Task not found: $Remove"
        exit 1
    }

    if ($DryRun) {
        Write-Output "Dry run - would remove:"
        Write-Output "  schtasks /Delete /TN $taskName /F"

        # Also clean up prompt and log files
        $promptFile = Join-Path $RepoRoot "user\schedule-prompts\$Remove.txt"
        $logFile = Join-Path $RepoRoot "user\schedule-logs\$Remove.log"
        if (Test-Path $promptFile) {
            Write-Output "  Remove-Item $promptFile"
        }
        if (Test-Path $logFile) {
            Write-Output "  Remove-Item $logFile"
        }
        exit 0
    }

    # Delete the task
    schtasks /Delete /TN $taskName /F | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to delete task"
        exit 1
    }

    # Clean up prompt and log files
    $promptFile = Join-Path $RepoRoot "user\schedule-prompts\$Remove.txt"
    $logFile = Join-Path $RepoRoot "user\schedule-logs\$Remove.log"
    if (Test-Path $promptFile) {
        Remove-Item $promptFile -Force
    }
    if (Test-Path $logFile) {
        Remove-Item $logFile -Force
    }

    Write-Output "Removed task: $Remove"
    exit 0
}

# Create mode - validate required args
if (-not $Name) {
    Write-Error "-Name is required"
    exit 2
}

if (-not $Schedule) {
    Write-Error "-Schedule is required"
    exit 2
}

if (-not $PromptFile) {
    Write-Error "-PromptFile is required"
    exit 2
}

if (-not $LogFile) {
    Write-Error "-LogFile is required"
    exit 2
}

# Resolve paths to absolute
if (-not [System.IO.Path]::IsPathRooted($PromptFile)) {
    $PromptFile = Join-Path $RepoRoot $PromptFile
}

if (-not [System.IO.Path]::IsPathRooted($LogFile)) {
    $LogFile = Join-Path $RepoRoot $LogFile
}

# Ensure prompt file exists
if (-not (Test-Path $PromptFile)) {
    Write-Error "Prompt file not found: $PromptFile"
    exit 1
}

# Ensure log directory exists
$LogDir = Split-Path -Parent $LogFile
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Generate task ID from name and timestamp
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$sanitizedName = $Name.ToLower() -replace '[^a-z0-9]', '-'
$taskId = "edwin-$timestamp-$sanitizedName"
$taskName = "\$TaskNamespace\$taskId"

# Build the command with the prompt file substituted
# For Windows, we create a wrapper batch file to handle the prompt file reading and output redirection
$wrapperFile = Join-Path $RepoRoot "user\schedule-prompts\$taskId.cmd"
$cmd = $CLAUDE_HEADLESS_CMD -replace '%PROMPT_FILE%', $PromptFile

# Create wrapper batch file that redirects output to log
$wrapperContent = @"
@echo off
echo [%date% %time%] Task started >> "$LogFile"
$cmd >> "$LogFile" 2>&1
echo [%date% %time%] Task completed >> "$LogFile"
"@

if ($DryRun) {
    Write-Output "Dry run - would create:"
    Write-Output "  Task name: $taskName"
    Write-Output "  Schedule: $Schedule"
    Write-Output "  Time: $Time"
    Write-Output "  Command: $cmd"
    Write-Output ""
    Write-Output "Wrapper file: $wrapperFile"
    Write-Output $wrapperContent
    exit 0
}

# Ensure the namespace folder exists by creating a parent task if needed
try {
    schtasks /Query /TN "\$TaskNamespace" 2>$null | Out-Null
} catch {
    # Create the namespace folder - we do this by creating and then deleting a dummy task
    schtasks /Create /TN "\$TaskNamespace\dummy" /TR "cmd.exe /c echo" /SC ONCE /ST "23:59" /F | Out-Null
    schtasks /Delete /TN "\$TaskNamespace\dummy" /F 2>$null | Out-Null
}

# Write wrapper batch file
$wrapperContent | Out-File -FilePath $wrapperFile -Encoding ASCII -Force

# Build schtasks command
$schtasksArgs = @(
    "/Create"
    "/TN", $taskName
    "/TR", $wrapperFile
    "/SC", $Schedule.ToUpper()
)

if ($Time) {
    $schtasksArgs += @("/ST", $Time)
}

if ($Days) {
    if ($Schedule -eq "WEEKLY") {
        $schtasksArgs += @("/D", $Days.ToUpper())
    } else {
        Write-Error "Days parameter (-Days) is only valid with -Schedule WEEKLY. Cannot honor days '$Days' with schedule '$Schedule'."
        exit 1
    }
}

$schtasksArgs += @("/F")  # Force overwrite if exists

# Create the scheduled task
& schtasks $schtasksArgs | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create scheduled task"
    exit 1
}

Write-Output "Task registered: $taskId"
Write-Output "TASK_ID=$taskId"
Write-Output "TASK_NAME=$taskName"

exit 0
