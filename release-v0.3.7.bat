@echo off
REM ============================================================
REM  Release skript za Perfect Text v0.3.7
REM  Dvojno klikni ali zaženi iz PowerShell/CMD.
REM
REM  Kaj naredi:
REM    1. Odstrani staro git lock datoteko (če obstaja)
REM    2. Doda spremembe v git (BREZ zasebnega ključa tipkam.key)
REM    3. Commit z opisom popravkov
REM    4. Naredi tag v0.3.7
REM    5. Potisne na GitHub → sproži avtomatski build
REM
REM  Nato: počakaj 10–15 min, da GitHub Actions zgradi.
REM        Aplikacija ti bo sama ponudila posodobitev.
REM ============================================================

cd /d "%~dp0"

echo.
echo === KORAK 1/6: Odstranjujem moreno git lock ===
if exist ".git\index.lock" (
    del /F /Q ".git\index.lock"
    echo Lock odstranjen.
) else (
    echo Lock-a ni bilo.
)

echo.
echo === KORAK 2/6: Trenutno stanje datotek ===
git status

echo.
echo === KORAK 3/6: Dodajam samo dovoljene datoteke ===
git add .gitignore
git add src/i18n.ts
git add src/main.ts
git add .github/workflows/release.yml
git add tipkam.key.pub

echo.
echo === Sanity check: ali je zasebni klu zaden ne v git? ===
git ls-files --cached | findstr /R "^tipkam\.key$" >nul
if %ERRORLEVEL%==0 (
    echo NAPAKA: tipkam.key je v stage-u, kar ne sme biti! Prekinitev.
    pause
    exit /b 1
) else (
    echo OK: tipkam.key NI v stage-u.
)

echo.
echo === KORAK 4/6: Pripravljen commit ===
git status --short

echo.
echo === Pritisnite tipko za commit + tag + push, ali zaprite okno za preklic ===
pause

echo.
echo === Commit ===
git commit -m "feat: yellow 'preparing mic' status before recording starts" -m "Standard mode (fast/accurate) now shows the same yellow 'preparing' indicator that live mode already shows. Signals to the user to wait for the red indicator before speaking — addresses 'first words lost' complaints."

if %ERRORLEVEL% NEQ 0 (
    echo NAPAKA pri commit-u.
    pause
    exit /b 1
)

echo.
echo === KORAK 5/6: Tag v0.3.7 ===
git tag v0.3.7

echo.
echo === KORAK 6/6: Push na GitHub ===
echo Posiljam main vejo...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo NAPAKA pri push origin main.
    pause
    exit /b 1
)

echo Posiljam tag v0.3.7...
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
echo  3. Odpri Perfect Text aplikacijo (ali jo znova zazeni).
echo  4. Klikni "Namesti in znova zazeni" v rumenem pasu zgoraj.
echo  5. Po posodobitvi pritisni F2 in preveri:
echo     - Najprej se mora pokazati RUMEN pas "Pripravljam mikrofon..."
echo     - Sele potem RDEC pas "Snemam..."
echo     - V tem trenutku lahko zacnes govoriti.
echo ============================================================
echo.
pause
