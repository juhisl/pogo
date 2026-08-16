import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const missingJsPath = new URL('./missing.js', import.meta.url)
const missingHtmlPath = new URL('./missing.html', import.meta.url)

async function loadMissingModule() {
  const source = await fs.readFile(missingJsPath, 'utf8')
  const clickHandlers = new Map()
  const elements = new Map([
    ['copyShiny', createButton('copyShiny', clickHandlers)],
    ['copyLucky', createButton('copyLucky', clickHandlers)],
    ['copyXxl', createButton('copyXxl', clickHandlers)],
    ['shiny', { innerHTML: '', innerText: 'Shiny text' }],
    ['lucky', { innerHTML: '', innerText: 'Lucky text' }],
    ['xxl', { innerHTML: '', innerText: 'XXL text' }],
    ['updated', { innerHTML: '' }],
  ])
  const fetchQueue = [
    '"Bulbasaur"',
    '"Pikachu"',
    '"Snorlax"',
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

  await fs.writeFile(modulePath, source)
  const module = await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`)

  return {
    clipboardWrites,
    clickHandlers,
    elements,
    namespace: module,
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
})

test('missing.html includes the Missing XXL card and copy button', async () => {
  const html = await fs.readFile(missingHtmlPath, 'utf8')

  assert.match(html, /<h3>Missing XXL<\/h3>/)
  assert.match(html, /id="xxl"/)
  assert.match(html, /id="copyXxl"/)
})

test('initMissingPage populates the page and wires copy buttons', async () => {
  const { namespace, clickHandlers, clipboardWrites, elements } = await loadMissingModule()

  await namespace.initMissingPage()

  clickHandlers.get('copyShiny:click')()
  clickHandlers.get('copyLucky:click')()
  clickHandlers.get('copyXxl:click')()

  assert.equal(elements.get('shiny').innerHTML, 'Bulbasaur&shiny&!traded')
  assert.equal(elements.get('lucky').innerHTML, 'Pikachu&!traded')
  assert.equal(elements.get('xxl').innerHTML, 'Snorlax&xxl&!traded')
  assert.equal(elements.get('updated').innerHTML, 'Last updated: 2026-08-16')
  assert.deepEqual(clipboardWrites, ['Shiny text', 'Lucky text', 'XXL text'])
})
