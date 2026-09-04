import { normalizeFlexibleGroup } from '@/features/flexibleGroups/domain.js'
import { supabase } from './client.js'

function success(data = null) {
  return { data, error: null }
}

export function toRemoteFlexibleGroup(input, userId) {
  const group = normalizeFlexibleGroup(input)
  return {
    id: group.id,
    user_id: userId,
    name: group.name,
    period: group.period,
    minimum_count: group.minimumCount,
    target_count: group.targetCount,
    extra_count: group.extraCount,
    timezone: group.timezone,
    status: group.status,
    version: group.version,
    created_at: group.createdAt,
    updated_at: group.updatedAt,
    deleted_at: group.deletedAt,
  }
}

export function fromRemoteFlexibleGroups({ groups = [], members = [] } = {}) {
  return groups.map(row => normalizeFlexibleGroup({
    id: row.id,
    name: row.name,
    period: row.period,
    minimumCount: row.minimum_count,
    targetCount: row.target_count,
    extraCount: row.extra_count,
    timezone: row.timezone,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    memberIds: members
      .filter(member => member.group_id === row.id && !member.deleted_at)
      .sort((a, b) => a.position - b.position)
      .map(member => member.habit_id),
  }))
}

export async function fetchFlexibleGroupsBundle() {
  if (!supabase) return success([])
  const [groups, members] = await Promise.all([
    supabase.from('traker_flexible_groups').select('*'),
    supabase.from('traker_flexible_group_members').select('*'),
  ])
  if (groups.error) return groups
  if (members.error) return members
  return success(fromRemoteFlexibleGroups({ groups: groups.data, members: members.data }))
}

async function syncMembers(group, userId) {
  const existing = await supabase
    .from('traker_flexible_group_members')
    .select('*')
    .eq('group_id', group.id)
  if (existing.error) return existing

  const desiredIds = new Set(group.memberIds)
  const now = new Date().toISOString()
  for (const row of existing.data ?? []) {
    if (!row.deleted_at && !desiredIds.has(row.habit_id)) {
      const result = await supabase
        .from('traker_flexible_group_members')
        .update({ deleted_at: now })
        .eq('id', row.id)
      if (result.error) return result
    }
  }

  for (const [position, habitId] of group.memberIds.entries()) {
    const prior = (existing.data ?? [])
      .filter(row => row.habit_id === habitId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
    const row = {
      id: prior?.id ?? crypto.randomUUID(),
      user_id: userId,
      group_id: group.id,
      habit_id: habitId,
      position,
      active_from: prior?.active_from ?? group.createdAt.slice(0, 10),
      active_until: null,
      created_at: prior?.created_at ?? group.createdAt,
      deleted_at: null,
    }
    const result = await supabase
      .from('traker_flexible_group_members')
      .upsert(row, { onConflict: 'id' })
    if (result.error) return result
  }
  return success()
}

export async function upsertFlexibleGroupBundle(input, userId) {
  if (!supabase) return success()
  const group = normalizeFlexibleGroup(input)
  const result = await supabase
    .from('traker_flexible_groups')
    .upsert(toRemoteFlexibleGroup(group, userId), { onConflict: 'id' })
  if (result.error) return result
  return syncMembers(group, userId)
}

export async function deleteFlexibleGroup(groupId, version = 1, deletedAt = new Date().toISOString()) {
  if (!supabase) return success()
  const membersResult = await supabase
    .from('traker_flexible_group_members')
    .update({ deleted_at: deletedAt })
    .eq('group_id', groupId)
    .is('deleted_at', null)
  if (membersResult.error) return membersResult
  return supabase
    .from('traker_flexible_groups')
    .update({
      status: 'archived',
      deleted_at: deletedAt,
      version: Math.max(1, Number(version) || 1),
    })
    .eq('id', groupId)
}

export async function bulkUpsertFlexibleGroups(groups, userId) {
  if (!supabase) return success()
  for (const group of groups ?? []) {
    const result = group.deletedAt
      ? await deleteFlexibleGroup(group.id, group.version, group.deletedAt)
      : await upsertFlexibleGroupBundle(group, userId)
    if (result.error) return result
  }
  return success()
}
