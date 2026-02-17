@echo off
setlocal

REM Build script for Synesis Export Zotero plugin (Windows CMD)
REM Delegates to build.ps1 to preserve forward slashes in ZIP entries

set "PS_EXE=pwsh"
where %PS_EXE% >nul 2>nul
if errorlevel 1 set "PS_EXE=powershell"

%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "build.ps1"
if errorlevel 1 (
    echo Build failed.
    exit /b 1
)

exit /b 0
