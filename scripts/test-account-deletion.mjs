import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'

const exec = promisify(execFile)

function assert(condition, code) {
  if (!condition) throw new Error(code)
}

function parseEnvironment(output) {
  return Object.fromEntries(String(output).split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    return match ? [[match[1], match[2].trim().replace(/^"|"$/g, '')]] : []
  }))
}

async function localConfig() {
  const { stdout } = await exec('npx', ['supabase', 'status', '-o', 'env'], {
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
    maxBuffer: 2_000_000,
  })
  const values = parseEnvironment(stdout)
  const config = {
    url: values.API_URL,
    publicKey: values.PUBLISHABLE_KEY || values.ANON_KEY,
    serviceRoleKey: values.SERVICE_ROLE_KEY,
  }
  assert(config.url && config.publicKey && config.serviceRoleKey, 'LOCAL_CONFIG_UNAVAILABLE')
  return config
}

function adminHeaders(config) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
    'content-type': 'application/json',
  }
}

async function createUser(config, label) {
  const email = `traker-delete-${label}-${randomUUID()}@example.invalid`
  const password = `Delete-${randomUUID()}-Aa1!`
  const created = await fetch(`${config.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(config),
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  assert(created.ok, `CREATE_${label}_HTTP_${created.status}`)
  const user = await created.json()
  const signedIn = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.publicKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  assert(signedIn.ok, `SIGN_IN_${label}_HTTP_${signedIn.status}`)
  const session = await signedIn.json()
  return { id: user.id, email, password, accessToken: session.access_token }
}

async function removeUser(config, userId) {
  const response = await fetch(`${config.url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: adminHeaders(config),
  })
  if (!response.ok && response.status !== 404) throw new Error(`CLEANUP_HTTP_${response.status}`)
}

async function seedHabit(config, user, label) {
  const response = await fetch(`${config.url}/rest/v1/habits`, {
    method: 'POST',
    headers: {
      apikey: config.publicKey,
      authorization: `Bearer ${user.accessToken}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify({
      id: randomUUID(),
      user_id: user.id,
      title: `Synthetic ${label}`,
      total_days: 30,
    }),
  })
  assert(response.ok, `SEED_${label}_HTTP_${response.status}`)
}

async function deletionState(config, userId) {
  const response = await fetch(`${config.url}/rest/v1/rpc/traker_account_deletion_state`, {
    method: 'POST',
    headers: adminHeaders(config),
    body: JSON.stringify({ p_user_id: userId, p_session_id: null }),
  })
  assert(response.ok, `STATE_HTTP_${response.status}`)
  return response.json()
}

async function invokeDelete(config, user, confirmation) {
  return fetch(`${config.url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      apikey: config.publicKey,
      authorization: `Bearer ${user.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ confirmation }),
  })
}

const config = await localConfig()
let accountA
let accountB
let accountADeleted = false

try {
  accountA = await createUser(config, 'a')
  accountB = await createUser(config, 'b')
  await seedHabit(config, accountA, 'A')
  await seedHabit(config, accountB, 'B')

  const rejected = await invokeDelete(config, accountA, 'NO')
  assert(rejected.status === 400, `CONFIRMATION_GATE_HTTP_${rejected.status}`)
  assert(Number((await deletionState(config, accountA.id)).ownedRows) === 1, 'A_CHANGED_AFTER_REJECTED_CONFIRMATION')

  const deleted = await invokeDelete(config, accountA, 'BORRAR')
  const deletionResult = await deleted.json().catch(() => ({}))
  assert(deleted.ok && deletionResult.code === 'ACCOUNT_DELETED', `DELETE_A_HTTP_${deleted.status}`)
  accountADeleted = true

  assert(Number((await deletionState(config, accountA.id)).ownedRows) === 0, 'A_ROWS_REMAIN')
  assert(Number((await deletionState(config, accountB.id)).ownedRows) === 1, 'B_ROWS_CHANGED')

  const aLogin = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.publicKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: accountA.email, password: accountA.password }),
  })
  assert(!aLogin.ok, 'A_CAN_STILL_SIGN_IN')

  const bLogin = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.publicKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: accountB.email, password: accountB.password }),
  })
  assert(bLogin.ok, 'B_CAN_NO_LONGER_SIGN_IN')

  process.stdout.write(`${JSON.stringify({
    confirmationGate: true,
    accountADeleted: true,
    accountARows: 0,
    accountBPreserved: true,
    accountBRows: 1,
    deletedLoginRejected: true,
  })}\n`)
} finally {
  if (accountA && !accountADeleted) await removeUser(config, accountA.id)
  if (accountB) await removeUser(config, accountB.id)
}
