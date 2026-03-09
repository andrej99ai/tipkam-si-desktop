mod native_overlay;

use std::os::windows::process::CommandExt;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconId},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// ─── Tray icon helper ───────────────────────────────────────────────────────
fn create_circle_rgba(r: u8, g: u8, b: u8) -> Vec<u8> {
    let size = 32u32;
    let mut pixels = vec![0u8; (size * size * 4) as usize];
    let cx = size as f64 / 2.0;
    let cy = size as f64 / 2.0;
    let radius = size as f64 / 2.0 - 1.0;
    for y in 0..size {
        for x in 0..size {
            let dx = x as f64 - cx + 0.5;
            let dy = y as f64 - cy + 0.5;
            let dist = (dx * dx + dy * dy).sqrt();
            let offset = ((y * size + x) * 4) as usize;
            if dist <= radius {
                pixels[offset] = r;
                pixels[offset + 1] = g;
                pixels[offset + 2] = b;
                pixels[offset + 3] = 255;
            } else if dist <= radius + 1.0 {
                let alpha = ((radius + 1.0 - dist) * 255.0).clamp(0.0, 255.0) as u8;
                pixels[offset] = r;
                pixels[offset + 1] = g;
                pixels[offset + 2] = b;
                pixels[offset + 3] = alpha;
            }
        }
    }
    pixels
}

struct TrayState {
    tray_id: TrayIconId,
}

struct ShortcutState2 {
    current_shortcut: Option<Shortcut>,
}

static LAST_F2: AtomicI64 = AtomicI64::new(0);

// ─── System sounds via PowerShell ───────────────────────────────────────────
fn play_system_sound(sound_type: &str) {
    let script = match sound_type {
        "start" => "[System.Media.SystemSounds]::Exclamation.Play()",
        "stop" => "[System.Media.SystemSounds]::Asterisk.Play()",
        "success" => "[System.Media.SystemSounds]::Asterisk.Play()",
        "error" => "[System.Media.SystemSounds]::Hand.Play()",
        _ => "[System.Media.SystemSounds]::Beep.Play()",
    };
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn();
}

// ─── Clipboard + paste via PowerShell ───────────────────────────────────────
fn clipboard_set(text: &str) {
    let escaped = text.replace('\'', "''");
    let script = format!("Set-Clipboard -Value '{}'", escaped);
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(0x08000000)
        .output();
}

fn simulate_ctrl_v() {
    let _ = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
        ])
        .creation_flags(0x08000000)
        .spawn();
}

fn get_tray_id(app: &tauri::AppHandle) -> TrayIconId {
    let state = app.state::<Mutex<TrayState>>();
    let guard = state.lock().unwrap();
    let id = guard.tray_id.clone();
    drop(guard);
    id
}

// ─── Parse shortcut string from frontend ────────────────────────────────────
fn parse_shortcut_string(s: &str) -> Option<Shortcut> {
    match s {
        "F2" => Some(Shortcut::new(None, Code::F2)),
        "F3" => Some(Shortcut::new(None, Code::F3)),
        "F4" => Some(Shortcut::new(None, Code::F4)),
        "F5" => Some(Shortcut::new(None, Code::F5)),
        "F6" => Some(Shortcut::new(None, Code::F6)),
        "F7" => Some(Shortcut::new(None, Code::F7)),
        "F8" => Some(Shortcut::new(None, Code::F8)),
        "F9" => Some(Shortcut::new(None, Code::F9)),
        "Ctrl+Shift+R" => Some(Shortcut::new(
            Some(Modifiers::CONTROL | Modifiers::SHIFT),
            Code::KeyR,
        )),
        "Ctrl+Shift+D" => Some(Shortcut::new(
            Some(Modifiers::CONTROL | Modifiers::SHIFT),
            Code::KeyD,
        )),
        "Ctrl+Shift+T" => Some(Shortcut::new(
            Some(Modifiers::CONTROL | Modifiers::SHIFT),
            Code::KeyT,
        )),
        _ => None,
    }
}

// ─── Tauri commands ─────────────────────────────────────────────────────────
#[tauri::command]
fn copy_and_paste(text: String) {
    clipboard_set(&text);
    std::thread::sleep(std::time::Duration::from_millis(200));
    simulate_ctrl_v();
}

#[tauri::command]
fn play_sound(sound_type: String) {
    play_system_sound(&sound_type);
}

#[tauri::command]
fn set_tray_icon(app: tauri::AppHandle, color: String) {
    let (r, g, b) = match color.as_str() {
        "green" => (14u8, 165, 233),  // #0ea5e9 — matches web app blue
        "red" => (220, 38, 38),
        "yellow" => (245, 158, 11),
        _ => (14, 165, 233),
    };
    let img = Image::new_owned(create_circle_rgba(r, g, b), 32, 32);
    let tray_id = get_tray_id(&app);
    if let Some(tray) = app.tray_by_id(&tray_id) {
        let _ = tray.set_icon(Some(img));
    }
}

