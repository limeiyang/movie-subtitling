import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = '/Users/meiyangli/codebase/gitlab/movie-subtitling/tubiao_clean.svg';
const iconsDir = '/Users/meiyangli/codebase/gitlab/movie-subtitling/src-tauri/icons';
const iconsetDir = '/Users/meiyangli/codebase/gitlab/movie-subtitling/src-tauri/icons.iconset';

fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(iconsetDir, { recursive: true });

async function generateIcons() {
  const svgBuffer = fs.readFileSync(svgPath);
  
  const sizes = [32, 64, 128, 256, 512];
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size, {
        fit: sharp.fit.contain,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(iconsDir, `${size}x${size}.png`));
    console.log(`Generated: ${size}x${size}.png`);
  }

  await sharp(svgBuffer)
    .resize(256, 256, {
      fit: sharp.fit.contain,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(iconsDir, '128x128@2x.png'));
  console.log('Generated: 128x128@2x.png');

  await sharp(svgBuffer)
    .resize(1024, 1024, {
      fit: sharp.fit.contain,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(iconsDir, 'original.png'));
  console.log('Generated: original.png');

  const iconsetSizes = [16, 32, 128, 256, 512];
  for (const size of iconsetSizes) {
    await sharp(svgBuffer)
      .resize(size, size, {
        fit: sharp.fit.contain,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(iconsetDir, `icon_${size}x${size}.png`));
    console.log(`Generated: icon_${size}x${size}.png`);

    if (size < 512) {
      await sharp(svgBuffer)
        .resize(size * 2, size * 2, {
          fit: sharp.fit.contain,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`));
      console.log(`Generated: icon_${size}x${size}@2x.png`);
    }
  }

  console.log('\n✅ 所有图标生成完成！');
}

generateIcons().catch(console.error);