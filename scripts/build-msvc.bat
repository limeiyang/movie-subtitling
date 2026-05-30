@echo off
setlocal EnableExtensions

echo ==========================================
echo Movie Subtitling - Clean Build with MSVC
echo ==========================================
echo.

echo [1/7] Setting MSVC environment...
set "VCDIR=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207"
set "VSWINDIR=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\VS"
set "WINDOWSSDKDIR=C:\Program Files (x86)\Windows Kits\10"
set "LLVMDIR=C:\Program Files\LLVM"

echo [2/7] Configuring PATH...
set "PATH=%VCDIR%\bin\HostX64\x64;%VCDIR%\bin\HostX64\x86;%VSWINDIR%\Enterprise;%WINDOWSSDKDIR%\bin\10.0.22621.0\x64;%LLVMDIR%\bin;F:\Program Files\nodejs;%USERPROFILE%\.cargo\bin;%PATH%"

echo [3/7] Setting CUDA environment...
set "CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6"
set "CUDA_BIN=%CUDA_PATH%\bin"
set "CUDA_LIB=%CUDA_PATH%\lib\x64"
if exist "%CUDA_BIN%\nvcc.exe" (
    echo [OK] CUDA found at %CUDA_PATH%
    set "PATH=%CUDA_BIN%;%PATH%"
) else (
    echo [WARN] CUDA not found at %CUDA_PATH%, GPU acceleration may not work
)

echo [4/7] Clearing conflicting variables...
set CC=
set CXX=

echo [5/7] Setting build environment...
set "INCLUDE=%VCDIR%\include;%WINDOWSSDKDIR%\include\10.0.22621.0\ucrt;%WINDOWSSDKDIR%\include\10.0.22621.0\shared;%WINDOWSSDKDIR%\include\10.0.22621.0\um;%WINDOWSSDKDIR%\include\10.0.22621.0\winrt;%WINDOWSSDKDIR%\include\10.0.22621.0\cppwinrt"
set "LIB=%VCDIR%\lib\ATL\amd64;%VCDIR%\lib\mmx\amd64;%VCDIR%\lib\amd64;%VCDIR%\lib\amd64_arm64;%WINDOWSSDKDIR%\lib\10.0.22621.0\ucrt\x64;%WINDOWSSDKDIR%\lib\10.0.22621.0\um\x64"
set "LIBCLANG_PATH=%LLVMDIR%\lib"
set "CMAKE_GENERATOR=Ninja"

echo [6/7] Cleaning whisper-rs build cache...
if exist "src-tauri\target\debug\build\whisper*" (
    echo Removing whisper-rs build artifacts...
    rmdir /s /q "src-tauri\target\debug\build\whisper*" 2>nul
)
if exist "src-tauri\target\x86_64-pc-windows-msvc" (
    rmdir /s /q "src-tauri\target\x86_64-pc-windows-msvc" 2>nul
)

echo [7/7] Verifying MSVC compiler...
where cl.exe >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] MSVC compiler not found!
    echo Please ensure Visual Studio Build Tools 2022 is installed.
    pause
    exit /b 1
)
echo [OK] MSVC compiler ready

echo.
echo ==========================================
echo Starting cargo build...
echo ==========================================
echo.

cd /d "%~dp0.."
cargo build --manifest-path "src-tauri\Cargo.toml"