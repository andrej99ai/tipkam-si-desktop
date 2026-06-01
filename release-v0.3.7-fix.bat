@echo off
REM ============================================================
REM  Fix skripta: dokonca push za v0.3.7 po "rejected" napaki.
REM  Pulla najnoveje spremembe iz GitHuba (latest.json od prej),
REM  jih spaja s tvojim commit-om in pošlje vse skupaj.
REM ============================================================

cd /d "%~dp0"

echo.
echo === KORAK 1/3: Pull z rebase (vleci nove commit-e iz GitHuba) ===
git pull --rebase origin main
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo NAPAKA pri pull --rebase.
    echo Mozno je, da je prislo do konflikta. Naredi screenshot in mi sporoci.
    pause
    exit /b 1
)

echo.
echo === KORAK 2/3: Push main veje ===
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo NAPAKA pri push origin main.
    pause
    exit /b 1
)

echo.
echo === KORAK 3/3: Push tag v0.3.7 (sproii GitHub Actions build!) ===
git push origin v0.3.7
if %ERRORLEVEL% NEQ 0 (
    echo NAPAKA pri push tag-a.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  USPEH! Vse je poslano na GitHub.
echo.
echo  Naslednji koraki:
echo  1. Pojdi na: https://github.com/andrej99ai/tipkam-si-desktop/actions
echo  2. Pocakaj, da se zeleni kljukec pojavi (10-15 min).
echo  3. Odpri Perfect Text aplikacijo.
echo  4. Klikni "Namesti in znova zazeni" v rumenem pasu.
echo ============================================================
echo.
pause
