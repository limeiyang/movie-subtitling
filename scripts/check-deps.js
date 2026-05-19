#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const YELLOW = '\x1b[1;33m';
const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const RESET = '\x1b[0m';

console.log('\n======================================');
console.log('  Movie Subtitling - 环境检查');
console.log('======================================\n');

let hasWarnings = false;

// 检查 Node.js
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`${GREEN}✓${RESET} Node.js: ${nodeVersion}`);
} catch {
  console.log(`${RED}✗${RESET} Node.js: 未安装`);
  console.log('  请访问 https://nodejs.org/ 下载安装\n');
  process.exit(1);
}

// 检查 npm
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`${GREEN}✓${RESET} npm: ${npmVersion}`);
} catch {
  console.log(`${RED}✗${RESET} npm: 未安装`);
  process.exit(1);
}

console.log('');

// 检查 node_modules
if (!existsSync('node_modules')) {
  console.log(`${YELLOW}⚠${RESET} 首次运行，正在安装依赖...\n`);
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('');
  } catch {
    console.log(`${RED}✗${RESET} 依赖安装失败`);
    process.exit(1);
  }
} else {
  console.log(`${GREEN}✓${RESET} 依赖已安装`);
}

console.log('');

// 检查 FFmpeg
try {
  const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf8', maxBuffer: 1024 * 100 }).toString().split('\n')[0];
  console.log(`${GREEN}✓${RESET} FFmpeg: 已安装`);
} catch {
  console.log(`${YELLOW}⚠${RESET} FFmpeg: 未安装`);
  console.log('  音频提取功能将不可用');
  console.log('  macOS: brew install ffmpeg');
  console.log('  Linux: sudo apt install ffmpeg');
  console.log('  Windows: https://ffmpeg.org/download.html\n');
  hasWarnings = true;
}

// 检查 Rust
try {
  const rustVersion = execSync('rustc --version', { encoding: 'utf8' }).trim();
  console.log(`${GREEN}✓${RESET} Rust: ${rustVersion}`);
} catch {
  console.log(`${YELLOW}⚠${RESET} Rust: 未安装');
  console.log('  Tauri 桌面应用将不可用');
  console.log('  请访问 https://rustup.rs/ 安装\n');
  hasWarnings = true;
}

// 检查 Whisper 模型
const models = ['ggml-tiny.bin', 'ggml-base.bin', 'ggml-small.bin', 'ggml-medium.bin'];
const availableModels = models.filter(m => existsSync(join('models', m)));

if (availableModels.length > 0) {
  console.log(`${GREEN}✓${RESET} Whisper 模型: ${availableModels.join(', ')}`);
} else {
  console.log(`${YELLOW}⚠${RESET} Whisper 模型: 未下载`);
  console.log('  本地 ASR 功能将不可用');
  console.log('  请从 https://huggingface.co/ggerganov/whisper.cpp/tree/main 下载');
  console.log('  推荐: ggml-base.bin (150MB)\n');
  hasWarnings = true;
}

console.log('\n======================================');
if (hasWarnings) {
  console.log(`${YELLOW}  注意: 部分功能可能不可用${RESET}`);
}
console.log('  准备启动...\n');
