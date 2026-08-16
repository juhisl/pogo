import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const missingJsPath = new URL('./missing.js', import.meta.url)
const missingHtmlPath = new URL('./missing.html', import.meta.url)
const styleCssPath = new URL('./style.css', import.meta.url)

async function loadMissingModule() {
  const source = await fs.readFile(missingJsPath, 'utf8')
  const clickHandlers = new Map()
  const timeoutCallbacks = new Map()
  let nextTimeoutId = 1
  const clearedTimeouts = []
  const elements = new Map([
    ['copyShiny', createButton('copyShiny', clickHandlers)],
    ['copyLucky', createButton('copyLucky', clickHandlers)],
    ['copyXxl', createButton('copyXxl', clickHandlers)],
    ['copyXxs', createButton('copyXxs', clickHandlers)],
    ['copyShinyPopup', createPopup()],
    ['copyLuckyPopup', createPopup()],
    ['copyXxlPopup', createPopup()],
    ['copyXxsPopup', createPopup()],
    ['shiny', { innerHTML: '', innerText: 'Shiny text' }],
    ['lucky', { innerHTML: '', innerText: 'Lucky text' }],
    ['xxl', { innerHTML: '', innerText: 'XXL text' }],
    ['xxs', { innerHTML: '', innerText: 'XXS text' }],
    ['updated', { innerHTML: '' }],
  ])
  const fetchQueue = [
    '"Bulbasaur"',
    '"Pikachu"',
    '"Snorlax"',
    '"Joltik"',
    '"2026-08-16"',
  ]
  const clipboardWrites = []
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pogo-missing-test-'))
  const modulePath = path.join(tempDir, 'missing-under-test.mjs')

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      getElementById(id) {
        return elements.get(id)
      },
    },
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText(value) {
          clipboardWrites.push(value)
        },
      },
    },
  })
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => ({
      async text() {
        return fetchQueue.shift()
      },
    }),
  })
  Object.defineProperty(globalThis, 'setTimeout', {
    configurable: true,
    value: (callback) => {
      const timeoutId = nextTimeoutId++
      timeoutCallbacks.set(timeoutId, callback)
      return timeoutId
    },
  })
  Object.defineProperty(globalThis, 'clearTimeout', {
    configurable: true,
    value: (timeoutId) => {
      clearedTimeouts.push(timeoutId)
      timeoutCallbacks.delete(timeoutId)
    },
  })

  await fs.writeFile(modulePath, source)
  const module = await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`)

  return {
    clearedTimeouts,
    clipboardWrites,
    clickHandlers,
    elements,
    namespace: module,
    runTimeout(timeoutId) {
      const callback = timeoutCallbacks.get(timeoutId)
      if (callback) {
        timeoutCallbacks.delete(timeoutId)
        callback()
      }
    },
    timeoutCallbacks,
  }
}

function createButton(id, clickHandlers) {
  return {
    id,
    addEventListener(eventName, handler) {
      clickHandlers.set(`${id}:${eventName}`, handler)
    },
  }
}

function createPopup() {
  return {
    hidden: true,
    textContent: '',
  }
}

test('missing.js exports helper functions for deduplicated page setup', async () => {
  const { namespace } = await loadMissingModule()

  assert.equal(typeof namespace.initMissingPage, 'function')
  assert.equal(typeof namespace.bindCopyButton, 'function')
  assert.equal(typeof namespace.buildSheetUrl, 'function')
  assert.equal(typeof namespace.fetchSheetValue, 'function')
  assert.equal(typeof namespace.stripCsvQuotes, 'function')
})

test('buildSheetUrl composes sheet URLs from shared base and query params', async () => {
  const { namespace } = await loadMissingModule()

  assert.equal(
    namespace.buildSheetUrl('Missing%20Shiny', 'F1'),
    'https://docs.google.com/spreadsheets/d/1GBORc_fa3vH1Jj0h-a_5tmmuYvYRwmYIAHC-Tcr6VG8/gviz/tq?tqx=out:csv&sheet=Missing%20Shiny&range=F1',
  )
  assert.equal(
    namespace.buildSheetUrl('Pokedex', 'AR1'),
    'https://docs.google.com/spreadsheets/d/1GBORc_fa3vH1Jj0h-a_5tmmuYvYRwmYIAHC-Tcr6VG8/gviz/tq?tqx=out:csv&sheet=Pokedex&range=AR1',
  )
  assert.equal(
    namespace.buildSheetUrl('Missing%20XXL', 'F1'),
    'https://docs.google.com/spreadsheets/d/1GBORc_fa3vH1Jj0h-a_5tmmuYvYRwmYIAHC-Tcr6VG8/gviz/tq?tqx=out:csv&sheet=Missing%20XXL&range=F1',
  )
  assert.equal(
    namespace.buildSheetUrl('Missing%20XXS', 'F1'),
    'https://docs.google.com/spreadsheets/d/1GBORc_fa3vH1Jj0h-a_5tmmuYvYRwmYIAHC-Tcr6VG8/gviz/tq?tqx=out:csv&sheet=Missing%20XXS&range=F1',
  )
})

test('missing.html includes popup elements for every copy button', async () => {
  const html = await fs.readFile(missingHtmlPath, 'utf8')

  assert.match(html, /id="copyShinyPopup"/)
  assert.match(html, /id="copyLuckyPopup"/)
  assert.match(html, /id="copyXxlPopup"/)
  assert.match(html, /id="copyXxsPopup"/)
  assert.match(html, /Search string copied to the clipboard/)
})

test('style.css includes larger mobile-friendly copy buttons and popup styling', async () => {
  const css = await fs.readFile(styleCssPath, 'utf8')

  assert.match(css, /\.copy-btn\s*\{[\s\S]*min-height:/)
  assert.match(css, /\.copy-btn\s*\{[\s\S]*box-shadow:/)
  assert.match(css, /\.copy-btn:active\s*\{[\s\S]*transform:/)
  assert.match(css, /\.copy-popup\s*\{/)
  assert.match(css, /\.copy-row\s*\{/)
})

test('style.css increases heading, copy button, and popup font sizes for mobile readability', async () => {
  const css = await fs.readFile(styleCssPath, 'utf8')

  assert.match(css, /\.card h3\s*\{[\s\S]*font-size:\s*1\.4rem;/)
  assert.match(css, /\.copy-btn\s*\{[\s\S]*font-size:\s*1\.12rem;/)
  assert.match(css, /\.copy-popup\s*\{[\s\S]*font-size:\s*1rem;/)
})

test('initMissingPage populates the page and copy popups survive rapid repeated clicks', async () => {
  const { namespace, clickHandlers, clipboardWrites, elements, timeoutCallbacks, clearedTimeouts, runTimeout } = await loadMissingModule()

  await namespace.initMissingPage()

  await clickHandlers.get('copyShiny:click')()
  await clickHandlers.get('copyLucky:click')()
  await clickHandlers.get('copyXxl:click')()
  await clickHandlers.get('copyXxs:click')()
  await clickHandlers.get('copyShiny:click')()
  await clickHandlers.get('copyShiny:click')()

  assert.equal(elements.get('shiny').innerHTML, 'Bulbasaur&shiny&!traded')
  assert.equal(elements.get('lucky').innerHTML, 'Pikachu&!traded')
  assert.equal(elements.get('xxl').innerHTML, 'Snorlax&xxl&!traded')
  assert.equal(elements.get('xxs').innerHTML, 'Joltik&xxs&!traded')
  assert.equal(elements.get('updated').innerHTML, 'Last updated: 2026-08-16')
  assert.deepEqual(clipboardWrites, ['Shiny text', 'Lucky text', 'XXL text', 'XXS text', 'Shiny text', 'Shiny text'])

  const shinyPopup = elements.get('copyShinyPopup')
  const luckyPopup = elements.get('copyLuckyPopup')
  assert.equal(shinyPopup.textContent, 'Search string copied to the clipboard')
  assert.equal(shinyPopup.hidden, false)
  assert.equal(luckyPopup.hidden, false)
  assert.equal(timeoutCallbacks.size, 4)
  assert.deepEqual(clearedTimeouts, [1, 5])

  runTimeout(6)

  assert.equal(shinyPopup.hidden, true)
  assert.equal(luckyPopup.hidden, false)
})
