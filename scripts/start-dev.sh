#!/bin/bash
# Movie Subtitling 启动脚本 - 使用 MSYS2 MinGW64 环境

export PATH="/f/Program Files/nodejs:/c/Users/A/.cargo/bin:/c/msys64/mingw64/bin:$PATH"
export CC="/c/msys64/mingw64/bin/gcc.exe"
export CXX="/c/msys64/mingw64/bin/g++.exe"
export CMAKE_GENERATOR="Ninja"
export CMAKE_MAKE_PROGRAM="/c/msys64/mingw64/bin/ninja.exe"

cd /d/codebase/github/movie-subtitling
npm run tauri:dev