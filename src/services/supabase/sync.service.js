/**
 * @file supabase/sync.service.js
 *
 * Offline-first sync orchestrator.
 *
 * Architecture:
 *
 *   User action
 *     → Pinia store mutates
 *     → localStorage writes immediately  (persistence plugin)
 *     → sync.push(change) called
 *         → if online:  pushes to Supabase immediately
 *         → if offline: queues in localStorage (traker:sync-queue)
 *
 *   On network reconnect:
 *     → flushQueue() drains every pending operation
 *
 *   On sign-in:
 *     → pullAll() fetches cloud state and merges into Pinia
 *
 * Conflict resolution is handled in the Pinia store when cloud data is merged:
 * localStorage remains immediate, and each daily entry keeps the newest
 * loggedAt/updated_at value available.
 *
 * NOTE: This service does NOT import Pinia stores directly to avoid
 * circular dependencies. The stores call sync functions; sync calls
 * Supabase services.
 */

import { isSupabaseConfigured } from './config.js'
import { storage } from '@services/storage'
import { dayNumberForLocalDate, logLevelForStatus } from '@/features/habits/domain.js'
import { features } from '@/config/features.js'
import { nextSyncRetry, syncErrorCode } from './syncRetry.js'

let cloudServicesPromise
let pilotBridgePromise
let pushChain = Promise.resolve()
let queueRetryTimer = null
let queueRetryAt = null
function loadCloudServices() {
  cloudServicesPromise ??= Promise.all([
    import('./habits.service.js'),
    import('./checkins.service.js'),
    import('./rewards.service.js'),
    import('./flexibleGroups.service.js'),
    import('./settings.service.js'),
    import('./dayClosures.service.js'),
    import('./auth.service.js'),
  ]).then(([habits, checkins, rewards, flexibleGroups, settings, dayClosures, auth]) => ({ ...habits, ...checkins, ...rewards, ...flexibleGroups, ...settings, ...dayClosures, ...auth }))
  return cloudServicesPromise
}

function loadPilotBridge() {
  pilotBridgePromise ??= import('../syncV2PilotBridge.service.js')
  return pilotBridgePromise
}

export async function ensureV2PilotOwner(userId) {
  if (!features.syncV2Pilot) return { allowed: true, status: 'not_enabled' }
  try {
    const { ensureV2LocalOwner } = await loadPilotBridge()
    return await ensureV2LocalOwner(userId)
  } catch (error) {
    console.warn('[v2 pilot] Local owner boundary unavailable; sync remains paused:', error)
    return { allowed: false, status: 'ownership_unavailable' }
  }
}

async function pilotOwnerAllows(user) {
  if (!features.syncV2Pilot) return true
  return (await ensureV2PilotOwner(user?.id)).allowed
}

// ── Queue storage key ──────────────────────────────────────────────────────
const QUEUE_KEY = storage.KEYS.SYNC_QUEUE

// ── Queue helpers ──────────────────────────────────────────────────────────

function readQueue() {
  return storage.read(QUEUE_KEY, [])
}

function writeQueue(q) {
  storage.write(QUEUE_KEY, q)
}

function scheduleQueueRetry(retry) {
  if (!retry || typeof window === 'undefined') return
  const desiredAt = Date.parse(retry.retryAt)
  if (queueRetryTimer && queueRetryAt <= desiredAt) return
  if (queueRetryTimer) window.clearTimeout(queueRetryTimer)
  queueRetryAt = desiredAt
  queueRetryTimer = window.setTimeout(() => {
    queueRetryTimer = null
    queueRetryAt = null
    flushQueue().catch(console.warn)
  }, Math.max(0, retry.delayMs))
}

function clearQueueRetryTimer() {
  if (queueRetryTimer && typeof window !== 'undefined') window.clearTimeout(queueRetryTimer)
  queueRetryTimer = null
  queueRetryAt = null
}

