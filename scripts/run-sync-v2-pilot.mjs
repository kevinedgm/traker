import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.SUPABASE_URL
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY are required')
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  throw new Error('The Phase 5 pilot runner only accepts a localhost Supabase URL')
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const admin = createClient(url, serviceRoleKey, clientOptions)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function operation({ id = randomUUID(), entityType, entityId, operationType = 'upsert', baseVersion = 0, payload = {} }) {
  return {
    operationId: id,
    entityType,
    entityId,
    operationType,
    baseVersion,
    payload,
    occurredAt: new Date().toISOString(),
  }
}

async function timed(label, task, metrics) {
  const start = performance.now()
  const result = await task()
  metrics[label] = Math.round(performance.now() - start)
  if (result.error) throw result.error
  return result.data
}

async function run() {
  const metrics = {}
  const created = await admin.auth.admin.createUser({
    email: `phase5-pilot-${Date.now()}@traker.local`,
    password: `Pilot-${randomUUID()}-Aa1!`,
    email_confirm: true,
  })
  if (created.error) throw created.error
  const userId = created.data.user.id

  try {
    const token = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: created.data.user.email,
    })
    if (token.error) throw token.error
    const verified = await admin.auth.verifyOtp({
      token_hash: token.data.properties.hashed_token,
      type: 'magiclink',
    })
    if (verified.error) throw verified.error

    const user = createClient(url, publishableKey, {
      ...clientOptions,
      global: { headers: { Authorization: `Bearer ${verified.data.session.access_token}` } },
    })

    const habitId = randomUUID()
    const rewardId = randomUUID()
    const ruleId = randomUUID()
    const logIdA = randomUUID()
    const localDate = '2026-08-29'

    await timed('seedMs', () => user.from('habits').insert({
      id: habitId,
      user_id: userId,
      title: 'Piloto temporal',
      total_days: 30,
      lifecycle_status: 'active',
      timezone: 'America/Mexico_City',
      version: 1,
    }), metrics)
    await timed('seedRewardMs', async () => {
      const reward = await user.from('traker_rewards').insert({
        id: rewardId,
        user_id: userId,
        name: 'Recompensa temporal',
      })
      if (reward.error) return reward
      return user.from('traker_reward_rules').insert({
        id: ruleId,
        user_id: userId,
        reward_id: rewardId,
        rule_type: 'all',
        period: 'week',
      })
    }, metrics)

    const push = (deviceId, item, label) => timed(label, () => user.rpc('traker_apply_sync_operations', {
      p_device_id: deviceId,
      p_operations: [item],
    }), metrics)

    const paused = await push('pilot-device-a', operation({
      entityType: 'habit',
      entityId: habitId,
      baseVersion: 1,
      payload: { name: 'Piloto pausado', lifecycleStatus: 'paused', isActive: false },
    }), 'pauseMs')
    assert(paused[0].result === 'applied' && paused[0].newVersion === 2, 'pause was not applied at version 2')

    const staleMetadata = await push('pilot-device-b', operation({
      entityType: 'habit',
      entityId: habitId,
      baseVersion: 1,
      payload: { name: 'Edición obsoleta' },
    }), 'staleMetadataMs')
    assert(staleMetadata[0].result === 'conflict', 'stale metadata did not conflict')

    const removed = await push('pilot-device-a', operation({
      entityType: 'habit',
      entityId: habitId,
      operationType: 'delete',
      baseVersion: 2,
    }), 'deleteMs')
    assert(removed[0].result === 'applied' && removed[0].newVersion === 3, 'delete did not create version 3')

    const tombstoneConflict = await push('pilot-device-b', operation({
      entityType: 'habit',
      entityId: habitId,
      baseVersion: 2,
      payload: { name: 'No debe revivir' },
    }), 'tombstoneConflictMs')
    assert(tombstoneConflict[0].result === 'conflict', 'tombstone did not win')

    const restored = await push('pilot-device-b', operation({
      entityType: 'habit',
      entityId: habitId,
      operationType: 'restore',
      baseVersion: 3,
    }), 'restoreMs')
    assert(restored[0].result === 'applied' && restored[0].newVersion === 4, 'restore did not create version 4')

    const logA = await push('pilot-device-a', operation({
      entityType: 'habitLog',
      entityId: logIdA,
      payload: {
        habitId,
        localDate,
        timezone: 'America/Mexico_City',
        occurrenceKey: `date:${localDate}`,
        status: 'done',
        note: 'contenido temporal que no debe llegar al ledger',
      },
    }), 'logMs')
    assert(logA[0].result === 'applied', 'first log was not applied')

    const logB = await push('pilot-device-b', operation({
      entityType: 'habitLog',
      entityId: randomUUID(),
      payload: {
        habitId,
        localDate,
        occurrenceKey: `date:${localDate}`,
        status: 'partial',
      },
    }), 'occurrenceConflictMs')
    assert(logB[0].result === 'conflict', 'same occurrence did not conflict')

    const periodKey = '2026-W35'
    const claimA = await push('pilot-device-a', operation({
      entityType: 'rewardClaim',
      entityId: randomUUID(),
      payload: { ruleId, periodKey, unlockedAt: new Date().toISOString() },
    }), 'claimMs')
    assert(claimA[0].result === 'applied', 'first reward claim was not applied')

    const claimB = await push('pilot-device-b', operation({
      entityType: 'rewardClaim',
      entityId: randomUUID(),
      payload: { ruleId, periodKey, unlockedAt: new Date().toISOString() },
    }), 'duplicateClaimMs')
    assert(claimB[0].result === 'duplicate', 'reward claim was not idempotent')

    const pulled = await timed('pullMs', () => user.rpc('traker_pull_sync_changes', {
      p_device_id: 'pilot-device-b',
      p_after_received_at: null,
      p_after_operation_id: null,
      p_limit: 100,
    }), metrics)
    assert(pulled.changes.length >= 4, 'device B did not receive device A changes')

    const [quality, ledger, logs, claims, cursor] = await Promise.all([
      timed('qualityMs', () => user.rpc('traker_backfill_quality'), metrics),
      timed('ledgerMs', () => user.from('traker_sync_operations').select('payload'), metrics),
      timed('logsReadMs', () => user.from('traker_habit_logs').select('id').eq('habit_id', habitId), metrics),
      timed('claimsReadMs', () => user.from('traker_reward_claims').select('id').eq('rule_id', ruleId), metrics),
      timed('cursorReadMs', () => user.from('traker_sync_cursors').select('device_id,last_received_at').eq('device_id', 'pilot-device-b').single(), metrics),
    ])

    assert(quality.missingLegacyLogs === 0, 'server quality reports missing legacy logs')
    assert(quality.missingReminderSchedules === 0, 'server quality reports missing schedules')
    assert(logs.length === 1, 'same occurrence produced more than one log')
    assert(claims.length === 1, 'same reward period produced more than one claim')
    assert(cursor.last_received_at, 'device cursor was not persisted')
    const serializedLedger = JSON.stringify(ledger)
    assert(!serializedLedger.includes('Piloto pausado'), 'ledger retained habit content')
    assert(!serializedLedger.includes('contenido temporal'), 'ledger retained log content')

    return {
      passed: true,
      environment: 'localhost',
      scenarios: {
        metadataAndPause: 'passed',
        staleVersion: 'passed',
        deleteRestore: 'passed',
        occurrenceConflict: 'passed',
        rewardClaimIdempotency: 'passed',
        cursorAndPull: 'passed',
        contentFreeLedger: 'passed',
        backfillQuality: 'passed',
      },
      counts: {
        pulledChanges: pulled.changes.length,
        canonicalLogs: logs.length,
        rewardClaims: claims.length,
      },
      timingsMs: metrics,
    }
  } finally {
    await admin.auth.admin.deleteUser(userId)
  }
}

console.log(JSON.stringify(await run(), null, 2))
