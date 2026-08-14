import { supabase } from "./supabase";
import { startRecording, stopRecording, isRecording } from "./recorder";
import { processDictation, DictationMode, DictationError } from "./dictation";
import { SonioxSession } from "./soniox";
import { preflightCheck, mapMicError, MIC_ISSUE_I18N } from "./preflight";
import { LANGUAGES, isSlovenian } from "./languages";
import { t, setUILanguage, getUILanguage, UILanguage, UI_LANGUAGES } from "./i18n";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

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
const lastTranscript = document.getElementById("last-transcript") as HTMLDivElement;
const lastTranscriptText = document.getElementById("last-transcript-text") as HTMLParagraphElement;
const modeAccurateBtn = document.getElementById("mode-accurate-btn") as HTMLButtonElement;
const modeLiveBtn = document.getElementById("mode-live-btn") as HTMLButtonElement;
const modeToggle = document.getElementById("mode-toggle") as HTMLDivElement;
const updateBanner = document.getElementById("update-banner") as HTMLDivElement;
const updateBannerText = document.getElementById("update-banner-text") as HTMLSpanElement;
const updateInstallBtn = document.getElementById("update-install-btn") as HTMLButtonElement;
const updateDismissBtn = document.getElementById("update-dismiss-btn") as HTMLButtonElement;
const languageSelect = document.getElementById("language-select") as HTMLSelectElement;
const shortcutSelect = document.getElementById("shortcut-select") as HTMLSelectElement;
const shortcutDisplay = document.getElementById("shortcut-key") as HTMLElement;
const uiLangLogin = document.getElementById("ui-lang-login") as HTMLSelectElement;
const uiLangMain = document.getElementById("ui-lang-main") as HTMLSelectElement;
const micWarning = document.getElementById("mic-warning") as HTMLDivElement;
const micWarningText = document.getElementById("mic-warning-text") as HTMLSpanElement;
const errorPanel = document.getElementById("error-panel") as HTMLDivElement;
const errorPanelSubtitle = document.getElementById("error-panel-subtitle") as HTMLParagraphElement;
const errorStepWeb = document.getElementById("error-step-web") as HTMLDivElement;
const errorStepDesktop = document.getElementById("error-step-desktop") as HTMLDivElement;
const errorPanelDivider = document.getElementById("error-panel-divider") as HTMLDivElement;
const btnOpenProfile = document.getElementById("btn-open-profile") as HTMLButtonElement;
const btnErrorLogout = document.getElementById("btn-error-logout") as HTMLButtonElement;
const btnErrorDismiss = document.getElementById("btn-error-dismiss") as HTMLButtonElement;

