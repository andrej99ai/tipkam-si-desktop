import { supabase } from "./supabase";
import { startRecording, stopRecording, isRecording } from "./recorder";
import { processDictation, DictationMode } from "./dictation";
import { LANGUAGES, isSlovenian } from "./languages";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

// ─── DOM Elements ───────────────────────────────────────────────────────────
const loginScreen = document.getElementById("login-screen") as HTMLDivElement;
const mainScreen = document.getElementById("main-screen") as HTMLDivElement;
const emailInput = document.getElementById("email") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
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
      })
    );
  } catch (e) {
    // ignore
  }
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
    modeToggle.style.display = "flex";
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
    setStatus("error", `Bližnjica ${newShortcut} ni na voljo`);
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

  switch (state) {
    case "ready":
      statusText.textContent = `Pripravljen — pritisni ${key} za narekovanje`;
      setTrayColor("green");
      setTrayTooltip(`Tipkam.si — Pripravljen (${key})`);
      hideOverlay();
      break;
    case "recording":
      statusText.textContent = `Snemam... Pritisni ${key} za ustavitev`;
      setTrayColor("red");
      setTrayTooltip("SNEMAM...");
      showOverlay("#dc2626");
      playSound("start");
      break;
    case "processing":
      statusText.textContent = "Obdelujem narekovanje...";
      setTrayColor("yellow");
      setTrayTooltip("Obdelujem...");
      showOverlay("#d97706");
      playSound("stop");
      break;
    case "done":
      statusText.textContent = msg || "Besedilo prilepljeno!";
      setTrayColor("green");
      setTrayTooltip("Prilepljeno!");
      showOverlay("#16a34a");
      playSound("success");
      setTimeout(() => hideOverlay(), 2000);
      break;
    case "error":
      statusText.textContent = msg || "Napaka";
      setTrayColor("green");
      setTrayTooltip("Napaka");
      showOverlay("#dc2626");
      playSound("error");
      setTimeout(() => hideOverlay(), 4000);
      break;
  }
}

// ─── Login / Logout ─────────────────────────────────────────────────────────
async function handleLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    loginError.textContent = "Vnesite email in geslo.";
    return;
  }
  loginBtn.disabled = true;
  loginBtn.textContent = "Prijavljam...";
  loginError.textContent = "";

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = "Prijava";

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      loginError.textContent = "Napačen email ali geslo.";
    } else if (error.message.includes("Email not confirmed")) {
      loginError.textContent = "Email ni potrjen.";
    } else {
      loginError.textContent = `Napaka: ${error.message}`;
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
      setStatus("done", "Besedilo prilepljeno!");
      showLastTranscript(result.final_text);
      setTimeout(() => {
        if (!isRecording()) setStatus("ready");
      }, 4000);
    } catch (err: any) {
      console.error("Dictation error:", err);
      setStatus("error", err.message || "Napaka pri obdelavi");
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
      setStatus("error", "Mikrofon ni dostopen — odobri dovoljenje v oknu");
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

// Listen for shortcut event from Rust backend
listen("shortcut-pressed", () => {
  handleShortcutPress();
});

// ─── Init ───────────────────────────────────────────────────────────────────
async function init() {
  loadSettings();
  populateLanguages();

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
