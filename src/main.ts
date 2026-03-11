import { supabase } from "./supabase";
import { startRecording, stopRecording, isRecording } from "./recorder";
import { processDictation, DictationMode } from "./dictation";
import { LANGUAGES, isSlovenian } from "./languages";
import { t, setUILanguage, getUILanguage, UILanguage, UI_LANGUAGES } from "./i18n";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

// ─── DOM Elements ───────────────────────────────────────────────────────────
const loginScreen = document.getElementById("login-screen") as HTMLDivElement;
const mainScreen = document.getElementById("main-screen") as HTMLDivElement;
const emailInput = document.getElementById("email") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const googleLoginBtn = document.getElementById("google-login-btn") as HTMLButtonElement;
const loginError = document.getElementById("login-error") as HTMLParagraphElement;
const userEmail = document.getElementById("user-email") as HTMLSpanElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;
const statusDot = document.getElementById("status-dot") as HTMLDivElement;
const statusText = document.getElementById("status-text") as HTMLParagraphElement;
const minimizeBtn = document.getElementById("minimize-btn") as HTMLButtonElement;
const lastTranscript = document.getElementById("last-transcript") as HTMLDivElement;
const lastTranscriptText = document.getElementById("last-transcript-text") as HTMLParagraphElement;
const modeFastBtn = document.getElementById("mode-fast-btn") as HTMLButtonElement;
const modeAccurateBtn = document.getElementById("mode-accurate-btn") as HTMLButtonElement;
const modeToggle = document.getElementById("mode-toggle") as HTMLDivElement;
const languageSelect = document.getElementById("language-select") as HTMLSelectElement;
const shortcutSelect = document.getElementById("shortcut-select") as HTMLSelectElement;
const shortcutDisplay = document.getElementById("shortcut-key") as HTMLElement;
const uiLangLogin = document.getElementById("ui-lang-login") as HTMLSelectElement;
const uiLangMain = document.getElementById("ui-lang-main") as HTMLSelectElement;

// ─── State ──────────────────────────────────────────────────────────────────
let isLoggedIn = false;
let isProcessing = false;
let lastShortcutTime = 0;
let micPermissionGranted = false;
let currentMode: DictationMode = "accurate";
let currentLanguage = "sl";
let currentShortcut = "F2";

// ─── Load saved settings from localStorage ──────────────────────────────────
function loadSettings() {
  try {
    const saved = localStorage.getItem("tipkam-settings");
    if (saved) {
      const settings = JSON.parse(saved);
      if (settings.language) currentLanguage = settings.language;
      if (settings.mode) currentMode = settings.mode;
      if (settings.shortcut) currentShortcut = settings.shortcut;
      if (settings.uiLanguage && ["sl", "en", "it"].includes(settings.uiLanguage)) {
        setUILanguage(settings.uiLanguage as UILanguage);
      }
    }
  } catch (e) {
    // ignore
  }
}

function saveSettings() {
  try {
    localStorage.setItem(
      "tipkam-settings",
      JSON.stringify({
        language: currentLanguage,
        mode: currentMode,
        shortcut: currentShortcut,
        uiLanguage: getUILanguage(),
      })
    );
  } catch (e) {
    // ignore
  }
}

// ─── Apply translations to all UI elements ──────────────────────────────────
function applyTranslations() {
  const tr = t();

  // Update all elements with data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n") as string;
    const value = (tr as any)[key];
    if (typeof value === "string") {
      el.textContent = value;
    }
  });

  // Update placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder") as string;
    const value = (tr as any)[key];
    if (typeof value === "string") {
      (el as HTMLInputElement).placeholder = value;
    }
  });

  // Update titles (tooltips)
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title") as string;
    const value = (tr as any)[key];
    if (typeof value === "string") {
      (el as HTMLElement).title = value;
    }
  });

  // Update dynamic status text (if currently in ready state)
  if (!isRecording() && !isProcessing && isLoggedIn) {
    setStatus("ready");
  }

  // Update HTML lang attribute
  document.documentElement.lang = getUILanguage();
}

// ─── UI Language change handler ─────────────────────────────────────────────
function handleUILanguageChange(newLang: UILanguage) {
  setUILanguage(newLang);

  // Sync both selectors
  if (uiLangLogin) uiLangLogin.value = newLang;
  if (uiLangMain) uiLangMain.value = newLang;

  applyTranslations();
  saveSettings();
}

