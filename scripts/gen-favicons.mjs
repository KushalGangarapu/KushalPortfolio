// scripts/gen-favicons.mjs — generates Google Search & browser-compliant favicon assets
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(ROOT, 'public', 'favicon.svg'), 'utf8')

// Create HTML wrapper for rendering SVG cleanly at any dimension
const makeHtml = (svgContent) => `<!doctype html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: transparent; overflow: hidden; display: flex; }
    svg { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`

// Build a multi-resolution ICO file from PNG buffers
function buildIco(images) {
  // images: array of { width, height, buffer }
  const count = images.length
  const headerSize = 6
  const dirEntrySize = 16
  const dirSize = headerSize + count * dirEntrySize

  let totalSize = dirSize
  for (const img of images) {
    totalSize += img.buffer.length
  }

  const out = Buffer.alloc(totalSize)

  // ICONDIR header
  out.writeUInt16LE(0, 0) // Reserved
  out.writeUInt16LE(1, 2) // Type: 1 = ICO
  out.writeUInt16LE(count, 4) // Count

  let offset = dirSize
  images.forEach((img, idx) => {
    const entryOffset = headerSize + idx * dirEntrySize
    out.writeUInt8(img.width >= 256 ? 0 : img.width, entryOffset)
    out.writeUInt8(img.height >= 256 ? 0 : img.height, entryOffset + 1)
    out.writeUInt8(0, entryOffset + 2) // Color palette count
    out.writeUInt8(0, entryOffset + 3) // Reserved
    out.writeUInt16LE(1, entryOffset + 4) // Color planes
    out.writeUInt16LE(32, entryOffset + 6) // Bits per pixel
    out.writeUInt32LE(img.buffer.length, entryOffset + 8) // Image size
    out.writeUInt32LE(offset, entryOffset + 12) // Image data offset

    img.buffer.copy(out, offset)
    offset += img.buffer.length
  })

  return out
}

async function run() {
  console.log('Rendering favicon assets...')
  const browser = await chromium.launch({ channel: 'msedge' })
  const page = await browser.newPage()

  const html = makeHtml(svg)
  await page.setContent(html)

  const sizes = [16, 32, 48, 96, 180, 192, 512]
  const rendered = {}

  for (const s of sizes) {
    await page.setViewportSize({ width: s, height: s })
    const buf = await page.screenshot({ omitBackground: true, type: 'png' })
    rendered[s] = buf
  }

  await browser.close()

  // Save standard sizes
  // 1. Google Search compliant sizes (multiples of 48px)
  writeFileSync(join(ROOT, 'public', 'favicon-48x48.png'), rendered[48])
  console.log('✓ Created public/favicon-48x48.png (48x48, Google Search primary requirement)')

  writeFileSync(join(ROOT, 'public', 'favicon-96x96.png'), rendered[96])
  console.log('✓ Created public/favicon-96x96.png (96x96)')

  // 2. High-res PWA & Android / Chrome Web Store sizes
  writeFileSync(join(ROOT, 'public', 'favicon-192x192.png'), rendered[192])
  console.log('✓ Created public/favicon-192x192.png (192x192)')

  writeFileSync(join(ROOT, 'public', 'favicon-512x512.png'), rendered[512])
  console.log('✓ Created public/favicon-512x512.png (512x512)')

  // 3. Apple Touch Icon (180x180)
  writeFileSync(join(ROOT, 'public', 'apple-touch-icon.png'), rendered[180])
  console.log('✓ Created public/apple-touch-icon.png (180x180)')

  // 4. Legacy fallback favicon.png updated to 96x96 (multiple of 48)
  writeFileSync(join(ROOT, 'public', 'favicon.png'), rendered[96])
  console.log('✓ Updated public/favicon.png (96x96)')

  // 5. Multi-resolution favicon.ico containing 16x16, 32x32, and 48x48
  const icoBuf = buildIco([
    { width: 16, height: 16, buffer: rendered[16] },
    { width: 32, height: 32, buffer: rendered[32] },
    { width: 48, height: 48, buffer: rendered[48] },
  ])
  writeFileSync(join(ROOT, 'public', 'favicon.ico'), icoBuf)
  console.log('✓ Created public/favicon.ico (multi-resolution 16/32/48)')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
