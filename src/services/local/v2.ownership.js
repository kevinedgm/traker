import { openV2Database, V2_DB_NAME, V2_STORES } from './v2.database.js'

export const V2_OWNER_BINDING_KEY = 'sync-v2-owner-binding'

async function ownerFingerprint(userId) {
  const input = new TextEncoder().encode(`traker-v2-owner:${userId}`)
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', input)
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // Compatibility fallback for old embedded browsers. This marker prevents
  // accidental account mixing; it is not an authentication credential.
  let hash = 2166136261
  for (const byte of input) hash = Math.imul(hash ^ byte, 16777619)
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

/**
 * Atomically binds an unowned local v2 copy to one cloud account, then refuses
 * every different account. Only a one-way fingerprint is persisted.
 */
export async function ensureV2LocalOwner(userId, {
  databaseName = V2_DB_NAME,
  now = new Date().toISOString(),
  fingerprint = ownerFingerprint,
} = {}) {
  if (!userId) return { allowed: false, status: 'signed_out' }
  const currentFingerprint = await fingerprint(userId)
  const db = await openV2Database({ name: databaseName })
  const tx = db.transaction(V2_STORES.migrationMeta, 'readwrite')
  const existing = await tx.store.get(V2_OWNER_BINDING_KEY)
  if (!existing) {
    await tx.store.put({
      key: V2_OWNER_BINDING_KEY,
      ownerFingerprint: currentFingerprint,
      boundAt: now,
    })
    await tx.done
    return { allowed: true, status: 'bound' }
  }
  await tx.done
  return existing.ownerFingerprint === currentFingerprint
    ? { allowed: true, status: 'matched' }
    : { allowed: false, status: 'owner_mismatch' }
}