function enqueue(op, { failure = null } = {}) {
  const q = readQueue()
  const key = operationKey(op)
  const next = key ? q.filter(queued => operationKey(queued) !== key) : q
  const queued = { ...op, queuedAt: new Date().toISOString() }
  if (failure) {
    const retry = nextSyncRetry(failure, op.retryAttempts)
    queued.retryAttempts = retry?.attempts ?? Math.max(0, Number(op.retryAttempts) || 0)
    queued.lastErrorCode = syncErrorCode(failure)
    if (retry) {
      queued.retryAt = retry.retryAt
      scheduleQueueRetry(retry)
    } else {
      delete queued.retryAt
    }
  } else {
    delete queued.retryAttempts
    delete queued.lastErrorCode
    delete queued.retryAt
  }
  next.push(queued)
  writeQueue(next)
}

function operationKey({ type, payload }) {
  if (type === 'upsert-habit' || type === 'delete-habit' || type === 'restore-habit') return `habit:${payload.habit?.id ?? payload.habitId}`
  if (type === 'upsert-entry' || type === 'delete-entry') return `entry:${payload.habitId}:${payload.day}`
  if (type === 'upsert-checkin' || type === 'delete-checkin') return `checkin:${payload.checkin?.localDate ?? payload.localDate}`
  if (type === 'upsert-reward' || type === 'delete-reward') return `reward:${payload.reward?.id ?? payload.rewardId}`
  if (type === 'upsert-reward-claim') return `reward-claim:${payload.claim?.ruleId}:${payload.claim?.periodKey}`
  if (type === 'upsert-flexible-group' || type === 'delete-flexible-group') return `flexible-group:${payload.group?.id ?? payload.groupId}`
  if (type === 'upsert-day-closure') return `day-closure:${payload.closure?.localDate}`
  return null
}

function throwIfError(result) {
  if (result?.error) throw result.error
  return result?.data
}

function clearQueue() {
  writeQueue([])
}

function notifyCheckinSync(payload, status, error = null) {
  const localDate = payload?.checkin?.localDate ?? payload?.localDate
  if (!localDate || typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('traker:checkin-sync', {
    detail: { localDate, status, error },
  }))
}

// ── Online detection ───────────────────────────────────────────────────────

function isOnline() {
  return navigator.onLine
}

/**
 * Register the reconnect handler once when the service initialises.
 * Flushes the queue automatically when network comes back.
 */
let reconnectHandler = null

export function startReconnectSync() {
  if (reconnectHandler || typeof window === 'undefined') return () => stopReconnectSync()
  reconnectHandler = () => {
    console.info('[sync] Back online — flushing queue…')
    flushQueue().catch(console.warn)
  }
  window.addEventListener('online', reconnectHandler)
  return () => stopReconnectSync()
}

export function stopReconnectSync() {
  if (!reconnectHandler || typeof window === 'undefined') return
  window.removeEventListener('online', reconnectHandler)
  reconnectHandler = null
  clearQueueRetryTimer()
}

function ensureReconnectListener() {
  startReconnectSync()
}

// ── Push: local → Supabase ─────────────────────────────────────────────────

/**
 * Push a habit mutation to Supabase.
 * If offline, queues it for later.
 *
 * @param {'upsert-habit' | 'delete-habit' | 'upsert-entry' | 'delete-entry' | 'upsert-checkin' | 'delete-checkin'} type
 * @param {object} payload
 */
export function push(type, payload) {
  const queued = pushChain
    .catch(() => {})
    .then(() => pushInOrder(type, payload))
  pushChain = queued
  return queued
}

async function pushInOrder(type, payload) {
  if (!isSupabaseConfigured) return { status: 'unavailable', error: 'Supabase no está configurado.' }

  ensureReconnectListener()

  const operation = { type, payload }
  if (features.syncV2Pilot) {
    try {
      const { stagePilotV2Mutation } = await loadPilotBridge()
      const staged = await stagePilotV2Mutation(type, payload)
      operation.v2OperationId = staged?.operationId ?? null
    } catch (error) {
      console.warn('[v2 pilot] staging failed; legacy transport remains active:', error)
    }
  }

  if (!isOnline()) {
    enqueue(operation)
    return { status: 'queued' }
  }

  return _execute(operation)
}

