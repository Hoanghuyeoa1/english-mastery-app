const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Precompute CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcPayload);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPng(size, isMaskable = false) {
  // 1. Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // 2. IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // deflate
  ihdrData[11] = 0; // standard filter
  ihdrData[12] = 0; // non-interlaced
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // 3. Raw image scanlines
  const scanlines = Buffer.alloc(size * (1 + size * 4));
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size * 0.45;
  const innerRadius = size * 0.35;

  let offset = 0;
  for (let y = 0; y < size; y++) {
    scanlines[offset++] = 0; // filter type 0: None

    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background color: #0f172a
      let r = 15;
      let g = 23;
      let b = 42;
      let a = 255;

      if (!isMaskable) {
        // Rounded app icon shape
        const cornerR = size * 0.22;
        const boundedX = Math.abs(dx) - (size / 2 - cornerR);
        const boundedY = Math.abs(dy) - (size / 2 - cornerR);
        const outsideDist = Math.hypot(Math.max(0, boundedX), Math.max(0, boundedY));
        if (outsideDist > cornerR) {
          a = 0; // Transparent outside corner
        }
      }

      if (a > 0) {
        // Center Emblem: Gradient circle & "M" or Star badge
        if (dist <= outerRadius && dist >= innerRadius) {
          // Ring: Teal to Indigo gradient
          const factor = (y / size);
          r = Math.round(16 * (1 - factor) + 129 * factor);  // #10b981 to #818cf8
          g = Math.round(185 * (1 - factor) + 140 * factor);
          b = Math.round(129 * (1 - factor) + 248 * factor);
        } else if (dist < innerRadius) {
          // Inner core: Deep navy with subtle radial glow
          const innerFactor = dist / innerRadius;
          r = Math.round(30 + 15 * (1 - innerFactor));
          g = Math.round(41 + 40 * (1 - innerFactor));
          b = Math.round(70 + 80 * (1 - innerFactor));

          // Draw an elegant "M" letter in center
          const relX = (x - cx) / (innerRadius * 0.65);
          const relY = (y - cy) / (innerRadius * 0.65);

          // Draw Letter "M" paths
          const inM = (
            (Math.abs(relX) <= 0.85 && Math.abs(relY) <= 0.75) &&
            (
              // Left stem
              (relX >= -0.85 && relX <= -0.55 && relY >= -0.75 && relY <= 0.75) ||
              // Right stem
              (relX >= 0.55 && relX <= 0.85 && relY >= -0.75 && relY <= 0.75) ||
              // Left diagonal
              (relX >= -0.55 && relX <= 0.0 && Math.abs((relX * 1.5) - relY) <= 0.28 && relY >= -0.75 && relY <= 0.55) ||
              // Right diagonal
              (relX >= 0.0 && relX <= 0.55 && Math.abs((-relX * 1.5) - relY) <= 0.28 && relY >= -0.75 && relY <= 0.55)
            )
          );

          if (inM) {
            // Gradient Emerald to Cyan
            const mFactor = (relY + 0.75) / 1.5;
            r = Math.round(52 * (1 - mFactor) + 16 * mFactor);
            g = Math.round(211 * (1 - mFactor) + 185 * mFactor);
            b = Math.round(153 * (1 - mFactor) + 129 * mFactor);
          }
        }
      }

      scanlines[offset++] = r;
      scanlines[offset++] = g;
      scanlines[offset++] = b;
      scanlines[offset++] = a;
    }
  }

  // 4. IDAT
  const compressed = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);

  // 5. IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Ensure destination directories exist
const publicDir = path.resolve(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate Icons
console.log('Generating PWA PNG icons...');
const icon192 = createPng(192, false);
const icon512 = createPng(512, false);
const maskable512 = createPng(512, true);

// Save to public root
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
fs.writeFileSync(path.join(publicDir, 'maskable-icon-512.png'), maskable512);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), icon192);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icon192.subarray(0, Math.min(icon192.length, 32768))); // Valid fallback

// Also save to public/icons for both relative path conventions
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), icon192);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), icon512);
fs.writeFileSync(path.join(iconsDir, 'maskable-icon-512.png'), maskable512);

// Masked SVG Icon for Safari
const maskedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="112" fill="#0f172a"/>
  <circle cx="256" cy="256" r="180" stroke="#10b981" stroke-width="28"/>
  <path d="M160 360V152L256 280L352 152V360" stroke="#34d399" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'masked-icon.svg'), maskedSvg);

console.log('Successfully generated all PWA icons in public/ and public/icons/!');
