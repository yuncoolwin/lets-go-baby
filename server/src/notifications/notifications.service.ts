import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { AuthzService } from '@/auth/authz.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

const VALID_TYPES = ['all', 'course', 'class', 'personal', 'teacher'];

/** 图片上传：原始 base64 大小上限（约对应 10MB 原始图） */
const IMAGE_BASE64_MAX = 10 * 1024 * 1024;
/** 私有桶签名 URL 有效期：24 小时 */
const SIGNED_URL_TTL = 60 * 60 * 24;

@Injectable()
export class NotificationsService {
  constructor(private readonly authz: AuthzService) {}

  private get client() {
    return getSupabaseClient();
  }

  /**
   * 从 JWT userId 推导当前身份：teacher 优先，其次 parent，再次首个角色
   */
  private async getUserIdentity(userId: string) {
    const roles = await this.authz.getUserRoles(userId);
    const identity =
      roles.find((r) => r.role_type === 'teacher') ||
      roles.find((r) => r.role_type === 'parent') ||
      roles[0] ||
      null;
    return { roles, identity };
  }

  /**
   * 当前登录用户是否为管理员/超管（走 AuthzService，客户端传值无效）
   */
  private async isAdminUser(userId: string): Promise<boolean> {
    const level = await this.authz.getRoleLevel(userId);
    return level === 'admin' || level === 'superadmin';
  }

