@echo off
if "%1"=="" (
    echo Usage (run from repo root): scripts\update.bat [production / preview / all]
    exit /b 1
)

node scripts/stamp-build.js
if %errorlevel% neq 0 (
    echo Failed to bump version
    exit /b 1
)

set EAS_NO_VCS=1

if "%1"=="all" (
    npx eas-cli update --branch production --message "v bump"
    npx eas-cli update --branch preview --message "v bump"
) else (
    npx eas-cli update --branch %1 --message "v bump"
)
