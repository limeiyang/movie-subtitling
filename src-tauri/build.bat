@echo off
cd /d D:\codebase\github\movie-subtitling\src-tauri
call "E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64
set CC=cl.exe
set CXX=cl.exe
set CMAKE_GENERATOR=Visual Studio 17 2022
cargo build > build_output.txt 2>&1
type build_output.txt