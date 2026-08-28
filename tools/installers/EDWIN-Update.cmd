@echo off
setlocal

REM EDWIN-Update.cmd -- double-click launcher for EDWIN-Update.ps1
REM
REM The updater itself is PowerShell. This file exists only because Windows will not run a
REM .ps1 on double-click. See EDWIN-Install.cmd for the full reasoning; the short version is
REM that cmd mis-parses nested blocks without reporting it, so there is as little cmd here as
REM the job allows.

set "PS1=%~dp0EDWIN-Update.ps1"

if not exist "%PS1%" goto :missing

set "DO_PAUSE=1"
echo(%*| findstr /i /c:"-NoPause" >nul && set "DO_PAUSE=0"
echo(%*| findstr /i /c:"--no-pause" >nul && set "DO_PAUSE=0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
set "RC=%ERRORLEVEL%"

if "%DO_PAUSE%"=="1" pause
exit /b %RC%

:missing
echo EDWIN-Update.ps1 was not found next to this file.
echo.
echo Expected: %PS1%
echo.
echo Download the whole installers folder, not just this one file.
echo.
pause
exit /b 1
