@echo off
setlocal

REM EDWIN-Install.cmd -- double-click launcher for EDWIN-Install.ps1
REM
REM The installer itself is PowerShell. This file exists only because Windows will not run a
REM .ps1 on double-click: the default association opens it in an editor, and the default
REM execution policy blocks it even when it does run. So this hands off, reports the exit
REM code, and keeps the window open.
REM
REM It is deliberately this short. The previous installer was ~840 lines of batch, and three
REM separate Windows failures came from cmd mis-parsing nested `if (...) else (...)` blocks --
REM which it does without printing anything. There is nowhere in this file for that to happen.

set "PS1=%~dp0EDWIN-Install.ps1"

if not exist "%PS1%" goto :missing

set "DO_PAUSE=1"
echo(%*| findstr /i /c:"-NoPause" >nul && set "DO_PAUSE=0"
echo(%*| findstr /i /c:"--no-pause" >nul && set "DO_PAUSE=0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
set "RC=%ERRORLEVEL%"

REM Pause on the way out, whatever happened: a successful install has something to read, and
REM a PowerShell that never started has an error message worth seeing. Failures inside the
REM installer print their own diagnosis first.
if "%DO_PAUSE%"=="1" pause
exit /b %RC%

:missing
echo EDWIN-Install.ps1 was not found next to this file.
echo.
echo Expected: %PS1%
echo.
echo Download the whole installers folder, not just this one file.
echo.
pause
exit /b 1
