#!/usr/bin/env node

import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function convertSvgToPng(svgPath, outputPath, width, height) {
    const svgData = fs.readFileSync(svgPath);
    const resvg = new Resvg(svgData, {
        width: width,
        height: height
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    fs.writeFileSync(outputPath, pngBuffer);
    console.log(`✓ 生成 ${path.basename(outputPath)} (${width}x${height})`);
}

function main() {
    const basePath = __dirname;
    const svgPath = path.join(basePath, 'pic.svg');
    const iconsDir = path.join(basePath, 'src-tauri', 'icons');

    console.log('SVG 转 PNG 图标生成器');
    console.log(`源文件: ${svgPath}`);
    console.log(`目标目录: ${iconsDir}`);
    console.log('');

    // 创建图标尺寸
    const sizes = [
        { name: '32x32.png', width: 32, height: 32 },
        { name: '64x64.png', width: 64, height: 64 },
        { name: '128x128.png', width: 128, height: 128 },
        { name: '256x256.png', width: 256, height: 256 },
        { name: '512x512.png', width: 512, height: 512 },
        { name: '128x128@2x.png', width: 256, height: 256 },
        { name: 'original.png', width: 512, height: 512 }
    ];

    sizes.forEach(({ name, width, height }) => {
        const outputPath = path.join(iconsDir, name);
        try {
            convertSvgToPng(svgPath, outputPath, width, height);
        } catch (error) {
            console.error(`✗ 生成 ${name} 失败:`, error.message);
        }
    });

    console.log('');
    console.log('✓ 所有图标生成完成!');
}

main();
