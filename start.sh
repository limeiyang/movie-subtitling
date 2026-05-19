#!/bin/bash

# Movie Subtitling - 启动脚本

echo "======================================"
echo "  Movie Subtitling 字幕生成工具"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: Node.js 未安装${NC}"
    echo "请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: npm 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js: $(node --version)"
echo -e "${GREEN}✓${NC} npm: $(npm --version)"
echo ""

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}错误: 依赖安装失败${NC}"
        exit 1
    fi
    echo ""
fi

# 检查 FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${YELLOW}⚠ 警告: FFmpeg 未安装${NC}"
    echo "  音频提取功能将不可用"
    echo "  macOS 用户请运行: brew install ffmpeg"
    echo "  Linux 用户请运行: sudo apt install ffmpeg"
    echo ""
fi

# 检查 Rust
if ! command -v rustc &> /dev/null; then
    echo -e "${YELLOW}⚠ 警告: Rust 未安装${NC}"
    echo "  Tauri 桌面应用将不可用"
    echo "  请访问 https://rustup.rs/ 安装"
    echo ""
fi

# 检查 Whisper 模型
if [ ! -f "models/ggml-base.bin" ]; then
    echo -e "${YELLOW}⚠ 警告: Whisper 模型未下载${NC}"
    echo "  本地 ASR 功能将不可用"
    echo "  请手动下载模型放入 models/ 目录"
    echo "  下载地址: https://huggingface.co/ggerganov/whisper.cpp/tree/main"
    echo ""
fi

echo "======================================"
echo "  启动中..."
echo "======================================"
echo ""
echo "启动选项："
echo "  1) 仅前端 (Web 界面 - http://localhost:1420)"
echo "  2) 完整 Tauri 桌面应用 (需要 Rust)"
echo ""
read -p "请选择 [1/2，默认1]: " choice

choice=${choice:-1}

case $choice in
    1)
        echo ""
        echo -e "${GREEN}启动前端开发服务器...${NC}"
        echo -e "访问地址: ${YELLOW}http://localhost:1420${NC}"
        echo ""
        npm run dev
        ;;
    2)
        if ! command -v rustc &> /dev/null; then
            echo -e "${RED}错误: Rust 未安装，无法启动 Tauri${NC}"
            exit 1
        fi
        echo ""
        echo -e "${GREEN}启动 Tauri 桌面应用...${NC}"
        npm run tauri dev
        ;;
    *)
        echo "无效选择，默认启动前端"
        npm run dev
        ;;
esac
