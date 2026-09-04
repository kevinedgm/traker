/**
 * Canonical copy contract shared by the Vue client and Supabase Edge code.
 * Bump both values whenever catalog wording, event coverage, or selection
 * semantics change. The hash is an editorial snapshot identifier, not a
 * digest of user content.
 */
export const COPY_CATALOG_VERSION = '2026.08.31.2'
export const COPY_CATALOG_HASH = 'traker-copy-4c-v1'

/** Categories that may never receive high-intensity catalog copy. */
export const SENSITIVE_CATEGORY_IDS = Object.freeze([
  'family',
  'finance',
  'health',
  'medication',
  'nutrition',
  'sleep',
  'work',
])

/** System events whose meaning must never depend on humor. */
export const NEUTRAL_ONLY_EVENT_IDS = Object.freeze([
  'generic_error',
  'offline',
  'sync_error',
])
