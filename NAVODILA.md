# Tipkam.si — Navodila za namestitev in zagon

## Kaj je pripravljeno

Vseh 17 datotek projekta je pripravljenih v mapi `tipkam-si/`. Pred zagonom moraš narediti samo 2 stvari:

---

## KORAK 1: Vpiši Supabase podatke

Odpri datoteko `src/supabase.ts` v kateremkoli urejevalniku (Notepad, VS Code, ali kar z desnim klikom → "Odpri z" → Beležnica).

Zamenjaj ti dve vrstici:

```
const SUPABASE_URL = "https://YOUR_SUPABASE_URL.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

S tvojimi dejanskimi podatki, npr.:

```
const SUPABASE_URL = "https://abc123xyz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

Te podatke najdeš v Supabase Dashboard → Settings → API.

### Preveri tudi imena Edge Functions

V datoteki `src/dictation.ts` sta dve imeni Edge Functions:
- `transcribe-fast` — za hitri način
- `process-dictation` — za natančni način

Če se tvoji Edge Functions imenujejo drugače, zamenjaj imeni v tej datoteki.

---

## KORAK 2: Zaženi na Windows računalniku

Odpri **Command Prompt** ali **PowerShell** (ali Windows Terminal) in poženi naslednje ukaze:

```bash
cd pot/do/tipkam-si
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

---

## Production build

Ko je vse testirano in deluje:

```bash
npm run tauri build
```

Installer najdeš v: `src-tauri/target/release/bundle/nsis/`