#[tauri::command]
fn set_tray_tooltip(app: tauri::AppHandle, tooltip: String) {
    let tray_id = get_tray_id(&app);
    if let Some(tray) = app.tray_by_id(&tray_id) {
        let _ = tray.set_tooltip(Some(&tooltip));
    }
}

#[tauri::command]
fn show_overlay(_app: tauri::AppHandle, color: String) {
    native_overlay::show_overlay(&color);
}

#[tauri::command]
fn hide_overlay(_app: tauri::AppHandle) {
    native_overlay::hide_overlay();
}

#[tauri::command]
fn change_shortcut(app: tauri::AppHandle, shortcut_str: String) -> Result<String, String> {
    let new_shortcut = parse_shortcut_string(&shortcut_str)
        .ok_or_else(|| format!("Neznana bližnjica: {}", shortcut_str))?;

    // Unregister current shortcut
    let state = app.state::<Mutex<ShortcutState2>>();
    let mut guard = state.lock().unwrap();
    if let Some(ref old) = guard.current_shortcut {
        let _ = app.global_shortcut().unregister(*old);
    }

    // Register new shortcut
    let app_handle = app.clone();
    match app.global_shortcut().on_shortcut(new_shortcut, move |app, _, event| {
        if event.state() == ShortcutState::Pressed {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64;
            let prev = LAST_F2.swap(now, Ordering::SeqCst);
            if now - prev > 800 {
                let _ = app.emit("shortcut-pressed", ());
            }
        }
    }) {
        Ok(_) => {
            guard.current_shortcut = Some(new_shortcut);
            Ok(format!("Bližnjica spremenjena na {}", shortcut_str))
        }
        Err(e) => {
            // Try to re-register old shortcut
            if let Some(ref old) = guard.current_shortcut {
                let old_sc = *old;
                let _ = app_handle.global_shortcut().on_shortcut(old_sc, move |app, _, event| {
                    if event.state() == ShortcutState::Pressed {
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as i64;
                        let prev = LAST_F2.swap(now, Ordering::SeqCst);
                        if now - prev > 800 {
                            let _ = app.emit("shortcut-pressed", ());
                        }
                    }
                });
            }
            Err(format!("Bližnjice {} ni mogoče registrirati: {}", shortcut_str, e))
        }
    }
}

// ─── App entry ──────────────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // If user tries to open a second instance, bring existing window to front
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            copy_and_paste,
            play_sound,
            set_tray_icon,
            set_tray_tooltip,
            show_overlay,
            hide_overlay,
            change_shortcut
        ])
        .setup(move |app| {
            // ── System Tray ──
            let show_item =
                MenuItemBuilder::with_id("show", "Odpri Perfect Text").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Zapri").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .items(&[&show_item, &quit_item])
                .build()?;
            let green_img = Image::new_owned(create_circle_rgba(14, 165, 233), 32, 32);

            let tray = TrayIconBuilder::new()
                .icon(green_img)
                .menu(&tray_menu)
                .tooltip("Perfect Text — Pripravljen (F2)")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.unminimize();
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.unminimize();
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            app.manage(Mutex::new(TrayState {
                tray_id: tray.id().clone(),
            }));

            // ── Screen width for overlay ──
            let main_window = app.get_webview_window("main").unwrap();
            let sw = main_window
                .primary_monitor()
                .ok()
                .flatten()
                .or_else(|| main_window.current_monitor().ok().flatten())
                .map(|m| m.size().width as f64 / m.scale_factor())
                .unwrap_or(1920.0);

            // ── Native Win32 overlay ──
            native_overlay::create_overlay(sw);

            // ── Default shortcut: F2 ──
            let default_shortcut = Shortcut::new(None, Code::F2);
            match app
                .global_shortcut()
                .on_shortcut(default_shortcut, |app, _, event| {
                    if event.state() == ShortcutState::Pressed {
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as i64;
                        let prev = LAST_F2.swap(now, Ordering::SeqCst);
                        if now - prev > 800 {
                            let _ = app.emit("shortcut-pressed", ());
                        }
                    }
                }) {
                Ok(_) => println!("Global shortcut F2 registered successfully"),
                Err(e) => eprintln!(
                    "WARNING: Could not register F2 shortcut: {}. Is another instance running?",
                    e
                ),
            }

            app.manage(Mutex::new(ShortcutState2 {
                current_shortcut: Some(default_shortcut),
            }));

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.minimize();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