async function _execute(operation) {
  const { type, payload, v2OperationId = null } = operation
  const {
    deleteDailyCheckin,
    deleteHabit,
    deleteHabitLog,
    deleteReward,
    deleteFlexibleGroup,
    getUser,
    upsertDailyCheckin,
    upsertHabitBundle,
    upsertHabitLog,
    upsertRewardBundle,
    upsertRewardClaim,
    upsertFlexibleGroupBundle,
    upsertDayClosure,
  } = await loadCloudServices()
  const user = await getUser()
  if (!user) {
    enqueue({ type, payload, v2OperationId })
    return { status: 'queued' }
  }
  if (!(await pilotOwnerAllows(user))) {
    enqueue({ type, payload, v2OperationId })
    return { status: 'blocked', error: 'local_owner_mismatch' }
  }

  try {
    let pilotRecord = null
    if (features.syncV2Pilot && v2OperationId) {
      const {
        isLatestPilotV2Operation,
        pushPilotV2Outbox,
        readPilotV2Operation,
      } = await loadPilotBridge()
      await pushPilotV2Outbox()
      pilotRecord = await readPilotV2Operation(v2OperationId)
      if (pilotRecord?.state === 'conflict' || pilotRecord?.state === 'rejected') {
        return {
          status: pilotRecord.state,
          conflict: pilotRecord.conflict ?? null,
          operationId: v2OperationId,
        }
      }
      if (pilotRecord?.state !== 'synced') {
        enqueue({ type, payload, v2OperationId })
        return { status: 'queued', operationId: v2OperationId }
      }
      if (!(await isLatestPilotV2Operation(v2OperationId))) {
        return { status: 'synced', operationId: v2OperationId, compatibilityWrite: 'superseded' }
      }
    }

    switch (type) {
      case 'upsert-habit':
        if (throwIfError(await upsertHabitBundle(payload.habit, user.id))?.deferredGoalLinks) {
          enqueue({ type, payload, v2OperationId })
        }
        break

      case 'upsert-entry': {
        const { habitId, log } = payload
        throwIfError(await upsertHabitLog(habitId, log, user.id))
        break
      }

      case 'delete-habit':
        // The v2 RPC created a tombstone. A legacy hard delete here would
        // erase it and make delete/restore impossible across devices.
        if (!pilotRecord) throwIfError(await deleteHabit(payload.habitId))
        break

      case 'restore-habit':
        if (!pilotRecord) {
          console.warn('[sync] restore-habit is only available inside the local v2 pilot')
          break
        }
        if (throwIfError(await upsertHabitBundle(payload.habit, user.id))?.deferredGoalLinks) {
          enqueue({ type, payload, v2OperationId })
        }
        break

      case 'delete-entry':
        if (!pilotRecord) throwIfError(await deleteHabitLog(payload.habitId, payload.log))
        break

      case 'upsert-checkin':
        throwIfError(await upsertDailyCheckin(payload.checkin, user.id))
        break

      case 'delete-checkin':
        throwIfError(await deleteDailyCheckin(payload.localDate, payload.version))
        break

      case 'upsert-reward':
        throwIfError(await upsertRewardBundle(payload.reward, user.id))
        break

      case 'upsert-reward-claim':
        throwIfError(await upsertRewardClaim(payload.claim, user.id))
        break

      case 'delete-reward':
        throwIfError(await deleteReward(payload.rewardId))
        break

      case 'upsert-flexible-group':
        throwIfError(await upsertFlexibleGroupBundle(payload.group, user.id))
        break

      case 'delete-flexible-group':
        throwIfError(await deleteFlexibleGroup(payload.groupId, payload.version, payload.deletedAt))
        break

      case 'upsert-day-closure':
        throwIfError(await upsertDayClosure(payload.closure, user.id))
        break

      default:
        console.warn('[sync] Unknown operation type:', type)
    }
    if (type === 'upsert-checkin' || type === 'delete-checkin') notifyCheckinSync(payload, 'synced')
    return { status: 'synced' }
  } catch (err) {
    console.warn('[sync] Push failed, re-queuing:', err.message)
    enqueue(operation, { failure: err })
    if (type === 'upsert-checkin' || type === 'delete-checkin') notifyCheckinSync(payload, 'error', err.message)
    return { status: 'error', error: err.message }
  }
}

