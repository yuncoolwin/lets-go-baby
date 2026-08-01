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
        .eq('status', 'approved')
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

  async getFeedbacks(parentRoleId?: string) {
    // 获取家长关联的幼儿
    let childId: string | null = null;
    if (parentRoleId) {
      const { data: relation } = await this.client
        .from('child_parent_relations')
        .select('child_id')
        .eq('parent_id', parentRoleId)
        .maybeSingle();
      if (relation) {
        childId = relation.child_id;
      }
    }

    if (!childId) {
      // 没有关联幼儿，返回空
      return [];
    }

    // 从数据库查询该幼儿的反馈记录
    const { data, error } = await this.client
      .from('daily_feedbacks')
      .select(`
        id,
        feedback_date,
        meal_status,
        sleep_status,
        mood_status,
        activities,
        notes,
        teacher_id
      `)
      .eq('child_id', childId)
      .order('feedback_date', { ascending: false })
      .limit(30);

    if (error) {
      console.error('[ParentService] getFeedbacks error:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // 获取教师名称
    const teacherIds = [...new Set(data.map(f => f.teacher_id).filter(Boolean))];
    if (teacherIds.length > 0) {
      const { data: teachers } = await this.client
        .from('user_roles')
        .select('id, real_name')
        .in('id', teacherIds);
      var teacherMap = new Map(teachers?.map(t => [t.id, t.real_name]) || []);
    }

    // 获取幼儿名称
    const { data: child } = await this.client
      .from('children')
      .select('name')
      .eq('id', childId)
      .maybeSingle();

    return data.map(f => ({
      id: f.id,
      child_name: child?.name || '幼儿',
      feedback_date: f.feedback_date,
      meal_status: f.meal_status,
      sleep_status: f.sleep_status,
      mood_status: f.mood_status,
      activities: f.activities,
      notes: f.notes,
      teacher_name: f.teacher_id ? (teacherMap?.get(f.teacher_id) || '老师') : '老师',
    }));
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
    return [
      {
        id: '1',
        record_type: 'milestone',
        title: '第一次独立完成拼图',
        content: '今天宝宝第一次独立完成了20块的拼图，展现了很好的专注力和动手能力',
        photo_urls: null,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        teacher_name: '王老师',
      },
      {
        id: '2',
        record_type: 'photo',
        title: '户外活动精彩瞬间',
        content: '今天天气很好，带小朋友们去户外做了游戏',
        photo_urls: null,
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        teacher_name: '李老师',
      },
    ];
  }

  async searchChildren(keyword: string) {
    if (!keyword || keyword.trim().length < 1) {
      return [];
    }
    // 从 children 表中模糊搜索幼儿姓名
    const { data, error } = await this.client
      .from('children')
      .select('id, name, gender, birth_date')
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
            gender: 'unknown',
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
      .eq('status', 'approved')
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
