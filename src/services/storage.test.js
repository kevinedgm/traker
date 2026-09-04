import { beforeEach, describe, expect, it } from 'vitest'
import { KEYS, SCHEMA_VERSION, storage } from './storage.js'

describe('storage service', () => {
  beforeEach(() => localStorage.clear())

  it('writes and reads namespaced JSON values', () => {
    const habits = [{ id: 'habit-1', name: 'Leer' }]
    expect(storage.write(KEYS.HABITS, habits)).toBe(true)
    expect(storage.read(KEYS.HABITS, [])).toEqual(habits)
  })

  it('migrates a legacy habits array and stamps the schema', () => {
    localStorage.setItem(KEYS.HABITS, JSON.stringify([{ id: 'habit-1', name: 'Leer' }]))
    const result = storage.bootstrap()

    expect(storage.read(KEYS.HABITS, [])[0]).toMatchObject({
      id: 'habit-1', name: 'Leer', duration: 30, logs: {},
    })
    expect(storage.getMeta().schemaVersion).toBe(SCHEMA_VERSION)
    expect(result).toMatchObject({ status: 'migrated', fromVersion: 0 })
  })

  it('blocks an older cached client without downgrading newer local data', () => {
    const futureSchema = SCHEMA_VERSION + 2
    const habits = { habits: [{ id: 'future-habit', futureField: { keep: true } }] }
    storage.write(KEYS.META, { schemaVersion: futureSchema, lastOpened: '2026-09-01T06:00:00.000Z' })
    storage.write(KEYS.HABITS, habits)

    const result = storage.bootstrap()

    expect(result).toEqual({
      status: 'blocked_newer_schema',
      fromVersion: futureSchema,
      supportedVersion: SCHEMA_VERSION,
    })
    expect(storage.getMeta()).toMatchObject({ schemaVersion: futureSchema })
    expect(storage.read(KEYS.HABITS, null)).toEqual(habits)
  })

  it('removes retired daily-gate keys without touching current app data', () => {
    localStorage.setItem('traker.retired-picker.shownOn.Sun Aug 30 2026', '1')
    storage.write(KEYS.HABITS, [{ id: 'habit-1', name: 'Leer' }])
    storage.write(KEYS.META, { schemaVersion: 1 })

    storage.bootstrap()

    expect(localStorage.getItem('traker.retired-picker.shownOn.Sun Aug 30 2026')).toBeNull()
    expect(storage.read(KEYS.HABITS, [])).toEqual([{ id: 'habit-1', name: 'Leer' }])
  })

  it('rejects backups from a newer schema', () => {
    expect(() => storage.importData({ _schema: SCHEMA_VERSION + 1 })).toThrow('Backup requires schema')
  })

  it('includes private daily check-ins in backups and account reset', () => {
    const checkins = { checkins: [{ id: 'checkin-1', syncScope: 'local_only' }] }
    storage.write(KEYS.CHECKINS, checkins)
    expect(storage.exportData().checkins).toEqual(checkins)
    storage.clearAll()
    expect(storage.read(KEYS.CHECKINS, null)).toBeNull()
  })

  it('backs up rewards, claims and day closures together', () => {
    const rewards = { rewards: [{ id: 'reward-1' }], claims: [{ id: 'claim-1' }] }
    const dayClosures = { closures: [{ id: 'closure-1', localDate: '2026-08-29' }] }
    storage.write(KEYS.REWARDS, rewards)
    storage.write(KEYS.DAY_CLOSURES, dayClosures)

    expect(storage.exportData()).toMatchObject({ rewards, dayClosures })
    storage.clearAll()
    expect(storage.read(KEYS.REWARDS, null)).toBeNull()
    expect(storage.read(KEYS.DAY_CLOSURES, null)).toBeNull()
  })

  it('exports, restores and clears flexible groups', () => {
    const flexibleGroups = { groups: [{ id: 'group-1', memberIds: ['habit-1'] }] }
    storage.write(KEYS.FLEXIBLE_GROUPS, flexibleGroups)
    expect(storage.exportData().flexibleGroups).toEqual(flexibleGroups)

    localStorage.removeItem(KEYS.FLEXIBLE_GROUPS)
    storage.importData({ _schema: SCHEMA_VERSION, flexibleGroups })
    expect(storage.read(KEYS.FLEXIBLE_GROUPS, null)).toEqual(flexibleGroups)

    storage.clearAll()
    expect(storage.read(KEYS.FLEXIBLE_GROUPS, null)).toBeNull()
  })

  it('exports operational queues without leaking authentication material', () => {
    const syncQueue = [{ type: 'upsert-habit', v2OperationId: 'operation-1' }]
    const notificationLog = [{ kind: 'morning_opening', at: '2026-08-29T08:00:00.000Z' }]
    storage.write(KEYS.SYNC_QUEUE, syncQueue)
    storage.write(KEYS.NOTIFICATION_LOG, notificationLog)
    storage.write(KEYS.AUTH, { pin: '1234' })
    storage.write(KEYS.SUPABASE_SESSION, { access_token: 'secret' })
    storage.write(KEYS.API_TOKEN, 'secret')

    const exported = storage.exportData()

    expect(exported).toMatchObject({ syncQueue, notificationLog })
    expect(exported).not.toHaveProperty('pin')
    expect(JSON.stringify(exported)).not.toContain('secret')
  })

  it('honors the emotional-data export preference', () => {
    storage.write(KEYS.CHECKINS, { checkins: [{ id: 'checkin-private', mood: 1, note: 'privado' }] })
    storage.write(KEYS.SETTINGS, { includeEmotionsInExport: false })

    expect(storage.exportData()).toMatchObject({
      _privacy: { emotionsIncluded: false },
      checkins: { checkins: [] },
    })
    expect(JSON.stringify(storage.exportData())).not.toContain('privado')
  })

  it('can clear user data while preserving account sessions', () => {
    storage.write(KEYS.HABITS, [{ id: 'habit-1' }])
    storage.write(KEYS.SYNC_QUEUE, [{ type: 'delete-habit' }])
    storage.write(KEYS.SUPABASE_SESSION, { access_token: 'session' })
    storage.write(KEYS.API_TOKEN, 'legacy-session')

    storage.clearAll({ preserveSessions: true })

    expect(storage.read(KEYS.HABITS, null)).toBeNull()
    expect(storage.read(KEYS.SYNC_QUEUE, null)).toBeNull()
    expect(storage.read(KEYS.SUPABASE_SESSION, null)).toEqual({ access_token: 'session' })
    expect(storage.read(KEYS.API_TOKEN, null)).toBe('legacy-session')
  })
})
