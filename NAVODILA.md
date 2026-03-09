# Tipkam.si — Navodila za namestitev in zagon

## Kaj je pripravljeno

Celoten projekt (24 datotek) je pripravljen in že inicializiran kot Git repozitorij.
Supabase podatki so že vpisani. Potrebuješ narediti samo 2 stvari:
1. Naložiti projekt na GitHub
2. Zagnati aplikacijo na svojem Windows računalniku

---

## KORAK 1: Nalaganje na GitHub

### 1a) Ustvari nov repozitorij na GitHub.com

1. Odpri brskalnik in pojdi na: **https://github.com/new**
2. Izpolni:
   - **Repository name**: `tipkam-si-desktop`
   - **Description**: `Tipkam.si desktop aplikacija za Windows`
   - **Visibility**: izberi **Private**
   - **NE označi** "Add a README file" (ker ga že imamo)
   - **NE označi** "Add .gitignore" (ker ga že imamo)
3. Klikni **Create repository**
4. Na naslednji strani boš videl navodila — potrebuješ samo URL repozitorija, ki izgleda tako:
   `https://github.com/TVOJE-IME/tipkam-si-desktop.git`

### 1b) Poveži lokalni projekt z GitHub-om

Odpri **Command Prompt** ali **PowerShell** v mapi `tipkam-si` in poženi:

```bash
cd pot\do\tipkam-si
git remote add origin https://github.com/TVOJE-IME/tipkam-si-desktop.git
git push -u origin main
```

Zamenjaj `TVOJE-IME` s tvojim GitHub uporabniškim imenom.

Če te vpraša za geslo, uporabi **Personal Access Token** (ne GitHub geslo):
- GitHub.com → Settings → Developer settings → Personal access tokens → Generate new token
- Označi "repo" dovoljenje → Generate → Kopiraj token in ga uporabi kot geslo

---

## KORAK 2: Zaženi na Windows računalniku

Odpri **Command Prompt** ali **PowerShell** (ali Windows Terminal) in poženi:

```bash
cd pot\do\tipkam-si
npm install
npm run tauri dev
```

### Kaj se bo zgodilo:
1. `npm install` — namesti vse JavaScript dependencies (traja ~30 sekund)
2. `npm run tauri dev` — prevede Rust kodo in zažene aplikacijo (prvič traja 3-5 minut, ker prevaja Rust)

### Ko se aplikacija zažene:
1. Prikaže se okno z login ekranom
2. Vpiši email in geslo (isto kot za spletno aplikacijo)
3. Po prijavi vidiš glavni ekran z:
   - **Dropdown za izbiro jezika** (privzeto slovenščina)
   - **Hitro/Natančno toggle** (prikazan samo za slovenščino)
   - **Zeleni krog** — aplikacija je pripravljena
4. Pritisni **F2** (ali izbrano bližnjico), govori, pritisni **F2** — besedilo se prilepi kamor je kurzor

---

## Pogosti problemi

| Problem | Rešitev |
|---------|---------|
| `npm install` javi napako | Preveri da imaš Node.js v18+ nameščen (`node --version`) |
| Rust compilation error | Preveri da imaš Rust nameščen (`rustc --version`) in VS Build Tools |
| F2 ne deluje | Preveri da ni druga aplikacija, ki uporablja F2 |
| Login ne deluje | Preveri Supabase URL in Anon Key v `src/supabase.ts` |
| Mikrofon ne deluje | Prvič ko pritisneš F2, se okno prikaže v ospredje za odobritev mikrofona |
| `git push` zahteva geslo | Uporabi Personal Access Token, ne GitHub geslo |

---

## Production build

Ko je vse testirano in deluje:

```bash
npm run tauri build
```

Installer najdeš v: `src-tauri\target\release\bundle\nsis\`

---

## Tehnični pregled

### Edge Functions ki jih aplikacija kliče:
- **`voice-to-text`** — glavna transkripcija (pošlje audio + language_code + mode)
- **`proofread-text`** — lektoriranje (samo za slovenščino v natančnem načinu)

### Kako deluje:
1. Uporabnik pritisne bližnjico → začne se snemanje mikrofona
2. Uporabnik pritisne bližnjico znova → snemanje se ustavi
3. Zvok se pošlje na `voice-to-text` Edge Function (base64)
4. Za SL natančno: dodatno se kliče `proofread-text` za lektoriranje
5. Končno besedilo se kopira v clipboard in prilepi (Ctrl+V) kamor je kurzor
