@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "VCVARS=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
set "MSVC_BIN=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64"
set "CMAKE_BIN=C:\tools\cmake-3.28\cmake-3.28.0-windows-x86_64\bin"
set "PROJECT=D:\codebase\github\movie-subtitling"

REM Load MSVC environment
call "%VCVARS%" x64

REM Prepend MSVC and CMake paths
set "PATH=%MSVC_BIN%;%CMAKE_BIN%;%PATH%"

REM Clean whisper-rs cache
for /d /r "%PROJECT%\src-tauri\target" %%d in (whisper*) do (
    if exist "%%d" rmdir /s /q "%%d" 2>nul
)

REM Build - use cmd /c to keep environment
cd /d "%PROJECT%"
cmd /c "set PATH^&^& cargo build --manifest-path \"src-tauri\Cargo.toml\""