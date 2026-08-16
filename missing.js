const sheetBaseUrl = 'https://docs.google.com/spreadsheets/d/1GBORc_fa3vH1Jj0h-a_5tmmuYvYRwmYIAHC-Tcr6VG8/gviz/tq?tqx=out:csv'
const copyPopupMessage = 'Search string copied to the clipboard'
const copyPopupTimers = new Map()

export function buildSheetUrl(sheetName, range) {
  return `${sheetBaseUrl}&sheet=${sheetName}&range=${range}`
}

const sheetUrls = {
  shiny: buildSheetUrl('Missing%20Shiny', 'F1'),
  lucky: buildSheetUrl('Missing%20Lucky', 'F1'),
  xxl: buildSheetUrl('Missing%20XXL', 'F1'),
  xxs: buildSheetUrl('Missing%20XXS', 'F1'),
  updated: buildSheetUrl('Pokedex', 'AR1'),
}

let initPromise

export function stripCsvQuotes(value) {
  return value.replace(/(^"|"$)/g, '')
}

export async function fetchSheetValue(url, fetchImpl = fetch) {
  const response = await fetchImpl(url)
  return stripCsvQuotes(await response.text())
}

export function showCopyPopup(popupId, doc = document, schedule = setTimeout, cancel = clearTimeout) {
  const popup = doc.getElementById(popupId)
  const previousTimeoutId = copyPopupTimers.get(popupId)

  if (previousTimeoutId) {
    cancel(previousTimeoutId)
  }

  popup.textContent = copyPopupMessage
  popup.hidden = false

  const timeoutId = schedule(() => {
    popup.hidden = true
    copyPopupTimers.delete(popupId)
  }, 1600)

  copyPopupTimers.set(popupId, timeoutId)
}

export function bindCopyButton(buttonId, contentId, popupId, doc = document, clipboard = navigator.clipboard, schedule = setTimeout, cancel = clearTimeout) {
  doc.getElementById(buttonId).addEventListener("click", async () => {
    await clipboard.writeText(doc.getElementById(contentId).innerText)
    showCopyPopup(popupId, doc, schedule, cancel)
  })
}

async function populateContent(elementId, url, suffix = '', doc = document, fetchImpl = fetch) {
  const value = await fetchSheetValue(url, fetchImpl)
  doc.getElementById(elementId).innerHTML = `${value}${suffix}`
}

export function initMissingPage({ doc = document, fetchImpl = fetch, clipboard = navigator.clipboard, schedule = setTimeout, cancel = clearTimeout } = {}) {
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      bindCopyButton("copyShiny", "shiny", "copyShinyPopup", doc, clipboard, schedule, cancel)
      bindCopyButton("copyLucky", "lucky", "copyLuckyPopup", doc, clipboard, schedule, cancel)
      bindCopyButton("copyXxl", "xxl", "copyXxlPopup", doc, clipboard, schedule, cancel)
      bindCopyButton("copyXxs", "xxs", "copyXxsPopup", doc, clipboard, schedule, cancel)

      await populateContent("shiny", sheetUrls.shiny, "&shiny&!traded", doc, fetchImpl)
      await populateContent("lucky", sheetUrls.lucky, "&!traded", doc, fetchImpl)
      await populateContent("xxl", sheetUrls.xxl, "&xxl&!traded", doc, fetchImpl)
      await populateContent("xxs", sheetUrls.xxs, "&xxs&!traded", doc, fetchImpl)

      const updated = await fetchSheetValue(sheetUrls.updated, fetchImpl)
      doc.getElementById("updated").innerHTML = `Last updated: ${updated}`
    } catch (e) {
      doc.getElementById("updated").innerHTML = "Error: " + e
    }
  })()

  return initPromise
}

await initMissingPage()
