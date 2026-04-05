# Navodila za Lovable: Perfect Text Desktop aplikacija

## Povzetek

Izdelali smo Windows desktop aplikacijo "Perfect Text", ki uporabniku omogoča narekovanje besedila kjerkoli na računalniku (Word, Outlook, brskalnik...) s pritiskom tipke F2. Aplikacija uporablja isti Supabase backend in iste uporabniške račune kot spletna aplikacija tipkam.si.

Namestitvena datoteka: `Perfect Text_0.1.0_x64-setup.exe`

Uporabnik jo lahko prenese šele po prijavi v Studio. Neprijavljen uporabnik mora biti preusmerjen na registracijo/prijavo.

---

## 1. Landing page — sekcija za desktop aplikacijo

Na landing page (tipkam.si) dodaj novo sekcijo, ki promovira desktop aplikacijo. Besedilo naj bo v slovenščini, prodajno naravnano.

### Naslov sekcije

**Uporabljaj Perfect Text kjerkoli na računalniku**

### Podnaslov

Namesti desktop aplikacijo za Windows in nareki besedilo neposredno v Word, Outlook, Gmail, brskalnik ali katerokoli drugo aplikacijo — brez kopiranja in lepljenja.

### Prednosti (prikaži kot kartice ali seznam z ikonami)

1. **Deluje v vsaki aplikaciji**
   Pritisni F2, nareci in besedilo se avtomatsko pripiše tja, kamor si postavil kurzor — v Word, Outlook, e-pošto, brskalnik ali katerokoli drugo polje za vnos besedila.

2. **Brez kopiranja in lepljenja**
   Besedilo se po obdelavi samodejno prilepi na mesto kurzorja. Ni treba preklapljati med okni.

3. **Deluje v ozadju**
   Aplikacija teče v ozadju in je vedno pripravljena. Minimiziraj jo v sistemsko vrstico in jo pozabi — pritisni F2 kadarkoli.

4. **Isti račun, isti paket**
   Prijavi se z istim Google računom ali e-pošto kot na spletni aplikaciji. Desktop aplikacija je vključena v tvoj obstoječi paket.

5. **Izbira med 77 jeziki**
   Enako kot spletna različica — slovenščina, angleščina, italijanščina in še 74 drugih jezikov.

6. **Natančno ali hitro**
   Za slovenščino izberi natančen način (Gemini Pro) za brezhibno oblikovano besedilo ali hiter način (Gemini Flash) za surovi prepis.

### CTA gumb

Tekst gumba: **"Prenesi za Windows"**

Obnašanje ob kliku:
- Če je uporabnik **prijavljen** → preusmeri ga v Studio, kjer je na voljo prenos
- Če **ni prijavljen** → preusmeri ga na prijavo/registracijo. Po uspešni prijavi ga preusmeri v Studio

**NE ponujaj neposredne povezave za prenos na landing page.** Prenos je dostopen samo prijavljenim uporabnikom znotraj Studia.

---

## 2. Studio — sekcija za prenos desktop aplikacije

Ko je uporabnik prijavljen v Studio (tipkam.si/studio), dodaj novo sekcijo ali zavihek z informacijami o desktop aplikaciji in gumbom za prenos.

### Naslov

**Desktop aplikacija za Windows**

### Kratek opis

Namesti Perfect Text na svoj Windows računalnik in nareki besedilo neposredno v katerokoli aplikacijo s pritiskom tipke F2.

### Gumb za prenos

Tekst: **"Prenesi Perfect Text za Windows"**
Velikost datoteke: ~pribl. 5 MB (prikaži ob gumbu)
Datoteka: `Perfect Text_0.1.0_x64-setup.exe`

Gumb naj sproži prenos datoteke. Datoteko naloži Andrej ročno na hosting (Hostinger).

### Navodila za namestitev in uporabo (prikaži pod gumbom za prenos)

Prikaži kot zložljiv (accordion) element ali pa kot jasne korake:

**Namestitev**

1. Prenesi namestitveno datoteko in jo zaženi.
2. Namestitveni program te bo vprašal, ali želiš ustvariti bližnjico na namizju — priporočamo da izbereš "Da".
3. Po namestitvi se aplikacija samodejno zažene.

**Prijava**

- Klikni "Nadaljuj z Googlom" za prijavo z Google računom (enak račun kot na spletni aplikaciji).
- Ali pa uporabi e-pošto in geslo, če si se registriral z e-pošto.

**Uporaba**

1. Po prijavi pritisni tipko **F2** za začetek narekovanja.
2. Govori v mikrofon.
3. Ponovno pritisni **F2** za ustavitev.
4. Besedilo se samodejno prilepi tja, kamor je postavljen kurzor (Word, Outlook, brskalnik...).

**Dodatne nastavitve**

- **Jezik govora:** Privzeto je slovenščina. Spremeni ga v nastavitvah aplikacije (77 jezikov na voljo).
- **Način prepisa (samo slovenščina):** Izberi "Natančno" za lektorirano besedilo ali "Hitro" za surovi prepis.
- **Bližnjica:** Privzeto je F2. Spremeni jo v nastavitvah na F3–F9 ali Ctrl+Shift kombinacijo.
- **Minimiziraj v ozadje:** Klikni "Minimiziraj v tray" — aplikacija bo delovala v ozadju. Ponovno jo odpreš z dvoklikom na ikono v sistemski vrstici.
- **Jezik vmesnika:** Izberi slovenščino, angleščino ali italijanščino v zgornjem desnem kotu.

---

## 3. Tehnične informacije za implementacijo

### Datoteka za prenos

Ime datoteke: `Perfect Text_0.1.0_x64-setup.exe`
Datoteko bo Andrej ročno naložil na Hostinger. Lovable potrebuje samo URL, kamor bo datoteka naložena (npr. `https://tipkam.si/downloads/Perfect_Text_0.1.0_x64-setup.exe`).

### Zaščita prenosa

Prenos mora biti dostopen **samo prijavljenim uporabnikom**. Neprijavljeni uporabniki ne smejo imeti neposredne povezave do datoteke.

Predlagana rešitev:
- Gumb za prenos v Studiu preusmeri na URL datoteke šele po preverjanju, da je uporabnik prijavljen
- Na landing page CTA gumb vedno preusmeri na prijavo/registracijo, če uporabnik ni prijavljen

### Obstoječa infrastruktura

- Supabase Auth za prijavo (Google OAuth + e-pošta/geslo)
- Landing page: tipkam.si
- Studio: tipkam.si/studio
- Uporabniški profili in paketi že obstajajo v Supabase

---

## 4. Česa NE vključi

- **NE vključi** kode ali tehničnih detajlov desktop aplikacije (Tauri, Rust, TypeScript)
- **NE spreminjaj** obstoječe prijave ali registracije — desktop aplikacija uporablja iste račune
- **NE ustvarjaj** novih tabel v Supabase za desktop aplikacijo
- **NE ponujaj** neposredne povezave za prenos brez prijave
- **NE omenjaj** tehničnih zahtev (Windows verzija, RAM...) — namestitveni program to sam preveri
