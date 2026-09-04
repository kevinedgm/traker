import { supabase } from './client.js'

const ENTITY_TYPES = new Set(['habit', 'habitLog', 'rewardClaim'])
const OPERATION_TYPES = new Set(['upsert', 'delete', 'restore'])

export function createSyncOperation({
  operationId = crypto.randomUUID(),
  entityType,
  entityId,
  operationType = 'upsert',
  baseVersion = 0,
  payload = {},
  occurredAt = new Date().toISOString(),
}) {
  if (!ENTITY_TYPES.has(entityType)) throw new Error(`Unsupported v2 entity: ${entityType}`)
  if (!OPERATION_TYPES.has(operationType)) throw new Error(`Unsupported v2 operation: ${operationType}`)
  if (!entityId) throw new Error('A v2 operation requires entityId')
  return {
    operationId,
    entityType,
    entityId,
    operationType,
    baseVersion: Math.max(0, Number(baseVersion) || 0),
    payload,
    occurredAt,
  }
}

export function createSyncV2Client(client = supabase) {
  function unavailable() {
    return { data: null, error: new Error('Supabase is not configured') }
  }

  return {
    async push(deviceId, operations) {
      if (!client) return unavailable()
      if (!Array.isArray(operations) || operations.length > 100) {
        return { data: null, error: new Error('A v2 sync batch must contain at most 100 operations') }
      }
      return client.rpc('traker_apply_sync_operations', {
        p_device_id: deviceId,
        p_operations: operations,
      })
    },

    async pull(deviceId, cursor = {}, limit = 100) {
      if (!client) return unavailable()
      return client.rpc('traker_pull_sync_changes', {
        p_device_id: deviceId,
        p_after_received_at: cursor.receivedAt ?? null,
        p_after_operation_id: cursor.operationId ?? null,
        p_limit: Math.min(500, Math.max(1, Number(limit) || 100)),
      })
    },

    async quality() {
      if (!client) return unavailable()
      return client.rpc('traker_sync_v2_quality')
    },

    async acknowledgeRehydration(deviceId, cursor = {}) {
      if (!client) return unavailable()
      return client.rpc('traker_acknowledge_sync_rehydration', {
        p_device_id: deviceId,
        p_received_at: cursor.receivedAt ?? null,
        p_operation_id: cursor.operationId ?? null,
      })
    },
  }
}

export const syncV2 = createSyncV2Client()
