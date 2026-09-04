import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteV2Database, openV2Database, V2_STORES } from './v2.database.js'
import { ensureV2LocalOwner, V2_OWNER_BINDING_KEY } from './v2.ownership.js'

const DB_NAME = 'traker-v2-owner-test'
const fingerprint = async userId => `fingerprint:${userId}`

describe('v2 local owner boundary', () => {
  beforeEach(() => deleteV2Database(DB_NAME))
  afterEach(() => deleteV2Database(DB_NAME))

  it('binds once and accepts the same account later', async () => {
    await expect(ensureV2LocalOwner('user-a', {
      databaseName: DB_NAME,
      now: '2026-08-30T02:00:00.000Z',
      fingerprint,
    })).resolves.toEqual({ allowed: true, status: 'bound' })
    await expect(ensureV2LocalOwner('user-a', { databaseName: DB_NAME, fingerprint }))
      .resolves.toEqual({ allowed: true, status: 'matched' })

    const stored = await (await openV2Database({ name: DB_NAME }))
      .get(V2_STORES.migrationMeta, V2_OWNER_BINDING_KEY)
    expect(stored).toEqual({
      key: V2_OWNER_BINDING_KEY,
      ownerFingerprint: 'fingerprint:user-a',
      boundAt: '2026-08-30T02:00:00.000Z',
    })
  })

  it('blocks another account without replacing the original binding', async () => {
    await ensureV2LocalOwner('user-a', { databaseName: DB_NAME, fingerprint })

    await expect(ensureV2LocalOwner('user-b', { databaseName: DB_NAME, fingerprint }))
      .resolves.toEqual({ allowed: false, status: 'owner_mismatch' })
    const stored = await (await openV2Database({ name: DB_NAME }))
      .get(V2_STORES.migrationMeta, V2_OWNER_BINDING_KEY)
    expect(stored.ownerFingerprint).toBe('fingerprint:user-a')
  })

  it('does not create a binding without an authenticated account', async () => {
    await expect(ensureV2LocalOwner(null, { databaseName: DB_NAME, fingerprint }))
      .resolves.toEqual({ allowed: false, status: 'signed_out' })
    const stored = await (await openV2Database({ name: DB_NAME }))
      .get(V2_STORES.migrationMeta, V2_OWNER_BINDING_KEY)
    expect(stored).toBeUndefined()
  })
})
