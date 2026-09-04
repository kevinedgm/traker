import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  claimDueNotificationActions,
  completeNotificationAction,
  deleteNotificationActionDatabase,
  enqueueNotificationAction,
  nextNotificationActionAt,
  releaseNotificationAction,
} from './actionQueue.js'

const DATABASE = 'traker-notification-actions-test'

describe('durable notification action queue', () => {
  afterEach(() => deleteNotificationActionDatabase(DATABASE))

  it('survives independent opens and claims done/skip once', async () => {
    await enqueueNotificationAction({ id: 'done-1', action: 'done', habitId: 'habit-1' }, { now: 1_000, databaseName: DATABASE })
    await enqueueNotificationAction({ id: 'skip-1', action: 'skip', habitId: 'habit-2' }, { now: 1_001, databaseName: DATABASE })

    const firstClaim = await claimDueNotificationActions({ now: 2_000, databaseName: DATABASE })
    const secondClaim = await claimDueNotificationActions({ now: 2_000, databaseName: DATABASE })
    expect(firstClaim.map(item => item.action)).toEqual(['done', 'skip'])
    expect(secondClaim).toEqual([])

    await Promise.all(firstClaim.map(item => completeNotificationAction(item.id, { databaseName: DATABASE })))
    expect(await nextNotificationActionAt({ databaseName: DATABASE })).toBeNull()
  })

  it('keeps snooze durable until its 15 minute deadline', async () => {
    const record = await enqueueNotificationAction({ id: 'snooze-1', action: 'snooze', habitId: 'habit-1' }, { now: 10_000, databaseName: DATABASE })
    expect(await claimDueNotificationActions({ now: record.availableAt - 1, databaseName: DATABASE })).toEqual([])
    expect(await nextNotificationActionAt({ databaseName: DATABASE })).toBe(record.availableAt)
    expect(await claimDueNotificationActions({ now: record.availableAt, databaseName: DATABASE })).toHaveLength(1)
  })

  it('releases a failed action for a later retry after reload', async () => {
    await enqueueNotificationAction({ id: 'retry-1', action: 'done', habitId: 'habit-1' }, { now: 1_000, databaseName: DATABASE })
    const [claimed] = await claimDueNotificationActions({ now: 2_000, databaseName: DATABASE })
    await releaseNotificationAction(claimed.id, { databaseName: DATABASE })
    expect(await claimDueNotificationActions({ now: 2_001, databaseName: DATABASE })).toHaveLength(1)
  })
})

