import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import puppeteer from 'puppeteer'
import { runScenario } from './lib/harness.mjs'
import { setupLocalSupabase } from './lib/supabase.mjs'
import { todayScenarios } from './scenarios/today.spec.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const PORT = Number(process.env.E2E_PORT || 4174)
const BASE_URL = `http://127.0.0.1:${PORT}`
const ARTIFACTS_DIR = resolve(import.meta.dirname, 'artifacts')
const headed = process.argv.includes('--headed')
const requested = process.argv.find(argument => argument.startsWith('--scenario='))?.split('=')[1]
const scenarios = requested
  ? todayScenarios.filter(scenario => scenario.id.startsWith(requested))
  : todayScenarios

if (!scenarios.length) throw new Error(`Unknown E2E scenario: ${requested}`)

function startVite(supabase) {
  const vite = resolve(ROOT, 'node_modules/vite/bin/vite.js')
  const child = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: supabase.url,
      VITE_SUPABASE_PUBLISHABLE_KEY: supabase.publicKey,
      VITE_GOALS_ENABLED: 'true',
      VITE_SYNC_V2_PILOT: 'true',
      VITE_COPY_PERSONALITY: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.output = ''
  const collect = chunk => {
    child.output = `${child.output}${chunk}`.slice(-4_000)
  }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  return child
}

async function waitForVite(server) {
  let lastError = null
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`VITE_EXITED_${server.exitCode}: ${server.output.trim() || 'no output'}`)
    }
    try {
      const response = await fetch(`${BASE_URL}/e2e/seed.html`)
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  throw new Error(`VITE_NOT_READY: ${lastError?.message ?? 'timeout'}`)
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

await mkdir(ARTIFACTS_DIR, { recursive: true })
let supabase
let vite
let browser
const results = []

try {
  supabase = await setupLocalSupabase(ROOT)
  vite = startVite(supabase)
  await waitForVite(vite)
  browser = await puppeteer.launch({
    headless: headed ? false : 'shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  for (const definition of scenarios) {
    const result = await runScenario({
      browser,
      baseUrl: BASE_URL,
      definition,
      artifactsDir: ARTIFACTS_DIR,
      runtime: { auth: supabase.browserAuth, createBrowserAuth: () => supabase.createBrowserAuth() },
    })
    results.push(result)
    process.stdout.write(`${result.status === 'passed' ? 'PASS' : 'FAIL'} ${result.id} ${result.title}\n`)
  }
} finally {
  await browser?.close()
  await stopProcess(vite)
  await supabase?.cleanup()
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode: headed ? 'headed' : 'headless',
  dataPolicy: 'synthetic-only; no names, notes, emotions, credentials or response payloads',
  infrastructure: supabase?.report ?? { local: false, temporaryUserAuthenticated: false, temporaryUserRemoved: false },
  summary: {
    total: results.length,
    passed: results.filter(result => result.status === 'passed').length,
    failed: results.filter(result => result.status === 'failed').length,
  },
  results,
}
await writeFile(resolve(ARTIFACTS_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)

process.stdout.write(`E2E ${report.summary.passed}/${report.summary.total} passed · report: e2e/artifacts/report.json\n`)
if (report.summary.failed) process.exitCode = 1
