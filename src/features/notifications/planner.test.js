import { describe, expect, it } from 'vitest'
import {
  COPY_CATALOG_HASH,
  COPY_CATALOG_VERSION,
  evaluateNotificationPlan,
  isQuietAt,
  normalizeNotificationSettings,
  planNotifications,
  selectNotificationCopy,
} from './planner.js'
import {
  COPY_CATALOG_HASH as CLIENT_COPY_HASH,
  COPY_CATALOG_VERSION as CLIENT_COPY_VERSION,
} from '@/features/copy/catalog.js'
import { selectDailyOpening } from '@/features/dailyOpening/domain.js'
import { actionsForNotification } from '../../../supabase/functions/_shared/notification-actions.js'

const NOW = new Date('2026-08-29T14:00:00.000Z') // 08:00 America/Mexico_City
const BASE = {
  now: NOW,
  timezone: 'America/Mexico_City',
  settings: { enabled: true, quietStart: '21:30', quietEnd: '07:30' },
  agenda: [{ id: 'habit-a', reminderTime: '08:00', registered: false }],
}

describe('notification planner', () => {
  it('comparte exactamente la versión y snapshot con el catálogo del cliente', () => {
    expect(COPY_CATALOG_VERSION).toBe(CLIENT_COPY_VERSION)
    expect(COPY_CATALOG_HASH).toBe(CLIENT_COPY_HASH)
  })

  it('normalizes browser, database and bounded budget fields', () => {
    expect(normalizeNotificationSettings({
      notificationsEnabled: true,
      closing_reminder_enabled: false,
      daily_budget: 99,
    })).toMatchObject({ enabled: true, dailyBudget: 6 })
  })

  it('understands overnight quiet hours', () => {
    expect(isQuietAt(22 * 60, '21:30', '07:30')).toBe(true)
    expect(isQuietAt(7 * 60, '21:30', '07:30')).toBe(true)
    expect(isQuietAt(12 * 60, '21:30', '07:30')).toBe(false)
  })

  it('groups due habits and substitutes the opening reminder', () => {
    const intents = planNotifications({
      ...BASE,
      agenda: [
        { id: 'habit-b', reminderTime: '08:00', registered: false },
        { id: 'habit-a', reminderTime: '08:00', registered: false },
      ],
      settings: { ...BASE.settings, morningEnabled: true, morningTime: '08:00' },
    })
    expect(intents).toHaveLength(1)
    expect(intents[0]).toMatchObject({
      kind: 'habit_or_block',
      jobKey: '2026-08-29:habit_or_block',
      count: 2,
      referenceIds: ['habit-a', 'habit-b'],
      copyVersion: COPY_CATALOG_VERSION,
      copyHash: COPY_CATALOG_HASH,
    })
    expect(intents[0].phraseId).toMatch(/^notification\.habit_or_block\./)
  })

  it('only exposes direct actions for one habit after explicit opt-in', () => {
    expect(actionsForNotification({
      kind: 'habit_or_block',
      referenceIds: ['habit-a'],
      directActionsEnabled: true,
    }).map(item => item.action)).toEqual(['done', 'snooze', 'skip'])
    expect(actionsForNotification({
      kind: 'habit_or_block',
      referenceIds: ['habit-a', 'habit-b'],
      directActionsEnabled: true,
    })).toEqual([])
    expect(actionsForNotification({
      kind: 'habit_or_block',
      referenceIds: ['habit-a'],
      directActionsEnabled: false,
    })).toEqual([])
  })

  it('evita repetir una plantilla reciente en cliente y Edge con el mismo catálogo', () => {
    const first = selectNotificationCopy('evening_close', 0, [], 'day-1')
    const second = selectNotificationCopy('evening_close', 0, [{
      kind: 'evening_close', phraseId: first.id, at: '2026-08-30T20:00:00.000Z',
    }], 'day-2')
    expect(second.id).not.toBe(first.id)
  })

  it('usa en la notificación matutina la misma apertura pública del dashboard', () => {
    const intent = planNotifications({
      ...BASE,
      agenda: [{ id: 'habit-a', reminderTime: '09:00', registered: false }],
      settings: { ...BASE.settings, morningEnabled: true, morningTime: '08:00' },
    })[0]
    const opening = selectDailyOpening('2026-08-29')

    expect(intent).toMatchObject({
      kind: 'morning_opening',
      title: opening.title,
      body: opening.body,
      phraseId: opening.id,
    })
  })

  it.each([
    ['disabled', { settings: { enabled: false } }],
    ['silenced', { settings: { ...BASE.settings, silencedUntil: '2026-08-30T00:00:00.000Z' } }],
    ['quiet_hours', { now: new Date('2026-08-29T04:00:00.000Z') }],
    ['daily_budget', { history: [
      { kind: 'morning_opening', localDate: '2026-08-29', at: '2026-08-29T12:00:00.000Z' },
      { kind: 'habit_or_block', localDate: '2026-08-29', at: '2026-08-29T13:00:00.000Z' },
    ] }],
    ['cooldown', { history: [
      { kind: 'morning_opening', localDate: '2026-08-29', at: '2026-08-29T13:30:00.000Z' },
    ] }],
    ['already_sent', { settings: { ...BASE.settings, cooldownMinutes: 0 }, history: [
      { kind: 'habit_or_block', intentKey: '2026-08-29:habit_or_block', localDate: '2026-08-29', at: '2026-08-29T08:00:00.000Z' },
    ] }],
  ])('reports %s suppression', (reason, override) => {
    expect(evaluateNotificationPlan({ ...BASE, ...override }).suppression).toBe(reason)
  })

  it('does not ask to close an already closed day', () => {
    const result = evaluateNotificationPlan({
      ...BASE,
      now: new Date('2026-08-30T02:00:00.000Z'), // 20:00 local
      agenda: [],
      dayClosure: { localDate: '2026-08-29' },
      settings: { ...BASE.settings, closingEnabled: true, closingTime: '20:00' },
    })
    expect(result.suppression).toBe('not_due')
  })

  it('allows one return nudge per seven days', () => {
    const input = {
      ...BASE,
      agenda: [],
      daysSinceActivity: 4,
      settings: { ...BASE.settings, morningEnabled: false, returnEnabled: true, morningTime: '08:00', cooldownMinutes: 0 },
    }
    expect(planNotifications(input)[0]?.kind).toBe('return_nudge')
    expect(evaluateNotificationPlan({
      ...input,
      history: [{ kind: 'return_nudge', at: '2026-08-25T14:00:00.000Z', localDate: '2026-08-25' }],
    }).suppression).toBe('not_due')
  })
})
