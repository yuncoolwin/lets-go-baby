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
    // Demo data
    return [
      {
        id: 'req_1',
        parent_name: '张先生',
        child_name: '张小明',
        relationship: 'father',
        status: 'pending',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'req_2',
        parent_name: '李女士',
        child_name: '李小红',
        relationship: 'mother',
        status: 'pending',
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
  }

  async approveBindingRequest(requestId: string) {
    const { error } = await this.client
      .from('binding_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) throw new Error(`审核失败: ${error.message}`);
    return { success: true };
  }

  async rejectBindingRequest(requestId: string) {
    const { error } = await this.client
      .from('binding_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) throw new Error(`审核失败: ${error.message}`);
    return { success: true };
  }
}
