import { openDB } from 'idb'

export const GOALS_DB_NAME = 'traker-goals'
export const GOALS_DB_VERSION = 1

export const GOALS_STORES = Object.freeze({
  goals: 'goals',
  stages: 'goalStages',
  actions: 'goalActions',
  sessions: 'workSessions',
  progress: 'progressEntries',
  events: 'goalEvents',
  outbox: 'syncOutbox',
  syncMeta: 'syncMeta',
})

const databasePromises = new Map()

export function openGoalsDatabase({ name = GOALS_DB_NAME } = {}) {
  if (!databasePromises.has(name)) {
    const promise = openDB(name, GOALS_DB_VERSION, {
      upgrade(db) {
        const goals = db.createObjectStore(GOALS_STORES.goals, { keyPath: 'id' })
        goals.createIndex('by-status', 'status')
        goals.createIndex('by-focus-rank', 'focusRank')
        goals.createIndex('by-updated-at', 'updatedAt')

        const stages = db.createObjectStore(GOALS_STORES.stages, { keyPath: 'id' })
        stages.createIndex('by-goal', 'goalId')

        const actions = db.createObjectStore(GOALS_STORES.actions, { keyPath: 'id' })
        actions.createIndex('by-goal', 'goalId')
        actions.createIndex('by-stage', 'stageId')

        const sessions = db.createObjectStore(GOALS_STORES.sessions, { keyPath: 'id' })
        sessions.createIndex('by-goal', 'goalId')
        sessions.createIndex('by-status', 'status')

        const progress = db.createObjectStore(GOALS_STORES.progress, { keyPath: 'id' })
        progress.createIndex('by-goal', 'goalId')
        progress.createIndex('by-occurred-at', 'occurredAt')

        const events = db.createObjectStore(GOALS_STORES.events, { keyPath: 'id' })
        events.createIndex('by-goal', 'goalId')
        events.createIndex('by-occurred-at', 'occurredAt')

        const outbox = db.createObjectStore(GOALS_STORES.outbox, { keyPath: 'operationId' })
        outbox.createIndex('by-created-at', 'createdAt')

        db.createObjectStore(GOALS_STORES.syncMeta, { keyPath: 'key' })
      },
      blocking() {
        databasePromises.get(name)?.then(db => db.close())
        databasePromises.delete(name)
      },
    })
    databasePromises.set(name, promise)
  }
  return databasePromises.get(name)
}

export async function readGoalsStores({ name = GOALS_DB_NAME } = {}) {
  const db = await openGoalsDatabase({ name })
  const entries = await Promise.all(
    Object.values(GOALS_STORES).map(async storeName => [storeName, await db.getAll(storeName)]),
  )
  return Object.fromEntries(entries)
}

export async function deleteGoalsDatabase(name = GOALS_DB_NAME) {
  const promise = databasePromises.get(name)
  if (promise) {
    const db = await promise
    db.close()
    databasePromises.delete(name)
  }
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`Database deletion blocked: ${name}`))
  })
}
