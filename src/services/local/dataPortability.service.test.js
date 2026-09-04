import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { storage } from '@/services/storage.js'
import { deleteGoalsDatabase, GOALS_STORES, openGoalsDatabase } from './goals.database.js'
import { deleteV2Database, openV2Database, V2_STORES } from './v2.database.js'
import { NOTIFICATION_ACTION_DB } from '@/features/notifications/actionQueue.js'
import {
  deleteAccountDeviceData,
  deleteLocalDeviceData,
  exportLocalDeviceData,
  importLocalDeviceData,
  validateLocalDeviceBackup,
} from './dataPortability.service.js'

const GOALS_DB_NAME = 'traker-goals-delete-test'
const V2_DB_NAME = 'traker-v2-delete-test'

describe('local data portability', () => {
  beforeEach(async () => {
    localStorage.clear()
    await deleteGoalsDatabase(GOALS_DB_NAME)
    await deleteV2Database(V2_DB_NAME)
  })

  afterEach(async () => {
    await deleteGoalsDatabase(GOALS_DB_NAME)
    await deleteV2Database(V2_DB_NAME)
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('deletes both IndexedDB copies and local user data while preserving sessions', async () => {
    await (await openGoalsDatabase({ name: GOALS_DB_NAME }))
      .put(GOALS_STORES.goals, { id: 'goal-1', title: 'Meta local' })
    await (await openV2Database({ name: V2_DB_NAME }))
      .put(V2_STORES.habits, { id: 'habit-1', name: 'Hábito local' })
    storage.write(storage.KEYS.HABITS, [{ id: 'habit-1' }])
    storage.write(storage.KEYS.SYNC_QUEUE, [{ type: 'upsert-habit' }])
    storage.write(storage.KEYS.SUPABASE_SESSION, { access_token: 'session' })

    await expect(deleteLocalDeviceData({
      goalsDatabaseName: GOALS_DB_NAME,
      v2DatabaseName: V2_DB_NAME,
    })).resolves.toEqual({
      deletedDatabases: [GOALS_DB_NAME, V2_DB_NAME, NOTIFICATION_ACTION_DB],
      remotePreserved: true,
      sessionsPreserved: true,
    })

    expect(storage.read(storage.KEYS.HABITS, null)).toBeNull()
    expect(storage.read(storage.KEYS.SYNC_QUEUE, null)).toBeNull()
    expect(storage.read(storage.KEYS.SUPABASE_SESSION, null)).toEqual({ access_token: 'session' })
    const databases = await indexedDB.databases()
    expect(databases.map(database => database.name)).not.toContain(GOALS_DB_NAME)
    expect(databases.map(database => database.name)).not.toContain(V2_DB_NAME)
  })

  it('clears sessions, legacy namespaced data and Traker caches after account deletion', async () => {
    await (await openGoalsDatabase({ name: GOALS_DB_NAME }))
      .put(GOALS_STORES.goals, { id: 'goal-account-delete', title: 'Meta local' })
    await (await openV2Database({ name: V2_DB_NAME }))
      .put(V2_STORES.habits, { id: 'habit-account-delete', name: 'Hábito local' })
    storage.write(storage.KEYS.SUPABASE_SESSION, { access_token: 'session-secret' })
    localStorage.setItem('traker:legacy-test', 'legacy')
    localStorage.setItem('unrelated:key', 'preserve')
    sessionStorage.setItem('traker:restore-notice', 'notice')
    sessionStorage.setItem('unrelated:session', 'preserve')
    const deletedCaches = []
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['workbox-precache-traker', 'shared-cache']),
      delete: vi.fn(async name => {
        deletedCaches.push(name)
        return true
      }),
    })

    await expect(deleteAccountDeviceData({
      goalsDatabaseName: GOALS_DB_NAME,
      v2DatabaseName: V2_DB_NAME,
    })).resolves.toEqual({
      deletedDatabases: [GOALS_DB_NAME, V2_DB_NAME, NOTIFICATION_ACTION_DB],
      deletedCaches: ['workbox-precache-traker'],
      remoteDeleted: true,
      sessionsPreserved: false,
    })

    expect(localStorage.getItem(storage.KEYS.SUPABASE_SESSION)).toBeNull()
    expect(localStorage.getItem('traker:legacy-test')).toBeNull()
    expect(localStorage.getItem('unrelated:key')).toBe('preserve')
    expect(sessionStorage.getItem('traker:restore-notice')).toBeNull()
    expect(sessionStorage.getItem('unrelated:session')).toBe('preserve')
    expect(deletedCaches).toEqual(['workbox-precache-traker'])
  })

  it('exports both IndexedDB copies and filters local credentials', async () => {
    await (await openGoalsDatabase({ name: GOALS_DB_NAME }))
      .put(GOALS_STORES.goals, { id: 'goal-1', title: 'Meta local' })
    await (await openV2Database({ name: V2_DB_NAME }))
      .put(V2_STORES.habits, { id: 'habit-1', name: 'Hábito local' })
    storage.write(storage.KEYS.HABITS, [{ id: 'habit-1', name: 'Hábito heredado' }])
    storage.write(storage.KEYS.SUPABASE_SESSION, { access_token: 'session-secret' })
    storage.write(storage.KEYS.API_TOKEN, 'api-secret')
    storage.write(storage.KEYS.AUTH, '1234')

    const exported = await exportLocalDeviceData({
      goalsDatabaseName: GOALS_DB_NAME,
      databaseName: V2_DB_NAME,
      exportedAt: '2026-08-29T18:00:00.000Z',
    })

    expect(exported).toMatchObject({
      _schema: 2,
      _exportedAt: '2026-08-29T18:00:00.000Z',
      legacy: { habits: [{ id: 'habit-1', name: 'Hábito heredado' }] },
    })
    expect(exported.stores[V2_STORES.habits]).toEqual([{ id: 'habit-1', name: 'Hábito local' }])
    expect(exported.legacyGoals[GOALS_STORES.goals]).toEqual([{ id: 'goal-1', title: 'Meta local' }])
    expect(JSON.stringify(exported)).not.toContain('session-secret')
    expect(JSON.stringify(exported)).not.toContain('api-secret')
    expect(JSON.stringify(exported)).not.toContain('1234')
  })

  it('restores an exact local round trip while preserving the current cloud session', async () => {
    const goalsDb = await openGoalsDatabase({ name: GOALS_DB_NAME })
    const v2Db = await openV2Database({ name: V2_DB_NAME })
    await goalsDb.put(GOALS_STORES.goals, { id: 'goal-restore', title: 'Meta conservada' })
    await v2Db.put(V2_STORES.habits, { id: 'habit-restore', name: 'Hábito conservado' })
    await v2Db.put(V2_STORES.outbox, {
      operationId: 'operation-restore',
      entityType: 'habit',
      entityId: 'habit-restore',
      state: 'pending',
    })
    storage.write(storage.KEYS.HABITS, { habits: [{ id: 'habit-restore', name: 'Hábito conservado' }] })
    storage.write(storage.KEYS.SETTINGS, { theme: 'dark', includeEmotionsInExport: false })
    storage.write(storage.KEYS.SUPABASE_SESSION, { access_token: 'current-session' })
    const backup = await exportLocalDeviceData({
      goalsDatabaseName: GOALS_DB_NAME,
      databaseName: V2_DB_NAME,
      exportedAt: '2026-09-01T06:00:00.000Z',
    })

    await deleteLocalDeviceData({ goalsDatabaseName: GOALS_DB_NAME, v2DatabaseName: V2_DB_NAME })
    storage.write(storage.KEYS.HABITS, { habits: [{ id: 'junk' }] })

    await expect(importLocalDeviceData(backup, {
      goalsDatabaseName: GOALS_DB_NAME,
      v2DatabaseName: V2_DB_NAME,
    })).resolves.toEqual({
      restoredDatabases: [GOALS_DB_NAME, V2_DB_NAME],
      remotePreserved: true,
      sessionsPreserved: true,
    })

    expect(storage.read(storage.KEYS.HABITS, null)).toEqual({
      habits: [{ id: 'habit-restore', name: 'Hábito conservado' }],
    })
    expect(storage.read(storage.KEYS.SETTINGS, null)).toEqual({
      theme: 'dark',
      includeEmotionsInExport: false,
    })
    expect(storage.read(storage.KEYS.SUPABASE_SESSION, null)).toEqual({ access_token: 'current-session' })
    expect(await (await openGoalsDatabase({ name: GOALS_DB_NAME })).getAll(GOALS_STORES.goals))
      .toEqual([{ id: 'goal-restore', title: 'Meta conservada' }])
    expect(await (await openV2Database({ name: V2_DB_NAME })).getAll(V2_STORES.habits))
      .toEqual([{ id: 'habit-restore', name: 'Hábito conservado' }])
    expect(await (await openV2Database({ name: V2_DB_NAME })).getAll(V2_STORES.outbox))
      .toEqual([expect.objectContaining({ operationId: 'operation-restore', state: 'pending' })])
  })

  it('rejects incompatible or malformed backups before replacing current data', async () => {
    storage.write(storage.KEYS.HABITS, { habits: [{ id: 'still-here' }] })
    const current = storage.read(storage.KEYS.HABITS, null)

    expect(() => validateLocalDeviceBackup({ _schema: 99, _database: 'traker-v2' }))
      .toThrow('versión más reciente')
    await expect(importLocalDeviceData({
      _schema: 2,
      _database: 'traker-v2',
      legacy: { _schema: storage.SCHEMA_VERSION },
      stores: {},
      legacyGoals: {},
    }, {
      goalsDatabaseName: GOALS_DB_NAME,
      v2DatabaseName: V2_DB_NAME,
    })).rejects.toThrow('stores.goals debe ser una lista')

    expect(storage.read(storage.KEYS.HABITS, null)).toEqual(current)
  })
})
