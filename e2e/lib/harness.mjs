import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'

function sanitize(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/(apikey|authorization|token|password|secret)=?[^\s&]*/gi, '$1=[redacted]')
    .replace(/\?.*$/, '')
    .slice(0, 280)
}

async function clearBrowserState() {
  localStorage.clear()
  sessionStorage.clear()
  if (indexedDB.databases) {
    const databases = await indexedDB.databases()
    await Promise.all(databases
      .map(database => database.name)
      .filter(Boolean)
      .map(name => new Promise(resolve => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = request.onerror = request.onblocked = () => resolve()
      })))
  }
  if ('caches' in window) {
    await Promise.all((await caches.keys()).map(name => caches.delete(name)))
  }
  if ('serviceWorker' in navigator) {
    await Promise.all((await navigator.serviceWorker.getRegistrations()).map(registration => registration.unregister()))
  }
}

export async function prepareFixture(page, baseUrl, fixture) {
  await page.goto(`${baseUrl}/e2e/seed.html`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(clearBrowserState)
  await page.evaluate(async payload => {
    for (const [key, value] of Object.entries(payload.localStorage)) {
      localStorage.setItem(key, JSON.stringify(value))
    }
    const seedStores = {
      goals: payload.goals ?? [],
      goalActions: payload.actions ?? [],
      goalStages: payload.milestones ?? [],
      progressEntries: payload.progressEntries ?? [],
      goalEvents: payload.goalEvents ?? [],
    }
    if (!Object.values(seedStores).some(records => records.length)) return
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('traker-goals', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        const goalStore = db.createObjectStore('goals', { keyPath: 'id' })
        goalStore.createIndex('by-status', 'status')
        goalStore.createIndex('by-focus-rank', 'focusRank')
        goalStore.createIndex('by-updated-at', 'updatedAt')
        const stages = db.createObjectStore('goalStages', { keyPath: 'id' })
        stages.createIndex('by-goal', 'goalId')
        const actionStore = db.createObjectStore('goalActions', { keyPath: 'id' })
        actionStore.createIndex('by-goal', 'goalId')
        actionStore.createIndex('by-stage', 'stageId')
        const sessions = db.createObjectStore('workSessions', { keyPath: 'id' })
        sessions.createIndex('by-goal', 'goalId')
        sessions.createIndex('by-status', 'status')
        const progress = db.createObjectStore('progressEntries', { keyPath: 'id' })
        progress.createIndex('by-goal', 'goalId')
        progress.createIndex('by-occurred-at', 'occurredAt')
        const events = db.createObjectStore('goalEvents', { keyPath: 'id' })
        events.createIndex('by-goal', 'goalId')
        events.createIndex('by-occurred-at', 'occurredAt')
        const outbox = db.createObjectStore('syncOutbox', { keyPath: 'operationId' })
        outbox.createIndex('by-created-at', 'createdAt')
        db.createObjectStore('syncMeta', { keyPath: 'key' })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const populatedStores = Object.entries(seedStores).filter(([, records]) => records.length)
        const transaction = db.transaction(populatedStores.map(([storeName]) => storeName), 'readwrite')
        populatedStores.forEach(([storeName, records]) => {
          records.forEach(record => transaction.objectStore(storeName).put(record))
        })
        transaction.oncomplete = () => {
          db.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      }
    })
  }, fixture)
}

export async function unlockApp(page, readySelector = '.home') {
  await page.waitForSelector('[role="dialog"][aria-label="Pantalla de bloqueo de Traker"]')
  const enterPin = async () => {
    for (const digit of ['1', '2', '3', '4']) {
      await page.evaluate(value => {
        const button = [...document.querySelectorAll('[data-pin-key]')]
          .find(element => element.textContent.trim() === value)
        button?.click()
      }, digit)
    }
  }
  await enterPin()
  await new Promise(resolve => setTimeout(resolve, 650))
  const needsConfirmation = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="Pantalla de bloqueo de Traker"]')
    return Boolean(dialog?.textContent.includes('Confirma tu PIN'))
  })
  if (needsConfirmation) {
    await enterPin()
  }
  await page.waitForSelector('[role="dialog"][aria-label="Pantalla de bloqueo de Traker"]', { hidden: true, timeout: 5_000 })
  await page.waitForSelector(readySelector, { timeout: 5_000 })
}

