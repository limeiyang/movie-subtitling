@echo off
chcp 65001 >nul
echo ==========================================
echo Movie Subtitling - 开发模式启动
echo ==========================================
echo.

echo [1/6] 加载 MSVC 环境...
call "E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64 >nul 2>&1

echo [2/6] 设置路径 (MSVC + CMake 3.28 + CUDA)...
set "PATH=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64;C:\tools\cmake-3.28\cmake-3.28.0-windows-x86_64\bin;C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin;%PATH%"

echo [3/6] 设置 CUDA 编译器环境...
set "CUDACXX=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin\nvcc.exe"
set "CUDAHOSTCXX=E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64\cl.exe"

echo [4/6] 编译 Rust 后端 (GPU 版本)...
cd /d "%~dp0.."
cargo build --manifest-path "src-tauri\Cargo.toml"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Rust 编译失败，退出码: %ERRORLEVEL%
    pause
    exit /b %ERRORLEVEL%
)

echo [5/6] 启动前端 + Tauri 开发服务器...
echo.
echo ==========================================
echo 编译完成，现在启动 Tauri 开发模式...
echo ==========================================
echo.
npm run tauri:dev
echo.
echo [6/6] Tauri 已退出