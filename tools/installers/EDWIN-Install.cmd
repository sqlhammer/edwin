@echo off
setlocal enabledelayedexpansion

REM EDWIN-Install.cmd
REM
REM Double-click Windows installer for EDWIN.
REM Checks prerequisites, clones or updates the repository, and runs the sync engine.

REM ============================================================================
REM Configuration
REM ============================================================================

set "DEFAULT_INSTALL_DIR=%USERPROFILE%\edwin"
set "INSTALL_DIR=%DEFAULT_INSTALL_DIR%"
set "LOG_FILE=%INSTALL_DIR%\install.log"
set "MIN_NODE_VERSION=18"

REM Repository URL can be passed as argument
set "REPO_URL="
if /i "%~1"=="--repo-url" (
    if not "%~2"=="" (
        set "REPO_URL=%~2"
    )
)

REM ============================================================================
REM Helper Functions
REM ============================================================================

REM Note: log file directory is created by :log and :log_error when needed

REM Open URL in default browser
goto :skip_functions

:open_url
start "" "%~1"
goto :eof

:log
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" 2>nul
echo [%date% %time%] %* >> "%LOG_FILE%"
echo %*
goto :eof

:log_error
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" 2>nul
echo [%date% %time%] ERROR: %* >> "%LOG_FILE%"
echo ERROR: %* >&2
goto :eof

:exit_with_error
call :log_error %*
echo.
echo Installation failed. Check the log file for details:
echo   %LOG_FILE%
echo.
pause
exit /b 1

:command_exists
where %1 >nul 2>&1
goto :eof

:validate_repo_url
REM Input: %VALIDATE_INPUT%
REM Output: %VALIDATE_OUTPUT% (empty if invalid)
set "VALIDATE_OUTPUT="

REM Strip quotes if present
set "VALIDATE_INPUT=%VALIDATE_INPUT:"=%"

REM Check if empty
if "%VALIDATE_INPUT%"=="" goto :eof

REM Check if it's owner/repo format (simple check for slash with no other special chars)
echo %VALIDATE_INPUT% | findstr /r "^[a-zA-Z0-9_-][a-zA-Z0-9_-]*/[a-zA-Z0-9_-][a-zA-Z0-9_-]*$" >nul
if not errorlevel 1 (
    set "VALIDATE_OUTPUT=https://github.com/%VALIDATE_INPUT%.git"
    goto :eof
)

REM Check if it's a valid git URL
echo %VALIDATE_INPUT% | findstr /r "^https://.*\.git$" >nul
if not errorlevel 1 (
    set "VALIDATE_OUTPUT=%VALIDATE_INPUT%"
    goto :eof
)

REM Try adding .git if it's https but missing .git
echo %VALIDATE_INPUT% | findstr /r "^https://" >nul
if not errorlevel 1 (
    echo %VALIDATE_INPUT% | findstr "\.git$" >nul
    if errorlevel 1 (
        set "VALIDATE_OUTPUT=%VALIDATE_INPUT%.git"
        goto :eof
    )
)

goto :eof

:prompt_for_repo_url
REM Output: %PROMPT_URL% (empty if invalid or cancelled)
set "PROMPT_URL="

echo.
echo ========================================================================
echo   Repository URL Needed
echo ========================================================================
echo.
echo I need to know which EDWIN repository to install from.
echo.
echo Please enter the GitHub repository URL or owner/repo:
echo.
echo Examples:
echo   https://github.com/username/edwin.git
echo   username/edwin
echo.
set /p "PROMPT_INPUT=Repository: "

if "%PROMPT_INPUT%"=="" goto :eof

set "VALIDATE_INPUT=%PROMPT_INPUT%"
call :validate_repo_url

if not "%VALIDATE_OUTPUT%"=="" (
    set "PROMPT_URL=%VALIDATE_OUTPUT%"
) else (
    echo.
    echo That doesn't look like a valid repository URL.
    echo.
)

goto :eof

:skip_functions

REM ============================================================================
REM Main Installation
REM ============================================================================

cls
echo ========================================================================
echo   EDWIN Installer
echo ========================================================================
echo.
echo This will install EDWIN on your machine.
echo.
echo Installation directory: %INSTALL_DIR%
echo Log file: %LOG_FILE%
echo.

echo ======================================== >> "%LOG_FILE%"
echo EDWIN Installation Started >> "%LOG_FILE%"
echo [%date% %time%] >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"

REM ============================================================================
REM Check Prerequisites
REM ============================================================================

call :log Checking prerequisites...

