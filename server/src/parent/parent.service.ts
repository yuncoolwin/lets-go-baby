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
    // Demo data when no real data
    return [
      {
        id: '1',
        child_name: '演示宝宝',
        feedback_date: new Date().toISOString().split('T')[0],
        meal_status: 'good',
        sleep_status: 'good',
        mood_status: 'happy',
        activities: '上午进行了户外游戏，下午做了手工绘画',
        notes: '今天表现很棒，和小朋友们相处融洽',
        teacher_name: '王老师',
      },
      {
        id: '2',
        child_name: '演示宝宝',
        feedback_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        meal_status: 'normal',
        sleep_status: 'good',
        mood_status: 'normal',
        activities: '学习了新的儿歌，参与了团体游戏',
        notes: '午饭吃得稍少，下午加了一点心',
        teacher_name: '李老师',
      },
    ];
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

  async submitBindingRequest(data: {
    parent_role_id: string;
    child_name: string;
    relationship: string;
  }) {
    const { data: result, error } = await this.client
      .from('binding_requests')
      .insert({
        parent_role_id: data.parent_role_id,
        child_name: data.child_name,
        relationship: data.relationship,
      })
      .select()
      .single();

    if (error) throw new Error(`提交绑定申请失败: ${error.message}`);
    return result;
  }
}