// ─── Populate language dropdown ─────────────────────────────────────────────
function populateLanguages() {
  if (!languageSelect) return;
  languageSelect.innerHTML = "";

  let currentGroup = "";
  let optgroup: HTMLOptGroupElement | null = null;

  for (const lang of LANGUAGES) {
    if (lang.group !== currentGroup) {
      currentGroup = lang.group;
      optgroup = document.createElement("optgroup");
      optgroup.label = currentGroup;
      languageSelect.appendChild(optgroup);
    }
    const option = document.createElement("option");
    option.value = lang.code;
    option.textContent = lang.name;
    if (lang.code === currentLanguage) option.selected = true;
    (optgroup || languageSelect).appendChild(option);
  }
}

// ─── Language change handler ────────────────────────────────────────────────
function handleLanguageChange() {
  currentLanguage = languageSelect.value;

  if (isSlovenian(currentLanguage)) {
    // Show mode toggle for Slovenian
    modeToggle.style.display = "block";
  } else {
    // Hide mode toggle for other languages — always use "fast"
    modeToggle.style.display = "none";
    currentMode = "fast";
  }
  saveSettings();
}

// ─── Mode toggle ────────────────────────────────────────────────────────────
function setMode(mode: DictationMode) {
  currentMode = mode;
  if (modeFastBtn && modeAccurateBtn) {
    if (mode === "fast") {
      modeFastBtn.classList.add("active");
      modeAccurateBtn.classList.remove("active");
    } else {
      modeFastBtn.classList.remove("active");
      modeAccurateBtn.classList.add("active");
    }
  }
  saveSettings();
}

// ─── Shortcut change handler ────────────────────────────────────────────────
async function handleShortcutChange() {
  const newShortcut = shortcutSelect.value;
  try {
    await invoke("change_shortcut", { shortcutStr: newShortcut });
    currentShortcut = newShortcut;
    if (shortcutDisplay) shortcutDisplay.textContent = newShortcut;
    saveSettings();
  } catch (err: any) {
    // Revert dropdown if shortcut failed
    shortcutSelect.value = currentShortcut;
    setStatus("error", t().shortcutUnavailable(newShortcut));
    setTimeout(() => setStatus("ready"), 3000);
  }
}

// ─── Sound / Tray / Overlay helpers ─────────────────────────────────────────
async function playSound(soundType: string) {
  try { await invoke("play_sound", { soundType }); } catch (e) { /* */ }
}
async function setTrayColor(color: string) {
  try { await invoke("set_tray_icon", { color }); } catch (e) { /* */ }
}
async function setTrayTooltip(tooltip: string) {
  try { await invoke("set_tray_tooltip", { tooltip }); } catch (e) { /* */ }
}
async function showOverlay(color: string) {
  try { await invoke("show_overlay", { color }); } catch (e) { /* */ }
}
async function hideOverlay() {
  try { await invoke("hide_overlay"); } catch (e) { /* */ }
}

async function bringWindowToFront() {
  try {
    const win = getCurrentWindow();
    await win.unminimize();
    await win.show();
    await win.setFocus();
  } catch (e) { /* */ }
}

// ─── Screen management ─────────────────────────────────────────────────────
function showLogin() {
  loginScreen.style.display = "flex";
  mainScreen.style.display = "none";
  loginError.textContent = "";
  emailInput.value = "";
  passwordInput.value = "";
  isLoggedIn = false;
}

function showMain(email: string) {
  loginScreen.style.display = "none";
  mainScreen.style.display = "flex";
  userEmail.textContent = email;
  isLoggedIn = true;
  setStatus("ready");

  // Apply saved settings
  setMode(currentMode);
  handleLanguageChange(); // show/hide mode toggle based on language
}

