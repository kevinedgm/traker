import { supabase } from './client.js'

export function fromRemoteDayClosure(row) {
  return {
    id: row.id,
    localDate: row.local_date,
    timezone: row.timezone,
    status: row.status,
    summary: row.summary ?? {},
    tomorrowNote: '',
    version: row.version ?? 1,
    closedAt: row.closed_at,
    updatedAt: row.updated_at ?? row.closed_at,
  }
}

export async function fetchDayClosures() {
  if (!supabase) return { data: [], error: null }
  const result = await supabase
    .from('traker_day_closures')
    .select('id, local_date, timezone, status, summary, version, closed_at, updated_at')
    .order('local_date', { ascending: false })
  return { ...result, data: (result.data ?? []).map(fromRemoteDayClosure) }
}

export async function upsertDayClosure(closure, userId) {
  if (!supabase) return { data: null, error: null }
  return supabase
    .from('traker_day_closures')
    .upsert({
      id: closure.id,
      user_id: userId,
      local_date: closure.localDate,
      timezone: closure.timezone,
      status: closure.status,
      summary: closure.summary,
      version: closure.version,
      closed_at: closure.closedAt,
    }, { onConflict: 'user_id,local_date' })
    .select('id, local_date, timezone, status, summary, version, closed_at, updated_at')
    .single()
}

export async function bulkUpsertDayClosures(closures, userId) {
  if (!supabase || !closures?.length) return { data: [], error: null }
  return supabase
    .from('traker_day_closures')
    .upsert(closures.map(closure => ({
      id: closure.id,
      user_id: userId,
      local_date: closure.localDate,
      timezone: closure.timezone,
      status: closure.status,
      summary: closure.summary,
      version: closure.version,
      closed_at: closure.closedAt,
    })), { onConflict: 'user_id,local_date' })
}