/**
 * Drain the offline queue, pushing each pending operation to Supabase.
 * Called automatically on reconnect and after sign-in.
 */
export async function flushQueue() {
  if (!isSupabaseConfigured || !isOnline()) return
  clearQueueRetryTimer()

  let pilot = null
  if (features.syncV2Pilot) {
    const { getUser } = await loadCloudServices()
    const user = await getUser()
    if (!user) return { legacyOperations: 0, pilot: null }
    if (!(await pilotOwnerAllows(user))) {
      return { legacyOperations: 0, pilot: null, blocked: 'local_owner_mismatch' }
    }
    const { pushPilotV2Outbox } = await loadPilotBridge()
    pilot = await pushPilotV2Outbox()
  }

  const q = readQueue()
  if (!q.length) return { legacyOperations: 0, pilot }

  clearQueue()   // optimistic clear — failed ops re-enqueue themselves

  for (const op of q) {
    await _execute(op)
  }

  console.info(`[sync] Flushed ${q.length} queued operations`)
  return { legacyOperations: q.length, pilot }
}

/**
 * Push reminder settings to Supabase so the cron can read them.
 * Fire-and-forget: no-ops when offline / signed out.
 *
 * @param {object} settingsState — settings store state
 */
export async function pushSettings(settingsState) {
  if (!isSupabaseConfigured || !isOnline()) return

  const { getUser, upsertReminderSettings } = await loadCloudServices()
  const user = await getUser()
  if (!user) return
  if (!(await pilotOwnerAllows(user))) return { status: 'blocked', error: 'local_owner_mismatch' }

  const { error } = await upsertReminderSettings(user.id, settingsState)
  if (error) console.warn('[sync] pushSettings failed:', error.message)
}

// ── Pull: Supabase → local ─────────────────────────────────────────────────

/**
 * Pull all cloud data for the current user and return it in the
 * same shape as the local habits store.
 *
 * The store is responsible for merging / replacing its state —
 * this function only fetches and transforms.
 *
 * @returns {Promise<{ habits: object[] } | null>}
 */
