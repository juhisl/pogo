import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const projectRoot = new URL('./', import.meta.url)
const htmlPaths = [
  new URL('./index.html', import.meta.url),
  new URL('./missing.html', import.meta.url),
]
const manifestPath = new URL('./site.webmanifest', import.meta.url)
const iconPaths = [
  new URL('./apple-touch-icon.png', import.meta.url),
  new URL('./icon-512.png', import.meta.url),
  new URL('./icon-1024.png', import.meta.url),
]

test('pages declare Apple touch icon and web manifest links', async () => {
  for (const htmlPath of htmlPaths) {
    const html = await fs.readFile(htmlPath, 'utf8')
    assert.match(html, /rel="apple-touch-icon"/)
    assert.match(html, /href="apple-touch-icon\.png"/)
    assert.match(html, /rel="manifest"/)
    assert.match(html, /href="site\.webmanifest"/)
  }
})

test('site.webmanifest defines high-resolution Master Ball icons', async () => {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))

  assert.equal(manifest.name, 'POGO')
  assert.ok(Array.isArray(manifest.icons))
  assert.deepEqual(
    manifest.icons.map((icon) => ({
      src: icon.src,
      sizes: icon.sizes,
      purpose: icon.purpose,
      type: icon.type,
    })),
    [
      {
        src: 'apple-touch-icon.png',
        sizes: '180x180',
        purpose: 'any',
        type: 'image/png',
      },
      {
        src: 'icon-512.png',
        sizes: '512x512',
        purpose: 'maskable any',
        type: 'image/png',
      },
      {
        src: 'icon-1024.png',
        sizes: '1024x1024',
        purpose: 'maskable any',
        type: 'image/png',
      },
    ],
  )
})

test('icon files exist and are non-empty PNG assets', async () => {
  for (const iconPath of iconPaths) {
    const stat = await fs.stat(iconPath)
    assert.ok(stat.size > 0, `${iconPath.pathname} should not be empty`)
  }

  const files = await fs.readdir(projectRoot)
  assert.ok(files.includes('apple-touch-icon.png'))
  assert.ok(files.includes('icon-512.png'))
  assert.ok(files.includes('icon-1024.png'))
})
