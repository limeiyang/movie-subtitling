@echo off
set CMAKE_GENERATOR=
set CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6
cd /d D:\codebase\github\movie-subtitling\src-tauri
rmdir /s /q target\x86_64-pc-windows-msvc 2>nul
cargo build