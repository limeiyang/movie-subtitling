#!/usr/bin/env python3
import cairosvg
import os
from PIL import Image

def convert_svg_to_png(svg_path, output_path, size=None):
    """将 SVG 转换为 PNG"""
    if size:
        # 先转换为高分辨率，然后缩放
        temp_size = size * 2
        cairosvg.svg2png(url=svg_path, write_to=output_path, output_width=temp_size, output_height=temp_size)
        # 使用 PIL 缩放
        with Image.open(output_path) as img:
            img = img.resize((size, size), Image.LANCZOS)
            img.save(output_path)
    else:
        cairosvg.svg2png(url=svg_path, write_to=output_path)

def main():
    base_path = os.path.dirname(os.path.abspath(__file__))
    svg_path = os.path.join(base_path, 'pic.svg')
    icons_dir = os.path.join(base_path, 'src-tauri', 'icons')
    
    # 创建图标尺寸列表
    sizes = [32, 64, 128, 256, 512]
    
    print(f"转换 SVG: {svg_path}")
    print(f"目标目录: {icons_dir}")
    
    for size in sizes:
        output_path = os.path.join(icons_dir, f'{size}x{size}.png')
        print(f"生成 {size}x{size}.png...")
        convert_svg_to_png(svg_path, output_path, size)
    
    # 生成 @2x 版本
    for size in [128, 256]:
        output_path = os.path.join(icons_dir, f'{size}x{size}@2x.png')
        print(f"生成 {size}x{size}@2x.png...")
        convert_svg_to_png(svg_path, output_path, size * 2)
    
    # 复制一份作为 original.png
    import shutil
    original_path = os.path.join(icons_dir, 'original.png')
    print(f"复制为 original.png...")
    shutil.copy(output_path, original_path)
    
    print("✓ 所有图标生成完成!")

if __name__ == '__main__':
    main()
