import { execFile } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

const exec = promisify(execFile)
const ROOT = resolve(import.meta.dirname, '../..')
const errors = []
const checks = []

function check(condition, code) {
  checks.push({ code, ok: Boolean(condition) })
  if (!condition) errors.push(code)
}

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const separator = line.indexOf('=')
      return separator < 1 ? [line, null] : [line.slice(0, separator), line.slice(separator + 1)]
    }))
}

const envPath = resolve(ROOT, process.argv.find(argument => argument.startsWith('--env='))?.slice(6) ?? '.env.example')
const env = parseEnvironment(await readFile(envPath, 'utf8'))
const requiredPublic = [
  'VITE_API_URL',
  'VITE_SYNC_V2_PILOT',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_REQUEST_TIMEOUT_MS',
  'VITE_VAPID_PUBLIC_KEY',
]
const secretPattern = /(SERVICE_ROLE|PRIVATE_KEY|CRON_SECRET|DATABASE_URL|DB_PASSWORD|ACCESS_TOKEN|JWT_SECRET)/i

requiredPublic.forEach(name => check(Object.hasOwn(env, name), `ENV_REQUIRED_${name}`))
check(Object.keys(env).every(name => name.startsWith('VITE_')), 'ENV_EXAMPLE_PUBLIC_ONLY')
check(Object.keys(env).every(name => !secretPattern.test(name)), 'ENV_EXAMPLE_HAS_NO_SERVER_SECRET_NAMES')
check(Object.entries(env).every(([name, value]) => !secretPattern.test(name) && !/(service_role|BEGIN PRIVATE KEY|postgres(?:ql)?:\/\/)/i.test(value ?? '')), 'ENV_EXAMPLE_HAS_NO_SECRET_VALUES')
check(/^https:\/\//.test(env.VITE_SUPABASE_URL ?? ''), 'ENV_SUPABASE_URL_IS_HTTPS')
check(/^sb_publishable_/.test(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''), 'ENV_USES_PUBLISHABLE_KEY')
check(Number(env.VITE_SUPABASE_REQUEST_TIMEOUT_MS) >= 1_000 && Number(env.VITE_SUPABASE_REQUEST_TIMEOUT_MS) <= 60_000, 'ENV_TIMEOUT_BOUNDED')

const migrationNames = (await readdir(resolve(ROOT, 'supabase/migrations'))).filter(name => name.endsWith('.sql')).sort()
const rollbackNames = new Set((await readdir(resolve(ROOT, 'supabase/rollbacks'))).filter(name => name.endsWith('.sql')))
const timestamps = migrationNames.map(name => name.match(/^(\d{14})_/)?.[1]).filter(Boolean)
check(new Set(timestamps).size === timestamps.length, 'MIGRATION_TIMESTAMPS_UNIQUE')
check([...timestamps].sort().join() === timestamps.join(), 'MIGRATIONS_SORT_LEXICOGRAPHICALLY')
for (const migration of migrationNames.filter(name => name >= '20260902000000_')) {
  const stem = migration.slice(0, -4)
  check(rollbackNames.has(`${stem}.down.sql`) || rollbackNames.has(`${stem}.rollback.sql`), `ROLLBACK_PRESENT_${stem}`)
}

const manifest = JSON.parse(await readFile(resolve(ROOT, 'dist/manifest.webmanifest'), 'utf8'))
check(manifest.start_url === '/traker/', 'PWA_START_URL_BASE_AWARE')
check(manifest.scope === '/traker/', 'PWA_SCOPE_BASE_AWARE')
check(Array.isArray(manifest.icons) && manifest.icons.some(icon => icon.purpose?.includes('maskable')), 'PWA_MASKABLE_ICON_PRESENT')

const packageJson = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'))
for (const script of ['test', 'test:e2e', 'test:bundle', 'test:pwa', 'staging:preflight', 'staging:smoke']) {
  check(Boolean(packageJson.scripts?.[script]), `SCRIPT_PRESENT_${script}`)
}

const { stdout: trackedEnvironment } = await exec('git', ['ls-files', '.env', '.env.*'], { cwd: ROOT })
check(trackedEnvironment.trim().split(/\r?\n/).filter(Boolean).every(name => name === '.env.example'), 'GIT_TRACKS_NO_ENVIRONMENT_SECRETS')

const result = {
  status: errors.length ? 'failed' : 'passed',
  envFile: envPath.slice(ROOT.length + 1),
  publicVariables: Object.keys(env).sort(),
  migrations: migrationNames.length,
  rollbacks: rollbackNames.size,
  checks,
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (errors.length) process.exitCode = 1

