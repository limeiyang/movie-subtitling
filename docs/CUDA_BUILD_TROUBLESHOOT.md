# whisper-rs + CUDA + Windows MSVC Build Guide

## 问题概述

在 Windows x64 环境下，使用 `whisper-rs` 的 `cuda` feature 编译时遇到 CMake 错误：

```
CMake Error: No CUDA toolset found.
```

或后续错误：

```
error MSB4019: 找不到导入的项目"...\CUDA .props"
```

---

## 环境

| 组件 | 版本 | 路径 |
|------|------|------|
| NVIDIA GPU | RTX 3060 Ti (compute 8.6) | - |
| CUDA Toolkit | 12.6 | `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6` |
| MSVC BuildTools | 2022 (14.44.35207) | `E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools` |
| CMake (系统) | 4.3.3 | `C:\Program Files\CMake` |
| CMake (使用) | 3.28.0 | `C:\tools\cmake-3.28\cmake-3.28.0-windows-x86_64` |
| Rust | 1.88.0 | - |

---

## 根本原因

### 1. CMake 4.x 与 cmake-rs 0.1.58 不兼容

`whisper-rs-sys` 依赖 `cmake-rs 0.1.58`，该版本对 CMake 4.x 的 CUDA 工具链检测逻辑处理不当。

**解决：降级 CMake 到 3.28.0**

下载 `cmake-3.28.0-windows-x86_64.zip`（约 41MB），解压到 `C:\tools\cmake-3.28\`。

### 2. MSVC BuildTools 缺少 CUDA MSBuild 集成文件

使用 Visual Studio **BuildTools**（而非完整 IDE）时，CUDA Toolkit 的 MSBuild 自定义文件（`.props`、`.targets`）不会被自动安装到 BuildTools 目录。

这些文件位于 CUDA Toolkit 目录：
```
C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\extras\visual_studio_integration\MSBuildExtensions\
```

需要手动复制到 BuildTools 的 MSBuild 目录：
```
E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Microsoft\VC\v170\BuildCustomizations\
```

需要**管理员权限**。复制以下 4 个文件：
- `CUDA 12.6.props`
- `CUDA 12.6.targets`
- `CUDA 12.6.xml`
- `Nvda.Build.CudaTasks.v12.6.dll`

### 3. whisper-rs-sys build.rs 未设置 CUDA 工具链变量

`whisper-rs-sys 0.15.0` 的 `build.rs` 在启用 `cuda` feature 时，只设置了：
- `GGML_CUDA = ON`
- `CMAKE_CUDA_FLAGS = "-Xcompiler=-fPIC"`

但**没有设置** Visual Studio generator 所需的：
- `CMAKE_VS_PLATFORM_TOOLSET_CUDA`
- `CMAKE_VS_PLATFORM_TOOLSET_CUDA_CUSTOM_DIR`
- `CMAKE_CUDA_ARCHITECTURES`（对 RTX 3060 Ti 应为 `86`）

---

## 解决方案

### Step 1: 降级 CMake

```powershell
# 下载 CMake 3.28.0
Invoke-WebRequest -Uri 'https://github.com/Kitware/CMake/releases/download/v3.28.0/cmake-3.28.0-windows-x86_64.zip' -OutFile 'C:\tools\cmake-3.28.zip'
# 解压
Expand-Archive 'C:\tools\cmake-3.28.zip' -DestinationPath 'C:\tools\cmake-3.28'
```

### Step 2: 复制 CUDA MSBuild 集成文件（需管理员）

```powershell
Copy-Item "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\extras\visual_studio_integration\MSBuildExtensions\*" "E:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Microsoft\VC\v170\BuildCustomizations\" -Force
```

### Step 3: 创建 patched whisper-rs-sys

在项目目录下创建 `src-tauri/patches/whisper-rs-sys/` 目录，复制原始 crate 内容并修改 `build.rs`：

```rust
// 在 if cfg!(feature = "cuda") { } 块中，添加：
config.define("CMAKE_VS_PLATFORM_TOOLSET_CUDA", "12.6");
config.define("CMAKE_VS_PLATFORM_TOOLSET_CUDA_CUSTOM_DIR", "C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.6");
config.define("CMAKE_CUDA_ARCHITECTURES", "86");
```

### Step 4: 添加 Cargo patch

在 `src-tauri/Cargo.toml` 末尾添加：

```toml
[patch.crates-io]
whisper-rs-sys = { path = "patches/whisper-rs-sys" }
```

### Step 5: 编译

```powershell
cargo build --manifest-path src-tauri/Cargo.toml
```

---

## 关键调试信息

### 查看 CMake 配置缓存
```
src-tauri/target/x86_64-pc-windows-msvc/debug/build/whisper-rs-sys-*/out/build/CMakeCache.txt
```

### 查看 CMake 配置日志
```
src-tauri/target/x86_64-pc-windows-msvc/debug/build/whisper-rs-sys-*/out/build/CMakeFiles/CMakeConfigureLog.yaml
```

### 验证 CUDA 依赖链接
```bash
ldd target/x86_64-pc-windows-msvc/debug/movie-subtitling.exe | grep cuda
```

成功输出示例：
```
nvcuda.dll => /c/WINDOWS/SYSTEM32/nvcuda.dll
cudart64_12.dll => /c/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.6/bin/cudart64_12.dll
cublas64_12.dll => /c/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.6/bin/cublas64_12.dll
cublasLt64_12.dll => ...
```

---

## 相关错误对照

| 错误信息 | 原因 | 解决 |
|---------|------|------|
| `No CUDA toolset found` | CMAKE_VS_PLATFORM_TOOLSET_CUDA 未设置 | 添加 patch |
| `No NVIDIA GPU detected` | CMAKE_CUDA_ARCHITECTURES 为 native 但运行时无法访问 GPU | 设置为 "86" |
| `找不到导入的项目 ... CUDA .props` | BuildTools 缺少 CUDA MSBuild 集成文件 | 手动复制 .props/.targets |
| CMake 4.x "Generator does not match" | cmake-rs 0.1.58 与 CMake 4.x 不兼容 | 使用 CMake 3.28 |
| `extra operand ...` (link.exe) | Git usr/bin/link.exe 干扰 MSVC link.exe | 确保 PATH 中 MSVC bin 在 Git bin 之前 |

---

## 构建产物

编译成功后，whisper-rs 会生成以下 CUDA 库：
- `out/lib/ggml-cuda.lib`（约 200MB，包含 CUDA kernels）
- `out/lib/ggml-cpu.lib`（CPU fallback）
- `out/lib/ggml.lib`

---

## 相关文件

```
src-tauri/
├── Cargo.toml              # 包含 [patch.crates-io] 配置
├── patches/
│   └── whisper-rs-sys/
│       ├── build.rs        # 已添加 CUDA toolset defines
│       └── ...             # 原始 crate 内容
```

---

## 备注

- RTX 3060 Ti 的 compute capability 是 **8.6**（Ampere 架构）
- CUDA 12.6 对 MSVC BuildTools 的支持需要手动安装 MSBuild 集成文件
- 如果同时装了多个 CUDA 版本（如 11.2 和 12.6），需要确保使用 v12.6 的路径
- whisper-rs 0.16 默认使用 whisper-rs-sys 0.15，build.rs 中已有 `CMAKE_*` 环境变量转发机制