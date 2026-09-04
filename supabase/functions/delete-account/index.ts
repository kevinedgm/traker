import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }
const FRESH_SIGN_IN_MS = 10 * 60 * 1000

function response(status: number, code: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: status < 400, code, ...extra }), {
    status,
    headers: JSON_HEADERS,
  })
}

function jwtClaims(token: string): Record<string, unknown> | null {
  try {
    const encoded = token.split('.')[1]
    if (!encoded) return null
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function signedInRecently(lastSignInAt?: string | null) {
  const timestamp = Date.parse(lastSignInAt ?? '')
  return Number.isFinite(timestamp) && Date.now() - timestamp <= FRESH_SIGN_IN_MS
}

async function removeOwnedStorageObjects(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: buckets, error: bucketsError } = await admin.storage.listBuckets()
  if (bucketsError) throw new Error('STORAGE_BUCKET_LIST_FAILED')

  let removed = 0
  for (const bucket of buckets ?? []) {
    const queue = ['']
    const ownedPaths: string[] = []

    while (queue.length) {
      const prefix = queue.shift() ?? ''
      for (let offset = 0; ; offset += 1000) {
        const { data: entries, error } = await admin.storage.from(bucket.id).list(prefix, {
          limit: 1000,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        })
        if (error) throw new Error('STORAGE_OBJECT_LIST_FAILED')
        const page = entries ?? []

        for (const entry of page) {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name
          if (entry.id) {
            if (entry.owner_id === userId) ownedPaths.push(path)
          } else {
            queue.push(path)
          }
        }
        if (page.length < 1000) break
      }
    }

    for (let index = 0; index < ownedPaths.length; index += 100) {
      const batch = ownedPaths.slice(index, index + 100)
      const { error } = await admin.storage.from(bucket.id).remove(batch)
      if (error) throw new Error('STORAGE_OBJECT_REMOVE_FAILED')
      removed += batch.length
    }
  }
  return removed
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (request.method !== 'POST') return response(405, 'METHOD_NOT_ALLOWED')

  const authorization = request.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return response(401, 'AUTH_REQUIRED')

  let body: { confirmation?: string }
  try {
    body = await request.json()
  } catch {
    return response(400, 'INVALID_JSON')
  }
  if (body.confirmation !== 'BORRAR') return response(400, 'CONFIRMATION_REQUIRED')

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey) return response(500, 'SERVER_CONFIGURATION_ERROR')

  const token = authorization.slice('Bearer '.length)
  const claims = jwtClaims(token)
  const sessionId = typeof claims?.session_id === 'string' ? claims.session_id : null
  if (!sessionId) return response(401, 'ACTIVE_SESSION_REQUIRED')

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  const user = userData.user
  if (userError || !user || claims?.sub !== user.id) return response(401, 'AUTH_INVALID')
  if (!signedInRecently(user.last_sign_in_at)) return response(403, 'REAUTHENTICATION_REQUIRED')

  const { data: before, error: stateError } = await admin.rpc('traker_account_deletion_state', {
    p_user_id: user.id,
    p_session_id: sessionId,
  })
  if (stateError) return response(500, 'DELETION_PREFLIGHT_FAILED')
  if (!before?.sessionActive) return response(401, 'ACTIVE_SESSION_REQUIRED')

  try {
    await removeOwnedStorageObjects(admin, user.id)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'STORAGE_CLEANUP_FAILED'
    return response(502, code)
  }

  const { error: deletionError } = await admin.auth.admin.deleteUser(user.id, false)
  if (deletionError) return response(502, 'AUTH_DELETE_FAILED')

  const { data: after, error: verificationError } = await admin.rpc('traker_account_deletion_state', {
    p_user_id: user.id,
    p_session_id: null,
  })
  if (verificationError || Number(after?.ownedRows ?? -1) !== 0) {
    return response(500, 'DELETION_VERIFICATION_FAILED')
  }

  return response(200, 'ACCOUNT_DELETED')
})
