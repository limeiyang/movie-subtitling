#!/usr/bin/env python3
import os
from PIL import Image

source_image = "/Users/meiyangli/codebase/gitlab/movie-subtitling/tubiao.png"
icons_dir = "/Users/meiyangli/codebase/gitlab/movie-subtitling/src-tauri/icons"

os.makedirs(icons_dir, exist_ok=True)

img = Image.open(source_image)
if img.mode in ('RGBA', 'LA', 'P'):
    img = img.convert('RGBA')
else:
    img = img.convert('RGB')

sizes = [32, 64, 128, 256, 512]

for size in sizes:
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    output_path = os.path.join(icons_dir, f"{size}x{size}.png")
    resized.save(output_path, "PNG")
    print(f"Generated: {output_path}")

for size in [128]:
    resized = img.resize((size * 2, size * 2), Image.Resampling.LANCZOS)
    output_path = os.path.join(icons_dir, f"{size}x{size}@2x.png")
    resized.save(output_path, "PNG")
    print(f"Generated: {output_path}")

original_path = os.path.join(icons_dir, "original.png")
img.save(original_path, "PNG")
print(f"Generated: {original_path}")

print("\nAll icons generated successfully!")
print("Note: For macOS .icns file, use the following command:")
print(f"  cd {icons_dir} && iconutil -c icns ../icons.iconset -o icon.icns")
