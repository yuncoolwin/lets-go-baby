import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

const RECORD_TYPE = 'daily';

@Injectable()
export class GrowthService {
  private get client() {
    return getSupabaseClient();
  }

  private async getRole(roleId: string) {
    if (!roleId) return null;
    const { data } = await this.client
      .from('user_roles')
      .select('id, user_id, role_type, real_name')
      .eq('id', roleId)
      .maybeSingle();
    return data;
  }

  private isAdminRole(roleType?: string) {
    return roleType === 'admin' || roleType === 'superadmin';
  }

  /** 上海时区当天（UTC+8，无夏令时） */
  private shanghaiToday(): string {
    return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  /**
   * 教师角色 -> 负责班级 id（teachers.user_id 优先，real_name 兜底）
   */
  private async resolveTeacherClassId(role: any): Promise<string | null> {
    if (!role || role.role_type !== 'teacher') return null;
    if (role.user_id) {
      const { data: t } = await this.client
        .from('teachers')
        .select('class_id')
        .eq('user_id', role.user_id)
        .eq('status', 'active')
        .maybeSingle();
      if (t?.class_id) return t.class_id;
    }
    if (role.real_name) {
      const { data: t2 } = await this.client
        .from('teachers')
        .select('class_id')
        .eq('real_name', role.real_name)
        .eq('status', 'active')
        .maybeSingle();
      if (t2?.class_id) return t2.class_id;
    }
    return null;
  }

  private async getTeacherNames(records: any[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const teacherIds = [...new Set(records.map((r) => r.teacher_id).filter(Boolean))];
    if (!teacherIds.length) return map;

    const { data: roles } = await this.client
      .from('user_roles')
      .select('id, real_name, user_id')
      .in('id', teacherIds);

    const roleMap = new Map<string, any>((roles || []).map((r) => [r.id, r]));
    const nickMap = new Map<string, string>();
    const userIds = [...new Set((roles || []).map((r) => r.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: users } = await this.client
        .from('users')
        .select('id, nickname')
        .in('id', userIds);
      (users || []).forEach((u) => nickMap.set(u.id, u.nickname || ''));
    }

    const teacherNickMap = new Map<string, string>();
    if (userIds.length) {
      const { data: teacherRows } = await this.client
        .from('teachers')
        .select('user_id, nickname')
        .in('user_id', userIds);
      (teacherRows || []).forEach((t) => {
        if (t.user_id && t.nickname) teacherNickMap.set(t.user_id, t.nickname);
      });
    }

    const realNameNickMap = new Map<string, string>();
    const realNames = [...new Set((roles || []).map((r) => r.real_name).filter(Boolean))];
    if (realNames.length) {
      const { data: teacherByName } = await this.client
        .from('teachers')
        .select('real_name, nickname')
        .in('real_name', realNames);
      (teacherByName || []).forEach((t) => {
        if (t.real_name && t.nickname) realNameNickMap.set(t.real_name, t.nickname);
      });
    }

    teacherIds.forEach((tid) => {
      const role = roleMap.get(tid);
      let name = role?.user_id
        ? teacherNickMap.get(role.user_id) || nickMap.get(role.user_id) || ''
        : '';
      if (!name && role?.real_name) name = realNameNickMap.get(role.real_name) || '';
      if (!name) name = role?.real_name || '';
      map.set(tid, name);
    });
    return map;
  }

  private async getChildNames(records: any[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const childIds = [...new Set(records.map((r) => r.child_id).filter(Boolean))];
    if (!childIds.length) return map;
    const { data: children } = await this.client
      .from('children')
      .select('id, name')
      .in('id', childIds);
    (children || []).forEach((c) => map.set(c.id, c.name || ''));
    return map;
  }

  private async ensureBucket() {
    try {
      const { data: existing } = await this.client.storage.getBucket('growth');
      if (!existing) {
        await this.client.storage.createBucket('growth', { public: true });
      }
    } catch (e) {
      console.warn('[Growth] ensure bucket error:', (e as Error)?.message);
    }
  }

  /**
   * 从 publicUrl 提取 storage 路径（用于删除文件）
   */
  private extractStoragePaths(urls: string[]): string[] {
    const paths: string[] = [];
    (urls || []).forEach((url) => {
      if (!url || typeof url !== 'string') return;
      const marker = '/object/public/growth/';
      const idx = url.indexOf(marker);
      if (idx >= 0) {
        paths.push(url.slice(idx + marker.length));
        return;
      }
      const marker2 = '/object/sign/growth/';
      const idx2 = url.indexOf(marker2);
      if (idx2 >= 0) {
        paths.push(url.slice(idx2 + marker2.length).split('?')[0]);
      }
    });
    return paths.filter(Boolean);
  }

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

    await this.ensureBucket();
    const path = `growth/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;

    const { error: uploadError } = await this.client.storage
      .from('growth')
      .upload(path, compressed, { contentType: 'image/webp' });

    if (uploadError) {
      return { error: true, code: 500, msg: `上传失败: ${uploadError.message}` };
    }

    const publicUrl = this.client.storage.from('growth').getPublicUrl(path).data.publicUrl;
    return { url: publicUrl };
  }

  async create(
    dto: { child_id: string; title: string; content?: string; photo_urls?: string[]; record_date?: string; course_name?: string },
    roleId?: string,
  ) {
    if (!dto.child_id || !dto.title) {
      return { error: true, code: 400, msg: 'child_id/title 不能为空' };
    }
    if (!roleId) return { error: true, code: 401, msg: '缺少角色身份' };

    const role = await this.getRole(roleId);
    if (!role) return { error: true, code: 404, msg: '角色不存在' };

    // 权限校验：教师只能给本人负责班级的幼儿创建
    if (role.role_type === 'teacher') {
      const classId = await this.resolveTeacherClassId(role);
      if (!classId) {
        throw new HttpException(
          { code: 403, msg: '教师未绑定班级', data: null },
          HttpStatus.FORBIDDEN,
        );
      }
      const { data: child } = await this.client
        .from('children')
        .select('class_id')
        .eq('id', dto.child_id)
        .maybeSingle();
      if (!child || child.class_id !== classId) {
        throw new HttpException(
          { code: 403, msg: '只能为本人负责班级的幼儿创建记录', data: null },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const { data: record, error } = await this.client
      .from('growth_records')
      .insert({
        child_id: dto.child_id,
        teacher_id: roleId,
        record_type: RECORD_TYPE,
        title: dto.title,
        content: dto.content || null,
        photo_urls: dto.photo_urls || [],
        record_date: dto.record_date || this.shanghaiToday(),
        course_name: dto.course_name || null,
      })
      .select()
      .single();

    if (error) return { error: true, code: 500, msg: `创建失败: ${error.message}` };
    return record;
  }

  async findAll(query: {
    child_id?: string;
    child_ids?: string;
    record_date?: string;
    page?: number | string;
    page_size?: number | string;
    role_id?: string;
  }) {
    const role = await this.getRole(query.role_id || '');
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = this.client.from('growth_records').select('*', { count: 'exact' });
    if (query.child_id) {
      q = q.eq('child_id', query.child_id);
    } else if (query.child_ids) {
      const ids = query.child_ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) q = q.in('child_id', ids);
    }
    if (query.record_date) {
      q = q.eq('record_date', query.record_date);
    }
    // 教师只返回自己创建的记录，admin/superadmin 返回全部
    if (role?.role_type === 'teacher') {
      q = q.eq('teacher_id', query.role_id);
    }
    q = q
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await q;
    if (error) return { error: true, code: 500, msg: `查询失败: ${error.message}` };

    const records = data || [];
    const teacherNames = await this.getTeacherNames(records);
    const childNames = await this.getChildNames(records);

    const list = records.map((r) => ({
      ...r,
      teacher_name: teacherNames.get(r.teacher_id) || '',
      child_name: childNames.get(r.child_id) || '',
    }));

    return {
      list,
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count || 0) / pageSize),
    };
  }

  async findOne(id: string, roleId?: string) {
    const { data: record } = await this.client
      .from('growth_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!record) return { error: true, code: 404, msg: '记录不存在' };

    const role = await this.getRole(roleId || '');
    if (role?.role_type === 'teacher' && record.teacher_id !== roleId) {
      throw new HttpException(
        { code: 403, msg: '无权查看该记录', data: null },
        HttpStatus.FORBIDDEN,
      );
    }

    const teacherNames = await this.getTeacherNames([record]);
    const childNames = await this.getChildNames([record]);
    return {
      ...record,
      teacher_name: teacherNames.get(record.teacher_id) || '',
      child_name: childNames.get(record.child_id) || '',
    };
  }

  async update(
    id: string,
    dto: { title?: string; content?: string; photo_urls?: string[]; record_date?: string; course_name?: string },
    roleId?: string,
  ) {
    const { data: existing } = await this.client
      .from('growth_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return { error: true, code: 404, msg: '记录不存在' };

    const role = await this.getRole(roleId || '');
    const isOwner = existing.teacher_id === roleId;
    if (!isOwner && !this.isAdminRole(role?.role_type)) {
      throw new HttpException({ code: 403, msg: '无权编辑该记录', data: null }, HttpStatus.FORBIDDEN);
    }

    const updateData: Record<string, any> = {};
    updateData.parent_read_at = null;
    if (!isOwner && this.isAdminRole(role?.role_type)) {
      updateData.teacher_id = roleId;
    }
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.photo_urls !== undefined) updateData.photo_urls = dto.photo_urls;
    if (dto.record_date !== undefined) updateData.record_date = dto.record_date;
    if (dto.course_name !== undefined) updateData.course_name = dto.course_name;

    const { data: updated, error } = await this.client
      .from('growth_records')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) return { error: true, code: 500, msg: `更新失败: ${error.message}` };
    return updated;
  }

  async remove(id: string, roleId?: string) {
    const { data: existing } = await this.client
      .from('growth_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return { error: true, code: 404, msg: '记录不存在' };

    const role = await this.getRole(roleId || '');
    const isOwner = existing.teacher_id === roleId;
    // 放行条件：超级管理员；或教师本人删除自己发的当天记录
    // （record_date 为空时用 created_at 加 8 小时取前 10 位比较，上海时区口径）
    const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const recordDate = existing.record_date || (existing.created_at ? new Date(new Date(existing.created_at).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) : '');
    const isTeacherOwnerToday = role?.role_type === 'teacher' && isOwner && recordDate === todayStr;
    if (role?.role_type !== 'superadmin' && !isTeacherOwnerToday) {
      throw new HttpException({ code: 403, msg: '无权删除该记录：仅超级管理员或教师本人可删除当天记录', data: null }, HttpStatus.FORBIDDEN);
    }

    // 同步删除 Supabase Storage 中的图片，避免孤儿文件
    const paths = this.extractStoragePaths(existing.photo_urls || []);
    if (paths.length) {
      try {
        await this.client.storage.from('growth').remove(paths);
      } catch (e) {
        console.warn('[Growth] remove images error:', (e as Error)?.message);
      }
    }

    const { error } = await this.client.from('growth_records').delete().eq('id', id);
    if (error) return { error: true, code: 500, msg: `删除失败: ${error.message}` };
    return { id };
  }
}