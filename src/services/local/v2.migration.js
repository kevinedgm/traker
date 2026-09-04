import { localDateForDay, logStatusForLevel } from '@/features/habits/domain.js'
import { storage } from '@/services/storage.js'
import { GOALS_STORES, openGoalsDatabase } from './goals.database.js'
import { openV2Database, V2_STORES } from './v2.database.js'

export const V2_BACKFILL_KEY = 'local-v2-backfill'

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function randomId() {
  return globalThis.crypto?.randomUUID?.()
    ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
      const value = Math.floor(Math.random() * 16)
      return (token === 'x' ? value : ((value & 0x3) | 0x8)).toString(16)
    })
}

function rowsByStore(legacy) {
  const result = Object.fromEntries(Object.values(V2_STORES).map(name => [name, []]))
  const habits = Array.isArray(legacy?.habits) ? legacy.habits : []

  for (const source of habits) {
    const { logs = {}, schedule, goalIds, goalId, ...habit } = source
    const habitId = source.id ?? randomId()
    result[V2_STORES.habits].push({
      ...clone(habit),
      id: habitId,
      lifecycleStatus: source.lifecycleStatus ?? (source.isActive === false ? 'paused' : 'active'),
      migrationQuality: 'exact',
    })

    if (schedule?.id) {
      result[V2_STORES.schedules].push({
        ...clone(schedule),
        habitId,
        migrationQuality: 'exact',
      })
    }

    const linkedGoalIds = [...new Set([...(goalIds ?? []), ...(goalId ? [goalId] : [])].filter(Boolean))]
    for (const linkedGoalId of linkedGoalIds) {
      result[V2_STORES.habitGoalLinks].push({
        id: `legacy:${habitId}:${linkedGoalId}`,
        habitId,
        goalId: linkedGoalId,
        migrationQuality: 'exact',
      })
    }

    for (const [dayNumber, log] of Object.entries(logs)) {
      const localDate = log.localDate
        ?? localDateForDay(source.createdAt, Number(dayNumber), schedule?.timezone)
      result[V2_STORES.habitLogs].push({
        ...clone(log),
        id: log.id ?? randomId(),
        habitId,
        localDate,
        occurrenceKey: log.occurrenceKey ?? `date:${localDate}`,
        status: logStatusForLevel(log.level),
        minimumUsed: Number(log.level) === 1,
        legacyDayNumber: Number(dayNumber),
        legacyLevel: Number(log.level ?? 0),
        // localStorage never recorded whether localDate came from an original
        // calendar value or from a day offset, so preserve it conservatively.
        migrationQuality: log.migrationQuality ?? 'inferred',
      })
    }
  }

  result[V2_STORES.dailyCheckins].push(...clone(legacy?.checkins?.checkins ?? []))
  result[V2_STORES.dayClosures].push(...clone(legacy?.dayClosures?.closures ?? []))

  const flexibleGroups = legacy?.flexibleGroups?.groups ?? []
  for (const source of flexibleGroups) {
    const { memberIds = [], ...group } = source
    result[V2_STORES.flexibleGroups].push(clone(group))
    result[V2_STORES.flexibleGroupMembers].push(...memberIds.map((habitId, position) => ({
      id: `legacy:${source.id}:${habitId}`,
      groupId: source.id,
      habitId,
      position,
      activeFrom: String(source.createdAt ?? new Date().toISOString()).slice(0, 10),
      createdAt: source.createdAt,
      deletedAt: source.deletedAt ?? null,
      migrationQuality: 'exact',
    })))
  }

  const rewards = legacy?.rewards?.rewards ?? []
  for (const source of rewards) {
    const { rule, ...reward } = source
    result[V2_STORES.rewards].push(clone(reward))
    if (!rule?.id) continue
    const { sources = [], ...ruleRecord } = rule
    result[V2_STORES.rewardRules].push({ ...clone(ruleRecord), rewardId: source.id })
    result[V2_STORES.rewardSources].push(...sources.map(item => ({
      ...clone(item),
      id: item.id ?? randomId(),
      ruleId: rule.id,
    })))
  }
  result[V2_STORES.rewardClaims].push(...clone(legacy?.rewards?.claims ?? []))

  const settings = legacy?.settings ?? {}
  result[V2_STORES.notificationPreferences].push({
    ...clone(settings),
    id: 'local-global',
    migrationQuality: 'exact',
  })
  return result
}

