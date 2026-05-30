@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "VCVARS=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
set "MSVC_BIN=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64"
set "CMAKE_BIN=C:\tools\cmake-3.28\cmake-3.28.0-windows-x86_64\bin"
set "PROJECT=D:\codebase\github\movie-subtitling"

REM Load MSVC environment
echo [1] Loading MSVC vcvars...
call "%VCVARS%" x64
if %ERRORLEVEL% neq 0 (
    echo [ERROR] vcvarsall.bat failed
    exit /b 1
)

REM Verify MSVC tools
echo [2] Verifying MSVC tools...
where cl.exe
where link.exe
where nvcc.exe

REM Prepend MSVC and CMake paths to ensure MSVC tools take priority over Git tools
echo [3] Adjusting PATH priority...
set "PATH=%MSVC_BIN%;%CMAKE_BIN%;%PATH%"

echo [4] First 5 in PATH after adjustment:
for /f "tokens=1* delims=;" %%a in ("%PATH%") do echo   %%a
for /f "tokens=1* delims=;" %%a in ("%PATH%") do (
    for /f "tokens=1* delims=;" %%c in ("%%b") do echo   %%c
)

REM Clean whisper-rs cache
echo [5] Cleaning whisper-rs cache...
for /d /r "%PROJECT%\src-tauri\target" %%d in (whisper*) do (
    if exist "%%d" rmdir /s /q "%%d" 2>nul
)

REM Build
echo [6] Starting cargo build...
cd /d "%PROJECT%"
cargo build --manifest-path "src-tauri\Cargo.toml"
echo.
echo [DONE] Exit code: %ERRORLEVEL%