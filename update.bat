@echo off
if "%1"=="" (
    echo Usage: update.bat [production / preview / all]
    exit /b 1
)

node scripts/stamp-build.js
if %errorlevel% neq 0 (
    echo Failed to bump version
    exit /b 1
)

set EAS_NO_VCS=1

if "%1"=="all" (
    eas update --branch production --message "v bump"
    eas update --branch preview --message "v bump"
) else (
    eas update --branch %1 --message "v bump"
)
