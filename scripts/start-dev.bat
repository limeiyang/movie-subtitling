@echo off
chcp 65001 >nul
echo Movie Subtitling 启动脚本
echo.

set PATH=F:\Program Files\nodejs;%USERPROFILE%\.cargo\bin;C:\msys64\mingw64\bin;%PATH%
set CC=C:\msys64\mingw64\bin\gcc.exe
set CXX=C:\msys64\mingw64\bin\g++.exe
set CMAKE_GENERATOR=Ninja
set CMAKE_MAKE_PROGRAM=C:\msys64\mingw64\bin\ninja.exe

cd /d "%~dp0.."
npm run tauri:dev