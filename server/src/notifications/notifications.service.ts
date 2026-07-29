import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class NotificationsService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 创建通知
   */
  async create(dto: {
    title: string;
    content: string;
    type: string;
    scope?: string;
    target_ids?: string;
    is_pinned?: boolean;
  }, authorId?: string) {
    const { data, error } = await this.client
      .from('notifications')
      .insert({
        title: dto.title,
        content: dto.content,
        type: dto.type,
        scope: dto.scope || 'all',
        target_ids: dto.target_ids || null,
        is_pinned: dto.is_pinned || false,
        author_id: authorId || null,
      })
      .select()
      .single();

    if (error) {
      return { error: true, code: 500, msg: `创建失败: ${error.message}` };
    }
    return data;
  }

  /**
   * 列表查询（分页 + 筛选 + 搜索）
   */
  async findAll(query: {
    page?: number;
    page_size?: number;
    type?: string;
    keyword?: string;
  }) {
    const page = query.page || 1;
    const pageSize = query.page_size || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let builder = this.client
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.type) {
      builder = builder.eq('type', query.type);
    }
    if (query.keyword) {
      builder = builder.ilike('title', `%${query.keyword}%`);
    }

    const { data, count, error } = await builder;

    if (error) {
      return { error: true, code: 500, msg: `查询失败: ${error.message}` };
    }

    // 为每条通知添加已读人数统计
    const results: Array<Record<string, unknown>> = [];
    for (const item of (data || [])) {
      const { count: readCount } = await this.client
        .from('notification_reads')
        .select('*', { count: 'exact', head: true })
        .eq('notification_id', item.id);

      results.push({
        ...item,
        read_count: readCount || 0,
      });
    }

    return {
      list: results,
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * 详情
   */
  async findOne(id: string) {
    const { data: notification, error } = await this.client
      .from('notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return { error: true, code: 500, msg: `查询失败: ${error.message}` };
    }
    if (!notification) {
      return { error: true, code: 404, msg: '通知不存在' };
    }

    // 获取已读人数
    const { count: readCount } = await this.client
      .from('notification_reads')
      .select('*', { count: 'exact', head: true })
      .eq('notification_id', id);

    return {
      ...notification,
      read_count: readCount || 0,
    };
  }

  /**
   * 更新
   */
  async update(id: string, dto: {
    title?: string;
    content?: string;
    type?: string;
    scope?: string;
    target_ids?: string;
    is_pinned?: boolean;
  }) {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.scope !== undefined) updateData.scope = dto.scope;
    if (dto.target_ids !== undefined) updateData.target_ids = dto.target_ids;
    if (dto.is_pinned !== undefined) updateData.is_pinned = dto.is_pinned;

    const { data, error } = await this.client
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { error: true, code: 500, msg: `更新失败: ${error.message}` };
    }
    return data;
  }

  /**
   * 删除
   */
  async remove(id: string) {
    // 先删除已读记录
    await this.client
      .from('notification_reads')
      .delete()
      .eq('notification_id', id);

    // 再删除通知
    const { error } = await this.client
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      return { error: true, code: 500, msg: `删除失败: ${error.message}` };
    }
    return { success: true };
  }

  /**
   * 标记已读
   */
  async markRead(notificationId: string, userId: string) {
    // 检查是否已读
    const { data: existing } = await this.client
      .from('notification_reads')
      .select('id')
      .eq('notification_id', notificationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return { success: true, msg: '已读' };
    }

    const { error } = await this.client
      .from('notification_reads')
      .insert({
        notification_id: notificationId,
        user_id: userId,
      });

    if (error) {
      return { error: true, code: 500, msg: `标记失败: ${error.message}` };
    }
    return { success: true };
  }

  /**
   * 统计
   */
  async getStats() {
    // 总通知数
    const { count: total } = await this.client
      .from('notifications')
      .select('*', { count: 'exact', head: true });

    // 按类型统计
    const { data: typeStats } = await this.client
      .from('notifications')
      .select('type');

    const byType: Record<string, number> = {};
    for (const t of (typeStats || [])) {
      byType[t.type] = (byType[t.type] || 0) + 1;
    }

    // 置顶数
    const { count: pinnedCount } = await this.client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_pinned', true);

    // 已读总数
    const { count: totalReads } = await this.client
      .from('notification_reads')
      .select('*', { count: 'exact', head: true });

    return {
      total: total || 0,
      pinned_count: pinnedCount || 0,
      by_type: byType,
      total_reads: totalReads || 0,
    };
  }
}
