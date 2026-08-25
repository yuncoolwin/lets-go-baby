import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

const VALID_TYPES = ['all', 'course', 'class', 'personal', 'teacher'];

@Injectable()
export class NotificationsService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 根据角色 id 查询角色
   */
  private async getRole(roleId: string) {
    if (!roleId) return null;
    const { data } = await this.client
      .from('user_roles')
      .select('id, user_id, role_type')
      .eq('id', roleId)
      .maybeSingle();
    return data;
  }

  /**
   * 根据幼儿 id 数组查所有家长的角色 id（parent_role_id）
   * 口径：parent_child_relations.status = 'active'
   */
  private async getParentRoleIdsByChildIds(childIds: string[]): Promise<string[]> {
    if (!childIds.length) return [];
    const { data } = await this.client
      .from('parent_child_relations')
      .select('parent_role_id')
      .eq('status', 'active')
      .in('child_id', childIds);
    return [...new Set((data || []).map((r) => r.parent_role_id).filter(Boolean))];
  }

  /**
   * 根据教师 user_id 数组查教师端角色 id
   * 口径：user_roles.role_type = 'teacher'
   */
  private async getTeacherRoleIdsByUserIds(userIds: string[]): Promise<string[]> {
    if (!userIds.length) return [];
    const { data } = await this.client
      .from('user_roles')
      .select('id')
      .eq('role_type', 'teacher')
      .in('user_id', userIds);
    return (data || []).map((r) => r.id).filter(Boolean);
  }

  /**
   * 查所有在职教师的教师端角色 id
   * 口径：teachers.status = 'active'
   */
  private async getActiveTeacherRoleIds(): Promise<string[]> {
    const { data } = await this.client
      .from('teachers')
      .select('user_id')
      .eq('status', 'active');
    const userIds = [...new Set((data || []).map((t) => t.user_id).filter(Boolean))];
    return this.getTeacherRoleIdsByUserIds(userIds);
  }

  /**
   * 查指定班级的在职教师角色 id
   * 口径：teachers.class_id in classIds
   */
  private async getTeacherRoleIdsByClassIds(classIds: string[]): Promise<string[]> {
    if (!classIds.length) return [];
    const { data } = await this.client
      .from('teachers')
      .select('user_id')
      .eq('status', 'active')
      .in('class_id', classIds);
    const userIds = [...new Set((data || []).map((t) => t.user_id).filter(Boolean))];
    return this.getTeacherRoleIdsByUserIds(userIds);
  }

  /**
   * 查所有管理员角色 id
   * 口径：user_roles.role_type = 'admin'
   */
  private async getAdminRoleIds(): Promise<string[]> {
    const { data } = await this.client
      .from('user_roles')
      .select('id')
      .eq('role_type', 'admin');
    return (data || []).map((r) => r.id).filter(Boolean);
  }

  /**
   * 按类型展开接收人（返回去重后的 user_role_id 数组）
   */
  private async expandRecipients(type: string, targetIds?: string[]): Promise<string[]> {
    const roleIds = new Set<string>();
    const ids = targetIds && targetIds.length ? targetIds : [];

    if (type === 'all') {
      // 所有在读幼儿的家长 + 所有在职教师
      const { data: enrollments } = await this.client
        .from('enrollments')
        .select('child_id')
        .eq('status', '进行中');
      const childIds = [...new Set((enrollments || []).map((e) => e.child_id).filter(Boolean))];
      (await this.getParentRoleIdsByChildIds(childIds)).forEach((id) => roleIds.add(id));
      (await this.getActiveTeacherRoleIds()).forEach((id) => roleIds.add(id));
    } else if (type === 'course') {
      // 该课程下所有在读幼儿的家长 + 该课程老师 + 所有管理员
      if (ids.length) {
        const { data: enrollments } = await this.client
          .from('enrollments')
          .select('child_id, class_id')
          .eq('status', '进行中')
          .in('course_id', ids);
        const childIds = [...new Set((enrollments || []).map((e) => e.child_id).filter(Boolean))];
        (await this.getParentRoleIdsByChildIds(childIds)).forEach((id) => roleIds.add(id));

        // 课程老师 = 该课程下在读班级的老师
        const classIds = [...new Set((enrollments || []).map((e) => e.class_id).filter(Boolean))];
        (await this.getTeacherRoleIdsByClassIds(classIds)).forEach((id) => roleIds.add(id));
      }
      (await this.getAdminRoleIds()).forEach((id) => roleIds.add(id));
    } else if (type === 'class') {
      // 该班级内所有在读幼儿的家长 + 该班级老师
      if (ids.length) {
        const { data: enrollments } = await this.client
          .from('enrollments')
          .select('child_id')
          .eq('status', '进行中')
          .in('class_id', ids);
        const childIds = [...new Set((enrollments || []).map((e) => e.child_id).filter(Boolean))];
        (await this.getParentRoleIdsByChildIds(childIds)).forEach((id) => roleIds.add(id));

        (await this.getTeacherRoleIdsByClassIds(ids)).forEach((id) => roleIds.add(id));
      }
    } else if (type === 'personal') {
      // 所选幼儿的所有家长（不看是否在读）
      (await this.getParentRoleIdsByChildIds(ids)).forEach((id) => roleIds.add(id));
    } else if (type === 'teacher') {
      // 所选教师的教师端角色
      if (ids.length) {
        const { data: teachers } = await this.client
          .from('teachers')
          .select('user_id')
          .in('id', ids);
        const userIds = [...new Set((teachers || []).map((t) => t.user_id).filter(Boolean))];
        (await this.getTeacherRoleIdsByUserIds(userIds)).forEach((id) => roleIds.add(id));
      }
    }

    return [...roleIds];
  }

  /**
   * 写入接收人
   */
  private async insertRecipients(notificationId: string, roleIds: string[]): Promise<number> {
    if (!roleIds.length) return 0;
    const rows = roleIds.map((userRoleId) => ({
      notification_id: notificationId,
      user_role_id: userRoleId,
      is_read: false,
    }));
    const { error } = await this.client.from('notification_recipients').insert(rows);
    if (error) throw new Error(`写入接收人失败: ${error.message}`);
    return rows.length;
  }

  /**
   * 清空接收人（草稿转发布重建前调用）
   */
  private async clearRecipients(notificationId: string): Promise<void> {
    await this.client.from('notification_recipients').delete().eq('notification_id', notificationId);
  }

  /**
   * 创建通知
   */
  async create(
    dto: {
      title: string;
      content: string;
      type: string;
      target_ids?: string[];
      status?: string;
      images?: string[];
    },
    authorId?: string,
  ) {
    if (!dto.title || !dto.content || !dto.type) {
      return { error: true, code: 400, msg: 'title/content/type 不能为空' };
    }
    if (!VALID_TYPES.includes(dto.type)) {
      return { error: true, code: 400, msg: `type 必须是 ${VALID_TYPES.join('/')} 之一` };
    }

    // 权限校验：教师角色不能发布 all / teacher 类型
    if (authorId) {
      const role = await this.getRole(authorId);
      if (role?.role_type === 'teacher' && (dto.type === 'all' || dto.type === 'teacher')) {
        throw new HttpException(
          { code: 403, msg: '教师无权发布全园通知或教师通知', data: null },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const status = dto.status || 'draft';
    const { data: notification, error } = await this.client
      .from('notifications')
      .insert({
        title: dto.title,
        content: dto.content,
        type: dto.type,
        target_ids: dto.target_ids || [],
        status,
        images: dto.images || [],
        author_id: authorId || null,
      })
      .select()
      .single();

    if (error) {
      return { error: true, code: 500, msg: `创建失败: ${error.message}` };
    }

    // 发布时展开接收人
    if (status === 'published') {
      const roleIds = await this.expandRecipients(dto.type, dto.target_ids || []);
      await this.insertRecipients(notification.id, roleIds);
      return { ...notification, recipient_count: roleIds.length };
    }

    return notification;
  }

  /**
   * 列表查询：支持 scope = received / sent / draft
   */
  async findAll(query: {
    page?: number | string;
    page_size?: number | string;
    type?: string;
    keyword?: string;
    scope?: string;
    user_role_id?: string;
    author_id?: string;
  }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (query.scope === 'received') {
      return this.findReceived(query.user_role_id, query, page, pageSize, from, to);
    }
    if (query.scope === 'sent') {
      return this.findSent(query.author_id, query, page, pageSize, from, to, false);
    }
    if (query.scope === 'draft') {
      return this.findSent(query.author_id, query, page, pageSize, from, to, true);
    }

    // 默认：管理端全量列表（仅已发布，排除草稿和已撤回）
    let builder = this.client
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (query.type) builder = builder.eq('type', query.type);
    if (query.keyword) builder = builder.ilike('title', `%${query.keyword}%`);

    const { data, count, error } = await builder.range(from, to);
    if (error) return { error: true, code: 500, msg: `查询失败: ${error.message}` };

    const list = data || [];

    // 统计每条通知的接收人总数与已读数
    const statsMap = new Map<string, { recipient_count: number; read_count: number }>();
    const notificationIds = list.map((n: any) => n.id);
    if (notificationIds.length) {
      const { data: recipients } = await this.client
        .from('notification_recipients')
        .select('notification_id, is_read')
        .in('notification_id', notificationIds);

      (recipients || []).forEach((r: any) => {
        const cur = statsMap.get(r.notification_id) || { recipient_count: 0, read_count: 0 };
        cur.recipient_count += 1;
        if (r.is_read) cur.read_count += 1;
        statsMap.set(r.notification_id, cur);
      });
    }

    // 反查发送对象名称
    const listWithMeta = await Promise.all(
      list.map(async (n: any) => {
        const stats = statsMap.get(n.id) || { recipient_count: 0, read_count: 0 };
        const targetLabels = await this.getTargetLabels(n.type, n.target_ids || []);
        return {
          ...n,
          read_count: stats.read_count,
          recipient_count: stats.recipient_count,
          target_labels: targetLabels,
        };
      }),
    );

    return {
      list: listWithMeta,
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * 我收到的通知（仅 published，过滤已撤回/草稿）
   */
  private async findReceived(
    userRoleId: string | undefined,
    _query: any,
    page: number,
    pageSize: number,
    from: number,
    to: number,
  ) {
    if (!userRoleId) return { error: true, code: 400, msg: '缺少 user_role_id' };

    const { data: recipients, error } = await this.client
      .from('notification_recipients')
      .select('notification_id, is_read, read_at, created_at')
      .eq('user_role_id', userRoleId)
      .order('created_at', { ascending: false });

    if (error) return { error: true, code: 500, msg: `查询接收记录失败: ${error.message}` };

    const notificationIds = [...new Set((recipients || []).map((r) => r.notification_id))];
    const publishedMap = new Map<string, any>();
    if (notificationIds.length) {
      const { data: notifications } = await this.client
        .from('notifications')
        .select('id, title, content, type, images, author_id, created_at, updated_at')
        .in('id', notificationIds)
        .eq('status', 'published');
      (notifications || []).forEach((n) => publishedMap.set(n.id, n));
    }

    const merged = (recipients || [])
      .map((r) => {
        const notification = publishedMap.get(r.notification_id);
        if (!notification) return null;
        return {
          ...notification,
          is_read: r.is_read,
          read_at: r.read_at,
        };
      })
      .filter(Boolean);

    const total = merged.length;
    return {
      list: merged.slice(from, to + 1),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 我发出的通知（sent = published，draft = 草稿）
   */
  private async findSent(
    authorId: string | undefined,
    query: any,
    page: number,
    pageSize: number,
    from: number,
    to: number,
    isDraft: boolean,
  ) {
    if (!authorId) return { error: true, code: 400, msg: '缺少 author_id' };

    let builder = this.client
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('author_id', authorId);

    if (isDraft) {
      builder = builder.eq('status', 'draft');
    } else {
      builder = builder.in('status', ['published', 'revoked']);
    }
    builder = builder.order('created_at', { ascending: false });

    if (query.type) builder = builder.eq('type', query.type);
    if (query.keyword) builder = builder.ilike('title', `%${query.keyword}%`);

    const { data, count, error } = await builder.range(from, to);
    if (error) return { error: true, code: 500, msg: `查询失败: ${error.message}` };

    const list = data || [];

    // 统计每条通知的接收人总数与已读数（draft 无 recipients，两者为 0）
    const statsMap = new Map<string, { recipient_count: number; read_count: number }>();
    const notificationIds = list.map((n: any) => n.id);
    if (notificationIds.length) {
      const { data: recipients } = await this.client
        .from('notification_recipients')
        .select('notification_id, is_read')
        .in('notification_id', notificationIds);

      (recipients || []).forEach((r: any) => {
        const cur = statsMap.get(r.notification_id) || { recipient_count: 0, read_count: 0 };
        cur.recipient_count += 1;
        if (r.is_read) cur.read_count += 1;
        statsMap.set(r.notification_id, cur);
      });
    }

    const listWithStats = await Promise.all(
      list.map(async (n: any) => {
        const stats = statsMap.get(n.id) || { recipient_count: 0, read_count: 0 };
        const targetLabels = await this.getTargetLabels(n.type, n.target_ids || []);
        return {
          ...n,
          recipient_count: stats.recipient_count,
          read_count: stats.read_count,
          target_labels: targetLabels,
        };
      }),
    );

    return {
      list: listWithStats,
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * 查询详情
   */
  async findOne(id: string) {
    const { data: notification } = await this.client
      .from('notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!notification) return { error: true, code: 404, msg: '通知不存在' };

    const { count } = await this.client
      .from('notification_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('notification_id', id);

    return { ...notification, recipient_count: count || 0 };
  }

  /**
   * 编辑草稿；草稿转发布时按新 target_ids 重建 recipients
   */
  async update(
    id: string,
    dto: {
      title?: string;
      content?: string;
      type?: string;
      target_ids?: string[];
      status?: string;
      images?: string[];
    },
  ) {
    const { data: existing } = await this.client
      .from('notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return { error: true, code: 404, msg: '通知不存在' };
    if (existing.status !== 'draft' && existing.status !== 'revoked') {
      return { error: true, code: 400, msg: '仅草稿或已撤回的通知可编辑' };
    }

    const nextType = dto.type ?? existing.type;
    const nextTargetIds = dto.target_ids ?? existing.target_ids ?? [];
    if (dto.type && !VALID_TYPES.includes(dto.type)) {
      return { error: true, code: 400, msg: `type 必须是 ${VALID_TYPES.join('/')} 之一` };
    }

    // 权限校验：教师的草稿不能编辑为 all / teacher 类型
    if ((nextType === 'all' || nextType === 'teacher') && existing.author_id) {
      const authorRole = await this.getRole(existing.author_id);
      if (authorRole?.role_type === 'teacher') {
        throw new HttpException(
          { code: 403, msg: '教师无权发布全园通知或教师通知', data: null },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const becomingPublished = dto.status === 'published';
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.target_ids !== undefined) updateData.target_ids = dto.target_ids;
    if (dto.images !== undefined) updateData.images = dto.images;
    if (becomingPublished) updateData.status = 'published';

    const { data: updated, error } = await this.client
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: true, code: 500, msg: `更新失败: ${error.message}` };

    // 草稿转发布时重建 recipients
    if (becomingPublished) {
      await this.clearRecipients(id);
      const roleIds = await this.expandRecipients(nextType, nextTargetIds);
      await this.insertRecipients(id, roleIds);
      return { ...updated, recipient_count: roleIds.length };
    }

    return updated;
  }

  /**
   * 删除：仅草稿可物理删除
   */
  async remove(id: string) {
    const { data: existing } = await this.client
      .from('notifications')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return { error: true, code: 404, msg: '通知不存在' };
    if (existing.status !== 'draft') {
      return { error: true, code: 400, msg: '仅草稿可删除，已发布通知请使用撤回' };
    }

    await this.client.from('notification_recipients').delete().eq('notification_id', id);
    const { error } = await this.client.from('notifications').delete().eq('id', id);
    if (error) return { error: true, code: 500, msg: `删除失败: ${error.message}` };

    return { success: true };
  }

  /**
   * 标记已读
   */
  async markRead(notificationId: string, userRoleId?: string) {
    if (!userRoleId) return { error: true, code: 400, msg: '缺少 user_role_id' };

    const { error } = await this.client
      .from('notification_recipients')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('notification_id', notificationId)
      .eq('user_role_id', userRoleId);

    if (error) return { error: true, code: 500, msg: `标记已读失败: ${error.message}` };
    return { success: true };
  }

  /**
   * 撤回：status = revoked
   */
  async revoke(id: string) {
    const { data: existing } = await this.client
      .from('notifications')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return { error: true, code: 404, msg: '通知不存在' };
    if (existing.status === 'revoked') return { error: true, code: 400, msg: '通知已撤回' };
    if (existing.status === 'draft') return { error: true, code: 400, msg: '草稿无需撤回' };

    const { error } = await this.client
      .from('notifications')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { error: true, code: 500, msg: `撤回失败: ${error.message}` };
    return { success: true };
  }

  /**
   * 统计（按新 status 维度）
   */
  async getStats(authorId?: string) {
    let builder = this.client.from('notifications').select('status', { count: 'exact' });
    if (authorId) builder = builder.eq('author_id', authorId);

    const { data, count, error } = await builder;
    if (error) return { error: true, code: 500, msg: `统计失败: ${error.message}` };

    const rows = data || [];
    return {
      total: count || 0,
      published: rows.filter((n) => n.status === 'published').length,
      draft: rows.filter((n) => n.status === 'draft').length,
      revoked: rows.filter((n) => n.status === 'revoked').length,
    };
  }

  /**
   * 反查发送对象名称
   */
  private async getTargetLabels(type: string, targetIds: string[]): Promise<string[]> {
    if (type === 'all' || !targetIds || !targetIds.length) return [];
    const ids = [...new Set(targetIds.filter(Boolean))];
    if (!ids.length) return [];

    if (type === 'course') {
      const { data } = await this.client.from('courses').select('name').in('id', ids);
      return (data || []).map((r: any) => r.name).filter(Boolean);
    }
    if (type === 'class') {
      const { data } = await this.client.from('classes').select('name').in('id', ids);
      return (data || []).map((r: any) => r.name).filter(Boolean);
    }
    if (type === 'personal') {
      const { data } = await this.client.from('children').select('name').in('id', ids);
      return (data || []).map((r: any) => r.name).filter(Boolean);
    }
    if (type === 'teacher') {
      const { data } = await this.client.from('teachers').select('real_name, nickname').in('id', ids);
      return (data || []).map((r: any) => r.real_name || r.nickname).filter(Boolean);
    }
    return [];
  }

  /**
   * 未读数：当前角色未读且通知仍为 published 的数量
   */
  async getUnreadCount(userRoleId: string) {
    if (!userRoleId) return { error: true, code: 400, msg: '缺少 user_role_id' };

    const { data: unreadRecipients, error } = await this.client
      .from('notification_recipients')
      .select('notification_id')
      .eq('user_role_id', userRoleId)
      .eq('is_read', false);

    if (error) return { error: true, code: 500, msg: `查询未读失败: ${error.message}` };

    const unreadNotificationIds = [
      ...new Set((unreadRecipients || []).map((r: any) => r.notification_id).filter(Boolean)),
    ];
    if (!unreadNotificationIds.length) return { count: 0 };

    const { count } = await this.client
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .in('id', unreadNotificationIds)
      .eq('status', 'published');

    return { count: count || 0 };
  }

  /**
   * 图片上传：base64 → Buffer → Supabase Storage public bucket notifications
   */
  async uploadImage(body: { image: string; name?: string }) {
    const { image } = body || {};
    if (!image) return { error: true, code: 400, msg: 'image 不能为空' };

    let base64 = image;
    const match = image.match(/^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,(.*)$/i);
    if (match) base64 = match[2];

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch (e) {
      return { error: true, code: 400, msg: '图片 base64 解析失败' };
    }

    let compressed: Buffer;
    try {
      compressed = await sharp(buffer)
        .rotate()
        .resize({ width: 1080, height: 1080, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
    } catch (e) {
      return { error: true, code: 400, msg: `图片压缩失败: ${(e as Error).message}` };
    }

    // 确保 bucket 存在（不存在则创建 public bucket）
    try {
      const { data: existingBucket } = await this.client.storage.getBucket('notifications');
      if (!existingBucket) {
        await this.client.storage.createBucket('notifications', { public: true });
      }
    } catch (e) {
      console.warn('[Notifications] ensure bucket error:', (e as Error)?.message);
    }

    const path = `notification/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;

    const { error: uploadError } = await this.client.storage
      .from('notifications')
      .upload(path, compressed, { contentType: 'image/webp' });

    if (uploadError) {
      return { error: true, code: 500, msg: `上传失败: ${uploadError.message}` };
    }

    const publicUrl = this.client.storage.from('notifications').getPublicUrl(path).data.publicUrl;
    return { url: publicUrl };
  }
}