// ─── Status management ─────────────────────────────────────────────────────
function setStatus(
  state: "ready" | "recording" | "processing" | "done" | "error",
  msg?: string
) {
  statusDot.className = "status-dot " + state;
  const key = currentShortcut;
  const tr = t();

  switch (state) {
    case "ready":
      statusText.textContent = tr.statusReady(key);
      setTrayColor("green");
      setTrayTooltip(tr.trayReady(key));
      hideOverlay();
      break;
    case "recording":
      statusText.textContent = tr.statusRecording(key);
      setTrayColor("red");
      setTrayTooltip(tr.trayRecording);
      showOverlay("#dc2626");
      playSound("start");
      break;
    case "processing":
      statusText.textContent = tr.statusProcessing;
      setTrayColor("yellow");
      setTrayTooltip(tr.trayProcessing);
      showOverlay("#d97706");
      playSound("stop");
      break;
    case "done":
      statusText.textContent = msg || tr.statusDone;
      setTrayColor("green");
      setTrayTooltip(tr.trayDone);
      showOverlay("#16a34a");
      playSound("success");
      setTimeout(() => hideOverlay(), 2000);
      break;
    case "error":
      statusText.textContent = msg || tr.statusError;
      setTrayColor("green");
      setTrayTooltip(tr.trayError);
      showOverlay("#dc2626");
      playSound("error");
      setTimeout(() => hideOverlay(), 4000);
      break;
  }
}

// ─── Google OAuth Login ─────────────────────────────────────────────────────
async function handleGoogleLogin() {
  const tr = t();
  const googleBtnText = googleLoginBtn.querySelector("[data-i18n]") as HTMLSpanElement;

  googleLoginBtn.disabled = true;
  if (googleBtnText) googleBtnText.textContent = tr.loginGoogleLoading;
  loginError.textContent = "";

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
        redirectTo: "perfecttext://auth-callback",
      },
    });

    if (error) throw error;
    if (data?.url) {
      // Open the OAuth URL in the user's default browser
      await open(data.url);
    }
  } catch (err: any) {
    console.error("Google OAuth error:", err);
    loginError.textContent = tr.loginErrorGeneric(err.message || "Google login failed");
  } finally {
    googleLoginBtn.disabled = false;
    if (googleBtnText) googleBtnText.textContent = tr.loginGoogleButton;
  }
}

// ─── Handle deep link callback from OAuth ───────────────────────────────────
async function handleDeepLinkCallback(url: string) {
  console.log("Deep link received:", url);

  // Bring the app window to front
  await bringWindowToFront();

  try {
    // The URL can be in two forms:
    // 1. PKCE flow: perfecttext://auth-callback?code=xxx (code in query string)
    // 2. Implicit flow: perfecttext://auth-callback#access_token=xxx&refresh_token=xxx (tokens in hash)

    // Parse the URL — deep link URLs may not parse correctly with new URL(),
    // so we handle both cases manually
    const urlStr = url.replace("perfecttext://auth-callback", "https://placeholder");
    const parsed = new URL(urlStr);

    // Try PKCE flow first (code in query params)
    const code = parsed.searchParams.get("code");
    if (code) {
      console.log("Exchanging auth code for session...");
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      if (data?.user) {
        showMain(data.user.email ?? "");
        return;
      }
    }

    // Try implicit flow (tokens in hash fragment)
    const hashStr = url.includes("#") ? url.split("#")[1] : "";
    if (hashStr) {
      const hashParams = new URLSearchParams(hashStr);
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");
      if (access_token && refresh_token) {
        console.log("Setting session from tokens...");
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) throw error;
        if (data?.user) {
          showMain(data.user.email ?? "");
          return;
        }
      }
    }

    // If we get here, check if there's an error in the URL
    const errorDesc = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");
    if (errorDesc) {
      throw new Error(errorDesc);
    }

    // Fallback: check current session (maybe Supabase handled it)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      showMain(session.user.email ?? "");
    }
  } catch (err: any) {
    console.error("OAuth callback error:", err);
    loginError.textContent = t().loginErrorGeneric(err.message || "Auth failed");
  }
}

// ─── Email/Password Login ───────────────────────────────────────────────────
async function handleLogin() {
  const tr = t();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    loginError.textContent = tr.loginErrorEmpty;
    return;
  }
  loginBtn.disabled = true;
  loginBtn.textContent = tr.loginButtonLoading;
  loginError.textContent = "";

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = tr.loginButton;

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      loginError.textContent = tr.loginErrorInvalid;
    } else if (error.message.includes("Email not confirmed")) {
      loginError.textContent = tr.loginErrorEmailNotConfirmed;
    } else {
      loginError.textContent = tr.loginErrorGeneric(error.message);
    }
    return;
  }
  if (data.user) showMain(data.user.email ?? email);
}

async function handleLogout() {
  await supabase.auth.signOut();
  showLogin();
}

