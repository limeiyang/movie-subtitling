@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo [1] Loading MSVC environment...
call "E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64 >nul 2>&1

echo [2] Verifying tools...
where cl.exe >nul 2>&1 && echo [OK] cl.exe found || echo [FAIL] cl.exe not found
where nvcc.exe >nul 2>&1 && echo [OK] nvcc.exe found || echo [FAIL] nvcc.exe not found

echo [3] Cleaning whisper-rs cache...
if exist "src-tauri\target\x86_64-pc-windows-msvc\debug\build\whisper*" (
    rmdir /s /q "src-tauri\target\x86_64-pc-windows-msvc\debug\build\whisper*" 2>nul
)

echo [4] Setting CMake path...
set "PATH=C:\tools\cmake-3.28\cmake-3.28.0-windows-x86_64\bin;%PATH%"

echo [5] Starting cargo build...
cd /d "%~dp0"
cargo build --manifest-path "src-tauri\Cargo.toml" %*
echo Exit code: %ERRORLEVEL%