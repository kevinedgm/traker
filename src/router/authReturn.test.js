import { describe, expect, it } from 'vitest'
import { authReturnRouteName } from './authReturn.js'

describe('authReturnRouteName', () => {
  it('returns to the approved local pilot after sign-in', () => {
    expect(authReturnRouteName('sync-v2-pilot')).toBe('sync-v2-pilot')
  })

  it('falls back to the dashboard for unapproved destinations', () => {
    expect(authReturnRouteName('https://example.com')).toBe('dashboard')
    expect(authReturnRouteName('//example.com')).toBe('dashboard')
    expect(authReturnRouteName(undefined)).toBe('dashboard')
  })
})