export async function pullAll() {
  if (!isSupabaseConfigured || !isOnline()) return null

  const {
    fetchDailyCheckins,
    fetchHabitGoalLinks,
    fetchHabitLogs,
    fetchHabitSchedules,
    fetchHabits,
    fetchRewardsBundle,
    fetchFlexibleGroupsBundle,
    fetchDayClosures,
    getUser,
    fromRemoteSchedule,
  } = await loadCloudServices()
  const user = await getUser()
  if (!user) return null
  if (!(await pilotOwnerAllows(user))) return null

  try {
    const [habitsResult, linksResult, schedulesResult, logsResult, checkinsResult, rewardsResult, flexibleGroupsResult, closuresResult] = await Promise.all([
      fetchHabits(),
      fetchHabitGoalLinks(),
      fetchHabitSchedules(),
      fetchHabitLogs(),
      fetchDailyCheckins(),
      fetchRewardsBundle(),
      fetchFlexibleGroupsBundle(),
      fetchDayClosures(),
    ])
    const remoteHabits = throwIfError(habitsResult) ?? []
    const remoteLinks = throwIfError(linksResult) ?? []
    const remoteSchedules = throwIfError(schedulesResult) ?? []
    const remoteLogs = throwIfError(logsResult) ?? []
    const remoteCheckins = throwIfError(checkinsResult) ?? []
    const rewards = throwIfError(rewardsResult) ?? { rewards: [], claims: [] }
    const flexibleGroups = throwIfError(flexibleGroupsResult) ?? []
    const dayClosures = throwIfError(closuresResult) ?? []

    const habits = await Promise.all(
      remoteHabits.map(async (rh) => {
        const logs = {}
        const schedule = remoteSchedules.find(item => item.habit_id === rh.id)
        for (const entry of remoteLogs.filter(item => item.habit_id === rh.id)) {
          const day = dayNumberForLocalDate(rh.created_at, entry.local_date, entry.timezone ?? rh.timezone)
          const contexts = entry.context_codes ?? []
          logs[day] = {
            id: entry.id,
            clientOperationId: entry.client_operation_id,
            localDate: entry.local_date,
            timezone: entry.timezone,
            occurrenceKey: entry.occurrence_key,
            level: logLevelForStatus(entry.status, entry.minimum_used),
            status: entry.status,
            minimumUsed: entry.minimum_used,
            contextCodes: contexts.filter(code => !code.startsWith('emotion:') && !code.startsWith('energy:')),
            emotion: contexts.find(code => code.startsWith('emotion:'))?.slice(8) ?? null,
            energy: contexts.find(code => code.startsWith('energy:'))?.slice(7) ?? null,
            note: entry.note ?? '',
            loggedAt: entry.updated_at ?? entry.occurred_at ?? entry.created_at,
            version: entry.version ?? 1,
          }
        }

        const goalIds = remoteLinks
          .filter(link => link.habit_id === rh.id && !link.deleted_at)
          .map(link => link.goal_id)

        const localSchedule = fromRemoteSchedule(schedule)
        return {
          id:           rh.id,
          name:         rh.title,
          minimumVersion: rh.minimum_version ?? '',
          goalId: goalIds[0] ?? null,
          goalIds,
          icon:         rh.icon          ?? 'Activity',
          color:        rh.color         ?? '#6C8CFF',
          duration:     rh.total_days    ?? 30,
          isActive:     rh.is_active     ?? true,
          lifecycleStatus: rh.lifecycle_status ?? (rh.is_active === false ? 'paused' : 'active'),
          version:      rh.version       ?? 1,
          reminder:     rh.reminder_time ?? null,
          reminderDays: localSchedule?.kind === 'weekdays' ? localSchedule.daysOfWeek : null,
          schedule: localSchedule,
          copySettings: rh.copy_settings ?? null,
          createdAt:    rh.created_at,
          updatedAt:    rh.updated_at ?? rh.created_at,
          flexDays:     [],
          logs,
        }
      })
    )

    const { fromRemoteCheckin } = await loadCloudServices()
    const cloud = { habits, checkins: remoteCheckins.map(fromRemoteCheckin), rewards, flexibleGroups, dayClosures }
    if (features.syncV2Pilot) {
      const { recordPilotV2RemoteSnapshot } = await loadPilotBridge()
      await recordPilotV2RemoteSnapshot(cloud)
    }
    return cloud
  } catch (err) {
    console.warn('[sync] Pull failed:', err.message)
    return null
  }
}

/**
 * Pulls the content-free v2 ledger for this browser. The returned metadata is
 * only a signal; callers still hydrate user content through owner-scoped RLS
 * table reads in `pullAll()`.
 */
export async function pullV2PilotChanges() {
  if (!features.syncV2Pilot || !isSupabaseConfigured || !isOnline()) return null
  const { getUser } = await loadCloudServices()
  const user = await getUser()
  if (!user || !(await pilotOwnerAllows(user))) return null
  const { pullPilotV2Changes } = await loadPilotBridge()
  const result = await pullPilotV2Changes()
  if (result.error) {
    console.warn('[v2 pilot] Pull signal failed:', result.error.message)
    return null
  }
  return result.data
}

