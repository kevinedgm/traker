import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const migrationsDir = resolve(ROOT, 'supabase/migrations')
const rollbacksDir = resolve(ROOT, 'supabase/rollbacks')
const migrations = (await readdir(migrationsDir)).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort()
const latest = migrations.at(-1)
const stem = latest?.slice(0, -4)
const rollbackFiles = await readdir(rollbacksDir)
const rollback = rollbackFiles.find(name => name === `${stem}.down.sql` || name === `${stem}.rollback.sql`)
if (!latest || !rollback) throw new Error(`Rollback missing for latest migration: ${latest ?? 'none'}`)

const execute = process.argv.includes('--execute')
process.stdout.write(`${JSON.stringify({
  status: execute ? 'ready-to-execute' : 'dry-run',
  migration: latest,
  rollback,
  targetConfigured: Boolean(process.env.TRAKER_RESTORE_DB_URL),
  safeguard: 'isolated restore only; down and up run in one transaction',
}, null, 2)}\n`)
if (!execute) process.exit(0)
if (process.env.TRAKER_RESTORE_REHEARSAL_ACK !== 'isolated-restore-only') throw new Error('Set TRAKER_RESTORE_REHEARSAL_ACK=isolated-restore-only')
if (!process.env.TRAKER_RESTORE_DB_URL) throw new Error('TRAKER_RESTORE_DB_URL is required')

await new Promise((resolveRun, reject) => {
  const child = spawn('psql', [
    '--single-transaction', '--variable', 'ON_ERROR_STOP=1',
    '--file', resolve(rollbacksDir, rollback),
    '--file', resolve(migrationsDir, latest),
    '--dbname', process.env.TRAKER_RESTORE_DB_URL,
  ], { cwd: ROOT, stdio: 'inherit' })
  child.once('error', reject)
  child.once('exit', code => code === 0 ? resolveRun() : reject(new Error(`psql exited ${code}`)))
})

