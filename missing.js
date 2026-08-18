const sheetBaseUrl = 'https://docs.google.com/spreadsheets/d/1GBORc_fa3vH1Jj0h-a_5tmmuYvYRwmYIAHC-Tcr6VG8/gviz/tq?tqx=out:csv'
const copyPopupMessage = 'Search string copied to the clipboard'
const pullIndicatorMessages = {
  pulling: 'Pull to refresh',
  ready: 'Release to refresh',
  refreshing: 'Refreshing...',
}
const copyPopupTimers = new Map()
const pullToRefreshThreshold = 90

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
let refreshPromise
let interactionsBound = false

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

function renderContent(elementId, value, suffix = '', doc = document) {
  doc.getElementById(elementId).innerHTML = `${value}${suffix}`
}

async function fetchMissingContent(fetchImpl = fetch) {
  const [shiny, lucky, xxl, xxs, updated] = await Promise.all([
    fetchSheetValue(sheetUrls.shiny, fetchImpl),
    fetchSheetValue(sheetUrls.lucky, fetchImpl),
    fetchSheetValue(sheetUrls.xxl, fetchImpl),
    fetchSheetValue(sheetUrls.xxs, fetchImpl),
    fetchSheetValue(sheetUrls.updated, fetchImpl),
  ])

  return { shiny, lucky, xxl, xxs, updated }
}

export function setRefreshButtonState(isRefreshing, doc = document) {
  const refreshButton = doc.getElementById("refreshButton")

  if (!refreshButton) {
    return
  }

  refreshButton.disabled = isRefreshing
  refreshButton.textContent = isRefreshing ? "Refreshing..." : "Refresh"
}

export function setPullIndicatorState(state = 'idle', pullDistance = 0, doc = document) {
  const indicator = doc.getElementById("pullIndicator")

  if (!indicator) {
    return
  }

  indicator.hidden = state === 'idle'
  indicator.dataset.state = state
  indicator.textContent = pullIndicatorMessages[state] ?? pullIndicatorMessages.pulling
  indicator.style.setProperty('--pull-distance', `${Math.round(pullDistance)}px`)
}

export function refreshMissingPage({ doc = document, fetchImpl = fetch } = {}) {
  if (refreshPromise) {
    return refreshPromise
  }

  setRefreshButtonState(true, doc)
  setPullIndicatorState('refreshing', pullToRefreshThreshold, doc)

  refreshPromise = (async () => {
    try {
      const content = await fetchMissingContent(fetchImpl)
      renderContent("shiny", content.shiny, "&shiny&!traded", doc)
      renderContent("lucky", content.lucky, "&!traded", doc)
      renderContent("xxl", content.xxl, "&xxl&!traded", doc)
      renderContent("xxs", content.xxs, "&xxs&!traded", doc)
      doc.getElementById("updated").innerHTML = `Last updated: ${content.updated}`
    } catch (e) {
      doc.getElementById("updated").innerHTML = "Error: " + e
    } finally {
      setRefreshButtonState(false, doc)
      setPullIndicatorState('idle', 0, doc)
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export function bindRefreshButton({ doc = document, refresh = () => refreshMissingPage({ doc }) } = {}) {
  doc.getElementById("refreshButton").addEventListener("click", () => refresh())
}

export function bindPullToRefresh({
  doc = document,
  refresh = () => refreshMissingPage({ doc }),
  threshold = pullToRefreshThreshold,
  getScrollTop = () => globalThis.window?.scrollY ?? doc.documentElement?.scrollTop ?? doc.body?.scrollTop ?? 0,
} = {}) {
  let startY = 0
  let isPulling = false
  let isArmed = false

  doc.addEventListener("touchstart", (event) => {
    if (getScrollTop() > 0 || refreshPromise) {
      return
    }

    const touch = event.touches?.[0]

    if (!touch) {
      return
    }

    startY = touch.clientY
    isPulling = true
    isArmed = false
    setPullIndicatorState('pulling', 0, doc)
  })

  doc.addEventListener("touchmove", (event) => {
    if (!isPulling) {
      return
    }

    const touch = event.touches?.[0]

    if (!touch) {
      return
    }

    const rawDistance = touch.clientY - startY

    if (rawDistance <= 0) {
      return
    }

    const pullDistance = Math.min(120, rawDistance * 0.6)

    if (event.cancelable) {
      event.preventDefault()
    }

    isArmed = pullDistance >= threshold
    setPullIndicatorState(isArmed ? 'ready' : 'pulling', pullDistance, doc)
  })

  const finishPullGesture = () => {
    if (!isPulling) {
      return
    }

    isPulling = false

    if (isArmed) {
      isArmed = false
      return refresh()
    }

    isArmed = false
    setPullIndicatorState('idle', 0, doc)
  }

  doc.addEventListener("touchend", finishPullGesture)
  doc.addEventListener("touchcancel", finishPullGesture)
}

export function initMissingPage({ doc = document, fetchImpl = fetch, clipboard = navigator.clipboard, schedule = setTimeout, cancel = clearTimeout } = {}) {
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      if (!interactionsBound) {
        bindRefreshButton({ doc, refresh: () => refreshMissingPage({ doc, fetchImpl }) })
        bindPullToRefresh({ doc, refresh: () => refreshMissingPage({ doc, fetchImpl }) })
        bindCopyButton("copyShiny", "shiny", "copyShinyPopup", doc, clipboard, schedule, cancel)
        bindCopyButton("copyLucky", "lucky", "copyLuckyPopup", doc, clipboard, schedule, cancel)
        bindCopyButton("copyXxl", "xxl", "copyXxlPopup", doc, clipboard, schedule, cancel)
        bindCopyButton("copyXxs", "xxs", "copyXxsPopup", doc, clipboard, schedule, cancel)
        interactionsBound = true
      }

      await refreshMissingPage({ doc, fetchImpl })
    } catch (e) {
      doc.getElementById("updated").innerHTML = "Error: " + e
    }
  })()

  return initPromise
}

await initMissingPage()