// ─── State ──────────────────────────────────────────────────────────────────
let isLoggedIn = false;
let isProcessing = false;
let lastShortcutTime = 0;
let micPermissionGranted = false;
let currentMode: DictationMode = "accurate";
let currentLanguage = "sl";
let currentShortcut = "F2";
/** Active Soniox live-mode session (null when not recording in live mode) */
let activeSonioxSession: SonioxSession | null = null;
// ─── Load saved settings from localStorage ──────────────────────────────────
function loadSettings() {
  try {
    const saved = localStorage.getItem("tipkam-settings");
    if (saved) {
      const settings = JSON.parse(saved);
      if (settings.language) currentLanguage = settings.language;
      // Migracija: hitri način je odstranjen — stare shranjene nastavitve
      // z mode "fast" preslikamo na "accurate", sicer bi obstoječi uporabniki
      // ostali na Flash modelu brez aktivnega gumba v vmesniku.
      if (settings.mode) currentMode = settings.mode === "fast" ? "accurate" : settings.mode;
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
    // Sync the active button with currentMode (in case user switched away
    // from Slovenian and back — currentMode may have changed to "accurate")
    setMode(currentMode);
  } else {
    // Hide mode toggle for other languages — standard (non-live) pot.
    // Reset "live" na "accurate", ker je Soniox trdo vezan na slovenščino;
    // za tuje jezike se "mode" backendu tako ali tako ne pošilja.
    modeToggle.style.display = "none";
    setMode("accurate"); // also updates the (now hidden) button states for consistency
  }
  saveSettings();
}

// ─── Mode toggle ────────────────────────────────────────────────────────────
function setMode(mode: DictationMode) {
  currentMode = mode;
  // Clear all active states, then apply to the matching button
  modeAccurateBtn?.classList.remove("active");
  modeLiveBtn?.classList.remove("active");

  if (mode === "accurate") modeAccurateBtn?.classList.add("active");
  else if (mode === "live") modeLiveBtn?.classList.add("active");

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

// ─── Tray / Overlay helpers ─────────────────────────────────────────────────
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
// ─── Session heartbeat (prevents JWT expiry during background throttling) ──
// WebView2 throttles JS timers when the window is hidden/minimized, which can
// freeze Supabase's internal auto-refresh timer and let the JWT expire. This
// heartbeat runs every 5 minutes and proactively refreshes the JWT if it's
// close to expiry. The check is local (no network) unless a refresh is needed,
// and refresh runs in the background — F2 latency is never affected.
let sessionHeartbeatId: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const REFRESH_LEAD_TIME_SEC = 5 * 60; // refresh when <5 min until expiry

async function checkAndRefreshSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.expires_at) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const secondsLeft = session.expires_at - nowSec;
    if (secondsLeft < REFRESH_LEAD_TIME_SEC) {
      // JWT is close to expiry — refresh in background
      await supabase.auth.refreshSession();
    }
  } catch (e) {
    // Network or auth failure — onAuthStateChange will handle SIGNED_OUT.
  }
}

function startSessionHeartbeat() {
  if (sessionHeartbeatId !== null) return;
  // Run once immediately on login (in case JWT loaded from storage is stale)
  checkAndRefreshSession();
  sessionHeartbeatId = setInterval(checkAndRefreshSession, HEARTBEAT_INTERVAL_MS);
}

function stopSessionHeartbeat() {
  if (sessionHeartbeatId !== null) {
    clearInterval(sessionHeartbeatId);
    sessionHeartbeatId = null;
  }
}

// Listen for silent sign-outs (server-side session invalidation, refresh
// failure, etc.) and bring the user back to the login screen gracefully.
supabase.auth.onAuthStateChange((event, _session) => {
  if (event === "SIGNED_OUT" && isLoggedIn) {
    stopSessionHeartbeat();
    showLogin();
  }
  // TOKEN_REFRESHED is handled internally by Supabase — nothing to do here.
});

function showLogin() {
  stopSessionHeartbeat();
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

  // Keep JWT fresh while the app is running so F2 never hits an expired token
  startSessionHeartbeat();
}

// ─── Status management ─────────────────────────────────────────────────────
// Track pending timers so a fast shortcut press in the "done"/"error" tail
// window doesn't accidentally hide the new red overlay or reset status mid-flow.
let statusOverlayTimer: ReturnType<typeof setTimeout> | null = null;
function clearStatusOverlayTimer() {
  if (statusOverlayTimer !== null) {
    clearTimeout(statusOverlayTimer);
    statusOverlayTimer = null;
  }
}