  /**
   * 当前登录用户的所有 active 角色 id
   */
  private async getRoleIdsForUser(userId: string): Promise<string[]> {
    const roles = await this.authz.getUserRoles(userId);
    return roles.map((r) => r.id).filter(Boolean);
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
   * 口径：teachers.class_id in classIds + teacher_classes 多班关联（并集）
   */
  private async getTeacherRoleIdsByClassIds(classIds: string[]): Promise<string[]> {
    if (!classIds.length) return [];
    // 直属教师（teachers.class_id）+ 关联教师（teacher_classes）取并集
    const [{ data: direct }, { data: tcHits }] = await Promise.all([
      this.client
        .from('teachers')
        .select('user_id')
        .eq('status', 'active')
        .in('class_id', classIds),
      this.client
        .from('teacher_classes')
        .select('teacher_id')
        .in('class_id', classIds),
    ]);
    const tcTeacherIds = [...new Set((tcHits || []).map((r) => r.teacher_id).filter(Boolean))];
    let linked: any[] = [];
    if (tcTeacherIds.length) {
      const { data } = await this.client
        .from('teachers')
        .select('user_id')
        .eq('status', 'active')
        .in('id', tcTeacherIds);
      linked = data || [];
    }
    const userIds = [...new Set(
      [...(direct || []), ...linked].map((t: any) => t.user_id).filter(Boolean),
    )];
    return this.getTeacherRoleIdsByUserIds(userIds);
  }

  /**
   * 查所有管理员角色 id（含超级管理员）
   */
  private async getAdminRoleIds(): Promise<string[]> {
    const { data } = await this.client
      .from('user_roles')
      .select('id')
      .in('role_type', ['admin', 'superadmin']);
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
      (await this.getAdminRoleIds()).forEach((id) => roleIds.add(id));
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
      (await this.getAdminRoleIds()).forEach((id) => roleIds.add(id));
    } else if (type === 'personal') {
      // 所选幼儿的所有家长（不看是否在读）
      (await this.getParentRoleIdsByChildIds(ids)).forEach((id) => roleIds.add(id));
      (await this.getAdminRoleIds()).forEach((id) => roleIds.add(id));
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
      (await this.getAdminRoleIds()).forEach((id) => roleIds.add(id));
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
   * 创建通知：作者身份从 JWT userId 推导，客户端传值无效
   */
  /** 写审计日志：失败仅告警，不阻断主流程 */
  private async logAudit(params: {
    userId: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    name?: string | null;
    level?: string;
  }) {
    try {
      const { error } = await this.client.from('audit_logs').insert({
        user_id: params.userId || null,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId || null,
        detail: { name: params.name || null },
        level: params.level || 'info',
        created_at: new Date().toISOString(),
      });
      if (error) console.warn('[AuditLog] 写入失败:', error.message);
    } catch (e) {
      console.warn('[AuditLog] 写入失败:', (e as Error)?.message);
    }
  }

  async create(
    userId: string,
    dto: {
      title: string;
      content: string;
      type: string;
      target_ids?: string[];
      status?: string;
      images?: string[];
    },
  ) {
    if (!dto.title || !dto.content || !dto.type) {
      return { error: true, code: 400, msg: 'title/content/type 不能为空' };
    }
    if (!VALID_TYPES.includes(dto.type)) {
      return { error: true, code: 400, msg: `type 必须是 ${VALID_TYPES.join('/')} 之一` };
    }

    // 权限：仅管理员/教师可创建，家长/未登录 403
    const level = await this.authz.getRoleLevel(userId);
    if (level === 'none' || level === 'parent') {
      return { error: true, code: 403, msg: '家长无权发送通知' };
    }

    // 作者身份：teacher 优先（客户端传什么都无法伪造）
    const { identity } = await this.getUserIdentity(userId);
    const authorId = identity?.id || null;

    // 权限校验：教师角色不能发布 all / teacher 类型
    if (identity?.role_type === 'teacher' && (dto.type === 'all' || dto.type === 'teacher')) {
      throw new HttpException(
        { code: 403, msg: '教师无权发布全园通知或教师通知', data: null },
        HttpStatus.FORBIDDEN,
      );
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

    await this.logAudit({ userId, action: 'notification_create', targetType: 'notification', targetId: notification?.id || null, name: notification?.title || null });

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
   * 身份一律从 JWT userId 推导，客户端传的 user_role_id / author_id 全部忽略
   */
  async findAll(
    userId: string,
    query: {
      page?: number | string;
      page_size?: number | string;
      type?: string;
      keyword?: string;
      scope?: string;
    },
  ) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (query.scope === 'received') {
      const roleIds = await this.getRoleIdsForUser(userId);
      return this.findReceived(roleIds, query, page, pageSize, from, to);
    }
    if (query.scope === 'sent') {
      const { identity } = await this.getUserIdentity(userId);
      return this.findSent(identity?.id, query, page, pageSize, from, to, false);
    }
    if (query.scope === 'draft') {
      const { identity } = await this.getUserIdentity(userId);
      return this.findSent(identity?.id, query, page, pageSize, from, to, true);
    }

    // 默认：管理端全量列表（仅管理员/超管，仅已发布，排除草稿和已撤回）
    if (!(await this.isAdminUser(userId))) {
      return { error: true, code: 403, msg: '无权访问管理端通知列表', data: null };
    }
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

    const authorIds = [...new Set(list.map((n: any) => n.author_id).filter(Boolean))];
    const senderNames = await this.getSenderNames(authorIds);

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
          sender_name: senderNames.get(n.author_id) || '',
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
   * 反查 author_id 姓名：users.nickname 优先，空则 user_roles.real_name
   */
  private async getSenderNames(authorIds: string[]) {
    const map = new Map<string, string>();
    const ids = [...new Set(authorIds.filter(Boolean))];
    if (!ids.length) return map;

    const { data: roles } = await this.client
      .from('user_roles')
      .select('id, real_name, user_id')
      .in('id', ids);
    const roleMap = new Map((roles || []).map((r: any) => [r.id, r]));

    const userIds = [...new Set((roles || []).map((r: any) => r.user_id).filter(Boolean))];
    const nickMap = new Map<string, string>();
    if (userIds.length) {
      const { data: users } = await this.client
        .from('users')
        .select('id, nickname')
        .in('id', userIds);
      (users || []).forEach((u: any) => nickMap.set(u.id, u.nickname || ''));
    }

    const teacherNickMap = new Map<string, string>();
    if (userIds.length) {
      const { data: teacherRows } = await this.client
        .from('teachers')
        .select('user_id, nickname')
        .in('user_id', userIds);
      (teacherRows || []).forEach((t: any) => {
        if (t.user_id && t.nickname) teacherNickMap.set(t.user_id, t.nickname);
      });
    }

    const realNameNickMap = new Map<string, string>();
    const realNames = [...new Set((roles || []).map((r: any) => r.real_name).filter(Boolean))];
    if (realNames.length) {
      const { data: teacherByName } = await this.client
        .from('teachers')
        .select('real_name, nickname')
        .in('real_name', realNames);
      (teacherByName || []).forEach((t: any) => {
        if (t.real_name && t.nickname) realNameNickMap.set(t.real_name, t.nickname);
      });
    }

    ids.forEach((aid) => {
      const role = roleMap.get(aid);
      let name = role?.user_id
        ? teacherNickMap.get(role.user_id) || nickMap.get(role.user_id) || ''
        : '';
      if (!name && role?.real_name) name = realNameNickMap.get(role.real_name) || '';
      if (!name) name = role?.real_name || '';
      map.set(aid, name);
    });
    return map;
  }

  /**
   * 我收到的通知（仅 published，过滤已撤回/草稿）
   */
  private async findReceived(
    roleIds: string[],
    _query: any,
    page: number,
    pageSize: number,
    from: number,
    to: number,
  ) {
    // 用户所有 active 角色（teacher+parent 等）都能收到各自身份的通知
    if (!roleIds.length) {
      return {
        code: 200,
        msg: 'success',
        data: { list: [], total: 0, page, page_size: pageSize },
      };
    }

    const { data: recipients, error } = await this.client
      .from('notification_recipients')
      .select('notification_id, is_read, read_at, created_at')
      .in('user_role_id', roleIds)
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

    const authorIds = [
      ...new Set(
        (recipients || [])
          .map((r) => publishedMap.get(r.notification_id)?.author_id)
          .filter(Boolean),
      ),
    ];
    const senderNames = await this.getSenderNames(authorIds);

    const merged = (recipients || [])
      .map((r) => {
        const notification = publishedMap.get(r.notification_id);
        if (!notification) return null;
        return {
          ...notification,
          is_read: r.is_read,
          read_at: r.read_at,
          sender_name: senderNames.get(notification.author_id) || '',
        };
      })
      .filter(Boolean);

    const total = merged.length;
    return {
      list: await Promise.all(
        merged.slice(from, to + 1).map(async (n: any) => ({
          ...n,
          images: await this.signImageUrls(n.images || []),
        })),
      ),
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

    const authorIds = [...new Set(list.map((n: any) => n.author_id).filter(Boolean))];
    const senderNames = await this.getSenderNames(authorIds);

    const listWithStats = await Promise.all(
      list.map(async (n: any) => {
        const stats = statsMap.get(n.id) || { recipient_count: 0, read_count: 0 };
        const targetLabels = await this.getTargetLabels(n.type, n.target_ids || []);
        return {
          ...n,
          recipient_count: stats.recipient_count,
          read_count: stats.read_count,
          target_labels: targetLabels,
          sender_name: senderNames.get(n.author_id) || '',
        };
      }),
    );

    return {
      list: await Promise.all(
        listWithStats.map(async (n: any) => ({
          ...n,
          images: await this.signImageUrls(n.images || []),
        })),
      ),
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * 查询详情
   */
  async findOne(userId: string, id: string) {
    const roles = await this.authz.getUserRoles(userId);
    const roleIds = roles.map((r) => r.id).filter(Boolean);
    const { identity } = await this.getUserIdentity(userId);
    const level = await this.authz.getRoleLevel(userId);
    const isAdminOperator = level === 'admin' || level === 'superadmin';

    const { data: notification } = await this.client
      .from('notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!notification) return { error: true, code: 404, msg: '通知不存在' };

    // 管理员 / 作者本人 / 接收人可见
    let allowed = isAdminOperator;
    if (!allowed && identity?.id && notification.author_id === identity.id) allowed = true;
    if (!allowed && roleIds.length) {
      const { data: recipient } = await this.client
        .from('notification_recipients')
        .select('id')
        .eq('notification_id', id)
        .in('user_role_id', roleIds)
        .maybeSingle();
      if (recipient) allowed = true;
    }
    if (!allowed) return { error: true, code: 403, msg: '无权查看该通知' };

    const { count } = await this.client
      .from('notification_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('notification_id', id);

    const detail = { ...notification, recipient_count: count || 0 };
    if (Array.isArray(detail.images) && detail.images.length) {
      detail.images = await this.signImageUrls(detail.images);
    }
    return detail;
  }

  /**
   * 编辑草稿；草稿转发布时按新 target_ids 重建 recipients
   */
  async update(
    userId: string,
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
    const isAdminOperator = await this.isAdminUser(userId);
    const { identity } = await this.getUserIdentity(userId);
    const isAuthor = !!identity?.id && existing.author_id === identity.id;
    if (!isAdminOperator && !isAuthor) {
      return { error: true, code: 403, msg: '仅管理员或作者本人可编辑通知' };
    }
    if (!isAdminOperator && existing.status !== 'draft' && existing.status !== 'revoked') {
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

    // 仅当从草稿/撤回转为发布时才重建接收人；管理员就地编辑已发布通知不重建、不重置已读、不重新群发
    const becomingPublished = dto.status === 'published' && existing.status !== 'published';
    const isEditingPublished = isAdminOperator && existing.status === 'published';
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.images !== undefined) updateData.images = dto.images;
    if (!isEditingPublished) {
      if (dto.type !== undefined) updateData.type = dto.type;
      if (dto.target_ids !== undefined) updateData.target_ids = dto.target_ids;
      if (becomingPublished) updateData.status = 'published';
    }

    const { data: updated, error } = await this.client
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: true, code: 500, msg: `更新失败: ${error.message}` };

    await this.logAudit({ userId, action: 'notification_update', targetType: 'notification', targetId: id, name: updated?.title || null });

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
  async remove(userId: string, id: string) {
    const { data: existing } = await this.client
      .from('notifications')
      .select('status, author_id, title')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return { error: true, code: 404, msg: '通知不存在' };
    const isAdminOperator = await this.isAdminUser(userId);
    const { identity } = await this.getUserIdentity(userId);
    const isAuthor = !!identity?.id && existing.author_id === identity.id;
    if (!isAdminOperator && !isAuthor) {
      return { error: true, code: 403, msg: '仅管理员或作者本人可删除通知' };
    }
    if (!isAdminOperator && existing.status !== 'draft') {
      return { error: true, code: 400, msg: '仅草稿可删除，已发布通知请使用撤回' };
    }

    await this.client.from('notification_recipients').delete().eq('notification_id', id);
    const { error } = await this.client.from('notifications').delete().eq('id', id);
    if (error) return { error: true, code: 500, msg: `删除失败: ${error.message}` };

    await this.logAudit({ userId, action: 'notification_delete', targetType: 'notification', targetId: id, name: existing?.title || null, level: 'warn' });

    return { success: true };
  }

  /**
   * 标记已读
   */
  async markRead(userId: string, notificationId: string) {
    const roleIds = await this.getRoleIdsForUser(userId);
    if (!roleIds.length) return { success: true };

    const { error } = await this.client
      .from('notification_recipients')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('notification_id', notificationId)
      .in('user_role_id', roleIds);

    if (error) return { error: true, code: 500, msg: `标记已读失败: ${error.message}` };
    return { success: true };
  }

  /**
   * 撤回：status = revoked
   */
  async revoke(userId: string, id: string) {
    const { data: existing } = await this.client
      .from('notifications')
      .select('status, author_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return { error: true, code: 404, msg: '通知不存在' };

    // 仅管理员或作者本人可撤回
    const isAdminOperator = await this.isAdminUser(userId);
    const { identity } = await this.getUserIdentity(userId);
    const isAuthor = !!identity?.id && existing.author_id === identity.id;
    if (!isAdminOperator && !isAuthor) {
      return { error: true, code: 403, msg: '仅管理员或作者本人可撤回通知' };
    }

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
  async getStats(userId: string) {
    const { identity } = await this.getUserIdentity(userId);
    const authorId = identity?.id;
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
  async getUnreadCount(userId: string) {
    const roleIds = await this.getRoleIdsForUser(userId);
    if (!roleIds.length) return { count: 0 };

    const { data: unreadRecipients, error } = await this.client
      .from('notification_recipients')
      .select('notification_id')
      .in('user_role_id', roleIds)
      .eq('is_read', false);

    if (error) return { error: true, code: 500, msg: `查询未读失败: ${error.message}` };

    const unreadNotificationIds = [
      ...new Set((unreadRecipients || []).map((r: any) => r.notification_id).filter(Boolean)),
    ];
    let notificationUnread = 0;
    if (unreadNotificationIds.length) {
      const { count } = await this.client
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .in('id', unreadNotificationIds)
        .eq('status', 'published');
      notificationUnread = count || 0;
    }

    // 家长角色：追加成长记录未读数（多家长角色累计）
    let growthUnread = 0;
    const roles = await this.authz.getUserRoles(userId);
    const parentRoleIds = roles.filter((r) => r.role_type === 'parent').map((r) => r.id).filter(Boolean);
    for (const parentRoleId of parentRoleIds) {
      const { data: relations } = await this.client
        .from('parent_child_relations')
        .select('child_id')
        .eq('parent_role_id', parentRoleId)
        .eq('status', 'active');
      const childIds = [...new Set((relations || []).map((r: any) => r.child_id).filter(Boolean))];
      if (childIds.length) {
        const { count } = await this.client
          .from('growth_records')
          .select('id', { count: 'exact', head: true })
          .in('child_id', childIds)
          .is('parent_read_at', null);
        growthUnread += count || 0;
      }
    }

    return { count: notificationUnread + growthUnread };
  }

  /**
   * 从存储 URL 提取 storage 路径（兼容 public / sign 两种历史格式）
   */
  private extractStoragePaths(urls: string[]): string[] {
    const paths: string[] = [];
    (urls || []).forEach((url) => {
      if (!url || typeof url !== 'string') return;
      const marker = '/object/public/notifications/';
      const idx = url.indexOf(marker);
      if (idx >= 0) {
        paths.push(url.slice(idx + marker.length));
        return;
      }
      const marker2 = '/object/sign/notifications/';
      const idx2 = url.indexOf(marker2);
      if (idx2 >= 0) {
        paths.push(url.slice(idx2 + marker2.length).split('?')[0]);
      }
    });
    return paths.filter(Boolean);
  }

  /**
   * 为存储的图片 URL 动态生成签名 URL（bucket 已转为 private，public URL 不再可直接访问）
   */
  private async signImageUrls(urls: string[]): Promise<string[]> {
    const paths = this.extractStoragePaths(urls || []);
    const signed = new Map<string, string>();
    for (const p of paths) {
      const { data } = await this.client.storage.from('notifications').createSignedUrl(p, SIGNED_URL_TTL);
      if (data?.signedUrl) signed.set(p, data.signedUrl);
    }
    return (urls || []).map((url) => {
      const p = this.extractStoragePaths([url])[0];
      return (p && signed.get(p)) || url;
    });
  }

  /**
   * 图片上传：base64 → Buffer → Supabase Storage private bucket notifications（动态签名 URL）
   */
  async uploadImage(userId: string, body: { image: string; name?: string }) {
    // 鉴权：家长/未登录直接 403
    const level = await this.authz.getRoleLevel(userId);
    if (level === 'none' || level === 'parent') {
      return { error: true, code: 403, msg: '家长无权上传通知图片' };
    }

    const { image } = body || {};
    if (!image) return { error: true, code: 400, msg: 'image 不能为空' };

    // 白名单：必须严格匹配 data:image/(png|jpeg|jpg|webp);base64, 前缀，纯 base64（无前缀）与其他格式一律 415
    const match = image.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,(.*)$/i);
    if (!match) {
      return { error: true, code: 415, msg: '仅支持 png/jpeg/jpg/webp 格式' };
    }
    const base64 = match[1];

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch (e) {
      return { error: true, code: 400, msg: '图片 base64 解析失败' };
    }

    // base64 原始大小硬上限（对应原始图片约 10MB）
    if (buffer.length > IMAGE_BASE64_MAX) {
      return { error: true, code: 413, msg: '图片过大，请控制在 10MB 以内' };
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

    // 确保 bucket 存在（不存在则创建 private bucket；已存在 public 则降级为 private）
    try {
      const { data: existingBucket } = await this.client.storage.getBucket('notifications');
      if (!existingBucket) {
        await this.client.storage.createBucket('notifications', { public: false });
      } else if (existingBucket.public) {
        await this.client.storage.updateBucket('notifications', { public: false });
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

    // private bucket → 返回签名 URL（24 小时有效）
    const { data: signed } = await this.client.storage.from('notifications').createSignedUrl(path, SIGNED_URL_TTL);
    return { url: signed?.signedUrl || null };
  }
}