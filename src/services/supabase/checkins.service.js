import { supabase } from './client.js'
import { normalizeDailyCheckin } from '@/features/checkins/domain.js'

function success(data = null) {
  return { data, error: null }
}

export function toRemoteCheckin(checkin, userId) {
  return {
    id: checkin.id,
    user_id: userId,
    local_date: checkin.localDate,
    timezone: checkin.timezone,
    energy: checkin.energy,
    mood: checkin.mood,
    pressure: checkin.pressure,
    load_feeling: checkin.loadFeeling,
    context_codes: checkin.contextCodes?.length ? checkin.contextCodes : null,
    note: checkin.note ?? '',
    client_operation_id: checkin.clientOperationId,
    version: Math.max(1, Number(checkin.version) || 1),
    created_at: checkin.createdAt,
    updated_at: checkin.updatedAt,
    deleted_at: null,
  }
}

export function fromRemoteCheckin(row) {
  return normalizeDailyCheckin({
    id: row.id,
    localDate: row.local_date,
    timezone: row.timezone,
    energy: row.energy,
    mood: row.mood,
    pressure: row.pressure,
    loadFeeling: row.load_feeling,
    contextCodes: row.context_codes,
    note: row.note,
    syncScope: 'cloud',
    syncStatus: 'synced',
    clientOperationId: row.client_operation_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    deletedAt: row.deleted_at,
  })
}

export async function fetchDailyCheckins() {
  if (!supabase) return success([])
  return supabase
    .from('traker_daily_checkins')
    .select('*')
    .is('deleted_at', null)
    .order('local_date', { ascending: false })
}

export async function upsertDailyCheckin(checkin, userId) {
  if (!supabase) return success()

  const existing = await supabase
    .from('traker_daily_checkins')
    .select('id,client_operation_id,created_at')
    .eq('local_date', checkin.localDate)
    .is('deleted_at', null)
    .maybeSingle()
  if (existing.error) return existing

  const row = toRemoteCheckin(checkin, userId)
  if (existing.data) {
    row.id = existing.data.id
    row.client_operation_id = existing.data.client_operation_id
    row.created_at = existing.data.created_at
  }

  return supabase
    .from('traker_daily_checkins')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
}

export async function deleteDailyCheckin(localDate, version = 1) {
  if (!supabase) return success()
  const now = new Date().toISOString()
  return supabase
    .from('traker_daily_checkins')
    .update({ deleted_at: now, updated_at: now, version: Math.max(1, Number(version) || 1) + 1 })
    .eq('local_date', localDate)
    .is('deleted_at', null)
}

export async function bulkUpsertDailyCheckins(checkins, userId) {
  for (const checkin of checkins ?? []) {
    const result = await upsertDailyCheckin(checkin, userId)
    if (result.error) return result
  }
  return success(checkins ?? [])
}
