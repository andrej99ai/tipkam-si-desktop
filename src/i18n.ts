// ─── UI Translations for Perfect Text ────────────────────────────────────────
// Supported UI languages: Slovenian (sl), English (en), Italian (it)

export type UILanguage = "sl" | "en" | "it";

export interface Translations {
  // Login screen
  loginSubtitle: string;
  loginGoogleButton: string;
  loginGoogleLoading: string;
  loginSeparator: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  loginButton: string;
  loginButtonLoading: string;
  loginErrorEmpty: string;
  loginErrorInvalid: string;
  loginErrorEmailNotConfirmed: string;
  loginErrorGeneric: (msg: string) => string;

  // Main screen
  logoutButton: string;
  speechLanguageLabel: string;
  modeLabel: string;
  modeAccurate: string;
  modeAccurateTooltip: string;
  modeFast: string;
  modeFastTooltip: string;
  modeLive: string;
  modeLiveTooltip: string;
  liveTranscriptLabel: string;

  // Status
  statusReady: (key: string) => string;
  statusRecording: (key: string) => string;
  statusProcessing: string;
  statusDone: string;
  statusError: string;
  shortcutHint: string;
  micError: string;

  // Transcript
  lastTranscriptLabel: string;

  // Settings
  shortcutLabel: string;

  // Footer
  footerHint: string;

  // Tray
  trayReady: (key: string) => string;
  trayRecording: string;
  trayProcessing: string;
  trayDone: string;
  trayError: string;
  trayMenuOpen: string;
  trayMenuQuit: string;

  // UI language selector
  uiLanguageLabel: string;

  // Shortcut change error
  shortcutUnavailable: (key: string) => string;

  // Dictation error messages
  errorTimeout: string;
  errorQuota: string;
  errorSessionExpired: string;
  errorGeneric: string;

  // Error panel
  errorPanelTitle: string;
  errorPanelSubtitle: string;
  errorStepWebLabel: string;
  errorStepWebDesc: string;
  errorBtnProfile: string;
  errorStepDesktopLabel: string;
  errorStepDesktopDesc: string;
  errorBtnLogout: string;
  errorBtnDismiss: string;
}

const sl: Translations = {
  loginSubtitle: "AI Speech-to-Text",
  loginGoogleButton: "Nadaljuj z Googlom",
  loginGoogleLoading: "Odpiranje brskalnika...",
  loginSeparator: "Ali nadaljuj z e-pošto",
  emailLabel: "E-pošta",
  emailPlaceholder: "vas@email.com",
  passwordLabel: "Geslo",
  passwordPlaceholder: "Vaše geslo",
  loginButton: "Prijava",
  loginButtonLoading: "Prijavljam...",
  loginErrorEmpty: "Vnesite email in geslo.",
  loginErrorInvalid: "Napačen email ali geslo.",
  loginErrorEmailNotConfirmed: "Email ni potrjen.",
  loginErrorGeneric: (msg) => `Napaka: ${msg}`,

  logoutButton: "Odjava",
  speechLanguageLabel: "Jezik govora",
  modeLabel: "Način prepisa",
  modeAccurate: "Natančno",
  modeAccurateTooltip: "Natančno oblikovano besedilo (Gemini Pro)",
  modeFast: "Hitro",
  modeFastTooltip: "Hiter surov prepis govora (Gemini Flash)",
  modeLive: "Super hitro",
  modeLiveTooltip: "Prepis govora v živo (Soniox Nova)",
  liveTranscriptLabel: "V ŽIVO:",

  statusReady: (key) => `Pripravljen — pritisni ${key} za narekovanje`,
  statusRecording: (key) => `Snemam... Pritisni ${key} za ustavitev`,
  statusProcessing: "Obdelujem narekovanje...",
  statusDone: "Besedilo prilepljeno!",
  statusError: "Napaka",
  shortcutHint: "za začetek / ustavitev narekovanja",
  micError: "Mikrofon ni dostopen — odobri dovoljenje v oknu",

  lastTranscriptLabel: "ZADNJI TRANSKRIPT:",

  shortcutLabel: "Bližnjica",

  footerHint: "Pritisni bližnjico kadarkoli za narekovanje.",

  trayReady: (key) => `Perfect Text — Pripravljen (${key})`,
  trayRecording: "SNEMAM...",
  trayProcessing: "Obdelujem...",
  trayDone: "Prilepljeno!",
  trayError: "Napaka",
  trayMenuOpen: "Odpri Perfect Text",
  trayMenuQuit: "Zapri",

  uiLanguageLabel: "Jezik vmesnika",

  shortcutUnavailable: (key) => `Bližnjica ${key} ni na voljo`,

  errorTimeout: "Strežnik ni odgovoril pravočasno. Poskusi znova ali preveri povezavo.",
  errorQuota: "Minutna kvota je porabljena. Nadgradi naročnino na tipkam.si.",
  errorSessionExpired: "Seja je potekla. Odjavi se in se znova prijavi.",
  errorGeneric: "Napaka pri obdelavi. Poskusi znova.",

  errorPanelTitle: "Narekovanja ni bilo mogoče obdelati",
  errorPanelSubtitle: "Poskusi znova. Če se napaka ponavlja:",
  errorStepWebLabel: "V spletni aplikaciji",
  errorStepWebDesc: "Preveri mesečni limit v svojem profilu.",
  errorBtnProfile: "Odpri spletni profil",
  errorStepDesktopLabel: "V namizni aplikaciji",
  errorStepDesktopDesc: "Odjavi se in se ponovno prijavi.",
  errorBtnLogout: "Odjavi me",
  errorBtnDismiss: "Zapri",
};

