export interface Language {
  code: string;
  name: string;
  group: string;
}

export const LANGUAGES: Language[] = [
  // ── Privzeto ──
  { code: "sl", name: "Slovenščina", group: "Privzeto" },

  // ── Najbolj priljubljeni (popularnost 10) ──
  { code: "en", name: "English", group: "Najbolj priljubljeni" },
  { code: "es", name: "Spanish", group: "Najbolj priljubljeni" },
  { code: "fr", name: "French", group: "Najbolj priljubljeni" },
  { code: "de", name: "German", group: "Najbolj priljubljeni" },
  { code: "it", name: "Italian", group: "Najbolj priljubljeni" },
  { code: "pt", name: "Portuguese", group: "Najbolj priljubljeni" },
  { code: "zh", name: "Chinese", group: "Najbolj priljubljeni" },
  { code: "ja", name: "Japanese", group: "Najbolj priljubljeni" },
  { code: "ko", name: "Korean", group: "Najbolj priljubljeni" },
  { code: "ru", name: "Russian", group: "Najbolj priljubljeni" },

  // ── Evropski jeziki (popularnost 8) ──
  { code: "nl", name: "Dutch", group: "Evropski jeziki" },
  { code: "pl", name: "Polish", group: "Evropski jeziki" },
  { code: "sv", name: "Swedish", group: "Evropski jeziki" },
  { code: "da", name: "Danish", group: "Evropski jeziki" },
  { code: "no", name: "Norwegian", group: "Evropski jeziki" },
  { code: "fi", name: "Finnish", group: "Evropski jeziki" },
  { code: "cs", name: "Czech", group: "Evropski jeziki" },
  { code: "sk", name: "Slovak", group: "Evropski jeziki" },
  { code: "hr", name: "Croatian", group: "Evropski jeziki" },
  { code: "sr", name: "Serbian", group: "Evropski jeziki" },
  { code: "hu", name: "Hungarian", group: "Evropski jeziki" },
  { code: "ro", name: "Romanian", group: "Evropski jeziki" },
  { code: "bg", name: "Bulgarian", group: "Evropski jeziki" },
  { code: "el", name: "Greek", group: "Evropski jeziki" },

  // ── Azijski jeziki (popularnost 7) ──
  { code: "hi", name: "Hindi", group: "Azijski jeziki" },
  { code: "ar", name: "Arabic", group: "Azijski jeziki" },
  { code: "th", name: "Thai", group: "Azijski jeziki" },
  { code: "vi", name: "Vietnamese", group: "Azijski jeziki" },
  { code: "id", name: "Indonesian", group: "Azijski jeziki" },
  { code: "ms", name: "Malay", group: "Azijski jeziki" },
  { code: "tl", name: "Filipino", group: "Azijski jeziki" },
  { code: "bn", name: "Bengali", group: "Azijski jeziki" },
  { code: "ta", name: "Tamil", group: "Azijski jeziki" },
  { code: "te", name: "Telugu", group: "Azijski jeziki" },
  { code: "mr", name: "Marathi", group: "Azijski jeziki" },
  { code: "gu", name: "Gujarati", group: "Azijski jeziki" },
  { code: "kn", name: "Kannada", group: "Azijski jeziki" },
  { code: "ml", name: "Malayalam", group: "Azijski jeziki" },
  { code: "pa", name: "Punjabi", group: "Azijski jeziki" },
  { code: "ur", name: "Urdu", group: "Azijski jeziki" },
  { code: "fa", name: "Persian", group: "Azijski jeziki" },
  { code: "he", name: "Hebrew", group: "Azijski jeziki" },
  { code: "tr", name: "Turkish", group: "Azijski jeziki" },

  // ── Drugi evropski (popularnost 6) ──
  { code: "et", name: "Estonian", group: "Drugi evropski" },
  { code: "lv", name: "Latvian", group: "Drugi evropski" },
  { code: "lt", name: "Lithuanian", group: "Drugi evropski" },
  { code: "mt", name: "Maltese", group: "Drugi evropski" },
  { code: "ga", name: "Irish", group: "Drugi evropski" },
  { code: "cy", name: "Welsh", group: "Drugi evropski" },
  { code: "is", name: "Icelandic", group: "Drugi evropski" },

  // ── Afriški jeziki (popularnost 5) ──
  { code: "sw", name: "Swahili", group: "Afriški jeziki" },
  { code: "am", name: "Amharic", group: "Afriški jeziki" },
  { code: "yo", name: "Yoruba", group: "Afriški jeziki" },
  { code: "zu", name: "Zulu", group: "Afriški jeziki" },
  { code: "af", name: "Afrikaans", group: "Afriški jeziki" },

  // ── Ostali jeziki (popularnost 4) ──
  { code: "hy", name: "Armenian", group: "Ostali jeziki" },
  { code: "az", name: "Azerbaijani", group: "Ostali jeziki" },
  { code: "eu", name: "Basque", group: "Ostali jeziki" },
  { code: "be", name: "Belarusian", group: "Ostali jeziki" },
  { code: "bs", name: "Bosnian", group: "Ostali jeziki" },
  { code: "ca", name: "Catalan", group: "Ostali jeziki" },
  { code: "gl", name: "Galician", group: "Ostali jeziki" },
  { code: "ka", name: "Georgian", group: "Ostali jeziki" },
  { code: "kk", name: "Kazakh", group: "Ostali jeziki" },
  { code: "ky", name: "Kyrgyz", group: "Ostali jeziki" },
  { code: "lb", name: "Luxembourgish", group: "Ostali jeziki" },
  { code: "mk", name: "Macedonian", group: "Ostali jeziki" },
  { code: "mn", name: "Mongolian", group: "Ostali jeziki" },
  { code: "ne", name: "Nepali", group: "Ostali jeziki" },
  { code: "ps", name: "Pashto", group: "Ostali jeziki" },
  { code: "si", name: "Sinhala", group: "Ostali jeziki" },
  { code: "sq", name: "Albanian", group: "Ostali jeziki" },
  { code: "tg", name: "Tajik", group: "Ostali jeziki" },
  { code: "tk", name: "Turkmen", group: "Ostali jeziki" },
  { code: "uk", name: "Ukrainian", group: "Ostali jeziki" },
  { code: "uz", name: "Uzbek", group: "Ostali jeziki" },
];

export function isSlovenian(code: string): boolean {
  return code === "sl";
}
