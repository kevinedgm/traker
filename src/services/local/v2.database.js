import { deleteDB, openDB } from 'idb'

export const V2_DB_NAME = 'traker-v2'
export const V2_DB_VERSION = 1

export const V2_STORES = Object.freeze({
  goals: 'goals',
  milestones: 'milestones',
  actions: 'actions',
  sessions: 'sessions',
  goalEvents: 'goalEvents',
  habits: 'habits',
  schedules: 'schedules',
  habitGoalLinks: 'habitGoalLinks',
  flexibleGroups: 'flexibleGroups',
  flexibleGroupMembers: 'flexibleGroupMembers',
  habitLogs: 'habitLogs',
  dailyCheckins: 'dailyCheckins',
  dayClosures: 'dayClosures',
  rewards: 'rewards',
  rewardRules: 'rewardRules',
  rewardSources: 'rewardSources',
  rewardClaims: 'rewardClaims',
  notificationPreferences: 'notificationPreferences',
  outbox: 'outbox',
  syncCursors: 'syncCursors',
  migrationMeta: 'migrationMeta',
})

const databasePromises = new Map()

function createStore(db, name, keyPath, indexes = []) {
  const store = db.createObjectStore(name, { keyPath })
  for (const [indexName, indexKey, options] of indexes) {
    store.createIndex(indexName, indexKey, options)
  }
  return store
}

export function openV2Database({ name = V2_DB_NAME } = {}) {
  if (!databasePromises.has(name)) {
    const promise = openDB(name, V2_DB_VERSION, {
      upgrade(db) {
        createStore(db, V2_STORES.goals, 'id', [
          ['by-status', 'status'],
          ['by-updated-at', 'updatedAt'],
        ])
        createStore(db, V2_STORES.milestones, 'id', [['by-goal', 'goalId']])
        createStore(db, V2_STORES.actions, 'id', [
          ['by-goal', 'goalId'],
          ['by-milestone', 'milestoneId'],
        ])
        createStore(db, V2_STORES.sessions, 'id', [
          ['by-goal', 'goalId'],
          ['by-status', 'status'],
        ])
        createStore(db, V2_STORES.goalEvents, 'id', [['by-goal', 'goalId']])
        createStore(db, V2_STORES.habits, 'id', [
          ['by-lifecycle', 'lifecycleStatus'],
          ['by-updated-at', 'updatedAt'],
        ])
        createStore(db, V2_STORES.schedules, 'id', [['by-habit', 'habitId']])
        createStore(db, V2_STORES.habitGoalLinks, 'id', [
          ['by-habit', 'habitId'],
          ['by-goal', 'goalId'],
        ])
        createStore(db, V2_STORES.flexibleGroups, 'id')
        createStore(db, V2_STORES.flexibleGroupMembers, 'id', [
          ['by-group', 'groupId'],
          ['by-habit', 'habitId'],
        ])
        createStore(db, V2_STORES.habitLogs, 'id', [
          ['by-habit', 'habitId'],
          ['by-local-date', 'localDate'],
          ['by-occurrence', ['habitId', 'occurrenceKey'], { unique: true }],
        ])
        createStore(db, V2_STORES.dailyCheckins, 'id', [['by-local-date', 'localDate', { unique: true }]])
        createStore(db, V2_STORES.dayClosures, 'id', [['by-local-date', 'localDate', { unique: true }]])
        createStore(db, V2_STORES.rewards, 'id')
        createStore(db, V2_STORES.rewardRules, 'id', [['by-reward', 'rewardId']])
        createStore(db, V2_STORES.rewardSources, 'id', [['by-rule', 'ruleId']])
        createStore(db, V2_STORES.rewardClaims, 'id', [
          ['by-rule-period', ['ruleId', 'periodKey'], { unique: true }],
        ])
        createStore(db, V2_STORES.notificationPreferences, 'id')
        createStore(db, V2_STORES.outbox, 'operationId', [
          ['by-state', 'state'],
          ['by-created-at', 'createdAt'],
        ])
        createStore(db, V2_STORES.syncCursors, 'deviceId')
        createStore(db, V2_STORES.migrationMeta, 'key')
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

export async function readV2Stores({ name = V2_DB_NAME } = {}) {
  const db = await openV2Database({ name })
  const entries = await Promise.all(
    Object.values(V2_STORES).map(async storeName => [storeName, await db.getAll(storeName)]),
  )
  return Object.fromEntries(entries)
}

export async function deleteV2Database(name = V2_DB_NAME) {
  const promise = databasePromises.get(name)
  if (promise) {
    const db = await promise
    db.close()
    databasePromises.delete(name)
  }
  await deleteDB(name, {
    blocked() {
      throw new Error(`Database deletion blocked: ${name}`)
    },
  })
}
