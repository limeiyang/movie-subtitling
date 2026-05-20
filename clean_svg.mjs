import fs from 'fs';

const svgPath = '/Users/meiyangli/codebase/gitlab/movie-subtitling/tubiao.svg';
const outputPath = '/Users/meiyangli/codebase/gitlab/movie-subtitling/tubiao_clean.svg';

let svgContent = fs.readFileSync(svgPath, 'utf8');

svgContent = svgContent.replace(/fill="rgb\(247,248,248\)"/g, 'fill="none"');
svgContent = svgContent.replace(/stroke="rgb\(247,248,248\)"/g, 'stroke="none"');

svgContent = svgContent.replace(/fill="rgb\(255,255,255\)"/g, 'fill="none"');
svgContent = svgContent.replace(/stroke="rgb\(255,255,255\)"/g, 'stroke="none"');

svgContent = svgContent.replace(/fill="white"/gi, 'fill="none"');
svgContent = svgContent.replace(/stroke="white"/gi, 'stroke="none"');

fs.writeFileSync(outputPath, svgContent);
console.log(`✅ 已清理 SVG，保存到: ${outputPath}`);