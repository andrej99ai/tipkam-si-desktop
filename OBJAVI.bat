@echo off
REM ─────────────────────────────────────────────────────────────────────
REM  Perfect Text — objava nove verzije
REM  DVOKLIKNI to datoteko. Vse ostalo gre samo od sebe.
REM ─────────────────────────────────────────────────────────────────────
title Perfect Text - objava nove verzije
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0objavi.ps1"
echo.
echo Pritisni katerokoli tipko za zapiranje okna...
pause >nul
