# ============================================================
#  Perfect Text - objava nove verzije
#  Ne zaganjaj tega direktno - dvoklikni OBJAVI.bat
#
#  Kaj naredi:
#    1. Preveri, da se koda prevede (npm run build)
#    2. Doda in commita spremembe (kljuci in build mape so izloceni)
#    3. Sam izracuna naslednjo verzijo iz zadnjega taga
#    4. Potisne na GitHub main + tag  -> sprozi GitHub Actions build
#    5. Caka in preveri, da se latest.json res posodobi
#       (brez tega uporabniki ne dobijo posodobitve - zgodilo se je pri v0.3.13)
# ============================================================

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Set-Location $PSScriptRoot

$REPO = "andrej99ai/tipkam-si-desktop"
$LATEST_URL = "https://raw.githubusercontent.com/$REPO/main/latest.json"

function Gitx {
    # Brez param bloka: vsi argumenti (tudi -A, -m) gredo surovo v $args
    # in se splatajo na git. Z imenovanimi parametri bi jih PowerShell
    # poskusil vezati nase in javil "Missing an argument for parameter".
    $ukaz = $args
    & git @ukaz
    if ($LASTEXITCODE -ne 0) { throw "Ukaz 'git $($ukaz -join ' ')' ni uspel." }
}

function Naslov($t) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  $t" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

try {

# ---------- 0. Priprava ----------
Naslov "KORAK 1/7 - Priprava"
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
Remove-Item ".git\HEAD.lock"  -Force -ErrorAction SilentlyContinue
git config core.autocrlf true
Write-Host "OK - git pripravljen."

# ---------- 1. Preverjanje kode ----------
Naslov "KORAK 2/7 - Preverjam, ce se koda prevede"
Write-Host "Traja ~20 sekund..."
& npm run build
if ($LASTEXITCODE -ne 0) {
    throw "Koda se NE prevede. Objava prekinjena - najprej popravi napake zgoraj."
}
Write-Host "OK - koda je v redu." -ForegroundColor Green

# ---------- 2. Commit ----------
Naslov "KORAK 3/7 - Spremembe"
$spremembe = git status --porcelain
if ($spremembe) {
    $spremembe | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    $msg = Read-Host "Vpisi kratek opis spremembe (Enter = privzeto)"
    if ([string]::IsNullOrWhiteSpace($msg)) { $msg = "chore: posodobitev aplikacije" }
    Gitx add -A
    # Ce so bile razlike samo v koncih vrstic, po normalizaciji ne ostane nic
    # za commit - takrat git commit vrne napako, kar ni razlog za prekinitev.
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        Gitx commit -m $msg
        Write-Host "OK - commit narejen." -ForegroundColor Green
    } else {
        Write-Host "Ni vsebinskih sprememb za commit - nadaljujem."
    }
} else {
    Write-Host "Ni novih sprememb - grem naravnost na objavo obstojecega stanja."
}

# ---------- 3. Nova verzija ----------
Naslov "KORAK 4/7 - Dolocam novo verzijo"
Gitx fetch origin --tags --quiet

# Po vsaki objavi GitHub Actions sam commita latest.json na main, zato je
# lokalna kopija po vsakem releasu eno commit zadaj za GitHubom. Brez tega
# uskladjevanja push pade z "rejected (non-fast-forward)".
Write-Host "Usklajujem lokalno kopijo z GitHubom..."
try {
    Gitx pull --rebase origin main
    Write-Host "OK - usklajeno."
} catch {
    git rebase --abort 2>&1 | Out-Null
    throw "Lokalne in GitHub spremembe si nasprotujejo (konflikt pri rebase). Javi Claudu, da to pogleda - nic ni bilo objavljeno."
}
$tagi = git tag --list "v*" | Where-Object { $_ -match '^v\d+\.\d+\.\d+$' }
if (-not $tagi) { throw "Ne najdem nobenega taga oblike vX.Y.Z." }
$zadnji = $tagi | Sort-Object { [version]($_.Substring(1)) } | Select-Object -Last 1
$v = [version]($zadnji.Substring(1))
$nova = "v{0}.{1}.{2}" -f $v.Major, $v.Minor, ($v.Build + 1)

Write-Host ""
Write-Host "  Zadnja objavljena verzija : $zadnji"
Write-Host "  Nova verzija              : $nova" -ForegroundColor Yellow
Write-Host ""
$potrdi = Read-Host "Objavim? (d = da / karkoli drugega = preklic)"
if ($potrdi -ne 'd' -and $potrdi -ne 'D') {
    Write-Host "Preklicano. Nic ni bilo poslano na GitHub." -ForegroundColor Yellow
    exit 0
}

# ---------- 4. Push ----------
Naslov "KORAK 5/7 - Posiljam na GitHub"
Gitx push origin main
Gitx tag $nova
Gitx push origin $nova
Write-Host "OK - poslano. GitHub zdaj gradi aplikacijo." -ForegroundColor Green
Start-Process "https://github.com/$REPO/actions"

# ---------- 5. Cakanje na build ----------
Naslov "KORAK 6/7 - Cakam, da GitHub zgradi in objavi ($nova)"
Write-Host "Traja obicajno 10-15 minut. To okno lahko pustis odprto."
Write-Host "Preverjam vsake pol minute..."
Write-Host ""

$cilj = $nova.Substring(1)
$rok = (Get-Date).AddMinutes(30)
$uspeh = $false

while ((Get-Date) -lt $rok) {
    Start-Sleep -Seconds 30
    try {
        $r = Invoke-RestMethod "$LATEST_URL`?cb=$([guid]::NewGuid())" -Headers @{'Cache-Control' = 'no-cache' }
        if ($r.version -eq $cilj) { $uspeh = $true; break }
        Write-Host ("  {0}  na GitHubu je se {1}, cakam {2}" -f (Get-Date -Format 'HH:mm:ss'), $r.version, $cilj)
    } catch {
        Write-Host ("  {0}  se cakam..." -f (Get-Date -Format 'HH:mm:ss'))
    }
}

# ---------- 6. Zakljucek ----------
Naslov "KORAK 7/7 - Rezultat"
if ($uspeh) {
    Write-Host ""
    Write-Host "  USPEH! Verzija $nova je objavljena in na voljo uporabnikom." -ForegroundColor Green
    Write-Host ""
    Write-Host "  Kaj zdaj:"
    Write-Host "    1. Zazeni Perfect Text (ali ga odpri iz tray ikone)."
    Write-Host "    2. Cez nekaj sekund se pojavi rumen banner z novo razlicico."
    Write-Host "    3. Klikni 'Namesti in znova zazeni'."
} else {
    Write-Host ""
    Write-Host "  OPOZORILO: latest.json se po 30 minutah ni posodobil na $cilj." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  To pomeni, da build ni koncal ali je padel. Poglej:"
    Write-Host "    https://github.com/$REPO/actions"
    Write-Host ""
    Write-Host "  Koda in tag sta ze na GitHubu - ko bo build zelen, bo posodobitev"
    Write-Host "  prisla sama. Skripte ni treba ponovno zaganjati."
}

} catch {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "  NAPAKA - objava ustavljena" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}
