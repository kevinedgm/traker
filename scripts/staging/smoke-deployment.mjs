const rawUrl = process.argv.find(argument => argument.startsWith('--url='))?.slice(6)
if (!rawUrl) throw new Error('Use --url=https://host.example/traker/')

const base = new URL(rawUrl)
if (!base.pathname.endsWith('/')) base.pathname += '/'
const expectedBase = process.argv.find(argument => argument.startsWith('--base='))?.slice(7) ?? '/traker/'
const assetRoot = process.argv.find(argument => argument.startsWith('--asset-root='))?.slice(13) ?? null
const failures = []
const checks = []

async function check(path, { type, contains } = {}) {
  const url = path.startsWith('/') ? new URL(path, base.origin) : new URL(path, base)
  const response = await fetch(url, { redirect: 'follow' })
  const contentType = response.headers.get('content-type') ?? ''
  const body = await response.text()
  const ok = response.ok
    && (!type || contentType.includes(type))
    && (!contains || body.includes(contains))
  const item = { path: url.pathname, status: response.status, contentType: contentType.split(';')[0], ok }
  checks.push(item)
  if (!ok) failures.push(item.path)
  return { response, body }
}

const index = await check('', { type: 'text/html', contains: 'id="app"' })
const manifestMatch = index.body.match(/<link[^>]+rel="manifest"[^>]+href="([^"]+)"/i)
if (!manifestMatch) failures.push('MANIFEST_LINK_MISSING')
const manifestPath = manifestMatch?.[1] ?? 'manifest.webmanifest'
const deployedAssetPath = path => assetRoot === null
  ? path
  : `${assetRoot.replace(/\/$/, '')}/${path.replace(expectedBase, '').replace(/^\//, '')}`
const manifestResponse = await check(deployedAssetPath(manifestPath), { type: 'application/manifest+json' })
let manifest = null
try { manifest = JSON.parse(manifestResponse.body) } catch { failures.push('MANIFEST_JSON_INVALID') }
if (manifest?.scope !== expectedBase) failures.push('MANIFEST_SCOPE_MISMATCH')
if (manifest?.start_url !== expectedBase) failures.push('MANIFEST_START_URL_MISMATCH')

await Promise.all([
  check(deployedAssetPath(`${expectedBase}sw.js`), { type: 'javascript', contains: 'skipWaiting' }),
  check(deployedAssetPath(`${expectedBase}icons/pwa-192x192.png`), { type: 'image/png' }),
  check('goals', { type: 'text/html', contains: 'id="app"' }),
  check('settings', { type: 'text/html', contains: 'id="app"' }),
  check('does-not-exist', { type: 'text/html', contains: 'id="app"' }),
])

const result = { status: failures.length ? 'failed' : 'passed', basePath: base.pathname, expectedBase, assetRoot, checks, failures }
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (failures.length) process.exitCode = 1
