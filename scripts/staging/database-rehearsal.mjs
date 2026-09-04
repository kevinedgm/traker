import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, relative } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const outputDir = resolve(ROOT, '.local-backups/staging-rehearsal')
const execute = process.argv.includes('--execute')
const source = process.env.TRAKER_STAGING_DB_URL ?? ''
const target = process.env.TRAKER_RESTORE_DB_URL ?? ''

function safeIdentity(value) {
  if (!value) return null
  const url = new URL(value)
  return `${url.hostname}:${url.port || '5432'}${url.pathname}`
}

function run(command, args, env = process.env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', code => code === 0 ? resolveRun() : reject(new Error(`${command} exited ${code}`)))
  })
}

const plan = {
  status: execute ? 'ready-to-execute' : 'dry-run',
  sourceConfigured: Boolean(source),
  isolatedRestoreConfigured: Boolean(target),
  outputDirectory: relative(ROOT, outputDir),
  artifacts: ['roles.sql', 'schema.sql', 'data.sql', 'MANIFEST.sha256'],
  safeguards: ['explicit --execute', 'staging-only acknowledgement', 'different source and restore targets', 'URLs never printed'],
}
process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
if (!execute) process.exit(0)

if (process.env.TRAKER_STAGING_REHEARSAL_ACK !== 'staging-only') throw new Error('Set TRAKER_STAGING_REHEARSAL_ACK=staging-only')
if (!source || !target) throw new Error('TRAKER_STAGING_DB_URL and TRAKER_RESTORE_DB_URL are required')
if (safeIdentity(source) === safeIdentity(target)) throw new Error('Restore target must be a different isolated database')

await mkdir(outputDir, { recursive: true })
const dumps = [
  ['roles.sql', ['--role-only']],
  ['schema.sql', []],
  ['data.sql', ['--data-only', '--use-copy']],
]
for (const [file, flags] of dumps) {
  await run('npx', ['supabase', 'db', 'dump', '--db-url', source, '--file', resolve(outputDir, file), ...flags], {
    ...process.env,
    SUPABASE_TELEMETRY_DISABLED: '1',
  })
}
await run('psql', [
  '--single-transaction', '--variable', 'ON_ERROR_STOP=1',
  '--file', resolve(outputDir, 'roles.sql'),
  '--file', resolve(outputDir, 'schema.sql'),
  '--command', 'SET session_replication_role = replica',
  '--file', resolve(outputDir, 'data.sql'),
  '--dbname', target,
])

const manifest = []
for (const [file] of dumps) {
  const bytes = await import('node:fs/promises').then(fs => fs.readFile(resolve(outputDir, file)))
  manifest.push(`${createHash('sha256').update(bytes).digest('hex')}  ${file}`)
}
await writeFile(resolve(outputDir, 'MANIFEST.sha256'), `${manifest.join('\n')}\n`, { mode: 0o600 })

