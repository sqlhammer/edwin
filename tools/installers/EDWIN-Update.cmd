@echo off
setlocal enabledelayedexpansion

REM EDWIN-Update.cmd
REM
REM Updates an existing EDWIN installation to the latest version.
REM Preserves user/ directory and all personal data.

REM ============================================================================
REM Configuration
REM ============================================================================

set "INSTALL_DIR=%USERPROFILE%\edwin"
set "LOG_FILE=%INSTALL_DIR%\install.log"

REM ============================================================================
REM Helper Functions
REM ============================================================================

goto :skip_functions

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
echo Update failed. Check the log file for details:
echo   %LOG_FILE%
echo.
pause
exit /b 1

:skip_functions

REM ============================================================================
REM Main Update Flow
REM ============================================================================

cls
echo ========================================================================
echo   EDWIN Update
echo ========================================================================
echo.

echo ======================================== >> "%LOG_FILE%"
echo EDWIN Update Started >> "%LOG_FILE%"
echo [%date% %time%] >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"

REM Check if EDWIN is installed
if not exist "%INSTALL_DIR%\" (
    echo.
    echo EDWIN is not installed at %INSTALL_DIR%
    echo.
    echo Please run the installer first ^(EDWIN-Install.cmd^).
    echo.
    call :exit_with_error EDWIN not found at %INSTALL_DIR%
)

if not exist "%INSTALL_DIR%\.git\" (
    echo.
    echo The directory %INSTALL_DIR% exists but is not a Git repository.
    echo.
    echo Cannot update. Please reinstall EDWIN.
    echo.
    call :exit_with_error Not a git repository: %INSTALL_DIR%
)

REM Verify it's the EDWIN repository
if not exist "%INSTALL_DIR%\core\" (
    echo.
    echo The directory %INSTALL_DIR% doesn't appear to be an EDWIN installation.
    echo.
    echo Cannot update. Please reinstall EDWIN.
    echo.
    call :exit_with_error Invalid EDWIN installation at %INSTALL_DIR%
)

call :log Found EDWIN installation at %INSTALL_DIR%

REM Navigate to installation directory
cd /d "%INSTALL_DIR%"

REM Check for uncommitted changes
call :log Checking for uncommitted changes...

git diff-index --quiet HEAD -- 2>nul
if errorlevel 1 (
    REM There are changes. Check if they're only in user/
    set "HAS_NON_USER_CHANGES=0"

    for /f "delims=" %%f in ('git diff-index --name-only HEAD -- 2^>nul') do (
        set "FILE=%%f"
        REM Check if file starts with "user/"
        echo !FILE! | findstr /b "user/" >nul
        if errorlevel 1 (
            set "HAS_NON_USER_CHANGES=1"
        )
    )

    if !HAS_NON_USER_CHANGES! equ 1 (
        echo.
        echo ========================================================================
        echo   Uncommitted changes detected
        echo ========================================================================
        echo.
        echo You have uncommitted changes outside of user/.
        echo The updater won't overwrite them.
        echo.
        echo To update, either:
        echo   1. Commit or stash your changes manually
        echo   2. Discard them ^(if you know what you're doing^)
        echo.
        call :exit_with_error Uncommitted changes detected
    ) else (
        call :log Changes are only in user/ directory ^(preserved^)
    )
)

REM Pull latest changes
call :log Pulling latest changes...
echo.
echo Downloading updates...
echo.

git pull --ff-only >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    call :log_error Failed to pull updates
    echo.
    echo Failed to download updates. This might happen if:
    echo   - Your local changes conflict with updates
    echo   - You're not connected to the internet
    echo   - The branch has diverged from the remote
    echo.
    echo Check the log file for details: %LOG_FILE%
    echo.
    call :exit_with_error Git pull failed
)

call :log Updates pulled successfully

REM Verify user/ directory still exists and is intact
if not exist "%INSTALL_DIR%\user\" (
    call :log Note: user/ directory does not exist ^(normal for fresh install^)
) else (
    call :log Verified user/ directory is intact
)

REM Run sync engine
call :log Running sync engine...
echo.
echo Syncing EDWIN skills and persona...
echo.

set "ENGINE_PATH=%INSTALL_DIR%\tools\sync\engine.mjs"

if not exist "%ENGINE_PATH%" (
    echo.
    echo Sync engine not found at %ENGINE_PATH%
    echo The update may have failed or the repository structure changed.
    echo.
    call :exit_with_error Sync engine not found
)

node "%ENGINE_PATH%" --target all >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    call :log_error Sync engine failed
    echo.
    echo The sync engine encountered an error.
    echo Check the log file for details: %LOG_FILE%
    echo.
    call :exit_with_error Sync engine failed
)

call :log Sync completed successfully

REM Success message
echo.
echo ========================================================================
echo   Update Complete!
echo ========================================================================
echo.
echo EDWIN has been updated successfully.
echo.
echo Your personal data in the user/ directory has been preserved.
echo.
echo Restart Claude to load the changes.
echo.

echo Update completed successfully >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"

pause
exit /b 0