REM Check for git
call :command_exists git
if errorlevel 1 (
    echo.
    echo ========================================================================
    echo   Git is not installed
    echo ========================================================================
    echo.
    echo EDWIN needs Git to download and update its files.
    echo.
    echo I'll open the Git download page in your browser.
    echo After installing Git, run this installer again.
    echo.
    call :open_url "https://git-scm.com/downloads"
    call :exit_with_error Git is not installed
)

REM Check for Node.js
call :command_exists node
if errorlevel 1 (
    echo.
    echo ========================================================================
    echo   Node.js is not installed
    echo ========================================================================
    echo.
    echo EDWIN needs Node.js to run its installation scripts.
    echo.
    echo I'll open the Node.js download page in your browser.
    echo Download and install the LTS version, then run this installer again.
    echo.
    call :open_url "https://nodejs.org/"
    call :exit_with_error Node.js is not installed
)

REM Check Node.js version
for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_MAJOR=%%a
set NODE_MAJOR=%NODE_MAJOR:~1%

if %NODE_MAJOR% lss %MIN_NODE_VERSION% (
    echo.
    echo ========================================================================
    echo   Node.js version is too old
    echo ========================================================================
    echo.
    for /f %%v in ('node -v') do echo You have Node.js %%v, but EDWIN needs version %MIN_NODE_VERSION% or higher.
    echo.
    echo I'll open the Node.js download page in your browser.
    echo Download and install the latest LTS version, then run this installer again.
    echo.
    call :open_url "https://nodejs.org/"
    call :exit_with_error Node.js version is too old
)

REM Check for Claude Code or Claude Desktop
set "CLAUDE_DIR=%USERPROFILE%\.claude"

if not exist "%CLAUDE_DIR%" (
    echo.
    echo ========================================================================
    echo   Claude Code or Claude Desktop not detected
    echo ========================================================================
    echo.
    echo EDWIN is a personal assistant framework for Claude.
    echo.
    echo I couldn't find Claude Code or Claude Desktop on this machine.
    echo If you have Claude Desktop installed, it should work -- the installer
    echo just can't confirm it yet.
    echo.
    echo If you don't have either, install Claude Code ^(the command-line tool^)
    echo or Claude Desktop ^(the app^) first.
    echo.
    echo Download Claude Code: https://code.claude.ai/
    echo Download Claude Desktop: https://claude.ai/download
    echo.
    call :log Warning: Claude Code/Desktop not detected at %CLAUDE_DIR%
    echo Continuing installation anyway...
    echo.
) else (
    call :log Claude detected at %CLAUDE_DIR%
)

call :log Prerequisites OK

REM ============================================================================
REM Clone or Update Repository
REM ============================================================================

call :log Setting up EDWIN repository...

