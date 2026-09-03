import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { AuthzService } from '@/auth/authz.service';

@Injectable()
export class ParentService {
  constructor(private readonly authz: AuthzService) {}

  private get client() {
    return getSupabaseClient();
  }

  /** 获取当前家长（由 JWT 推导）绑定的所有幼儿 ID；agentChildId 为超管代理查看的幼儿 */
  private async getChildIds(userId: string, agentChildId?: string): Promise<string[]> {
    return this.authz.getParentChildIdsAsAgent(userId, agentChildId);
  }

  /** 上海时区当天日期 */
  private today() {
    return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  async getBabyStatus(userId: string, agentChildId?: string) {
    const childIds = await this.getChildIds(userId, agentChildId);
    if (!childIds.length) {
      return {
        child_id: null,
        child_name: null,
        attendance_status: null,
        check_in_time: null,
        check_out_time: null,
        latest_feedback: null,
      };
    }

    // 取绑定的第一个幼儿
    const childId = childIds[0];
    const { data: child } = await this.client
      .from('children')
      .select('name')
      .eq('id', childId)
      .maybeSingle();
    const childName = child?.name || null;

    // Get today's attendance（多课程/多班时当天可能有多条记录：入园取最早、离园取最晚）
    const { data: attendanceRows } = await this.client
      .from('attendance_records')
      .select('status, check_in_time, check_out_time')
      .eq('child_id', childId)
      .eq('record_date', this.today());
    const attendanceList = attendanceRows || [];
    const sortedIn = attendanceList
      .map(r => r.check_in_time)
      .filter(Boolean)
      .sort();
    const sortedOut = attendanceList
      .map(r => r.check_out_time)
      .filter(Boolean)
      .sort()
      .reverse();
    const attendance = attendanceList.length > 0
      ? {
          status: attendanceList.find(r => r.status && r.status !== 'absent')?.status || attendanceList[0].status,
          check_in_time: sortedIn[0] || null,
          check_out_time: sortedOut[0] || null,
        }
      : null;

    // Get latest feedback
    const { data: feedback } = await this.client
      .from('daily_feedbacks')
      .select('meal_status, sleep_status, mood_status')
      .eq('child_id', childId)
      .order('feedback_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      child_id: childId,
      child_name: childName,
      avatar_url: null,
      attendance_status: attendance?.status || 'absent',
      check_in_time: attendance?.check_in_time || null,
      check_out_time: attendance?.check_out_time || null,
      latest_feedback: feedback ? {
        meal_status: feedback.meal_status,
        sleep_status: feedback.sleep_status,
        mood_status: feedback.mood_status,
      } : null,
    };
  }

  async getFeedbacks(userId: string, feedbackDate?: string, agentChildId?: string) {
    // 默认查询今天的记录
    const date = feedbackDate || this.today();

    // 获取家长关联的所有幼儿
    const childIds = await this.getChildIds(userId, agentChildId);
    if (childIds.length === 0) {
      return [];
    }

    // 从数据库查询反馈记录
    const { data, error } = await this.client
      .from('daily_feedbacks')
      .select(`
        id, child_id, feedback_date, meal_status, sleep_status, mood_status,
        activities, notes, class_id, course_id, course_name, group_id, teacher_id
      `)
      .in('child_id', childIds)
      .eq('feedback_date', date)
      .order('feedback_date', { ascending: false });

    if (error) {
      console.error('[ParentService] getFeedbacks error:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // 获取幼儿名称
    const { data: children } = await this.client
      .from('children')
      .select('id, name')
      .in('id', childIds);
    const childNameMap = new Map(children?.map(c => [c.id, c.name]) || []);

    // 获取班级名称
    const allClassIds = new Set<string>();
    data.forEach(f => {
      if (f.class_id) {
        allClassIds.add(f.class_id);
      } else if (f.group_id && f.group_id.includes('__')) {
        allClassIds.add(f.group_id.split('__')[0]);
      }
    });
    const { data: classes } = await this.client
      .from('classes')
      .select('id, name')
      .in('id', [...allClassIds]);
    const classMap = new Map(classes?.map(c => [c.id, c.name]) || []);

    // 获取教师名称
    const teacherIds = [...new Set(data.map(f => f.teacher_id).filter(Boolean))];
    let teacherMap = new Map<string, string>();
    if (teacherIds.length > 0) {
      const { data: teachers } = await this.client
        .from('user_roles')
        .select('id, real_name')
        .in('id', teacherIds);
      teacherMap = new Map(teachers?.map(t => [t.id, t.real_name]) || []);
    }

    return data.map(f => {
      // 如果 class_id 为空，尝试从 group_id 提取
      let resolvedClassId = f.class_id;
      if (!resolvedClassId && f.group_id && f.group_id.includes('__')) {
        resolvedClassId = f.group_id.split('__')[0];
      }
      return {
        id: f.id,
        child_id: f.child_id,
        child_name: childNameMap.get(f.child_id) || '幼儿',
        class_name: resolvedClassId ? (classMap.get(resolvedClassId) || '') : '',
        course_name: f.course_name || '',
        feedback_date: f.feedback_date,
        meal_status: f.meal_status,
        sleep_status: f.sleep_status,
        mood_status: f.mood_status,
        activities: f.activities,
        notes: f.notes,
        teacher_name: f.teacher_id ? (teacherMap.get(f.teacher_id) || '老师') : '老师',
      };
    });
  }

  async getDailyFeedbacks(userId: string, childId: string, feedbackDate: string, agentChildId?: string) {
    const childIds = await this.getChildIds(userId, agentChildId);
    if (!childIds.length) return [];
    if (!childId || !feedbackDate) return [];
    if (!childIds.includes(childId)) {
      return { error: true, code: 403, msg: '无权查看' };
    }

    const { data, error } = await this.client
      .from('daily_feedbacks')
      .select('id, feedback_date, meal_status, sleep_status, mood_status, class_id, course_id, course_name, group_id')
      .eq('child_id', childId)
      .eq('feedback_date', feedbackDate);

    if (error) {
      console.error('[ParentService] getDailyFeedbacks error:', error);
      return [];
    }
    if (!data || data.length === 0) return [];

    // 补齐 class_id：如果 class_id 为空，尝试从 group_id 提取（格式: {class_id}__{course_type}）
    const allClassIds = new Set<string>();
    for (const f of data) {
      let cid = f.class_id;
      if (!cid && f.group_id) {
        const parts = f.group_id.split('__');
        if (parts.length >= 2) cid = parts[0];
      }
      if (cid) allClassIds.add(cid);
    }

    const classMap: Record<string, string> = {};
    if (allClassIds.size > 0) {
      const { data: classes } = await this.client
        .from('classes')
        .select('id, name')
        .in('id', [...allClassIds]);
      if (classes) {
        classes.forEach(c => { classMap[c.id] = c.name; });
      }
    }

    return data.map(f => {
      let cid = f.class_id;
      if (!cid && f.group_id) {
        const parts = f.group_id.split('__');
        if (parts.length >= 2) cid = parts[0];
      }
      return {
        id: f.id,
        feedback_date: f.feedback_date,
        meal_status: f.meal_status,
        sleep_status: f.sleep_status,
        mood_status: f.mood_status,
        class_id: f.class_id,
        course_id: f.course_id,
        course_name: f.course_name,
        course_type: f.group_id ? (f.group_id.split('__')[1] || '') : '',
        class_name: cid ? (classMap[cid] || null) : null,
      };
    });
  }

  async getAttendance(userId: string, courseType?: string, agentChildId?: string, childId?: string) {
    // 查询当前家长绑定的在读幼儿
    const childIds = await this.getChildIds(userId, agentChildId);
    if (!childIds.length) return [];

    let query = this.client
      .from('attendance_records')
      .select('id, record_date, status, check_in_time, check_out_time, notes, course_type')
      .in('child_id', childIds)
      .order('record_date', { ascending: false });

    // 指定幼儿时精确过滤（校验归属，超管代理/家长切换幼儿均生效）
    if (childId && childIds.includes(childId)) {
      query = query.eq('child_id', childId);
    }

    if (courseType) {
      query = query.eq('course_type', courseType);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[ParentService] getAttendance error:', error);
      return [];
    }

    return (data || []).map(r => ({
      id: r.id,
      record_date: r.record_date,
      status: r.status,
      check_in_time: r.check_in_time,
      check_out_time: r.check_out_time,
      notes: r.notes,
      course_type: r.course_type,
    }));
  }

  async getGrowthRecords(userId: string, childId?: string, agentChildId?: string) {
    // 查询当前家长绑定的在读幼儿
    const childIds = await this.getChildIds(userId, agentChildId);
    if (!childIds.length) return [];

    // 指定幼儿时校验归属
    if (childId && !childIds.includes(childId)) {
      return { error: true, code: 403, msg: '无权查看' };
    }
    const targetChildIds = childId ? [childId] : childIds;

    const { data: records, error } = await this.client
      .from('growth_records')
      .select('*')
      .in('child_id', targetChildIds)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询失败: ${error.message}`);

    const list = records || [];

    // 反查 teacher_name（teachers.nickname → users.nickname → user_roles.real_name）
    const teacherIds = [...new Set(list.map((r) => r.teacher_id).filter(Boolean))];
    const roleMap = new Map<string, any>();
    const nickMap = new Map<string, string>();
    const teacherNickMap = new Map<string, string>();
    const realNameNickMap = new Map<string, string>();
    if (teacherIds.length) {
      const { data: roles } = await this.client
        .from('user_roles')
        .select('id, real_name, user_id')
        .in('id', teacherIds);
      (roles || []).forEach((r) => roleMap.set(r.id, r));
      const userIds = [...new Set((roles || []).map((r) => r.user_id).filter(Boolean))];
      if (userIds.length) {
        const { data: users } = await this.client
          .from('users')
          .select('id, nickname')
          .in('id', userIds);
        (users || []).forEach((u) => nickMap.set(u.id, u.nickname || ''));

        const { data: teacherRows } = await this.client
          .from('teachers')
          .select('user_id, nickname')
          .in('user_id', userIds);
        (teacherRows || []).forEach((t) => {
          if (t.user_id && t.nickname) teacherNickMap.set(t.user_id, t.nickname);
        });
      }
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
    }

    return list.map((r) => {
      const role = roleMap.get(r.teacher_id);
      let teacherName = role?.user_id
        ? teacherNickMap.get(role.user_id) || nickMap.get(role.user_id) || ''
        : '';
      if (!teacherName && role?.real_name) teacherName = realNameNickMap.get(role.real_name) || '';
      if (!teacherName) teacherName = role?.real_name || '';
      return {
        id: r.id,
        record_type: r.record_type,
        title: r.title,
        content: r.content,
        photo_urls: r.photo_urls,
        created_at: r.created_at,
        teacher_name: teacherName,
        course_name: r.course_name,
        parent_read_at: r.parent_read_at,
      };
    });
  }

  async markGrowthRead(userId: string, agentChildId?: string) {
    const childIds = await this.getChildIds(userId, agentChildId);
    if (!childIds.length) return { updated: 0 };

    const { data, error } = await this.client
      .from('growth_records')
      .update({ parent_read_at: new Date().toISOString() })
      .in('child_id', childIds)
      .is('parent_read_at', null)
      .select('id');
    if (error) throw new Error(`标记已读失败: ${error.message}`);
    return { updated: (data || []).length };
  }

  async getGrowthUnreadCount(userId: string, agentChildId?: string) {
    const childIds = await this.getChildIds(userId, agentChildId);
    if (!childIds.length) return 0;

    const { count, error } = await this.client
      .from('growth_records')
      .select('id', { count: 'exact', head: true })
      .in('child_id', childIds)
      .is('parent_read_at', null);
    if (error) throw new Error(`未读统计失败: ${error.message}`);
    return count || 0;
  }

  // 按幼儿分组统计未读成长记录数（child_id -> count 映射），供家长端首页角标
  async getGrowthUnreadCounts(userId: string, agentChildId?: string) {
    const childIds = await this.getChildIds(userId, agentChildId);
    if (!childIds.length) return {};

    const { data, error } = await this.client
      .from('growth_records')
      .select('child_id')
      .in('child_id', childIds)
      .is('parent_read_at', null);
    if (error) {
      console.error('[ParentService] getGrowthUnreadCounts error:', error.message);
      return {};
    }
    const counts: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      const key = r.child_id as string;
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  async searchChildren(userId: string, keyword: string) {
    if (!userId) return [];
    if (!keyword || keyword.trim().length < 1) {
      return [];
    }
    // 从 children 表中模糊搜索幼儿姓名（仅返回基础字段，不含出生日期/过敏信息）
    const { data, error } = await this.client
      .from('children')
      .select('id, name, gender')
      .ilike('name', `%${keyword.trim()}%`)
      .limit(20);

    if (error) throw new Error(`搜索失败: ${error.message}`);
    return data || [];
  }

  // 查询单个幼儿的可回填资料（绑定表单用）
  async getChildProfile(userId: string, childId: string) {
    // 越权校验：绑定家长 或 存在 pending 绑定申请（幼儿选择场景）才可查看
    const childIds = await this.getChildIds(userId);
    if (!childIds.includes(childId)) {
      const parentRole = (await this.authz.getUserRoles(userId)).find(r => r.role_type === 'parent');
      let pendingAllowed = false;
      if (parentRole) {
        const { data: pending } = await this.client
          .from('binding_requests')
          .select('id')
          .eq('parent_role_id', parentRole.id)
          .eq('child_id', childId)
          .eq('status', 'pending')
          .maybeSingle();
        pendingAllowed = !!pending;
      }
      if (!pendingAllowed) {
        return { error: true, code: 403, msg: '无权查看该幼儿资料' };
      }
    }

    const { data, error } = await this.client
      .from('children')
      .select('id, name, nickname, gender, birth_date, allergies, parent_phone')
      .eq('id', childId)
      .maybeSingle();
    if (error) return { code: 500, msg: `查询幼儿资料失败: ${error.message}` };
    if (!data) return { code: 404, msg: '幼儿不存在' };
    return { code: 200, msg: 'success', data };
  }

  async submitBindingRequest(userId: string, data: {
    child_id?: string;
    relationship?: string;
    custom_relationship?: string;
    nickname?: string;
    gender?: string;
    birth_date?: string;
    allergies?: string;
    parent_phone?: string;
  }) {
    // 家长角色由服务端 JWT 推导
    const parentRole = (await this.authz.getUserRoles(userId)).find(r => r.role_type === 'parent');
    if (!parentRole) {
      return { error: true, code: 403, msg: '无家长角色' };
    }

    // child_id 必传，幼儿必须已存在（不再支持按姓名查找/创建）
    if (!data.child_id) {
      return { error: true, code: 400, msg: '请先搜索选择幼儿' };
    }

    const { data: child } = await this.client
      .from('children')
      .select('id, name')
      .eq('id', data.child_id)
      .maybeSingle();

    if (!child) {
      return { error: true, code: 400, msg: '幼儿不存在，请联系园方' };
    }

    // 防重复检查：查询是否已存在相同 parent_role_id + child_id 的记录
    const { data: existingRequests } = await this.client
      .from('binding_requests')
      .select('id, status')
      .eq('parent_role_id', parentRole.id)
      .eq('child_id', child.id);

    if (existingRequests && existingRequests.length > 0) {
      const pendingReq = existingRequests.find(r => r.status === 'pending');
      if (pendingReq) {
        return { error: true, code: 400, msg: '您已提交过绑定申请，请等待审核' };
      }
      const approvedReq = existingRequests.find(r => r.status === 'approved');
      if (approvedReq) {
        return { error: true, code: 400, msg: '您已绑定该幼儿' };
      }
    }

    // 插入绑定请求（仅写 schema 中存在的字段）
    const { data: result, error } = await this.client
      .from('binding_requests')
      .insert({
        parent_role_id: parentRole.id,
        child_id: child.id,
        child_name: child.name,
        relationship: data.relationship,
        custom_relationship: data.custom_relationship || null,
        nickname: data.nickname || null,
        gender: data.gender || null,
        birth_date: data.birth_date || null,
        allergies: data.allergies || null,
        parent_phone: data.parent_phone || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(`提交绑定申请失败: ${error.message}`);
    return result;
  }

  async getChildById(userId: string, childId: string, agentChildId?: string) {
    const childIds = await this.getChildIds(userId, agentChildId);
    if (!childIds.includes(childId)) {
      return { error: true, code: 403, msg: '无权查看该幼儿' };
    }

    // 查询 parent_child_relations 获取关联信息（限定当前家长自己的关系行，避免同幼儿多家长时 maybeSingle 报错）
    const roles = await this.authz.getUserRoles(userId);
    const isAgent = !!agentChildId && roles.some(r => r.role_type === 'superadmin');
    // 超管代理模式：无真实绑定关系，构造虚拟关系行以返回完整详情
    const relation = isAgent
      ? { id: `agent_${childId}`, child_id: childId, relationship: 'other', custom_relationship: null, status: 'active' }
      : await (async () => {
          const parentRole = roles.find(r => r.role_type === 'parent');
          if (!parentRole) return null;
          const { data, error: relError } = await this.client
            .from('parent_child_relations')
            .select('id, child_id, relationship, custom_relationship, status')
            .eq('child_id', childId)
            .eq('parent_role_id', parentRole.id)
            .eq('status', 'active')
            .maybeSingle();
          if (relError) throw new Error(`查询关联信息失败: ${relError.message}`);
          return data;
        })();

    if (!relation) return null;

    // 查询 children 表获取幼儿信息
    const { data: child, error: childError } = await this.client
      .from('children')
      .select('id, name, gender, birth_date, allergies, status, class_id')
      .eq('id', childId)
      .maybeSingle();

    if (childError) throw new Error(`查询幼儿信息失败: ${childError.message}`);
    if (!child) return null;

    // 查询班级信息
    let className = null;
    let room = null;
    if (child.class_id) {
      const { data: classInfo } = await this.client
        .from('classes')
        .select('name, room')
        .eq('id', child.class_id)
        .maybeSingle();
      if (classInfo) {
        className = classInfo.name;
        room = classInfo.room;
      }
    }

    return {
      id: relation.id,
      child_id: child.id,
      child_name: child.name,
      relationship: relation.relationship,
      custom_relationship: relation.custom_relationship,
      status: child.status,
      gender: child.gender,
      birth_date: child.birth_date,
      allergies: child.allergies,
      class_name: className,
      room: room,
    };
  }

  async updateChild(userId: string, childId: string, data: {
    name?: string;
    gender?: string;
    birth_date?: string;
    allergies?: string;
    relationship?: string;
    custom_relationship?: string;
  }) {
    const childIds = await this.getChildIds(userId);
    if (!childIds.includes(childId)) {
      return { error: true, code: 403, msg: '无权编辑该幼儿' };
    }

    // 更新 children 表（仅白名单字段）
    const childUpdate: Record<string, string> = {};
    if (data.name !== undefined) childUpdate.name = data.name;
    if (data.gender !== undefined) childUpdate.gender = data.gender;
    if (data.birth_date !== undefined) childUpdate.birth_date = data.birth_date;
    if (data.allergies !== undefined) childUpdate.allergies = data.allergies;

    if (Object.keys(childUpdate).length > 0) {
      const { error: childError } = await this.client
        .from('children')
        .update(childUpdate)
        .eq('id', childId);
      if (childError) throw new Error(`更新幼儿信息失败: ${childError.message}`);
    }

    // 更新 parent_child_relations 表（限定为当前家长自己的关联记录）
    const relationUpdate: Record<string, string | null> = {};
    if (data.relationship !== undefined) relationUpdate.relationship = data.relationship;
    if (data.custom_relationship !== undefined) relationUpdate.custom_relationship = data.custom_relationship;

    if (Object.keys(relationUpdate).length > 0) {
      const parentRole = (await this.authz.getUserRoles(userId)).find(r => r.role_type === 'parent');
      if (parentRole) {
        const { error: relError } = await this.client
          .from('parent_child_relations')
          .update(relationUpdate)
          .eq('child_id', childId)
          .eq('parent_role_id', parentRole.id);
        if (relError) throw new Error(`更新关联信息失败: ${relError.message}`);
      }
    }

    return { success: true };
  }
}