const en: Translations = {
  loginSubtitle: "AI Speech-to-Text",
  loginGoogleButton: "Continue with Google",
  loginGoogleLoading: "Opening browser...",
  loginSeparator: "Or continue with email",
  emailLabel: "Email",
  emailPlaceholder: "you@email.com",
  passwordLabel: "Password",
  passwordPlaceholder: "Your password",
  loginButton: "Sign in",
  loginButtonLoading: "Signing in...",
  loginErrorEmpty: "Please enter email and password.",
  loginErrorInvalid: "Invalid email or password.",
  loginErrorEmailNotConfirmed: "Email not confirmed.",
  loginErrorGeneric: (msg) => `Error: ${msg}`,

  logoutButton: "Sign out",
  speechLanguageLabel: "Speech language",
  modeLabel: "Transcription mode",
  modeAccurate: "Accurate",
  modeAccurateTooltip: "Accurately formatted text (Gemini Pro)",
  modeFast: "Fast",
  modeFastTooltip: "Quick raw transcription (Gemini Flash)",
  modeLive: "Super fast",
  modeLiveTooltip: "Live real-time transcription (Soniox Nova)",
  liveTranscriptLabel: "LIVE:",

  statusReady: (key) => `Ready — press ${key} to dictate`,
  statusRecording: (key) => `Recording... Press ${key} to stop`,
  statusProcessing: "Processing dictation...",
  statusDone: "Text pasted!",
  statusError: "Error",
  shortcutHint: "to start / stop dictation",
  micError: "Microphone not available — allow permission in window",

  lastTranscriptLabel: "LAST TRANSCRIPT:",

  shortcutLabel: "Shortcut",

  footerHint: "Press the shortcut anytime to dictate.",

  trayReady: (key) => `Perfect Text — Ready (${key})`,
  trayRecording: "RECORDING...",
  trayProcessing: "Processing...",
  trayDone: "Pasted!",
  trayError: "Error",
  trayMenuOpen: "Open Perfect Text",
  trayMenuQuit: "Quit",

  uiLanguageLabel: "Interface language",

  shortcutUnavailable: (key) => `Shortcut ${key} is not available`,

  errorTimeout: "Server did not respond in time. Try again or check your connection.",
  errorQuota: "Your minutes are used up. Upgrade your plan at tipkam.si.",
  errorSessionExpired: "Session expired. Please sign out and sign in again.",
  errorGeneric: "Processing error. Please try again.",

  errorPanelTitle: "Dictation could not be processed",
  errorPanelSubtitle: "Try again. If the error persists:",
  errorStepWebLabel: "In the web app",
  errorStepWebDesc: "Check your monthly limit in your profile.",
  errorBtnProfile: "Open web profile",
  errorStepDesktopLabel: "In the desktop app",
  errorStepDesktopDesc: "Sign out and sign back in.",
  errorBtnLogout: "Sign me out",
  errorBtnDismiss: "Close",
};

