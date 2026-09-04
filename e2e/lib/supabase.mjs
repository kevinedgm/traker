import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'

const exec = promisify(execFile)
const DEFAULT_URL = 'http://127.0.0.1:55321'

async function healthy(url) {
  try {
    const response = await fetch(`${url}/auth/v1/health`)
    return response.ok
  } catch {
    return false
  }
}

function parseEnvironment(output) {
  const result = {}
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    const value = match[2].trim().replace(/^"|"$/g, '')
    result[match[1]] = value
  }
  return result
}

async function runCli(root, args) {
  return exec('npx', ['supabase', ...args], {
    cwd: root,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
    maxBuffer: 2_000_000,
  })
}

async function readLocalEnvironment(root) {
  const { stdout } = await runCli(root, ['status', '-o', 'env'])
  const values = parseEnvironment(stdout)
  const url = values.API_URL || DEFAULT_URL
  const publicKey = values.PUBLISHABLE_KEY || values.ANON_KEY
  const serviceRoleKey = values.SERVICE_ROLE_KEY
  if (!publicKey || !serviceRoleKey) throw new Error('SUPABASE_LOCAL_KEYS_UNAVAILABLE')
  return { url, publicKey, serviceRoleKey }
}

async function createTemporaryUser(config) {
  const email = `traker-e2e-${randomUUID()}@example.invalid`
  const password = `E2e-${randomUUID()}-Aa1!`
  const headers = {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
    'content-type': 'application/json',
  }
  const created = await fetch(`${config.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (!created.ok) throw new Error(`TEMP_USER_CREATE_HTTP_${created.status}`)
  const user = await created.json()

  const token = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.publicKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  if (!token.ok) {
    await fetch(`${config.url}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers })
    throw new Error(`TEMP_USER_AUTH_HTTP_${token.status}`)
  }
  await token.json()

  return {
    id: user.id,
    browserAuth: { email, password },
    async remove() {
      const response = await fetch(`${config.url}/auth/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok && response.status !== 404) {
        throw new Error(`TEMP_USER_DELETE_HTTP_${response.status}`)
      }
    },
  }
}

export async function setupLocalSupabase(root) {
  let startedByRunner = false
  if (!await healthy(DEFAULT_URL)) {
    await runCli(root, ['start', '--exclude', 'edge-runtime,studio'])
    startedByRunner = true
  }

  const config = await readLocalEnvironment(root)
  if (!await healthy(config.url)) throw new Error('SUPABASE_LOCAL_NOT_HEALTHY')
  const temporaryUser = await createTemporaryUser(config)
  const temporaryUsers = [temporaryUser]
  let userRemoved = false

  return {
    url: config.url,
    publicKey: config.publicKey,
    browserAuth: temporaryUser.browserAuth,
    async createBrowserAuth() {
      const additionalUser = await createTemporaryUser(config)
      temporaryUsers.push(additionalUser)
      return additionalUser.browserAuth
    },
    report: {
      local: true,
      temporaryUserAuthenticated: true,
      temporaryUserRemoved: false,
      startedByRunner,
    },
    async cleanup() {
      try {
        for (const user of temporaryUsers) await user.remove()
        userRemoved = true
        this.report.temporaryUserRemoved = true
      } finally {
        if (startedByRunner) await runCli(root, ['stop'])
      }
      return userRemoved
    },
  }
}
