import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class ParentService {
  private get client() {
    return getSupabaseClient();
  }

  async getBabyStatus(parentRoleId?: string) {
    // Get the first child for this parent
    let childId: string | null = null;
    let childName = '演示宝宝';

    if (parentRoleId) {
      const { data: relation } = await this.client
        .from('parent_child_relations')
        .select('child_id')
        .eq('parent_role_id', parentRoleId)
        .eq('status', 'active')
        .maybeSingle();

      if (relation) {
        childId = relation.child_id;
        const { data: child } = await this.client
          .from('children')
          .select('name')
          .eq('id', childId)
          .maybeSingle();
        if (child) childName = child.name;
      }
    }

    // If no child found, use demo data
    if (!childId) {
      return {
        child_id: 'demo',
        child_name: childName,
        avatar_url: null,
        attendance_status: 'present',
        check_in_time: new Date().setHours(8, 30, 0, 0).toString(),
        check_out_time: null,
        latest_feedback: {
          meal_status: 'good',
          sleep_status: 'good',
          mood_status: 'happy',
        },
      };
    }

    // Get today's attendance
    const today = new Date().toISOString().split('T')[0];
    const { data: attendance } = await this.client
      .from('attendance_records')
      .select('status, check_in_time, check_out_time')
      .eq('child_id', childId)
      .eq('record_date', today)
      .maybeSingle();

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

  async getFeedbacks(parentRoleId?: string, feedbackDate?: string) {
    // 默认查询今天的记录
    const today = new Date().toISOString().split('T')[0];
    const date = feedbackDate || today;

    // 获取家长关联的所有幼儿
    let childIds: string[] = [];
    if (parentRoleId) {
      const { data: relations } = await this.client
        .from('parent_child_relations')
        .select('child_id')
        .eq('parent_role_id', parentRoleId)
        .eq('status', 'active');
      if (relations && relations.length > 0) {
        childIds = relations.map(r => r.child_id);
      }
    }

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

  async getDailyFeedbacks(childId: string, feedbackDate: string) {
    if (!childId || !feedbackDate) return [];

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
        class_name: cid ? (classMap[cid] || null) : null,
      };
    });
  }

  async getAttendance(parentRoleId?: string) {
    // Demo data
    const records: Array<{
      id: string;
      record_date: string;
      status: string;
      check_in_time: string | null;
      check_out_time: string | null;
      notes: string | null;
    }> = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() - i * 86400000);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      records.push({
        id: `att_${i}`,
        record_date: date.toISOString().split('T')[0],
        status: isWeekend ? 'leave' : 'present',
        check_in_time: isWeekend ? null : new Date(date.setHours(8, 30, 0, 0)).toISOString(),
        check_out_time: isWeekend ? null : new Date(date.setHours(17, 0, 0, 0)).toISOString(),
        notes: isWeekend ? '周末' : null,
      });
    }
    return records;
  }

  async getGrowthRecords(parentRoleId?: string) {
    if (!parentRoleId) return [];

    // 查询当前家长绑定的在读幼儿
    const { data: relations } = await this.client
      .from('parent_child_relations')
      .select('child_id')
      .eq('parent_role_id', parentRoleId)
      .eq('status', 'active');
    const childIds = [...new Set((relations || []).map((r) => r.child_id).filter(Boolean))];
    if (!childIds.length) return [];

    const { data: records, error } = await this.client
      .from('growth_records')
      .select('*')
      .in('child_id', childIds)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询失败: ${error.message}`);

    const list = records || [];

    // 反查 teacher_name（user_roles.real_name，空则 users.nickname）
    const teacherIds = [...new Set(list.map((r) => r.teacher_id).filter(Boolean))];
    const roleMap = new Map<string, any>();
    const nickMap = new Map<string, string>();
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
      }
    }

    return list.map((r) => {
      const role = roleMap.get(r.teacher_id);
      let teacherName = role?.user_id ? nickMap.get(role.user_id) || '' : '';
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

  async markGrowthRead(parentRoleId?: string) {
    if (!parentRoleId) return { updated: 0 };

    const { data: relations } = await this.client
      .from('parent_child_relations')
      .select('child_id')
      .eq('parent_role_id', parentRoleId)
      .eq('status', 'active');
    const childIds = [...new Set((relations || []).map((r) => r.child_id).filter(Boolean))];
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

  async getGrowthUnreadCount(parentRoleId?: string) {
    if (!parentRoleId) return 0;

    const { data: relations } = await this.client
      .from('parent_child_relations')
      .select('child_id')
      .eq('parent_role_id', parentRoleId)
      .eq('status', 'active');
    const childIds = [...new Set((relations || []).map((r) => r.child_id).filter(Boolean))];
    if (!childIds.length) return 0;

    const { count, error } = await this.client
      .from('growth_records')
      .select('id', { count: 'exact', head: true })
      .in('child_id', childIds)
      .is('parent_read_at', null);
    if (error) throw new Error(`未读统计失败: ${error.message}`);
    return count || 0;
  }

  async searchChildren(keyword: string) {
    if (!keyword || keyword.trim().length < 1) {
      return [];
    }
    // 从 children 表中模糊搜索幼儿姓名
    const { data, error } = await this.client
      .from('children')
      .select('id, name, gender, birth_date, allergies')
      .ilike('name', `%${keyword.trim()}%`)
      .limit(20);

    if (error) throw new Error(`搜索失败: ${error.message}`);
    return data || [];
  }

  async submitBindingRequest(data: {
    user_id?: string;
    parent_role_id: string;
    child_name: string;
    child_id?: string;
    relationship: string;
    custom_relationship?: string;
    nickname?: string;
    gender?: string;
    birth_date?: string;
    allergies?: string;
  }) {
    // 如果传了 child_id，直接使用；否则先在 children 表中查找或创建
    let childId = data.child_id;

    if (!childId) {
      // 先查找是否已存在同名幼儿
      const { data: existingChildren } = await this.client
        .from('children')
        .select('id')
        .eq('name', data.child_name)
        .limit(1);

      if (existingChildren && existingChildren.length > 0) {
        childId = existingChildren[0].id;
      } else {
        // 创建新的幼儿档案
        const { data: newChild, error: childError } = await this.client
          .from('children')
          .insert({
            name: data.child_name,
            nickname: data.nickname || null,
            gender: data.gender || 'unknown',
            birth_date: data.birth_date || null,
          })
          .select('id')
          .single();

        if (childError) throw new Error(`创建幼儿档案失败: ${childError.message}`);
        childId = newChild.id;
      }
    }

    // 防重复检查：查询是否已存在相同 parent_role_id + child_id 的记录
    const { data: existingRequests } = await this.client
      .from('binding_requests')
      .select('id, status')
      .eq('parent_role_id', data.parent_role_id)
      .eq('child_id', childId);

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

    // 插入绑定请求，确保 child_id 有值
    const { data: result, error } = await this.client
      .from('binding_requests')
      .insert({
        parent_role_id: data.parent_role_id,
        child_id: childId,
        child_name: data.child_name,
        relationship: data.relationship,
        custom_relationship: data.custom_relationship || null,
        nickname: data.nickname || null,
        allergies: data.allergies || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(`提交绑定申请失败: ${error.message}`);
    return result;
  }

  async getChildById(childId: string) {
    // 查询 parent_child_relations 获取关联信息
    const { data: relation, error: relError } = await this.client
      .from('parent_child_relations')
      .select('id, child_id, relationship, custom_relationship, status')
      .eq('child_id', childId)
      .eq('status', 'active')
      .maybeSingle();

    if (relError) throw new Error(`查询关联信息失败: ${relError.message}`);
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

  async updateChild(childId: string, data: {
    name?: string;
    gender?: string;
    birth_date?: string;
    allergies?: string;
    relationship?: string;
    custom_relationship?: string;
  }) {
    // 更新 children 表
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

    // 更新 parent_child_relations 表
    const relationUpdate: Record<string, string | null> = {};
    if (data.relationship !== undefined) relationUpdate.relationship = data.relationship;
    if (data.custom_relationship !== undefined) relationUpdate.custom_relationship = data.custom_relationship;

    if (Object.keys(relationUpdate).length > 0) {
      const { error: relError } = await this.client
        .from('parent_child_relations')
        .update(relationUpdate)
        .eq('child_id', childId);
      if (relError) throw new Error(`更新关联信息失败: ${relError.message}`);
    }

    return { success: true };
  }
}