const it: Translations = {
  loginSubtitle: "AI Speech-to-Text",
  loginGoogleButton: "Continua con Google",
  loginGoogleLoading: "Apertura del browser...",
  loginSeparator: "Oppure continua con email",
  emailLabel: "Email",
  emailPlaceholder: "tuo@email.com",
  passwordLabel: "Password",
  passwordPlaceholder: "La tua password",
  loginButton: "Accedi",
  loginButtonLoading: "Accesso in corso...",
  loginErrorEmpty: "Inserisci email e password.",
  loginErrorInvalid: "Email o password non validi.",
  loginErrorEmailNotConfirmed: "Email non confermata.",
  loginErrorGeneric: (msg) => `Errore: ${msg}`,

  logoutButton: "Esci",
  speechLanguageLabel: "Lingua parlata",
  modeLabel: "Modalità di trascrizione",
  modeAccurate: "Preciso",
  modeAccurateTooltip: "Testo formattato con precisione (Gemini Pro)",
  modeFast: "Veloce",
  modeFastTooltip: "Trascrizione rapida grezza (Gemini Flash)",
  modeLive: "Super veloce",
  modeLiveTooltip: "Trascrizione in tempo reale (Soniox Nova)",
  liveTranscriptLabel: "IN DIRETTA:",

  statusReady: (key) => `Pronto — premi ${key} per dettare`,
  statusRecording: (key) => `Registrazione... Premi ${key} per fermare`,
  statusProcessing: "Elaborazione dettatura...",
  statusDone: "Testo incollato!",
  statusError: "Errore",
  shortcutHint: "per avviare / fermare la dettatura",
  micError: "Microfono non disponibile — consenti l'accesso nella finestra",

  lastTranscriptLabel: "ULTIMA TRASCRIZIONE:",

  shortcutLabel: "Scorciatoia",

  footerHint: "Premi la scorciatoia in qualsiasi momento per dettare.",

  trayReady: (key) => `Perfect Text — Pronto (${key})`,
  trayRecording: "REGISTRAZIONE...",
  trayProcessing: "Elaborazione...",
  trayDone: "Incollato!",
  trayError: "Errore",
  trayMenuOpen: "Apri Perfect Text",
  trayMenuQuit: "Chiudi",

  uiLanguageLabel: "Lingua interfaccia",

  shortcutUnavailable: (key) => `Scorciatoia ${key} non disponibile`,

  errorTimeout: "Il server non ha risposto in tempo. Riprova o controlla la connessione.",
  errorQuota: "I minuti disponibili sono esauriti. Aggiorna il piano su tipkam.si.",
  errorSessionExpired: "Sessione scaduta. Esci e accedi di nuovo.",
  errorGeneric: "Errore di elaborazione. Riprova.",

  errorPanelTitle: "Non è stato possibile elaborare la dettatura",
  errorPanelSubtitle: "Riprova. Se l'errore persiste:",
  errorStepWebLabel: "Nell'app web",
  errorStepWebDesc: "Controlla il limite mensile nel tuo profilo.",
  errorBtnProfile: "Apri profilo web",
  errorStepDesktopLabel: "Nell'app desktop",
  errorStepDesktopDesc: "Esci e accedi di nuovo.",
  errorBtnLogout: "Esci",
  errorBtnDismiss: "Chiudi",
};

const translations: Record<UILanguage, Translations> = { sl, en, it };

let currentUILanguage: UILanguage = "sl";

export function setUILanguage(lang: UILanguage) {
  currentUILanguage = lang;
}

export function getUILanguage(): UILanguage {
  return currentUILanguage;
}

export function t(): Translations {
  return translations[currentUILanguage];
}

export const UI_LANGUAGES: { code: UILanguage; label: string }[] = [
  { code: "sl", label: "Slovenščina" },
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
];
