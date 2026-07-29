import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class AdminService {
  private get client() {
    return getSupabaseClient();
  }

  async getPendingCount() {
    const { count, error } = await this.client
      .from('binding_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) throw new Error(`查询失败: ${error.message}`);
    return { count: count || 0 };
  }

  async getBindingRequests() {
    // 从数据库查询所有绑定请求（包括 pending、approved、rejected）
    const { data, error } = await this.client
      .from('binding_requests')
      .select(`
        *,
        users!binding_requests_user_id_fkey (nickname),
        children!binding_requests_child_id_fkey (name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询失败: ${error.message}`);

    // 格式化返回数据
    return (data || []).map((req: any) => ({
      id: req.id,
      parent_name: req.users?.nickname || '未知用户',
      child_name: req.children?.name || '未知幼儿',
      relationship: req.relationship,
      custom_relationship: req.custom_relationship,
      status: req.status,
      reject_reason: req.reject_reason,
      created_at: req.created_at,
      approved_at: req.approved_at,
    }));
  }

  async getPendingBindingRequests() {
    // 只查询 pending 状态的记录
    const { data, error } = await this.client
      .from('binding_requests')
      .select(`
        *,
        users!binding_requests_user_id_fkey (nickname),
        children!binding_requests_child_id_fkey (name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询失败: ${error.message}`);

    // 格式化返回数据
    return (data || []).map((req: any) => ({
      id: req.id,
      parent_name: req.users?.nickname || '未知用户',
      child_name: req.children?.name || '未知幼儿',
      relationship: req.relationship,
      custom_relationship: req.custom_relationship,
      status: req.status,
      reject_reason: req.reject_reason,
      created_at: req.created_at,
      approved_at: req.approved_at,
    }));
  }

  async approveBindingRequest(requestId: string) {
    const { error } = await this.client
      .from('binding_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) throw new Error(`审核失败: ${error.message}`);
    return { success: true };
  }

  async rejectBindingRequest(requestId: string, reason?: string) {
    const updateData: any = {
      status: 'rejected',
      approved_at: new Date().toISOString(),
    };
    if (reason) {
      updateData.reject_reason = reason;
    }

    const { error } = await this.client
      .from('binding_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) throw new Error(`审核失败: ${error.message}`);
    return { success: true };
  }
}
