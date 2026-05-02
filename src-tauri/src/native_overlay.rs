// native_overlay.rs — Pure Win32 colored bar overlay (no WebView2)
#![allow(non_snake_case)]

use std::ffi::c_void;
use std::sync::atomic::{AtomicPtr, AtomicU32, Ordering};
use std::sync::Once;

use windows_sys::Win32::Foundation::*;
use windows_sys::Win32::Graphics::Gdi::*;
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

static OVERLAY_HWND: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());
static OVERLAY_COLOR: AtomicU32 = AtomicU32::new(0x002626DC);
static CLASS_REGISTERED: Once = Once::new();

const CLASS_NAME_STR: &str = "TipkamSiOverlay";

fn rgb_to_colorref(r: u8, g: u8, b: u8) -> u32 {
    (b as u32) << 16 | (g as u32) << 8 | (r as u32)
}

fn parse_color(color: &str) -> u32 {
    match color {
        "#dc2626" | "red" => rgb_to_colorref(220, 38, 38),
        "#f59e0b" | "#d97706" | "yellow" => rgb_to_colorref(217, 119, 6),
        "#16a34a" | "green" => rgb_to_colorref(22, 163, 74),
        "#0ea5e9" | "blue" => rgb_to_colorref(14, 165, 233),
        _ => rgb_to_colorref(220, 38, 38),
    }
}

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

unsafe extern "system" fn overlay_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_PAINT => {
            let mut ps: PAINTSTRUCT = std::mem::zeroed();
            let hdc = BeginPaint(hwnd, &mut ps);
            if !hdc.is_null() {
                let color = OVERLAY_COLOR.load(Ordering::Relaxed);
                let brush = CreateSolidBrush(color);
                FillRect(hdc, &ps.rcPaint, brush);
                DeleteObject(brush as HGDIOBJ);
                EndPaint(hwnd, &ps);
            }
            0
        }
        WM_ERASEBKGND => {
            let color = OVERLAY_COLOR.load(Ordering::Relaxed);
            let brush = CreateSolidBrush(color);
            let mut rect: RECT = std::mem::zeroed();
            GetClientRect(hwnd, &mut rect);
            FillRect(wparam as HDC, &rect, brush);
            DeleteObject(brush as HGDIOBJ);
            1
        }
        WM_DESTROY => {
            OVERLAY_HWND.store(std::ptr::null_mut(), Ordering::Relaxed);
            0
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

fn register_class() {
    CLASS_REGISTERED.call_once(|| unsafe {
        let hinstance = GetModuleHandleW(std::ptr::null());
        let class_name = to_wide(CLASS_NAME_STR);
        let wc = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(overlay_wnd_proc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: hinstance,
            hIcon: std::ptr::null_mut(),
            hCursor: std::ptr::null_mut(),
            hbrBackground: std::ptr::null_mut(),
            lpszMenuName: std::ptr::null(),
            lpszClassName: class_name.as_ptr(),
        };
        RegisterClassW(&wc);
    });
}

pub fn create_overlay(screen_width: f64) {
    register_class();
    let overlay_w: i32 = 50;
    let overlay_h: i32 = 8;
    let pos_x = ((screen_width / 2.0) - (overlay_w as f64 / 2.0)) as i32;
    unsafe {
        let hinstance = GetModuleHandleW(std::ptr::null());
        let class_name = to_wide(CLASS_NAME_STR);
        let hwnd = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
            class_name.as_ptr(),
            std::ptr::null(),
            WS_POPUP,
            pos_x,
            0,
            overlay_w,
            overlay_h,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            hinstance,
            std::ptr::null(),
        );
        if !hwnd.is_null() {
            OVERLAY_HWND.store(hwnd, Ordering::Relaxed);
            ShowWindow(hwnd, SW_HIDE);
        }
    }
}

pub fn show_overlay(color: &str) {
    let hwnd = OVERLAY_HWND.load(Ordering::Relaxed);
    if hwnd.is_null() {
        return;
    }
    OVERLAY_COLOR.store(parse_color(color), Ordering::Relaxed);
    unsafe {
        InvalidateRect(hwnd, std::ptr::null(), 1);
        ShowWindow(hwnd, SW_SHOWNOACTIVATE);
        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
    }
}

pub fn hide_overlay() {
    let hwnd = OVERLAY_HWND.load(Ordering::Relaxed);
    if hwnd.is_null() {
        return;
  