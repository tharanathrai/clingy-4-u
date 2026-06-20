// Renders the Clingy app icon (design-system option C1, see scripts/icon-template.html)
// into PWA app icons at 512 + 192. Uses the already-installed Playwright chromium
// as the rasterizer (no sharp/imagemagick in this env).
//
//   node scripts/generate-icons.mjs
import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const template = pathToFileURL(resolve(__dirname, 'icon-template.html')).href

const sizes = [
  { size: 512, out: 'public/icon-512.png' },
  { size: 192, out: 'public/icon-192.png' },
]

const browser = await chromium.launch()
try {
  for (const { size, out } of sizes) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    })
    await page.goto(template, { waitUntil: 'networkidle' })
    // resize the fixed-512 template tile to the target px size
    await page.evaluate((s) => {
      const tile = document.querySelector('.tile')
      tile.style.width = s + 'px'
      tile.style.height = s + 'px'
    }, size)
    await page.locator('.tile').screenshot({ path: resolve(root, out) })
    await page.close()
    console.log(`wrote ${out} (${size}x${size})`)
  }
} finally {
  await browser.close()
}
