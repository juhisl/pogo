import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const missingJsPath = new URL('./missing.js', import.meta.url)

async function loadMissingModule() {
  const source = await fs.readFile(missingJsPath, 'utf8')
  const clickHandlers = new Map()
  const elements = new Map([
    ['copyShiny', createButton('copyShiny', clickHandlers)],
    ['copyLucky', createButton('copyLucky', clickHandlers)],
    ['shiny', { innerHTML: '', innerText: 'Shiny text' }],
    ['lucky', { innerHTML: '', innerText: 'Lucky text' }],
    ['updated', { innerHTML: '' }],
  ])
  const fetchQueue = [
    '"Bulbasaur"',
    '"Pikachu"',
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
  assert.equal(typeof namespace.fetchSheetValue, 'function')
  assert.equal(typeof namespace.stripCsvQuotes, 'function')
})

test('initMissingPage populates the page and wires copy buttons', async () => {
  const { namespace, clickHandlers, clipboardWrites, elements } = await loadMissingModule()

  await namespace.initMissingPage()

  clickHandlers.get('copyShiny:click')()
  clickHandlers.get('copyLucky:click')()

  assert.equal(elements.get('shiny').innerHTML, 'Bulbasaur&shiny&!traded')
  assert.equal(elements.get('lucky').innerHTML, 'Pikachu&!traded')
  assert.equal(elements.get('updated').innerHTML, 'Last updated: 2026-08-16')
  assert.deepEqual(clipboardWrites, ['Shiny text', 'Lucky text'])
})
