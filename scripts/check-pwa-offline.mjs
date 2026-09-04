import { spawn } from 'node:child_process'
import process from 'node:process'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer'

const ROOT = resolve(import.meta.dirname, '..')
const PORT = Number(process.env.PWA_TEST_PORT || 4175)
const ORIGIN = `http://127.0.0.1:${PORT}`
const BASE_URL = `${ORIGIN}/traker/`

function assert(condition, code) {
  if (!condition) throw new Error(code)
}

function startPreview() {
  const vite = resolve(ROOT, 'node_modules/vite/bin/vite.js')
  const child = spawn(process.execPath, [vite, 'preview', '--base', '/traker/', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.output = ''
  const collect = chunk => { child.output = `${child.output}${chunk}`.slice(-4_000) }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  return child
}

async function waitForPreview(server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`PWA_PREVIEW_EXITED:${server.output.trim()}`)
    try {
      const response = await fetch(BASE_URL)
      if (response.ok) return
    } catch {
      // Preview is still starting.
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  throw new Error('PWA_PREVIEW_NOT_READY')
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise(resolveExit => child.once('exit', resolveExit)),
    new Promise(resolveWait => setTimeout(resolveWait, 2_000)),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

const preview = startPreview()
let browser

try {
  await waitForPreview(preview)
  browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const page = await browser.newPage()
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' })

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href
    return href ? fetch(href).then(response => response.json()) : null
  })
  assert(manifest?.display === 'standalone', 'PWA_MANIFEST_DISPLAY')
  assert(manifest?.orientation === undefined, 'PWA_MANIFEST_FORCED_ORIENTATION')
  assert(manifest?.shortcuts?.some(shortcut => shortcut.url.endsWith('/goals')), 'PWA_MANIFEST_GOALS_SHORTCUT')
  assert(manifest?.shortcuts?.some(shortcut => shortcut.url.endsWith('/habits')), 'PWA_MANIFEST_HABITS_SHORTCUT')

  const registration = await page.evaluate(async () => {
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ])
    return { scope: ready.scope, scriptURL: ready.active?.scriptURL ?? '' }
  })
  assert(registration.scope === BASE_URL, 'PWA_SERVICE_WORKER_SCOPE')
  assert(registration.scriptURL.endsWith('/traker/sw.js'), 'PWA_SERVICE_WORKER_SCRIPT')

  const performanceContext = await browser.createBrowserContext()
  const performancePage = await performanceContext.newPage()
  await performancePage.evaluateOnNewDocument(() => {
    window.__trakerPerformance = { lcp: 0, cls: 0, inp: 0 }
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__trakerPerformance.lcp = entry.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__trakerPerformance.cls += entry.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.interactionId) window.__trakerPerformance.inp = Math.max(window.__trakerPerformance.inp, entry.duration)
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 })
    } catch {
      // Individual assertions below report unsupported/missing metrics.
    }
  })
  const performanceClient = await performancePage.createCDPSession()
  await performanceClient.send('Network.enable')
  await performanceClient.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000,
    uploadThroughput: 93_750,
  })
  await performanceClient.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await performancePage.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 })
  await performancePage.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 20_000 })
  await performancePage.waitForSelector('#app > *', { timeout: 8_000 })
  const interactiveButtons = await performancePage.$$('button')
  let clicked = false
  for (const button of interactiveButtons) {
    const box = await button.boundingBox()
    const disabled = await button.evaluate(element => element.disabled)
    if (!box || disabled) continue
    await button.click()
    clicked = true
    break
  }
  assert(clicked, 'PWA_MOBILE_INTERACTION_TARGET')
  await new Promise(resolveWait => setTimeout(resolveWait, 750))
  const performanceMetrics = await performancePage.evaluate(() => ({
    ...window.__trakerPerformance,
    appReady: performance.now(),
  }))
  assert(performanceMetrics.lcp > 0 && performanceMetrics.lcp <= 4_000, 'PWA_MOBILE_LCP_BUDGET')
  assert(performanceMetrics.cls <= 0.1, 'PWA_MOBILE_CLS_BUDGET')
  assert(performanceMetrics.inp > 0 && performanceMetrics.inp <= 200, 'PWA_MOBILE_INP_BUDGET')
  assert(performanceMetrics.appReady <= 5_000, 'PWA_MOBILE_APP_READY_BUDGET')
  await performanceContext.close()
  process.stdout.write('PWA CHECK mobile metrics complete\n')

  const datasetContext = await browser.createBrowserContext()
  const datasetPage = await datasetContext.newPage()
  await datasetPage.goto(`${BASE_URL}manifest.webmanifest`, { waitUntil: 'domcontentloaded' })
  process.stdout.write('PWA CHECK large dataset seeding\n')
  const datasetShape = await datasetPage.evaluate(async () => {
    const now = new Date().toISOString()
    const localDate = now.slice(0, 10)
    const habits = Array.from({ length: 1_000 }, (_, index) => ({
      id: `scale-habit-${index}`,
      name: `Actividad de escala ${index + 1}`,
      minimumVersion: 'Abrir y empezar',
      goalId: null,
      goalIds: [],
      icon: 'Activity',
      color: '#637F50',
      duration: 15,
      isActive: true,
      lifecycleStatus: 'active',
      version: 1,
      reminder: null,
      reminderDays: null,
      schedule: {
        id: `scale-schedule-${index}`,
        kind: 'daily',
        timezone: 'America/Mexico_City',
        effectiveFrom: localDate,
        isActive: true,
        version: 1,
      },
      createdAt: now,
      updatedAt: now,
      flexDays: [],
      logs: {},
    }))
    localStorage.setItem('traker:pin', JSON.stringify({ pin: '1234' }))
    localStorage.setItem('traker:meta', JSON.stringify({ schemaVersion: 3, firstOpened: now, lastOpened: now }))
    localStorage.setItem('traker:app', JSON.stringify({ theme: 'light' }))
    localStorage.setItem('traker:settings', JSON.stringify({ notificationsEnabled: false, goalsFocusLimit: 3 }))
    localStorage.setItem('traker:habits', JSON.stringify({ habits }))

    const goals = Array.from({ length: 500 }, (_, index) => ({
      id: `scale-goal-${index}`,
      userId: null,
      title: `Meta de escala ${index + 1}`,
      personalWhy: '',
      desiredOutcome: '',
      doneDefinition: 'Resultado verificable',
      horizon: 'medium',
      status: 'active',
      focusRank: index < 3 ? index : null,
      currentActionId: `scale-action-${index}`,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    }))
    const actions = goals.map((goal, index) => ({
      id: goal.currentActionId,
      goalId: goal.id,
      title: `Paso de escala ${index + 1}`,
      minimumVersion: 'Abrir y empezar',
      energyLevel: 'medium',
      estimateBucket: '15m',
      status: 'ready',
      positionKey: `a${index}`,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    }))
    await new Promise((resolveSeed, rejectSeed) => {
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
      request.onerror = () => rejectSeed(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['goals', 'goalActions'], 'readwrite')
        goals.forEach(goal => transaction.objectStore('goals').put(goal))
        actions.forEach(action => transaction.objectStore('goalActions').put(action))
        transaction.oncomplete = () => { db.close(); resolveSeed() }
        transaction.onerror = () => rejectSeed(transaction.error)
      }
    })
    sessionStorage.setItem('traker:scale-reload-start', String(Date.now()))
    return { habits: habits.length, goals: goals.length }
  })
  process.stdout.write('PWA CHECK large dataset reload\n')
  await datasetPage.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 20_000 })
  await datasetPage.waitForSelector('[aria-label="Pantalla de bloqueo de Traker"]')
  for (const digit of ['1', '2', '3', '4']) {
    await datasetPage.evaluate(value => {
      const button = [...document.querySelectorAll('[data-pin-key]')]
        .find(element => element.textContent.trim() === value)
      button?.click()
    }, digit)
  }
  await datasetPage.waitForSelector('.home', { timeout: 8_000 })
  process.stdout.write('PWA CHECK large dataset hydrated\n')
  const datasetMetrics = await datasetPage.evaluate(async () => {
    const database = await new Promise((resolveDb, rejectDb) => {
      const request = indexedDB.open('traker-goals', 1)
      request.onsuccess = () => resolveDb(request.result)
      request.onerror = () => rejectDb(request.error)
    })
    const countRequest = database.transaction('goals', 'readonly').objectStore('goals').count()
    const goalCount = await new Promise((resolveCount, rejectCount) => {
      countRequest.onsuccess = () => resolveCount(countRequest.result)
      countRequest.onerror = () => rejectCount(countRequest.error)
    })
    database.close()
    return {
      hydrationMs: Date.now() - Number(sessionStorage.getItem('traker:scale-reload-start')),
      localStorageBytes: new Blob(Object.values(localStorage)).size,
      visibleHabits: document.querySelectorAll('.habit-list__items [role="listitem"]').length,
      goalCount,
    }
  })
  const heapBytes = (await datasetPage.metrics()).JSHeapUsedSize
  assert(datasetShape.habits === 1_000 && datasetShape.goals === 500, 'PWA_SCALE_FIXTURE_SHAPE')
  assert(datasetMetrics.goalCount === 500, 'PWA_SCALE_INDEXEDDB_COUNT')
  assert(datasetMetrics.visibleHabits <= 3, 'PWA_SCALE_PROGRESSIVE_DISCLOSURE')
  assert(datasetMetrics.hydrationMs <= 5_000, 'PWA_SCALE_HYDRATION_BUDGET')
  assert(datasetMetrics.localStorageBytes < 5 * 1024 * 1024, 'PWA_SCALE_LOCAL_STORAGE_BUDGET')
  assert(heapBytes < 128 * 1024 * 1024, 'PWA_SCALE_HEAP_BUDGET')
  await datasetContext.close()

  await page.reload({ waitUntil: 'networkidle0' })
  assert(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'PWA_SERVICE_WORKER_NOT_CONTROLLING')

  const client = await page.createCDPSession()
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  })

  const response = await page.goto(`${BASE_URL}goals`, { waitUntil: 'domcontentloaded', timeout: 10_000 })
  assert(response?.status() === 200, 'PWA_OFFLINE_DEEP_ROUTE_STATUS')
  await page.waitForSelector('#app > *', { timeout: 5_000 })
  assert((await page.title()).includes('Traker'), 'PWA_OFFLINE_APP_SHELL')

  process.stdout.write(`PWA PASS manifest, SW control, offline route · LCP ${Math.round(performanceMetrics.lcp)} ms · INP ${Math.round(performanceMetrics.inp)} ms · CLS ${performanceMetrics.cls.toFixed(3)} · escala ${datasetMetrics.hydrationMs} ms/${Math.round(heapBytes / 1024 / 1024)} MiB\n`)
} finally {
  await browser?.close()
  await stopProcess(preview)
}
