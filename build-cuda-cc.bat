@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "VCVARS=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
set "MSVC_BIN=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64"
set "CMAKE_BIN=C:\tools\cmake-3.28\cmake-3.28.0-windows-x86_64\bin"
set "CUDA_BIN=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin"
set "PROJECT=D:\codebase\github\movie-subtitling"

REM Load MSVC environment (this sets INCLUDE, LIB, PATH etc.)
call "%VCVARS%" x64
if %ERRORLEVEL% neq 0 (
    echo [ERROR] vcvarsall.bat failed with exit code %ERRORLEVEL%
    exit /b 1
)

REM Set CC and CXX so cmake uses MSVC compilers explicitly
set "CC=cl.exe"
set "CXX=cl.exe"

REM Prepend MSVC, CMake, CUDA paths so MSVC tools are found first
set "PATH=%MSVC_BIN%;%CMAKE_BIN%;%CUDA_BIN%;%PATH%"

echo === Tool check ===
where cl.exe
where link.exe
where nvcc.exe
where cmake.exe

echo.
echo === Build ===
cd /d "%PROJECT%"

REM Clean whisper-rs cache
for /d /r "%PROJECT%\src-tauri\target" %%d in (whisper*) do (
    if exist "%%d" rmdir /s /q "%%d" 2>nul
)

REM Build with CUDA
cargo build --manifest-path "src-tauri\Cargo.toml"
echo Exit code: %ERRORLEVEL%