// ─── F2 / Shortcut handler ─────────────────────────────────────────────────
async function handleShortcutPress() {
  const now = Date.now();
  if (now - lastShortcutTime < 1000) return;
  lastShortcutTime = now;
  if (!isLoggedIn) return;
  if (isProcessing) return;

  if (isRecording()) {
    // ── Stop recording & process ──
    isProcessing = true;
    setStatus("processing");
    try {
      const audioBase64 = await stopRecording();
      const result = await processDictation(audioBase64, currentMode, currentLanguage);
      await invoke("copy_and_paste", { text: result.final_text });
      setStatus("done", t().statusDone);
      showLastTranscript(result.final_text);
      setTimeout(() => {
        if (!isRecording()) setStatus("ready");
      }, 4000);
    } catch (err: any) {
      console.error("Dictation error:", err);
      setStatus("error", err.message || t().statusError);
      setTimeout(() => setStatus("ready"), 5000);
    } finally {
      isProcessing = false;
    }
  } else {
    // ── Start recording ──
    if (!micPermissionGranted) await bringWindowToFront();
    try {
      await startRecording();
      micPermissionGranted = true;
      setStatus("recording");
    } catch (err: any) {
      console.error("Recording start error:", err);
      await bringWindowToFront();
      setStatus("error", t().micError);
      setTimeout(() => setStatus("ready"), 5000);
    }
  }
}

// ─── Last transcript display ────────────────────────────────────────────────
function showLastTranscript(text: string) {
  if (lastTranscript && lastTranscriptText) {
    lastTranscript.style.display = "block";
    lastTranscriptText.textContent =
      text.length > 300 ? text.substring(0, 300) + "..." : text;
  }
}

// ─── Minimize handler ───────────────────────────────────────────────────────
async function handleMinimize() {
  await getCurrentWindow().minimize();
}

// ─── Event listeners ────────────────────────────────────────────────────────
loginBtn.addEventListener("click", handleLogin);
googleLoginBtn.addEventListener("click", handleGoogleLogin);
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});
emailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") passwordInput.focus();
});
logoutBtn.addEventListener("click", handleLogout);
if (minimizeBtn) minimizeBtn.addEventListener("click", handleMinimize);
if (modeFastBtn) modeFastBtn.addEventListener("click", () => setMode("fast"));
if (modeAccurateBtn) modeAccurateBtn.addEventListener("click", () => setMode("accurate"));
if (languageSelect) languageSelect.addEventListener("change", handleLanguageChange);
if (shortcutSelect) shortcutSelect.addEventListener("change", handleShortcutChange);

// UI language selectors
if (uiLangLogin) {
  uiLangLogin.addEventListener("change", () => {
    handleUILanguageChange(uiLangLogin.value as UILanguage);
  });
}
if (uiLangMain) {
  uiLangMain.addEventListener("change", () => {
    handleUILanguageChange(uiLangMain.value as UILanguage);
  });
}

// Listen for shortcut event from Rust backend
listen("shortcut-pressed", () => {
  handleShortcutPress();
});

// ─── Deep link listener for OAuth callback ──────────────────────────────────
onOpenUrl((urls: string[]) => {
  for (const url of urls) {
    if (url.startsWith("perfecttext://auth-callback")) {
      handleDeepLinkCallback(url);
    }
  }
});

// ─── Init ───────────────────────────────────────────────────────────────────
async function init() {
  loadSettings();
  populateLanguages();

  // Sync UI language selectors with saved value
  const uiLang = getUILanguage();
  if (uiLangLogin) uiLangLogin.value = uiLang;
  if (uiLangMain) uiLangMain.value = uiLang;

  // Apply translations
  applyTranslations();

  // Apply saved shortcut to dropdown
  if (shortcutSelect) shortcutSelect.value = currentShortcut;
  if (shortcutDisplay) shortcutDisplay.textContent = currentShortcut;

  // If saved shortcut is not F2 (default), tell Rust to change it
  if (currentShortcut !== "F2") {
    try {
      await invoke("change_shortcut", { shortcutStr: currentShortcut });
    } catch (e) {
      // If changing fails, revert to F2
      currentShortcut = "F2";
      if (shortcutSelect) shortcutSelect.value = "F2";
      if (shortcutDisplay) shortcutDisplay.textContent = "F2";
      saveSettings();
    }
  }

  // Check microphone permission
  try {
    const permResult = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    if (permResult.state === "granted") micPermissionGranted = true;
  } catch (e) {
    // ignore
  }

  // Check if already logged in
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    showMain(session.user.email ?? "");
  } else {
    showLogin();
  }
}

init();
