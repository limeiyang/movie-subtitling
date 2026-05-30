@echo off
setlocal

REM Load MSVC vcvars
call "E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64

REM Check that cl.exe is accessible
where cl.exe >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] cl.exe not found after vcvarsall
    exit /b 1
)

REM Ensure CMake 3.28 and MSVC link.exe come before Git paths
set "PATH=C:\tools\cmake-3.28\cmake-3.28.0-windows-x86_64\bin;%PATH%"

REM Also put MSVC bin directory at the very front to ensure link.exe from MSVC is used
for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\SxS\VC7" /v "14.0" 2^>nul') do set VCINSTALLDIR=%%a
if defined VCINSTALLDIR (
    set "PATH=%VCINSTALLDIR%Tools\MSVC\14.44.35207\bin\HostX64\x64;%PATH%"
)

echo === PATH first 5 ===
for /f "tokens=1* delims=;" %%a in ("%PATH%") do (
    echo 1: %%a
    for /f "tokens=1* delims=;" %%c in ("%%b") do (
        echo 2: %%c
        for /f "tokens=1* delims=;" %%e in ("%%d") do (
            echo 3: %%e
        )
    )
)
echo === link.exe location ===
where link.exe
echo === cl.exe location ===
where cl.exe
echo === nvcc.exe location ===
where nvcc.exe
echo === cmake version ===
C:\tools\cmake-3.28\cmake-3.28.0-windows-x86_64\bin\cmake.exe --version

echo.
echo === Starting cargo build ===
cd /d "D:\codebase\github\movie-subtitling"
cargo build --manifest-path "src-tauri\Cargo.toml"
echo Exit code: %ERRORLEVEL%