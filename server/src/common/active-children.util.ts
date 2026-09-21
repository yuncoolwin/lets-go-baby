import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 过滤出仍在册（非 archived）的幼儿 id 子集。
 * 用于所有按 child_id 返回幼儿业务数据的查询，集中排除已删除（回收站）幼儿的关联数据。
 * 幂等、无副作用；失败时返回空数组（调用方据此放行/过滤）。
 */
export async function getActiveChildIds(childIds: string[]): Promise<string[]> {
  const ids = [...new Set(childIds.map((s) => s).filter(Boolean))];
  if (ids.length === 0) return [];
  const client = getSupabaseClient();
  try {
    const { data } = await client
      .from('children')
      .select('id')
      .in('id', ids)
      .neq('status', 'archived');
    return (data || []).map((c: any) => c.id);
  } catch (e) {
    console.warn('[getActiveChildIds] 查询失败:', (e as Error)?.message);
    return [];
  }
}

/** 校验单个幼儿是否仍在册（非 archived） */
export async function isChildActive(childId: string | null | undefined): Promise<boolean> {
  if (!childId) return false;
  const client = getSupabaseClient();
  try {
    const { data } = await client
      .from('children')
      .select('status')
      .eq('id', childId)
      .neq('status', 'archived')
      .maybeSingle();
    return !!data;
  } catch (e) {
    console.warn('[isChildActive] 查询失败:', (e as Error)?.message);
    return false;
  }
}