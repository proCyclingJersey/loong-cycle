@echo off
REM ============================================================
REM  Loong Cycle - One-Click Sync and Deploy Script
REM  Usage: Double-click this file to run
REM ============================================================

setlocal enabledelayedexpansion

REM ---- Config ----
REM Source directory: default is the parent folder of this project
REM (i.e. "相册_优化后"). You can change it to an absolute path if needed.
set "SOURCE_DIR=%~dp0.."
set "PROJECT_DIR=%~dp0"
set "UPLOADS_DIR=%PROJECT_DIR%uploads"

REM Remove trailing backslash for consistency
if "%SOURCE_DIR:~-1%"=="\" set "SOURCE_DIR=%SOURCE_DIR:~0,-1%"

echo ============================================================
echo   Loong Cycle - Sync and Deploy
echo ============================================================
echo.
echo   Project : %PROJECT_DIR%
echo   Source  : %SOURCE_DIR%
echo.

REM ---- Check source directory ----
if not exist "%SOURCE_DIR%" (
    echo [ERROR] Source directory not found:
    echo         %SOURCE_DIR%
    echo.
    echo Please edit this .bat file and set SOURCE_DIR to your
    echo "相册_优化后" folder path.
    echo.
    pause
    exit /b 1
)

REM ---- Check Node.js ----
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM ---- Check Git ----
where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git is not installed or not in PATH.
    echo         Please install Git from https://git-scm.com/
    echo.
    pause
    exit /b 1
)

REM ============================================================
REM  Step 1: Clear old uploads
REM ============================================================
echo [1/5] Clearing old uploads directory...
if exist "%UPLOADS_DIR%" (
    rmdir /s /q "%UPLOADS_DIR%"
)
mkdir "%UPLOADS_DIR%"
echo       Done.
echo.

REM ============================================================
REM  Step 2: Copy all category folders and images to uploads
REM ============================================================
echo [2/5] Copying images from source to uploads...
echo       This may take a few minutes, please wait...
echo.

REM Use robocopy: /E = copy subdirs including empty, /R:2 = retry 2 times,
REM /W:2 = wait 2 sec between retries, /NFL /NDL = no file/dir list,
REM /NP = no progress percentage, /NJH = no job header
robocopy "%SOURCE_DIR%" "%UPLOADS_DIR%" /E /COPY:DAT /R:2 /W:2 /NFL /NDL /NP /NJH

REM robocopy exit codes: 0-7 = success, 8+ = error
set "RC=%ERRORLEVEL%"
if %RC% geq 8 (
    echo.
    echo [ERROR] Copy failed with robocopy code %RC%
    pause
    exit /b 1
)
echo       Copy completed.
echo.

REM ============================================================
REM  Step 3: Run import.js to regenerate categories.json
REM ============================================================
echo [3/5] Generating categories.json...
cd /d "%PROJECT_DIR%"
node scripts/import.js
if errorlevel 1 (
    echo.
    echo [ERROR] import.js failed. Please check the error above.
    pause
    exit /b 1
)
echo.

REM ============================================================
REM  Step 4: Git add and commit
REM ============================================================
echo [4/5] Committing changes to git...
cd /d "%PROJECT_DIR%"
git add -A
git commit -m "Sync: update all categories, albums and images" --allow-empty
if errorlevel 1 (
    echo [WARN] git commit had issues, continuing...
)
echo       Done.
echo.

REM ============================================================
REM  Step 5: Git push (force)
REM ============================================================
echo [5/5] Pushing to GitHub...
echo       Note: If connection fails, please retry or switch network.
echo.
cd /d "%PROJECT_DIR%"
git push --force origin main

if errorlevel 1 (
    echo.
    echo ============================================================
    echo   [WARN] Push failed!
    echo ============================================================
    echo.
    echo   This is usually a network issue (GitHub connection reset).
    echo   Please try one of the following:
    echo.
    echo   1. Run this .bat script again
    echo   2. Switch to a different network / mobile hotspot
    echo   3. Run manually: cd /d "%PROJECT_DIR%" ^&^& git push --force origin main
    echo.
    echo   Your local files are already updated. Only the push failed.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Sync Complete!
echo ============================================================
echo.
echo   Website : https://procyclingjersey.github.io/loong-cycle/
echo   GitHub Pages will update in 1-2 minutes.
echo.
echo   Please refresh the website after 2 minutes to verify.
echo.
pause
