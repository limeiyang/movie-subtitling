#!/usr/bin/env python3
from PIL import Image
import os

source = "/Users/meiyangli/codebase/gitlab/movie-subtitling/tubiao.png"
iconset_dir = "/Users/meiyangli/codebase/gitlab/movie-subtitling/src-tauri/icons.iconset"

img = Image.open(source).convert('RGBA')

sizes = [16, 32]
for size in sizes:
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(iconset_dir, f"icon_{size}x{size}.png"), "PNG")
    print(f"Generated: icon_{size}x{size}.png")
