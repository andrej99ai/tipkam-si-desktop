@echo off
REM ============================================================
REM  Release skript za Perfect Text v0.3.8
REM  Popravi workflow bug in zazene nov build.
REM
REM  Korak za korakom:
REM    1. Pomiri lokalni working tree (resetiraj na origin/main)
REM    2. Popravi .github/workflows/release.yml
REM       (zamenja "git checkout main" z "git checkout -f main")
REM    3. Commit
REM    4. Tag v0.3.8
REM    5. Push glavna veja + tag
REM
REM  Po tem sledi GitHub Actions build (10-15 min) in nato auto-update.
REM ============================================================

cd /d "%~dp0"

echo.
echo === KORAK 1/6: Pomiritev lokalnih datotek (reset na origin/main) ===
git fetch origin
if errorlevel 1 (
    echo NAPAKA pri git fetch.
    pause
    exit /b 1
)
git reset --hard origin/main
if errorlevel 1 (
    echo NAPAKA pri git reset.
    pause
    exit /b 1
)

echo.
echo === KORAK 2/6: Popravek workflow datoteke ===
powershell -NoProfile -Command "$path = '.github/workflows/release.yml'; $content = Get-Content $path -Raw; $newContent = $content -replace 'git checkout main', 'git checkout -f main'; if ($content -eq $newContent) { Write-Host 'OPOZORILO: nista nasla mesta za zamenjavo. Mogoce je workflow ze popravljen.'; exit 0 }; [System.IO.File]::WriteAllText((Resolve-Path $path), $newContent); Write-Host 'Popravljeno.'"
if errorlevel 1 (
    echo NAPAKA pri popravku workflow.
    pause
    exit /b 1
)

echo.
echo === Pregled popravka ===
git diff --no-color .github/workflows/release.yml

echo.
echo === Pritisnite tipko za commit + tag + push, ali zaprite okno za preklic ===
pause

echo.
echo === KORAK 3/6: Commit ===
git add .github/workflows/release.yml
git diff --cached --quiet
if not errorlevel 1 (
    echo OPOZORILO: ni sprememb za commit. Mozno je, da je workflow ze popravljen.
    echo Skripta nadaljuje s tagiranjem in push-anjem.
) else (
    git commit -m "fix(workflow): force checkout main to handle modified tauri.conf.json after build"
    if errorlevel 1 (
        echo NAPAKA pri commit-u.
        pause
        exit /b 1
    )
)

echo.
echo === KORAK 4/6: Tag v0.3.8 ===
git tag v0.3.8 2>nul
if errorlevel 1 (
    echo Tag v0.3.8 ze obstaja lokalno - to je v redu, gremo naprej.
)

echo.
echo === KORAK 5/6: Push main veje ===
git push origin main
if errorlevel 1 (
    echo NAPAKA pri push origin main.
    pause
    exit /b 1
)

echo.
echo === KORAK 6/6: Push tag v0.3.8 ===
git push origin v0.3.8
if errorlevel 1 (
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
echo  2. Pocakaj, da se Release v0.3.8 build konca z zelenim kljukcem.
echo     Pricakovan cas: 10-15 minut.
echo  3. Odpri Perfect Text aplikacijo (ali jo znova zazeni iz tray ikone).
echo  4. Po nekaj sekundah ti bo aplikacija ponudila rumen banner:
echo     "Na voljo je nova razlicica Perfect Text!"
echo  5. Klikni "Namesti in znova zazeni".
echo  6. Po posodobitvi pritisni F2 in preveri:
echo     - Najprej RUMEN pas "Pripravljam mikrofon..."
echo     - Sele potem RDEC pas "Snemam..." - tu lahko zacnes govoriti.
echo.
echo  Opomba: Broken Release v0.3.7 na GitHubu lahko mirno pustis.
echo          Lahko ga rocno izbrises kasneje (ni nujno).
echo ============================================================
echo.
pause