function setStatus(
  state: "ready" | "recording" | "processing" | "done" | "error",
  msg?: string
) {
  // Cancel any tail-window timer from a previous status — otherwise an
  // in-flight hideOverlay could fire during a new recording.
  clearStatusOverlayTimer();

  // Lock mode buttons during active recording or processing so the user
  // cannot switch modes mid-cycle (audio wouldn't match the selected model).
  const lock = state === "recording" || state === "processing";
  if (modeAccurateBtn) modeAccurateBtn.disabled = lock;
  if (modeLiveBtn) modeLiveBtn.disabled = lock;

  statusDot.className = "status-dot " + state;
  const key = currentShortcut;
  const tr = t();

  switch (state) {
    case "ready":
      statusText.textContent = tr.statusReady(key);
      setTrayColor("green");
      setTrayTooltip(tr.trayReady(key));
      showOverlay("#0ea5e9");
      errorPanel.style.display = "none";
      break;
    case "recording":
      statusText.textContent = tr.statusRecording(key);
      setTrayColor("red");
      setTrayTooltip(tr.trayRecording);
      showOverlay("#dc2626");
      break;
    case "processing":
      statusText.textContent = msg || tr.statusProcessing;
      setTrayColor("yellow");
      setTrayTooltip(tr.trayProcessing);
      showOverlay("#d97706");
      break;
    case "done":
      statusText.textContent = msg || tr.statusDone;
      setTrayColor("green");
      setTrayTooltip(tr.trayDone);
      showOverlay("#16a34a");
      statusOverlayTimer = setTimeout(() => {
        statusOverlayTimer = null;
        hideOverlay();
      }, 2000);
      break;
    case "error":
      statusText.textContent = msg || tr.statusError;
      setTrayColor("green");
      setTrayTooltip(tr.trayError);
      showOverlay("#dc2626");
      statusOverlayTimer = setTimeout(() => {
        statusOverlayTimer = null;
        hideOverlay();
      }, 4000);
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
  // Clean up any active recording sessions before signing out
  if (activeSonioxSession) {
    try { await activeSonioxSession.stop(); } catch (_) { /* */ }
    activeSonioxSession = null;
  }
  if (isRecording()) {
    try { await stopRecording(); } catch (_) { /* */ }
  }
  isProcessing = false;
  clearStatusOverlayTimer();
  hideOverlay();
  await supabase.auth.signOut();
  showLogin();
}

// ─── Non-modal mic warning (silence watchdog) ──────────────────────────────
function showMicWarning() {
  if (micWarning && micWarningText) {
    micWarningText.textContent = t().micSilenceWarning;
    micWarning.style.display = "block";
  }
}
function hideMicWarning() {
  if (micWarning) micWarning.style.display = "none";
}

/** Lokalizirano sporočilo za pred-snemalno / getUserMedia napako mikrofona */
function micMessage(err: any): string {
  const issue = mapMicError(err);
  const key = MIC_ISSUE_I18N[issue];
  return (t() as any)[key] ?? t().micError;
}

/** Prikaže napako mikrofona takoj (preden uporabnik govori) in se vrne v ready. */
function showMicError(message: string) {
  setStatus("error", message);
  setTimeout(() => {
    if (!isRecording() && !activeSonioxSession) setStatus("ready");
  }, 6000);
}

// ─── Finalize standard (MediaRecorder) recording ────────────────────────────
// Skupna pot za: (a) normalni drugi pritisk F2, (b) samodejni abort ob izgubi
// mikrofona. `lostMic` ob izgubi prikaže ustrezno sporočilo, a vseeno obdela
// in prilepi dosedanji posnetek (besedila ne zavržemo).
async function finalizeStandardRecording(lostMic = false) {
  if (isProcessing || !isRecording()) return;
  isProcessing = true;
  hideMicWarning();
  setStatus("processing");
  try {
    const { audioBase64, durationSeconds } = await stopRecording();
    const result = await processDictation(audioBase64, currentMode, currentLanguage, durationSeconds);
    await invoke("copy_and_paste", { text: result.final_text });
    setStatus("done", t().statusDone);
    showLastTranscript(result.final_text);
    if (lostMic) {
      // Po prilepitvi še na kratko sporoči, da je bil mikrofon odklopljen.
      setTimeout(() => setStatus("error", t().micDisconnected), 1500);
    }
    setTimeout(() => {
      if (!isRecording() && !activeSonioxSession) setStatus("ready");
    }, lostMic ? 6000 : 4000);
  } catch (err: any) {
    console.error("Dictation error:", err);
    await bringWindowToFront();
    setStatus("error");
    showErrorPanel(err instanceof DictationError ? err : undefined);
  } finally {
    isProcessing = false;
  }
}

// ─── F2 / Shortcut handler ─────────────────────────────────────────────────
async function handleShortcutPress() {
  const now = Date.now();
  if (now - lastShortcutTime < 1000) return;
  lastShortcutTime = now;
  if (!isLoggedIn) return;
  if (isProcessing) return;

  // ── Case 1: Soniox live session active → stop it ───────────────────────
  if (activeSonioxSession) {
    isProcessing = true;
    // Prikaži stanje obdelave (rumeno) enako kot v ostalih načinih — tudi če
    // finalizacija traja le ~1 s, mora biti povratna informacija dosledna.
    setStatus("processing");
    try {
      const session = activeSonioxSession;
      activeSonioxSession = null;
      const { text, durationSeconds: _dur } = await session.stop();

      if (!text.trim()) {
        setStatus("error", t().statusError);
        showLastTranscript(""); // reset to plain label
        setTimeout(() => { if (!activeSonioxSession) setStatus("ready"); }, 4000);
      } else {
        await invoke("copy_and_paste", { text });
        setStatus("done", t().statusDone);
        showLastTranscript(text); // final text + restore label
        setTimeout(() => { if (!activeSonioxSession) setStatus("ready"); }, 4000);
      }
    } catch (err: any) {
      activeSonioxSession = null;
      console.error("Live dictation stop error:", err);
      await bringWindowToFront();
      setStatus("error");
      showErrorPanel(err instanceof DictationError ? err : undefined);
    } finally {
      isProcessing = false;
    }
    return;
  }

  // ── Case 2: MediaRecorder active → stop & process ──────────────────────
  if (isRecording()) {
    await finalizeStandardRecording(false);
    return;
  }

  // ── Case 3: Nothing active → start recording ───────────────────────────
  if (!micPermissionGranted) await bringWindowToFront();

  // ── FAIL-FAST PRE-FLIGHT ──
  // Preveri dovoljenje + prisotnost naprave PREDEN karkoli zaženemo. Če je
  // mikrofon blokiran ali ga ni, uporabnika opozorimo TAKOJ — preden govori.
  // (getUserMedia se ne porabi tukaj; "busy"/"constraint" napake se ujamejo
  // ob pravem zajemu spodaj, kar je še vedno pred rdečim indikatorjem.)
  hideMicWarning();
  const issue = await preflightCheck();
  if (issue) {
    await bringWindowToFront();
    showMicError((t() as any)[MIC_ISSUE_I18N[issue]] ?? t().micError);
    return;
  }

  if (currentMode === "live") {
    // ── Live mode: Soniox WebSocket streaming ──
    try {
      // Show "connecting" state immediately — gives instant visual feedback
      // while mic + WebSocket setup runs in the background (~0.5–1 s).
      setStatus("processing", t().statusConnecting);

      const session = new SonioxSession({
        onTranscriptUpdate: (text) => {
          // Update the live transcript panel in real time
          updateLiveTranscript(text);
        },
        // Zajem teče (zvok se shranjuje) → RDEČA TAKOJ, čeprav se WebSocket
        // še vzpostavlja v ozadju. Nič se ne izgubi — vzorci gredo v
        // predpomnilnik in se ob vzpostavitvi povezave pošljejo naprej.
        onCaptureStarted: () => setStatus("recording"),
        // Mikrofon odklopljen ALI WebSocket prekinjen med sejo → ustavi in
        // ohrani dosedanje besedilo.
        onDisconnect: () => abortLiveSession(),
        // 15 s brez tokenov → nemodalno opozorilo (seje NE ustavljamo).
        onSilence: () => showMicWarning(),
        onSound: () => hideMicWarning(),
      });
      await session.start();
      activeSonioxSession = session;
      micPermissionGranted = true;

      // Show live transcript panel with "live" label
      if (lastTranscript && lastTranscriptText) {
        lastTranscript.style.display = "block";
        const lbl = lastTranscript.querySelector("label");
        if (lbl) lbl.textContent = t().liveTranscriptLabel;
        lastTranscriptText.textContent = "...";
      }
      setStatus("recording");
    } catch (err: any) {
      activeSonioxSession = null;
      console.error("Live recording start error:", err);
      await bringWindowToFront();
      setStatus("error");
      if (err instanceof DictationError) {
        // Quota, auth, or generic — error panel handles all DictationError types
        showErrorPanel(err);
      } else if (err instanceof DOMException && mapMicError(err) !== "unknown") {
        // Mikrofon: blokiran / ni najden / zaseden / … — specifično sporočilo
        showMicError(micMessage(err));
      } else {
        // Unknown error (AudioContext, network, etc.) — show generic error panel
        showErrorPanel(new DictationError(err?.message || "Live mode error", "generic"));
      }
    }
  } else {
    // ── Standard mode: MediaRecorder (accurate / fast) ──
    try {
      // Show "preparing mic" (yellow) immediately — gives instant visual
      // feedback while getUserMedia + MediaRecorder warm-up runs (~200–500 ms
      // on cold start). This matches the "connecting" state shown in live
      // mode and signals to the user "wait for red before speaking".
      setStatus("processing", t().statusPreparingMic);
      await startRecording({
        // Mikrofon odklopljen/utišan med snemanjem → obdelaj dosedanji posnetek.
        onLost: () => { void finalizeStandardRecording(true); },
        // RMS watchdog: 15 s tišine → nemodalno opozorilo.
        onSilence: () => showMicWarning(),
        onSound: () => hideMicWarning(),
      });
      micPermissionGranted = true;
      setStatus("recording");
    } catch (err: any) {
      console.error("Recording start error:", err);
      await bringWindowToFront();
      // Specifično sporočilo glede na vrsto napake mikrofona.
      showMicError(micMessage(err));
    }
  }
}

/** Ustavi aktivno Soniox sejo ob izgubi mikrofona/povezave, ohrani besedilo. */
async function abortLiveSession() {
  if (!activeSonioxSession || isProcessing) return;
  isProcessing = true;
  hideMicWarning();
  const session = activeSonioxSession;
  activeSonioxSession = null;
  try {
    const { text } = await session.stop();
    if (text.trim()) {
      await invoke("copy_and_paste", { text });
      showLastTranscript(text);
    }
  } catch (_) { /* */ }
  await bringWindowToFront();
  setStatus("error", t().micDisconnected);
  setTimeout(() => {
    if (!isRecording() && !activeSonioxSession) setStatus("ready");
  }, 6000);
  isProcessing = false;
}

/** Update the transcript panel with live (in-progress) text */
function updateLiveTranscript(text: string) {
  if (lastTranscript && lastTranscriptText) {
    lastTranscriptText.textContent = text || "...";
  }
}

// ─── Error panel ───────────────────────────────────────────────────────────
function showErrorPanel(err?: DictationError) {
  const tr = t();
  const type = err?.type ?? "generic";

  // Reset to all-visible state, then narrow down based on type.
  errorStepWeb.style.display = "";
  errorStepDesktop.style.display = "";
  errorPanelDivider.style.display = "";
  errorPanelSubtitle.textContent = tr.errorPanelSubtitle;

  switch (type) {
    case "timeout":
      // Network/server slow — no actionable steps, just message + Close.
      errorPanelSubtitle.textContent = tr.errorTimeout;
      errorStepWeb.style.display = "none";
      errorStepDesktop.style.display = "none";
      errorPanelDivider.style.display = "none";
      break;
    case "quota":
      // Limit exceeded — only the "check profile" step is relevant.
      errorPanelSubtitle.textContent = tr.errorQuota;
      errorStepDesktop.style.display = "none";
      errorPanelDivider.style.display = "none";
      break;
    case "auth":
      // Session expired — only the "sign out and back in" step is relevant.
      errorPanelSubtitle.textContent = tr.errorSessionExpired;
      errorStepWeb.style.display = "none";
      errorPanelDivider.style.display = "none";
      break;
    case "generic":
    default:
      // Unknown error — show both steps with default subtitle.
      break;
  }

  errorPanel.style.display = "block";
  // Hide last transcript while error is shown
  if (lastTranscript) lastTranscript.style.display = "none";
}

function hideErrorPanel() {
  errorPanel.style.display = "none";
  setStatus("ready");
}

btnErrorDismiss.addEventListener("click", hideErrorPanel);

btnOpenProfile.addEventListener("click", async () => {
  try { await open("https://tipkam.si/"); } catch (e) { /* */ }
});

btnErrorLogout.addEventListener("click", async () => {
  hideErrorPanel();
  await supabase.auth.signOut();
  showLogin();
});

// ─── Last transcript display ────────────────────────────────────────────────
function showLastTranscript(text: string) {
  if (lastTranscript && lastTranscriptText) {
    // Restore label to the standard "last transcript" label (in case it
    // was showing the live "V ŽIVO:" label from a previous live session).
    const lbl = lastTranscript.querySelector("label");
    if (lbl) lbl.textContent = t().lastTranscriptLabel;

    if (!text.trim()) {
      lastTranscript.style.display = "none";
      return;
    }
    lastTranscript.style.display = "block";
    lastTranscriptText.textContent =
      text.length > 300 ? text.substring(0, 300) + "..." : text;
  }
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
if (modeAccurateBtn) modeAccurateBtn.addEventListener("click", () => setMode("accurate"));
if (modeLiveBtn) modeLiveBtn.addEventListener("click", () => setMode("live"));
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

// ─── Deep link listeners for OAuth callback ─────────────────────────────────
// Method 1: deep-link plugin (for fresh app launch via deep link)
onOpenUrl((urls: string[]) => {
  for (const url of urls) {
    if (url.startsWith("perfecttext://auth-callback")) {
      handleDeepLinkCallback(url);
    }
  }
});

// Method 2: single-instance plugin forwards deep link from second instance
// When the app is already running and a deep link opens, Windows tries to launch
// a new instance. The single-instance plugin intercepts it and emits this event.
listen("deep-link-received", (event) => {
  const url = event.payload as string;
  if (url.startsWith("perfecttext://auth-callback")) {
    handleDeepLinkCallback(url);
  }
});

// ─── Auto-update ────────────────────────────────────────────────────────────
let pendingUpdate: Awaited<ReturnType<typeof check>> | null = null;

async function checkForUpdates() {
  try {
    const update = await check();
    if (update?.available) {
      pendingUpdate = update;
      if (updateBannerText) updateBannerText.textContent = t().updateAvailable;
      if (updateInstallBtn) updateInstallBtn.textContent = t().updateInstall;
      if (updateBanner) updateBanner.style.display = "flex";
    }
  } catch (e) {
    // Update check failed silently — user is not bothered
    console.log("Update check skipped:", e);
  }
}

if (updateInstallBtn) {
  updateInstallBtn.addEventListener("click", async () => {
    if (!pendingUpdate) return;
    updateInstallBtn.textContent = "...";
    updateInstallBtn.disabled = true;
    try {
      await pendingUpdate.downloadAndInstall();
      await relaunch();
    } catch (e) {
      console.error("Update install failed:", e);
      updateInstallBtn.textContent = t().updateInstall;
      updateInstallBtn.disabled = false;
    }
  });
}

if (updateDismissBtn) {
  updateDismissBtn.addEventListener("click", () => {
    if (updateBanner) updateBanner.style.display = "none";
  });
}

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
    checkForUpdates();
  } else {
    showLogin();
  }
}

init();
