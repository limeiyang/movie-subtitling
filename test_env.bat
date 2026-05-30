@echo off
call "E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64
echo === cl.exe ===
where cl.exe
echo === nvcc.exe ===
where nvcc.exe
echo === cmake ===
C:\tools\cmake-3.28\cmake-3.28.0-windows-x86_64\bin\cmake.exe --version