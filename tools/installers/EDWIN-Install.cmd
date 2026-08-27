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
set "MIN_NODE_VERSION=18"

REM The log is deliberately NOT inside INSTALL_DIR. `git clone` refuses a destination that
REM exists and is not empty, so writing the log there before cloning made the installer
REM create the obstacle it then tripped over -- a fresh install could never succeed. A copy
REM is placed in the install directory once the clone has happened.
set "LOG_FILE=%TEMP%\edwin-install.log"
set "FINAL_LOG_FILE=%INSTALL_DIR%\install.log"

set "REPO_URL="
set "ASSUME_YES=0"
set "INSTALL_DEPS=1"

REM A double-clicked .cmd runs under `cmd /c`, so the window closes the moment the script
REM ends -- taking any error message with it. Every exit therefore pauses first. An
REM installer whose failures are invisible is worse than one that fails loudly.
set "NO_PAUSE=0"

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--repo-url" (
    if "%~2"=="" (
        echo Error: --repo-url requires a URL >&2
        exit /b 2
    )
    set "REPO_URL=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--yes" (
    set "ASSUME_YES=1"
    shift
    goto :parse_args
)
if /i "%~1"=="-y" (
    set "ASSUME_YES=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--skip-deps" (
    set "INSTALL_DEPS=0"
    shift
    goto :parse_args
)
if /i "%~1"=="--no-pause" (
    set "NO_PAUSE=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--help" goto :show_usage
if /i "%~1"=="-h" goto :show_usage
echo Error: unknown option: %~1 >&2
echo. >&2
call :usage_text >&2
if "%NO_PAUSE%"=="0" pause
exit /b 2

:show_usage
call :usage_text
if "%NO_PAUSE%"=="0" pause
exit /b 0

:usage_text
echo EDWIN-Install.cmd -- install EDWIN on Windows
echo.
echo Usage:
echo   EDWIN-Install.cmd [options]
echo.
echo Options:
echo   --repo-url ^<url^>   Repository to install from ^(otherwise read from package.json or prompted^)
echo   --yes              Answer yes to every confirmation; required for unattended runs
echo   --skip-deps        Report missing Git or Node.js instead of installing them
echo   --no-pause         Do not wait for a keypress before closing
echo   --help             Show this help
echo.
echo Missing prerequisites are installed for you. Git and Node.js come from winget when it
echo is available; otherwise they are downloaded from their official sources and installed
echo silently. Nothing is downloaded through a web browser.
goto :eof

:args_done

REM ============================================================================
REM Helper Functions
REM ============================================================================

REM Note: log file directory is created by :log and :log_error when needed

goto :skip_functions

REM Note: neither logger creates INSTALL_DIR. It must not exist before the clone.
:log
echo [%date% %time%] %* >> "%LOG_FILE%"
echo %*
goto :eof

:log_error
echo [%date% %time%] ERROR: %* >> "%LOG_FILE%"
echo ERROR: %* >&2
goto :eof

:exit_with_error
call :log_error %*
echo.
echo Installation failed. Check the log file for details:
echo   %LOG_FILE%
echo.
if "%NO_PAUSE%"=="0" pause
exit /b 1

:command_exists
where %1 >nul 2>&1
goto :eof

REM Ask a yes/no question. Input: %CONFIRM_PROMPT%. Returns 0 for yes, 1 for no.
REM choice.exe reads the console directly, so a redirected or absent stdin gives
REM errorlevel 255 rather than silently looking like a bare Return. That distinction
REM matters: without it an unattended run would consent to everything by accident.
:confirm
if "%ASSUME_YES%"=="1" (
    echo %CONFIRM_PROMPT% [Y/n] y  ^(--yes^)
    exit /b 0
)
choice /c yn /n /d y /t 60 /m "%CONFIRM_PROMPT% [Y/n] "
if errorlevel 255 (
    call :log No console available to ask: "%CONFIRM_PROMPT%"
    exit /b 1
)
if errorlevel 2 exit /b 1
if errorlevel 1 exit /b 0
exit /b 1

REM Installed Node major version. Output: %NODE_MAJOR%, always a number (0 when unusable).
REM Anything non-numeric must collapse to 0: an empty or garbage value reaches
REM `if !NODE_MAJOR! lss 18` as a syntax error, and a syntax error terminates cmd
REM immediately -- which closes a double-clicked window with nothing on screen at all.
:node_major
set "NODE_MAJOR=0"
call :command_exists node
if errorlevel 1 goto :eof
set "NODE_RAW="
for /f "usebackq tokens=1 delims=." %%a in (`node -v 2^>nul`) do if not defined NODE_RAW set "NODE_RAW=%%a"
if not defined NODE_RAW goto :eof
set "NODE_RAW=%NODE_RAW:v=%"
echo(%NODE_RAW%|findstr /r /c:"^[0-9][0-9]*$" >nul
if errorlevel 1 goto :eof
set "NODE_MAJOR=%NODE_RAW%"
goto :eof

REM winget is present on Windows 10 1809+ and Windows 11. It can also exist as a broken
REM App Execution Alias, so being on PATH is not enough -- it has to actually answer.
:winget_available
where winget >nul 2>&1
if errorlevel 1 exit /b 1
winget --version >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

REM A freshly installed tool is not on this session's PATH: cmd captured PATH at
REM startup and neither winget nor an MSI can change that retroactively. Rather than
REM re-reading the registry -- whose Path holds unexpanded %%SystemRoot%%-style entries
REM that break when copied verbatim -- append the known install locations.
:refresh_tool_path
set "PATH=%PATH%;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs"
set "PATH=%PATH%;%ProgramFiles%\Git\cmd;%LOCALAPPDATA%\Programs\Git\cmd"
goto :eof

REM Newest Node release carrying an LTS codename. Output: %NODE_LTS% (empty on failure).
REM index.tab is whitespace-separated with lts in column 10 ("-" when not an LTS line),
REM so no JSON parser is needed -- which matters when the reason we are here is that
REM there is no node to parse JSON with.
:latest_node_lts
set "NODE_LTS="
for /f "usebackq skip=1 tokens=1,10" %%a in (`curl -fsSL --max-time 60 https://nodejs.org/dist/index.tab 2^>nul`) do (
    if not "%%b"=="-" (
        set "NODE_LTS=%%a"
        goto :eof
    )
)
goto :eof

REM Install Node from its official MSI. Output: errorlevel 0 on success.
:install_node_msi
call :latest_node_lts
if "%NODE_LTS%"=="" (
    call :log_error Could not determine the current Node.js LTS version from nodejs.org
    exit /b 1
)

set "NODE_ARCH=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODE_ARCH=arm64"

set "NODE_MSI=node-%NODE_LTS%-%NODE_ARCH%.msi"
set "NODE_BASE=https://nodejs.org/dist/%NODE_LTS%"
set "NODE_TMP=%TEMP%\edwin-node-%RANDOM%"
mkdir "%NODE_TMP%" 2>nul

call :log Downloading %NODE_MSI%...
curl -fL --max-time 900 -o "%NODE_TMP%\%NODE_MSI%" "%NODE_BASE%/%NODE_MSI%"
if errorlevel 1 (
    call :log_error Failed to download %NODE_BASE%/%NODE_MSI%
    rmdir /s /q "%NODE_TMP%" 2>nul
    exit /b 1
)

REM This installer is about to run elevated, so check it against Node's published
REM checksum first. A truncated or substituted download must not be installed.
curl -fsSL --max-time 120 -o "%NODE_TMP%\SHASUMS256.txt" "%NODE_BASE%/SHASUMS256.txt"
if errorlevel 1 (
    call :log_error Failed to download checksums from %NODE_BASE%/SHASUMS256.txt
    rmdir /s /q "%NODE_TMP%" 2>nul
    exit /b 1
)

set "NODE_EXPECTED="
for /f "usebackq tokens=1,2" %%h in ("%NODE_TMP%\SHASUMS256.txt") do (
    if /i "%%i"=="%NODE_MSI%" set "NODE_EXPECTED=%%h"
)

set "NODE_ACTUAL="
for /f "skip=1 delims=" %%h in ('certutil -hashfile "%NODE_TMP%\%NODE_MSI%" SHA256') do (
    if not defined NODE_ACTUAL set "NODE_ACTUAL=%%h"
)
REM certutil prints the digest with spaces on some Windows builds.
set "NODE_ACTUAL=%NODE_ACTUAL: =%"

if "%NODE_EXPECTED%"=="" (
    call :log_error No published checksum for %NODE_MSI% -- refusing to install it
    rmdir /s /q "%NODE_TMP%" 2>nul
    exit /b 1
)

if /i not "%NODE_EXPECTED%"=="%NODE_ACTUAL%" (
    call :log_error Checksum mismatch for %NODE_MSI% -- refusing to install it
    rmdir /s /q "%NODE_TMP%" 2>nul
    exit /b 1
)

call :log Checksum verified. Installing %NODE_MSI%...
msiexec /i "%NODE_TMP%\%NODE_MSI%" /qn /norestart
if errorlevel 1 (
    call :log_error msiexec failed for %NODE_MSI%
    rmdir /s /q "%NODE_TMP%" 2>nul
    exit /b 1
)

rmdir /s /q "%NODE_TMP%" 2>nul
exit /b 0

REM Install Git for Windows from its official release. Output: errorlevel 0 on success.
REM The version is taken from where /releases/latest redirects to, so this needs no JSON
REM parser. Git for Windows names its tag v<ver>.windows.<n> and its asset Git-<ver>.<n>,
REM so the asset version is the tag with ".windows." collapsed to ".".
:install_git_exe
set "GIT_TAG_URL="
for /f "usebackq delims=" %%u in (`curl -sIL -o NUL -w "%%{url_effective}" --max-time 60 https://github.com/git-for-windows/git/releases/latest 2^>nul`) do set "GIT_TAG_URL=%%u"

if "%GIT_TAG_URL%"=="" (
    call :log_error Could not reach github.com to find the current Git for Windows release
    exit /b 1
)

set "GIT_TAG=%GIT_TAG_URL:*/releases/tag/=%"
if "%GIT_TAG%"=="%GIT_TAG_URL%" (
    call :log_error Unexpected redirect target for the latest Git release: %GIT_TAG_URL%
    exit /b 1
)

set "GIT_VER=%GIT_TAG:~1%"
set "GIT_VER=%GIT_VER:.windows.=.%"

set "GIT_ASSET=Git-%GIT_VER%-64-bit.exe"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "GIT_ASSET=Git-%GIT_VER%-arm64.exe"

set "GIT_TMP=%TEMP%\edwin-git-%RANDOM%"
mkdir "%GIT_TMP%" 2>nul

call :log Downloading %GIT_ASSET%...
curl -fL --max-time 900 -o "%GIT_TMP%\%GIT_ASSET%" "https://github.com/git-for-windows/git/releases/download/%GIT_TAG%/%GIT_ASSET%"
if errorlevel 1 (
    call :log_error Failed to download %GIT_ASSET%
    rmdir /s /q "%GIT_TMP%" 2>nul
    exit /b 1
)

call :log Installing %GIT_ASSET%...
"%GIT_TMP%\%GIT_ASSET%" /VERYSILENT /NORESTART /NOCANCEL /SP- /SUPPRESSMSGBOXES /CLOSEAPPLICATIONS
if errorlevel 1 (
    call :log_error Git installer failed
    rmdir /s /q "%GIT_TMP%" 2>nul
    exit /b 1
)

rmdir /s /q "%GIT_TMP%" 2>nul
exit /b 0

:validate_repo_url
REM Input: %VALIDATE_INPUT%
REM Output: %VALIDATE_OUTPUT% (empty if invalid)
REM
REM Must be idempotent: main validates again a URL that :prompt_for_repo_url already
REM validated. An earlier version tested the suffix with
REM     echo %VALIDATE_INPUT% | findstr "\.git$"
REM which can never match. echo emits the space that sits before the pipe, so the piped
REM line ends in a space rather than "t" and the $ anchor always fails. Every call
REM therefore appended another ".git", producing edwin.git.git.git -- and the owner/repo
REM shorthand this prompt advertises never matched either. Suffix and prefix tests here use
REM substring comparison, which has no such trap.
set "VALIDATE_OUTPUT="

REM Strip quotes if present
set "VALIDATE_INPUT=%VALIDATE_INPUT:"=%"

REM set /p keeps exactly what was typed or pasted, trailing spaces included.
for /f "tokens=* delims= " %%a in ("%VALIDATE_INPUT%") do set "VALIDATE_INPUT=%%a"
:validate_trim_trailing
if "%VALIDATE_INPUT:~-1%"==" " (
    set "VALIDATE_INPUT=%VALIDATE_INPUT:~0,-1%"
    goto :validate_trim_trailing
)

if "%VALIDATE_INPUT%"=="" goto :eof

REM Recognised as a URL already: take it as given. file:// is accepted so the clone path can
REM be exercised against a local repository rather than only against the live network.
if /i "%VALIDATE_INPUT:~0,8%"=="https://" goto :validate_as_url
if /i "%VALIDATE_INPUT:~0,7%"=="http://" goto :validate_as_url
if /i "%VALIDATE_INPUT:~0,6%"=="ssh://" goto :validate_as_url
if /i "%VALIDATE_INPUT:~0,4%"=="git@" goto :validate_as_url
if /i "%VALIDATE_INPUT:~0,7%"=="file://" goto :validate_no_suffix

REM owner/repo shorthand: one slash, nothing exotic either side.
echo(%VALIDATE_INPUT%|findstr /r /c:"^[a-zA-Z0-9._-][a-zA-Z0-9._-]*/[a-zA-Z0-9._-][a-zA-Z0-9._-]*$" >nul
if errorlevel 1 goto :eof
set "VALIDATE_OUTPUT=https://github.com/%VALIDATE_INPUT%"
goto :validate_append_git

:validate_as_url
set "VALIDATE_OUTPUT=%VALIDATE_INPUT%"

:validate_append_git
if /i not "%VALIDATE_OUTPUT:~-4%"==".git" set "VALIDATE_OUTPUT=%VALIDATE_OUTPUT%.git"
goto :eof

REM A local path is taken exactly as given -- no .git is appended to it.
:validate_no_suffix
set "VALIDATE_OUTPUT=%VALIDATE_INPUT%"
goto :eof

REM Read repository.url out of package.json. Input: %1 = path. Output: %REPO_URL% (left
REM unchanged when the file has no usable url line, so a bad package.json falls through to
REM the prompt rather than producing a mangled URL).
:read_package_url
set "PKG_LINE="
for /f "usebackq delims=" %%a in (`findstr /c:"\"url\"" "%~1" 2^>nul`) do if not defined PKG_LINE set "PKG_LINE=%%a"
if not defined PKG_LINE goto :eof

echo(%PKG_LINE%|findstr /c:"https" >nul
if errorlevel 1 goto :eof

set "PKG_URL=https%PKG_LINE:*https=%"
set "PKG_URL=%PKG_URL:"=%"
if "%PKG_URL:~-1%"=="," set "PKG_URL=%PKG_URL:~0,-1%"
if not "%PKG_URL%"=="" set "REPO_URL=%PKG_URL%"
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

REM ----------------------------------------------------------------------------
REM Git
REM ----------------------------------------------------------------------------

call :command_exists git
if errorlevel 1 (
    echo.
    echo ========================================================================
    echo   Git is not installed
    echo ========================================================================
    echo.
    echo EDWIN needs Git to download and update its files. I can install it.
    echo.

    if "%INSTALL_DEPS%"=="0" call :exit_with_error Git is not installed ^(run without --skip-deps to install it^)

    set "CONFIRM_PROMPT=Install Git now?"
    call :confirm
    if errorlevel 1 (
        echo.
        echo Nothing installed. Install Git yourself and run this installer again,
        echo or re-run with --yes to install it without being asked.
        echo.
        call :exit_with_error Git is not installed and installation was declined
    )

    call :winget_available
    if errorlevel 1 (
        call :log winget is unavailable; installing Git from its official release...
        call :install_git_exe
    ) else (
        call :log Installing Git with winget...
        winget install --exact --id Git.Git --source winget --silent --accept-package-agreements --accept-source-agreements
        if errorlevel 1 (
            call :log winget machine-scope install failed; retrying in user scope...
            winget install --exact --id Git.Git --source winget --scope user --silent --accept-package-agreements --accept-source-agreements
        )
    )

    call :refresh_tool_path

    call :command_exists git
    if errorlevel 1 (
        echo.
        echo Git still isn't available after the install attempt.
        echo If it did install, close this window and run the installer again --
        echo a new window picks up the updated PATH.
        echo.
        call :exit_with_error Git installation did not produce a working git
    )

    call :log Git installed
) else (
    for /f "usebackq tokens=*" %%v in (`git --version 2^>nul`) do call :log Found %%v
)

REM ----------------------------------------------------------------------------
REM Node.js
REM ----------------------------------------------------------------------------

call :node_major

if !NODE_MAJOR! lss %MIN_NODE_VERSION% (
    echo.
    echo ========================================================================
    if "!NODE_MAJOR!"=="0" (
        echo   Node.js is not installed
    ) else (
        echo   Node.js is too old
    )
    echo ========================================================================
    echo.
    echo EDWIN needs Node.js %MIN_NODE_VERSION% or higher. I can install it.
    echo.

    if "%INSTALL_DEPS%"=="0" call :exit_with_error Node.js %MIN_NODE_VERSION% or higher is required ^(run without --skip-deps to install it^)

    set "CONFIRM_PROMPT=Install Node.js now?"
    call :confirm
    if errorlevel 1 (
        echo.
        echo Nothing installed. Install Node.js %MIN_NODE_VERSION% or higher yourself and run
        echo this installer again, or re-run with --yes to install it without being asked.
        echo.
        call :exit_with_error Node.js is missing or too old and installation was declined
    )

    call :winget_available
    if errorlevel 1 (
        call :log winget is unavailable; installing Node.js from its official MSI...
        call :install_node_msi
    ) else (
        call :log Installing Node.js with winget...
        winget install --exact --id OpenJS.NodeJS.LTS --source winget --silent --accept-package-agreements --accept-source-agreements
        if errorlevel 1 (
            call :log winget install failed; falling back to the official MSI...
            call :install_node_msi
        )
    )

    call :refresh_tool_path

    call :node_major

    if !NODE_MAJOR! lss %MIN_NODE_VERSION% (
        echo.
        echo Node.js still isn't usable after the install attempt.
        echo If it did install, close this window and run the installer again --
        echo a new window picks up the updated PATH.
        echo.
        call :exit_with_error Node.js installation did not produce a usable node
    )

    call :log Node.js installed
) else (
    for /f "usebackq tokens=*" %%v in (`node -v 2^>nul`) do call :log Found Node.js %%v
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
        REM git clone requires an empty destination, so this is a plain emptiness check. It
        REM used to exempt install.log, which only masked the fact that the installer had
        REM just written that log here and would then fail to clone over it.
        set "DIR_HAS_FILES=0"
        for /f %%f in ('dir /b /a-d "%INSTALL_DIR%" 2^>nul') do (
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
        REM Empty -- safe to clone into
    )

    REM Get repository URL from package.json if running from within a clone
    if "!REPO_URL!"=="" (
        set "SCRIPT_DIR=%~dp0"
        set "PACKAGE_JSON=%SCRIPT_DIR%..\..\package.json"

        if exist "!PACKAGE_JSON!" (
            REM Extract the repository URL from package.json. Splitting the line on ":"
            REM cannot work -- the URL contains one -- so cut at the scheme instead:
            REM %VAR:*https=% drops everything up to and including the first "https", and
            REM prepending it back reconstructs the URL from there. That also drops any
            REM "git+" prefix for free.
            call :read_package_url "!PACKAGE_JSON!"
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

REM --create-target: the engine refuses a missing %USERPROFILE%\.claude by default, which is right
REM for a manual sync but wrong here. Someone running a double-click installer may not have started
REM Claude yet, and failing at the last step would leave them with a clone and nothing else.
node "%ENGINE_PATH%" --target all --create-target >> "%LOG_FILE%" 2>&1
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

REM The log lived outside INSTALL_DIR so it could not block the clone. Put a copy where the
REM documentation says to look. Best-effort: a failed copy must not fail a good install.
if exist "%INSTALL_DIR%\" (
    copy /y "%LOG_FILE%" "%FINAL_LOG_FILE%" >nul 2>&1
    if not errorlevel 1 (
        echo Install log: %FINAL_LOG_FILE%
        echo.
    )
)

if "%NO_PAUSE%"=="0" pause
exit /b 0
