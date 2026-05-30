@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "VCVARS=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
set "MSVC_BIN=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64"
set "CMAKE_BIN=C:\tools\cmake-3.28\cmake-3.28.0-windows-x86_64\bin"
set "CUDA_BIN=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin"
set "PROJECT=D:\codebase\github\movie-subtitling"

REM Load MSVC environment
call "%VCVARS%" x64

REM Prepend paths
set "PATH=%MSVC_BIN%;%CMAKE_BIN%;%CUDA_BIN%;%PATH%"

REM Set CUDACXX so cmake uses nvcc and CUDAHOSTCXX so nvcc knows where to find cl.exe
set "CUDACXX=%CUDA_BIN%\nvcc.exe"
set "CUDAHOSTCXX=%MSVC_BIN%\cl.exe"

REM Clean whisper-rs cache
for /d /r "%PROJECT%\src-tauri\target" %%d in (whisper*) do (
    if exist "%%d" rmdir /s /q "%%d" 2>nul
)

echo === Tool check ===
where cl.exe
where link.exe
where nvcc.exe

echo.
echo === First 5 in PATH ===
set PATH
echo.

echo === Environment CUDACXX ===
echo %CUDACXX%
echo %CUDAHOSTCXX%

echo === Build ===
cd /d "%PROJECT%"
cargo build --manifest-path "src-tauri\Cargo.toml"
echo Exit code: %ERRORLEVEL%