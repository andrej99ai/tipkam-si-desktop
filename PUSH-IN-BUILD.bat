@echo off
REM ─────────────────────────────────────────────────────────────────────
REM  Tipkam.si — Push spremembe in zgradi novo aplikacijo
REM  Dvoklikni za uporabo. Vse korake izvede po vrsti.
REM ─────────────────────────────────────────────────────────────────────
setlocal enabledelayedexpansion

cd /d "%~dp0"

REM Pociscim morebitne git lock datoteke iz prejsnjih sej
if exist ".git\index.lock" del /f /q ".git\index.lock" 2>nul
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock" 2>nul

echo ========================================================
echo  KORAK 1/3: Posiljam spremembe na GitHub
echo ========================================================
echo.
git push
if errorlevel 1 (
    echo.
    echo NAPAKA: git push ni uspel.
    echo Preveri internetno povezavo in GitHub credentials.
    echo.
    pause
    exit /b 1
)
echo.
echo Push uspesen.
echo.

echo ========================================================
echo  KORAK 2/3: Namescam dependencije ^(npm install^)
echo ========================================================
echo.
call npm install
if errorlevel 1 (
    echo.
    echo NAPAKA: npm install ni uspel.
    echo Preveri, da je Node.js nameschen ^(node --version^).
    echo.
    pause
    exit /b 1
)
echo.
echo Dependencije pripravljene.
echo.

echo ========================================================
echo  KORAK 3/3: Gradim aplikacijo ^(traja 3-5 minut^)
echo ========================================================
echo.
echo  Bodi potrpezljiv — Rust prevaja v ozadju.
echo.
call npm run tauri build
if errorlevel 1 (
    echo.
    echo NAPAKA: build ni uspel.
    echo Preveri, da je Rust nameschen ^(rustc --version^)
    echo in da imash Visual Studio Build Tools.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo  KONCANO! Installer je pripravljen.
echo ========================================================
echo.
echo Odpiram mapo z installerjem...
start "" "%~dp0src-tauri\target\release\bundle\nsis"
echo.
echo Pred namestitvijo nove verzije:
echo   1. Odpri Windows Settings - Apps - poischi Tipkam ali Perfect Text
echo   2. Odstrani staro verzijo
echo   3. Dvoklikni novi .exe installer
echo.
pause
