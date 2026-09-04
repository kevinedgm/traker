import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client.js', () => ({ supabase: null }))

import {
  notificationDeviceId,
  toNotificationPreferenceRow,
} from './settings.service.js'

describe('notification preference mapping', () => {
  beforeEach(() => localStorage.clear())

  it('keeps a stable opaque id for this browser profile', () => {
    const first = notificationDeviceId()
    expect(notificationDeviceId()).toBe(first)
    expect(first.length).toBeGreaterThanOrEqual(16)
  })

  it('maps bounded, private-by-default per-device preferences', () => {
    const row = toNotificationPreferenceRow('user-a', {
      morningReminderEnabled: true,
      habitRemindersEnabled: false,
      closingReminderEnabled: true,
      closingReminderTime: '19:45',
      notificationDailyBudget: 20,
      lockScreenPrivacy: 'unexpected',
    }, 'device-a')
    expect(row).toMatchObject({
      user_id: 'user-a',
      device_id: 'device-a',
      habit_enabled: false,
      closing_time: '19:45',
      daily_budget: 6,
      lock_screen_privacy: 'generic',
      direct_actions_enabled: false,
    })
  })
})