export function assert(condition, code) {
  if (!condition) throw new Error(code)
}

export async function bodyIncludes(page, text) {
  return page.evaluate(expected => document.body.innerText.includes(expected), text)
}

export async function countText(page, text) {
  return page.evaluate(expected => document.body.innerText.split(expected).length - 1, text)
}

export async function clickByText(page, selector, text) {
  const clicked = await page.evaluate(({ selector: targetSelector, text: expected }) => {
    const target = [...document.querySelectorAll(targetSelector)]
      .find(element => element.textContent.trim().includes(expected))
    if (!target) return false
    target.click()
    return true
  }, { selector, text })
  assert(clicked, `CONTROL_NOT_FOUND:${text}`)
}

export async function readLocalStorage(page, key) {
  return page.evaluate(storageKey => {
    const value = localStorage.getItem(storageKey)
    return value === null ? null : JSON.parse(value)
  }, key)
}

export async function readIndexedDbStore(page, storeName, databaseName = 'traker-goals') {
  return page.evaluate(async ({ targetStore, targetDatabase }) => {
    if (indexedDB.databases) {
      const databases = await indexedDB.databases()
      if (!databases.some(database => database.name === targetDatabase)) return []
    }
    return new Promise((resolve, reject) => {
    const request = indexedDB.open(targetDatabase, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(targetStore)) {
        db.close()
        resolve([])
        return
      }
      const getAll = db.transaction(targetStore, 'readonly').objectStore(targetStore).getAll()
      getAll.onsuccess = () => {
        db.close()
        resolve(getAll.result)
      }
      getAll.onerror = () => {
        db.close()
        reject(getAll.error)
      }
    }
    })
  }, { targetStore: storeName, targetDatabase: databaseName })
}

export async function runScenario({ browser, baseUrl, definition, artifactsDir, runtime = {} }) {
  const startedAt = performance.now()
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])

  const diagnostics = []
  page.on('console', message => {
    if (message.type() !== 'error') return
    if (definition.allowConsoleError?.(message.text()) === true) return
    diagnostics.push({ type: 'console', message: sanitize(message.text()) })
  })
  page.on('pageerror', error => diagnostics.push({ type: 'pageerror', message: sanitize(error.message) }))
  page.on('requestfailed', request => {
    let path = request.url()
    try {
      path = new URL(request.url()).pathname
    } catch {
      path = sanitize(path)
    }
    diagnostics.push({
      type: 'requestfailed',
      method: request.method(),
      path,
      message: sanitize(request.failure()?.errorText),
    })
  })

  let status = 'passed'
  let failureCode = null
  let evidence = null
  try {
    await definition.setupPage?.(page)
    await prepareFixture(page, baseUrl, definition.fixture())
    await page.goto(baseUrl, { waitUntil: 'networkidle0' })
    if (!definition.skipUnlock) await unlockApp(page)
    await definition.run(page, { ...runtime, browser, baseUrl, artifactsDir })
    const viewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    assert(viewport.scrollWidth <= viewport.clientWidth, 'HORIZONTAL_OVERFLOW')
    assert(diagnostics.length === 0, 'BROWSER_DIAGNOSTIC_ERROR')
    await rm(join(artifactsDir, `${definition.id}.png`), { force: true })
  } catch (error) {
    status = 'failed'
    failureCode = sanitize(error?.message || 'UNKNOWN_E2E_FAILURE')
    const screenshot = join(artifactsDir, `${definition.id}.png`)
    await mkdir(dirname(screenshot), { recursive: true })
    await page.screenshot({ path: screenshot, fullPage: true })
    evidence = `${definition.id}.png`
  } finally {
    try {
      await page.goto(`${baseUrl}/e2e/seed.html`, { waitUntil: 'domcontentloaded' })
      await page.evaluate(clearBrowserState)
    } catch {
      // Context closure is the final isolation boundary if explicit cleanup fails.
    }
    await context.close()
  }

  return {
    id: definition.id,
    title: definition.title,
    status,
    durationMs: Math.round(performance.now() - startedAt),
    viewport: '375x812',
    failureCode,
    diagnostics,
    evidence,
  }
}
