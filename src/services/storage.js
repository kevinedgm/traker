/**
 * @file storage.js
 * Central localStorage service for traker.
 *
 * Responsibilities:
 *  - Namespaced key registry        (all keys live here, nowhere else)
 *  - Schema versioning + migrations  (v0 → v1 → …)
 *  - Safe read / write / remove      (try/catch, two-level JSON parse for backward-compat)
 *  - Cross-tab sync event            (window 'storage' event)
 *  - Data export / import            (full JSON snapshot for backup)
 *  - clearAll                        (wipe everything on log-out)
 *
 * Nothing in this file imports from Pinia or Vue —
 * it is a pure-JS service usable anywhere.
 */

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 3

/** All localStorage keys used by the app. Import KEYS wherever
 *  you need a key instead of hardcoding a string. */
export const KEYS = Object.freeze({
  HABITS:     'traker:habits',
  CHECKINS:   'traker:checkins',
  REWARDS:    'traker:rewards',
  DAY_CLOSURES: 'traker:day-closures',
  FLEXIBLE_GROUPS: 'traker:flexible-groups',
  AUTH:       'traker:pin',      // raw PIN (backward-compat key)
  APP:        'traker:app',      // theme, etc.
  SETTINGS:   'traker:settings',
  META:       'traker:meta',     // schema version, first/last opened
  COPY_STATE: 'traker:copy-state', // local-only copy history, saved/disabled ids and feedback
  DEVICE_ID:  'traker:device-id',
  PUSH_ACTIVE: 'traker:push-active',
  SYNC_QUEUE: 'traker:sync-queue',
  NOTIFICATION_LOG: 'traker:notif-log',
  SUPABASE_SESSION: 'traker:supabase-session',
  API_TOKEN: 'traker:token',
})

// ─────────────────────────────────────────────────────────────
// Low-level safe helpers
// ─────────────────────────────────────────────────────────────

/**
 * Read a key from localStorage.
 * Two-level JSON.parse: first attempt full parse; if it throws
 * (e.g. the old PIN was stored as a bare string "1234"), return
 * the raw string value — callers / deserialisers handle the rest.
 */
function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    try {
      return JSON.parse(raw)
    } catch {
      // Not valid JSON — return raw string (e.g. old PIN format)
      return raw
    }
  } catch (err) {
    console.warn(`[storage] read("${key}") failed:`, err)
    return fallback
  }
}

/**
 * Write a value as JSON to localStorage.
 * Returns true on success, false if storage is unavailable / quota exceeded.
 */
function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    console.warn(`[storage] write("${key}") failed:`, err)
    return false
  }
}

/** Remove a key. Silently swallows any error. */
function safeRemove(key) {
  try { localStorage.removeItem(key) } catch { /* noop */ }
}

// ─────────────────────────────────────────────────────────────
// Schema migrations
// ─────────────────────────────────────────────────────────────

/**
 * Migration functions keyed by the TARGET version they produce.
 * Each receives the full raw data bundle and returns a new bundle.
 *
 * v0 → v1:
 *   - habits array: ensure reminderDays, logs, createdAt exist
 *   - Handle old format where habits was stored as bare array
 */
const MIGRATIONS = {
  1(data) {
    const raw = Array.isArray(data)
      ? data                          // old bare-array format
      : (data?.habits ?? [])

    return {
      ...data,
      habits: raw.map(h => ({
        id:           h.id           ?? crypto.randomUUID(),
        name:         h.name         ?? '',
        icon:         h.icon         ?? '🏃',
        color:        h.color        ?? '#637f50',
        duration:     h.duration     ?? 30,
        reminder:     h.reminder     ?? null,
        reminderDays: h.reminderDays ?? null,
        createdAt:    h.createdAt    ?? new Date().toISOString(),
        logs:         h.logs         ?? {},
      })),
    }
  },
  2(data) {
    return data
  },
  3(data) {
    return { ...data, flexibleGroups: data?.flexibleGroups ?? { groups: [] } }
  },
}