export async function acknowledgeV2PilotSnapshot() {
  if (!features.syncV2Pilot) return null
  const { getUser } = await loadCloudServices()
  const user = await getUser()
  if (!user || !(await pilotOwnerAllows(user))) return null
  const { acknowledgePilotV2Snapshot } = await loadPilotBridge()
  return acknowledgePilotV2Snapshot()
}

/**
 * Push ALL local habits to Supabase at once.
 * Used once after the user signs in to seed their cloud account
 * with existing local data.
 *
 * @param {object[]} habits  — from habitsStore.habits
 */
export async function pushAll(habits) {
  if (!isSupabaseConfigured || !isOnline()) return

  const { bulkUpsertHabitLogs, getUser, upsertHabitBundle } = await loadCloudServices()
  const user = await getUser()
  if (!user) return
  if (!(await pilotOwnerAllows(user))) return { status: 'blocked', error: 'local_owner_mismatch' }

  for (const habit of habits) {
    const { error: hErr } = await upsertHabitBundle(habit, user.id)
    if (hErr) { console.warn('[sync] pushAll habit failed:', hErr.message); continue }

    if (habit.logs && Object.keys(habit.logs).length) {
      const { error: logErr } = await bulkUpsertHabitLogs(
        habit.id,
        habit.logs,
        user.id,
      )
      if (logErr) console.warn('[sync] pushAll canonical logs failed:', logErr.message)
    }
  }

  console.info(`[sync] Pushed ${habits.length} habits to cloud`)
}

/** Push the check-ins whose local privacy scope explicitly allows cloud sync. */
export async function pushAllCheckins(checkins) {
  if (!isSupabaseConfigured || !isOnline()) return

  const { bulkUpsertDailyCheckins, getUser } = await loadCloudServices()
  const user = await getUser()
  if (!user) return
  if (!(await pilotOwnerAllows(user))) return { status: 'blocked', error: 'local_owner_mismatch' }

  const allowed = (checkins ?? []).filter(checkin => checkin.syncScope === 'cloud' && !checkin.deletedAt)
  const { error } = await bulkUpsertDailyCheckins(allowed, user.id)
  if (error) console.warn('[sync] pushAllCheckins failed:', error.message)
}

/** Push all local reward definitions and their non-expiring claims. */
export async function pushAllRewards(rewards, claims) {
  if (!isSupabaseConfigured || !isOnline()) return

  const { bulkUpsertRewards, getUser } = await loadCloudServices()
  const user = await getUser()
  if (!user) return
  if (!(await pilotOwnerAllows(user))) return { status: 'blocked', error: 'local_owner_mismatch' }

  const { error } = await bulkUpsertRewards(rewards, claims, user.id)
  if (error) console.warn('[sync] pushAllRewards failed:', error.message)
}

/** Push flexible group aggregates and member tombstones. */
export async function pushAllFlexibleGroups(groups) {
  if (!isSupabaseConfigured || !isOnline()) return

  const { bulkUpsertFlexibleGroups, getUser } = await loadCloudServices()
  const user = await getUser()
  if (!user) return
  if (!(await pilotOwnerAllows(user))) return { status: 'blocked', error: 'local_owner_mismatch' }

  const { error } = await bulkUpsertFlexibleGroups(groups ?? [], user.id)
  if (error) console.warn('[sync] pushAllFlexibleGroups failed:', error.message)
}

/** Push day closure summaries. The private “tomorrow note” never leaves the device. */
export async function pushAllDayClosures(closures) {
  if (!isSupabaseConfigured || !isOnline()) return

  const { bulkUpsertDayClosures, getUser } = await loadCloudServices()
  const user = await getUser()
  if (!user) return
  if (!(await pilotOwnerAllows(user))) return { status: 'blocked', error: 'local_owner_mismatch' }

  const { error } = await bulkUpsertDayClosures(closures ?? [], user.id)
  if (error) console.warn('[sync] pushAllDayClosures failed:', error.message)
}
