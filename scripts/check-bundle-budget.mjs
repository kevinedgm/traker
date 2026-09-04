import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '..')
const assetsDir = join(root, 'dist', 'assets')
const KiB = 1024
const budget = Object.freeze({
  largestJs: 215 * KiB,
  totalJs: 850 * KiB,
  gzipJs: 285 * KiB,
  totalCss: 250 * KiB,
  gzipCss: 55 * KiB,
})

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  }))
  return nested.flat()
}

async function measure(paths) {
  const records = await Promise.all(paths.map(async path => {
    const [metadata, content] = await Promise.all([stat(path), readFile(path)])
    return {
      path: relative(root, path),
      bytes: metadata.size,
      gzipBytes: gzipSync(content, { level: 9 }).byteLength,
    }
  }))
  return {
    total: records.reduce((sum, record) => sum + record.bytes, 0),
    gzip: records.reduce((sum, record) => sum + record.gzipBytes, 0),
    largest: records.toSorted((a, b) => b.bytes - a.bytes)[0] ?? null,
  }
}

function kib(bytes) {
  return `${(bytes / KiB).toFixed(1)} KiB`
}

const files = await filesUnder(assetsDir)
const js = await measure(files.filter(path => path.endsWith('.js')))
const css = await measure(files.filter(path => path.endsWith('.css')))
const checks = [
  ['largest JS chunk', js.largest?.bytes ?? 0, budget.largestJs],
  ['total JS', js.total, budget.totalJs],
  ['gzip JS', js.gzip, budget.gzipJs],
  ['total CSS', css.total, budget.totalCss],
  ['gzip CSS', css.gzip, budget.gzipCss],
]
const failures = checks.filter(([, actual, limit]) => actual > limit)

console.log(`Bundle: ${kib(js.total)} JS (${kib(js.gzip)} gzip), ${kib(css.total)} CSS (${kib(css.gzip)} gzip)`)
console.log(`Largest JS: ${js.largest?.path ?? 'none'} · ${kib(js.largest?.bytes ?? 0)} / ${kib(budget.largestJs)}`)
for (const [label, actual, limit] of failures) {
  console.error(`Budget exceeded: ${label} ${kib(actual)} > ${kib(limit)}`)
}
if (failures.length) process.exitCode = 1