function removeLegacyDailyGateKeys() {
  try {
    const keys = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('traker.') && key.includes('.shownOn.')) keys.push(key)
    }
    keys.forEach(safeRemove)
  } catch {
    // Storage cleanup is best-effort; normal app data remains untouched.
  }
}

/**
 * Run all migrations needed to bring data from `fromVersion`
 * up to SCHEMA_VERSION. Returns the migrated data bundle.
 */
function runMigrations(data, fromVersion) {
  let current = data
  for (let v = fromVersion + 1; v <= SCHEMA_VERSION; v++) {
    if (MIGRATIONS[v]) {
      current = MIGRATIONS[v](current)
      console.info(`[storage] migrated to schema v${v}`)
    }
  }
  return current
}

// ─────────────────────────────────────────────────────────────
// Meta (schema version + timestamps)
// ─────────────────────────────────────────────────────────────

function getMeta() {
  return safeRead(KEYS.META, { schemaVersion: 0, firstOpened: null, lastOpened: null })
}

function setMeta(patch) {
  safeWrite(KEYS.META, { ...getMeta(), ...patch })
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export const storage = {
  KEYS,
  SCHEMA_VERSION,

  // ── Primitives ──────────────────────────────────────────────
  read:   safeRead,
  write:  safeWrite,
  remove: safeRemove,

  // ── Meta / stamp ────────────────────────────────────────────
  getMeta,

  /**
   * Update the meta record with the current timestamp and schema
   * version. Call once on app start (after migrations).
   */
  stamp() {
    const meta   = getMeta()
    const now    = new Date().toISOString()
    setMeta({
      schemaVersion: SCHEMA_VERSION,
      firstOpened:   meta.firstOpened ?? now,
      lastOpened:    now,
    })
  },

  // ── Bootstrap: read + migrate all data ──────────────────────

  /**
   * Called once at startup. Reads all persisted data, runs any
   * necessary schema migrations, re-writes migrated data, updates
   * meta. Returns a data bundle that stores can use to self-hydrate
   * if they skip the plugin.
   */
  bootstrap() {
    const meta        = getMeta()
    const parsedVersion = Number(meta.schemaVersion)
    const fromVersion = Number.isFinite(parsedVersion) ? parsedVersion : 0

    // A cached, older app bundle must never open data written by a newer
    // contract. Mounting Pinia would allow its persistence plugin to rewrite
    // unknown fields and `stamp()` would silently downgrade the schema marker.
    if (fromVersion > SCHEMA_VERSION) {
      console.warn(`[storage] schema v${fromVersion} requires a newer app bundle; startup paused`)
      return {
        status: 'blocked_newer_schema',
        fromVersion,
        supportedVersion: SCHEMA_VERSION,
      }
    }

    if (fromVersion < SCHEMA_VERSION) {
      // Assemble bundle from individual keys
      const bundle = {
        habits:   safeRead(KEYS.HABITS, []),
        checkins: safeRead(KEYS.CHECKINS, { checkins: [] }),
        rewards: safeRead(KEYS.REWARDS, { rewards: [], claims: [] }),
        dayClosures: safeRead(KEYS.DAY_CLOSURES, { closures: [] }),
        flexibleGroups: safeRead(KEYS.FLEXIBLE_GROUPS, { groups: [] }),
        settings: safeRead(KEYS.SETTINGS, {}),
        app:      safeRead(KEYS.APP, {}),
      }

      const migrated = runMigrations(bundle, fromVersion)

      // Persist migrated data back
      if (migrated.habits)   safeWrite(KEYS.HABITS,   migrated.habits)
      if (migrated.checkins) safeWrite(KEYS.CHECKINS, migrated.checkins)
      if (migrated.rewards) safeWrite(KEYS.REWARDS, migrated.rewards)
      if (migrated.dayClosures) safeWrite(KEYS.DAY_CLOSURES, migrated.dayClosures)
      if (migrated.flexibleGroups) safeWrite(KEYS.FLEXIBLE_GROUPS, migrated.flexibleGroups)
      if (migrated.settings) safeWrite(KEYS.SETTINGS, migrated.settings)
      if (migrated.app)      safeWrite(KEYS.APP,       migrated.app)
      if (fromVersion < 2) removeLegacyDailyGateKeys()
    }

    this.stamp()
    return {
      status: fromVersion < SCHEMA_VERSION ? 'migrated' : 'ready',
      fromVersion,
      supportedVersion: SCHEMA_VERSION,
    }
  },

  // ── Cross-tab sync ───────────────────────────────────────────

  /**
   * Register a callback for when `key` is changed in another tab.
   * Returns an unsubscribe function.
   */
  onExternalChange(key, callback) {
    const handler = (e) => {
      if (e.key !== key || e.newValue === null) return
      try {
        callback(JSON.parse(e.newValue))
      } catch {
        callback(e.newValue) // raw string fallback
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  },

  // ── Export / Import ─────────────────────────────────────────

  /**
   * Export all app data as a JSON-serialisable object.
   * Suitable for file download / cloud backup.
   */
  exportData({ includeEmotions } = {}) {
    const settings = safeRead(KEYS.SETTINGS, {})
    const emotionsIncluded = includeEmotions ?? settings.includeEmotionsInExport !== false
    const checkins = safeRead(KEYS.CHECKINS, { checkins: [] })
    return {
      _schema:     SCHEMA_VERSION,
      _exportedAt: new Date().toISOString(),
      _privacy:    { emotionsIncluded },
      habits:      safeRead(KEYS.HABITS,   []),
      checkins:    emotionsIncluded ? checkins : { ...checkins, checkins: [] },
      rewards:     safeRead(KEYS.REWARDS, { rewards: [], claims: [] }),
      dayClosures: safeRead(KEYS.DAY_CLOSURES, { closures: [] }),
      flexibleGroups: safeRead(KEYS.FLEXIBLE_GROUPS, { groups: [] }),
      settings,
      app:         safeRead(KEYS.APP,      {}),
      copyState:   safeRead(KEYS.COPY_STATE, null),
      syncQueue:   safeRead(KEYS.SYNC_QUEUE, []),
      notificationLog: safeRead(KEYS.NOTIFICATION_LOG, []),
    }
  },

  /**
   * Restore data from a previously exported bundle.
   * Throws if the bundle schema is incompatible.
   */
  importData(bundle) {
    if (!bundle || typeof bundle !== 'object') {
      throw new Error('Invalid backup data')
    }
    if ((bundle._schema ?? 0) > SCHEMA_VERSION) {
      throw new Error(`Backup requires schema v${bundle._schema}, app is on v${SCHEMA_VERSION}`)
    }
    if (bundle.habits)   safeWrite(KEYS.HABITS,   bundle.habits)
    if (bundle.checkins) safeWrite(KEYS.CHECKINS, bundle.checkins)
    if (bundle.rewards) safeWrite(KEYS.REWARDS, bundle.rewards)
    if (bundle.dayClosures) safeWrite(KEYS.DAY_CLOSURES, bundle.dayClosures)
    if (bundle.flexibleGroups) safeWrite(KEYS.FLEXIBLE_GROUPS, bundle.flexibleGroups)
    if (bundle.settings) safeWrite(KEYS.SETTINGS, bundle.settings)
    if (bundle.app)      safeWrite(KEYS.APP,       bundle.app)
    if (bundle.copyState) safeWrite(KEYS.COPY_STATE, bundle.copyState)
    if (bundle.syncQueue) safeWrite(KEYS.SYNC_QUEUE, bundle.syncQueue)
    if (bundle.notificationLog) safeWrite(KEYS.NOTIFICATION_LOG, bundle.notificationLog)
    this.stamp()
  },

  // ── Nuclear option ───────────────────────────────────────────

  /** Remove ALL traker keys from localStorage (used on account reset). */
  clearAll({ preserveSessions = false } = {}) {
    const preserved = preserveSessions
      ? new Set([KEYS.SUPABASE_SESSION, KEYS.API_TOKEN])
      : new Set()
    Object.values(KEYS).filter(key => !preserved.has(key)).forEach(safeRemove)
  },
}
