import struct
import zlib

def create_png(width, height):
    png = []
    png.append(struct.pack('8B', 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
    
    def crc32(data):
        crc = 0xFFFFFFFF
        for byte in data:
            crc ^= byte
            for _ in range(8):
                crc = (crc >> 1) ^ (0xEDB88320 if crc & 1 else 0)
        return (crc ^ 0xFFFFFFFF) & 0xFFFFFFFF
    
    def chunk(type_name, data):
        length = struct.pack('!I', len(data))
        chunk_type = type_name.encode('ascii')
        crc_data = chunk_type + data
        crc = struct.pack('!I', crc32(crc_data))
        return length + chunk_type + data + crc
    
    ihdr_data = struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.append(chunk('IHDR', ihdr_data))
    
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)
        for x in range(width):
            raw_data.extend([100, 150, 200, 255])
    
    compressed = zlib.compress(raw_data)
    png.append(chunk('IDAT', compressed))
    png.append(chunk('IEND', b''))
    
    return b''.join(png)

import os
os.makedirs('src-tauri/icons', exist_ok=True)

for size in [32, 64, 128, 256, 512]:
    with open(f'src-tauri/icons/{size}x{size}.png', 'wb') as f:
        f.write(create_png(size, size))

print('Icons created successfully')
