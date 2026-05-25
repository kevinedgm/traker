/**
 * @file persistence.js
 * Pinia plugin: automatic localStorage persistence.
 *
 * Usage — add a `persist` option to any store:
 *
 *   defineStore('myStore', setupFn, {
 *     persist: true                       // persist everything, key = traker:myStore
 *
 *     // — or granular config —
 *     persist: {
 *       key:         'traker:my-key',     // override storage key
 *       pick:        ['field1', 'field2'],// persist only these state keys
 *       debounce:    300,                 // ms to debounce writes (0 = immediate)
 *       serialize:   (state) => state,    // transform before writing
 *       deserialize: (saved) => saved,    // transform after reading
 *     }
 *   })
 *
 * The plugin:
 *  1. Reads persisted state and patches the store on first use.
 *  2. Subscribes to every mutation and writes the (optionally
 *     filtered) state to localStorage automatically.
 *  3. Listens to the browser's `storage` event so changes made
 *     in another tab propagate here in real time.
 */

import { storage } from '@services/storage'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Pick only the requested keys from a state object. */
function pickKeys(state, keys) {
  return Object.fromEntries(keys.map(k => [k, state[k]]))
}

/**
 * Resolve the user-supplied `persist` option into a normalised
 * config object with defaults filled in.
 */
function resolveConfig(storeId, raw) {
  if (!raw) return null

  const base = raw === true ? {} : raw

  return {
    key:         base.key         ?? `traker:${storeId}`,
    pick:        base.pick        ?? null,     // null = all state
    debounce:    base.debounce    ?? 0,
    serialize:   base.serialize   ?? ((s) => s),
    deserialize: base.deserialize ?? ((s) => s),
  }
}

// ─────────────────────────────────────────────────────────────
// Plugin factory
// ─────────────────────────────────────────────────────────────

/**
 * Call this once and pass the result to `pinia.use(...)`.
 *
 * @param {typeof storage} [storageService] — override the storage
 *   service (useful for testing).
 */
export function createPersistence(storageService = storage) {
  return function persistencePlugin({ store, options }) {
    const config = resolveConfig(store.$id, options?.persist)
    if (!config) return   // store did not opt in

    const { key, pick, debounce, serialize, deserialize } = config

    // ── 1. Hydrate from storage ──────────────────────────────

    let isHydrating = true

    const saved = storageService.read(key, null)
    if (saved !== null) {
      try {
        const hydrated = deserialize(saved)
        if (hydrated && typeof hydrated === 'object') {
          const patch = pick
            ? Object.fromEntries(
                pick
                  .filter(k => k in hydrated)
                  .map(k => [k, hydrated[k]])
              )
            : hydrated

          store.$patch(patch)
        }
      } catch (err) {
        console.warn(`[persistence] hydrate "${store.$id}" failed:`, err)
      }
    }

    isHydrating = false

    // ── 2. Subscribe: write on every mutation ────────────────

    let writeTimer = null

    const flush = () => {
      const raw   = pick ? pickKeys(store.$state, pick) : store.$state
      const data  = serialize(raw)
      storageService.write(key, data)
    }

    store.$subscribe((_mutation, _state) => {
      if (isHydrating) return

      if (debounce > 0) {
        clearTimeout(writeTimer)
        writeTimer = setTimeout(flush, debounce)
      } else {
        flush()
      }
    }, {
      // Keep subscription alive even when the component that
      // triggered useXxxStore() is unmounted.
      detached: true,
    })

    // ── 3. Cross-tab sync ────────────────────────────────────

    storageService.onExternalChange(key, (external) => {
      try {
        const hydrated = deserialize(external)
        if (!hydrated || typeof hydrated !== 'object') return

        const patch = pick
          ? Object.fromEntries(
              pick
                .filter(k => k in hydrated)
                .map(k => [k, hydrated[k]])
            )
          : hydrated

        // Guard against triggering our own subscriber
        isHydrating = true
        store.$patch(patch)
        isHydrating = false
      } catch (err) {
        console.warn(`[persistence] cross-tab sync "${store.$id}" failed:`, err)
      }
    })
  }
}