async function legacyGoalsExist() {
  if (typeof indexedDB?.databases !== 'function') return true
  const databases = await indexedDB.databases()
  return databases.some(database => database.name === 'traker-goals')
}

async function readLegacyGoals(openGoals = openGoalsDatabase) {
  if (!(await legacyGoalsExist())) return null
  const db = await openGoals()
  const names = Object.values(GOALS_STORES)
  const values = await Promise.all(names.map(name => db.getAll(name)))
  return Object.fromEntries(names.map((name, index) => [name, values[index]]))
}

function mergeGoalRows(rows, goals) {
  if (!goals) return
  rows[V2_STORES.goals].push(...goals[GOALS_STORES.goals])
  rows[V2_STORES.milestones].push(...goals[GOALS_STORES.stages])
  rows[V2_STORES.actions].push(...goals[GOALS_STORES.actions])
  rows[V2_STORES.sessions].push(...goals[GOALS_STORES.sessions])
  rows[V2_STORES.goalEvents].push(...goals[GOALS_STORES.events])
  rows[V2_STORES.goalEvents].push(...goals[GOALS_STORES.progress].map(entry => ({
    ...entry,
    eventType: entry.eventType ?? 'progress_recorded',
  })))
  rows[V2_STORES.outbox].push(...goals[GOALS_STORES.outbox].map(operation => ({
    ...operation,
    deviceId: operation.deviceId ?? operation.clientId ?? 'legacy-goals',
    state: operation.state ?? 'pending',
    createdAt: operation.createdAt ?? new Date().toISOString(),
  })))
  rows[V2_STORES.migrationMeta].push({
    key: 'legacy-goals-sync-meta',
    records: goals[GOALS_STORES.syncMeta],
  })
}

export async function backfillLocalV2({
  databaseName,
  legacySnapshot = storage.exportData(),
  includeGoals = true,
  openGoals = openGoalsDatabase,
  now = () => new Date().toISOString(),
} = {}) {
  const db = await openV2Database({ name: databaseName })
  const existing = await db.get(V2_STORES.migrationMeta, V2_BACKFILL_KEY)
  if (existing?.status === 'completed') return existing

  const startedAt = now()
  const rows = rowsByStore(legacySnapshot)
  if (includeGoals) mergeGoalRows(rows, await readLegacyGoals(openGoals))

  const writableStores = Object.values(V2_STORES)
  const tx = db.transaction(writableStores, 'readwrite')
  for (const storeName of writableStores) {
    if (storeName === V2_STORES.migrationMeta) continue
    const store = tx.objectStore(storeName)
    for (const row of rows[storeName]) {
      if (row?.id !== undefined || row?.operationId !== undefined || row?.deviceId !== undefined) {
        await store.put(clone(row))
      }
    }
  }
  for (const row of rows[V2_STORES.migrationMeta]) {
    await tx.objectStore(V2_STORES.migrationMeta).put(clone(row))
  }

  const counts = Object.fromEntries(
    Object.entries(rows).map(([storeName, values]) => [storeName, values.length]),
  )
  const report = {
    key: V2_BACKFILL_KEY,
    status: 'completed',
    sourceSchema: legacySnapshot?._schema ?? 1,
    startedAt,
    completedAt: now(),
    counts,
    quality: {
      inferredLogs: rows[V2_STORES.habitLogs].filter(log => log.migrationQuality === 'inferred').length,
      preservedLegacyLogs: rows[V2_STORES.habitLogs].length,
      preservedGoalOperations: rows[V2_STORES.outbox].length,
    },
  }
  await tx.objectStore(V2_STORES.migrationMeta).put(report)
  await tx.done
  return report
}
