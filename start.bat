@echo off
chcp 65001 >nul
echo ======================================
echo   Movie Subtitling 字幕生成工具
echo ======================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: Node.js 未安装
    echo 请访问 https://nodejs.org/ 下载安装
    pause
    exit /b 1
)

:: 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: npm 未安装
    pause
    exit /b 1
)

echo ✓ Node.js: 
node --version
echo ✓ npm: 
npm --version
echo.

:: 安装依赖
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo 错误: 依赖安装失败
        pause
        exit /b 1
    )
    echo.
)

:: 检查 FFmpeg
where ffmpeg >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠ 警告: FFmpeg 未安装
    echo   音频提取功能将不可用
    echo   请访问 https://ffmpeg.org/download.html 下载
    echo.
)

:: 检查 Rust
where rustc >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠ 警告: Rust 未安装
    echo   Tauri 桌面应用将不可用
    echo   请访问 https://rustup.rs/ 安装
    echo.
)

:: 检查 Whisper 模型
if not exist "models\ggml-base.bin" (
    echo ⚠ 警告: Whisper 模型未下载
    echo   本地 ASR 功能将不可用
    echo   请手动下载模型放入 models/ 目录
    echo   下载地址: https://huggingface.co/ggerganov/whisper.cpp/tree/main
    echo.
)

echo ======================================
echo   启动中...
echo ======================================
echo.
echo 启动选项：
echo   1) 仅前端 ^(Web 界面 - http://localhost:1420^)
echo   2) 完整 Tauri 桌面应用 ^(需要 Rust^)
echo.
set /p choice="请选择 [1/2，默认1]: "

if "%choice%"=="2" (
    if not exist "C:\Program Files\Rust" (
        if not exist "%USERPROFILE%\.cargo\bin\rustc.exe" (
            echo 错误: Rust 未安装，无法启动 Tauri
            pause
            exit /b 1
        )
    )
    echo.
    echo 启动 Tauri 桌面应用...
    call npm run tauri dev
) else (
    if "%choice%" neq "1" (
        echo 无效选择，默认启动前端
    )
    echo.
    echo 启动前端开发服务器...
    echo 访问地址: http://localhost:1420
    echo.
    call npm run dev
)