REM Check if installation directory already exists with .git
if exist "%INSTALL_DIR%\.git\" (
    REM Existing git repository
    call :log Found existing repository at %INSTALL_DIR%

    REM Verify it's actually the EDWIN repository
    if not exist "%INSTALL_DIR%\core\" (
        echo.
        echo ========================================================================
        echo   Directory exists but doesn't look like EDWIN
        echo ========================================================================
        echo.
        echo The directory %INSTALL_DIR% exists but doesn't appear to be
        echo an EDWIN installation ^(missing core/ directory^).
        echo.
        echo Please either:
        echo   1. Remove or rename that directory, or
        echo   2. Choose a different installation location
        echo.
        call :exit_with_error Invalid repository at %INSTALL_DIR%
    )

    REM Update existing repository
    call :log Updating repository...
    cd /d "%INSTALL_DIR%"

    REM Check for uncommitted changes
    git diff-index --quiet HEAD -- 2>nul
    if errorlevel 1 (
        echo.
        echo ========================================================================
        echo   Uncommitted changes detected
        echo ========================================================================
        echo.
        echo Your EDWIN installation has uncommitted changes.
        echo The installer won't overwrite them.
        echo.
        echo To update, either:
        echo   1. Commit or stash your changes manually, or
        echo   2. Remove the directory and run the installer again
        echo.
        call :exit_with_error Uncommitted changes in %INSTALL_DIR%
    )

    REM Pull latest changes
    git pull --ff-only >> "%LOG_FILE%" 2>&1
    if errorlevel 1 (
        call :log_error Failed to update repository
        echo.
        echo Failed to update the repository. This might happen if:
        echo   - Your local changes conflict with updates
        echo   - You're not connected to the internet
        echo.
        echo Check the log file for details: %LOG_FILE%
        echo.
        call :exit_with_error Git pull failed
    )

    call :log Repository updated successfully
) else (
    REM Need to clone
    if exist "%INSTALL_DIR%\" (
        REM Directory exists - check if it's empty or only contains our log file
        set "DIR_HAS_FILES=0"
        for /f %%f in ('dir /b /a-d "%INSTALL_DIR%" 2^>nul ^| findstr /v /i "install.log"') do (
            set "DIR_HAS_FILES=1"
        )
        for /f %%d in ('dir /b /ad "%INSTALL_DIR%" 2^>nul') do (
            set "DIR_HAS_FILES=1"
        )

        if !DIR_HAS_FILES! equ 1 (
            REM Directory has other files, not safe to use
            echo.
            echo ========================================================================
            echo   Directory already exists
            echo ========================================================================
            echo.
            echo The directory %INSTALL_DIR% already exists but is not a
            echo Git repository.
            echo.
            echo Please remove or rename it before installing EDWIN.
            echo.
            call :exit_with_error Non-git directory exists at %INSTALL_DIR%
        )
        REM Directory is empty or only has our log - safe to use for clone
    )

    REM Get repository URL from package.json if running from within a clone
    if "!REPO_URL!"=="" (
        set "SCRIPT_DIR=%~dp0"
        set "PACKAGE_JSON=%SCRIPT_DIR%..\..\package.json"

        if exist "!PACKAGE_JSON!" (
            REM Extract repository URL from package.json
            for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"url\"" "!PACKAGE_JSON!" 2^>nul') do (
                set "REPO_URL=%%~a"
            )
            REM Strip git+ prefix if present
            set "REPO_URL=!REPO_URL:git+=!"
        )
    )

    REM If we still don't have a URL, prompt the user
    if "!REPO_URL!"=="" (
        REM Check if stdin is redirected (non-interactive)
        REM This is a simplified check - in Windows batch it's hard to detect TTY
        REM We'll just try to prompt and if it fails, we fail

        call :prompt_for_repo_url

        if "!PROMPT_URL!"=="" (
            echo.
            echo ========================================================================
            echo   Repository URL Required
            echo ========================================================================
            echo.
            echo This installer needs to know which repository to clone from.
            echo.
            echo Please either:
            echo   1. Run this installer normally ^(double-click^), or
            echo   2. Pass the repository URL as an argument:
            echo      %~nx0 --repo-url https://github.com/owner/edwin.git
            echo.
            call :exit_with_error No repository URL provided
        )

        set "REPO_URL=!PROMPT_URL!"
    )

    REM Validate the URL we have
    set "VALIDATE_INPUT=!REPO_URL!"
    call :validate_repo_url

    if "!VALIDATE_OUTPUT!"=="" (
        call :exit_with_error Invalid repository URL: !REPO_URL!
    )

    set "REPO_URL=!VALIDATE_OUTPUT!"

    call :log Cloning repository from !REPO_URL!...

    REM Clone the repository
    git clone "!REPO_URL!" "%INSTALL_DIR%" >> "%LOG_FILE%" 2>&1
    if errorlevel 1 (
        call :log_error Failed to clone repository
        echo.
        echo Failed to download EDWIN. This might happen if:
        echo   - You're not connected to the internet
        echo   - The repository URL is incorrect
        echo   - You don't have access to the repository
        echo.
        echo Repository URL: !REPO_URL!
        echo.
        echo Check the log file for details: %LOG_FILE%
        echo.
        call :exit_with_error Git clone failed
    )

    call :log Repository cloned successfully
)

REM ============================================================================
REM Run Sync Engine
REM ============================================================================

call :log Running EDWIN sync engine...

set "ENGINE_PATH=%INSTALL_DIR%\tools\sync\engine.mjs"

if not exist "%ENGINE_PATH%" (
    echo.
    echo ========================================================================
    echo   Sync engine not found
    echo ========================================================================
    echo.
    echo The sync engine is missing from the repository.
    echo This might mean the download was incomplete or corrupted.
    echo.
    echo Expected location: %ENGINE_PATH%
    echo.
    call :exit_with_error Sync engine not found
)

echo.
echo Installing EDWIN skills and persona...
echo.

node "%ENGINE_PATH%" --target all >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    call :log_error Sync engine failed
    echo.
    echo The sync engine encountered an error.
    echo Check the log file for details: %LOG_FILE%
    echo.
    call :exit_with_error Sync engine failed
)

call :log Sync engine completed successfully

REM ============================================================================
REM Success Message
REM ============================================================================

echo.
echo ========================================================================
echo   Installation Complete!
echo ========================================================================
echo.
echo EDWIN has been installed successfully.
echo.
echo Next step:
echo   1. Open Claude ^(Desktop or Code^)
echo   2. Say: set up EDWIN
echo.
echo That will complete the initial configuration.
echo.

echo Installation completed successfully >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"

pause
exit /b 0
