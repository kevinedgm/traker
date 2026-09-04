import { supabase } from './client.js'
import { getUser } from './auth.service.js'

const PURPOSES = new Set(['goals_sync', 'goals_analytics'])

export async function saveGoalsConsent({ purpose, consentVersion, grantedAt, revokedAt = null }) {
  if (!supabase) return { data: null, error: null }
  if (!PURPOSES.has(purpose)) throw new Error(`Unsupported consent purpose: ${purpose}`)
  const user = await getUser()
  if (!user) return { data: null, error: null }
  return supabase.from('traker_product_consents').upsert({
    user_id: user.id,
    purpose,
    consent_version: consentVersion,
    granted_at: grantedAt,
    revoked_at: revokedAt,
  }, { onConflict: 'user_id,purpose' })
}

export async function revokeGoalsConsent({ purpose, consentVersion, grantedAt }) {
  return saveGoalsConsent({
    purpose,
    consentVersion,
    grantedAt: grantedAt ?? new Date().toISOString(),
    revokedAt: new Date().toISOString(),
  })
}

export async function pushGoalOperations(operations) {
  if (!supabase || !operations.length) return { results: [], processedAt: null }
  const milestoneOperations = operations.filter(operation => operation.entityType === 'goalMilestone')
  const originalOperations = operations.filter(operation => operation.entityType !== 'goalMilestone')
  const batches = [
    ['sync_traker_goal_operations', originalOperations],
    ['sync_traker_goal_milestone_operations', milestoneOperations],
  ].filter(([, batch]) => batch.length)
  const results = []
  let processedAt = null
  for (const [rpc, batch] of batches) {
    const { data, error } = await supabase.rpc(rpc, { p_operations: batch })
    if (error) throw error
    results.push(...(data?.results ?? []))
    processedAt = data?.processedAt ?? processedAt
  }
  return { results, processedAt }
}
