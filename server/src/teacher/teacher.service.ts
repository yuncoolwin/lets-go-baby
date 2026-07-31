import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class TeacherService {
  private get client() {
    return getSupabaseClient();
  }

  async getClassOverview(teacherRoleId?: string) {
    // 查询所有活跃班级及其学生数量
    const { data: classes, error: classError } = await this.client
      .from('classes')
      .select('id, name, level')
      .eq('status', 'active')
      .order('id');

    if (classError) throw new Error(`查询班级失败: ${classError.message}`);
    if (!classes || classes.length === 0) return [];

    // 查询各班级的在读幼儿数量
    const { data: children, error: childError } = await this.client
      .from('children')
      .select('id, class_id')
      .eq('status', 'active');

    if (childError) throw new Error(`查询幼儿失败: ${childError.message}`);

    // 按班级统计幼儿数量
    const countMap: Record<string, number> = {};
    children?.forEach((c) => {
      if (c.class_id) {
        countMap[c.class_id] = (countMap[c.class_id] || 0) + 1;
      }
    });

    return classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      student_count: countMap[cls.id] || 0,
      today_attendance: countMap[cls.id] || 0, // TODO: 后续接入考勤系统后改为真实出勤数
    }));
  }

  async getClassStudents(classId: string) {
    // 查询指定班级的在读幼儿
    const { data, error } = await this.client
      .from('children')
      .select('id, name, gender')
      .eq('class_id', classId)
      .eq('status', 'active');

    if (error) throw new Error(`查询幼儿失败: ${error.message}`);
    if (!data) return [];

    return data.map((c) => ({
      id: c.id,
      name: c.name,
      gender: c.gender || 'unknown',
      status: 'present',
    }));
  }

  async getFeedbacks(teacherRoleId?: string) {
    return [
      {
        id: '1',
        child_name: '张小明',
        feedback_date: new Date().toISOString().split('T')[0],
        meal_status: 'good',
        sleep_status: 'good',
        mood_status: 'happy',
        activities: '户外游戏、手工绘画',
        notes: '表现优秀',
        teacher_name: '王老师',
      },
    ];
  }

  async submitAttendance(data: {
    records: Array<{ child_id: string; class_id: string; status: string }>;
    teacher_role_id?: string;
  }) {
    const today = new Date().toISOString().split('T')[0];
    const insertData = data.records.map((r) => ({
      child_id: r.child_id,
      class_id: r.class_id,
      record_date: today,
      status: r.status,
      check_in_time: r.status === 'present' ? new Date().toISOString() : null,
    }));

    if (insertData.length > 0) {
      const { error } = await this.client
        .from('attendance_records')
        .insert(insertData);

      if (error) throw new Error(`提交考勤失败: ${error.message}`);
    }

    return { success: true, count: insertData.length };
  }

  async submitFeedback(data: {
    child_id: string;
    teacher_role_id?: string;
    meal_status: string;
    sleep_status: string;
    mood_status: string;
    activities?: string;
    notes?: string;
  }) {
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await this.client
      .from('daily_feedbacks')
      .insert({
        child_id: data.child_id,
        teacher_role_id: data.teacher_role_id || null,
        feedback_date: today,
        meal_status: data.meal_status,
        sleep_status: data.sleep_status,
        mood_status: data.mood_status,
        activities: data.activities || null,
        notes: data.notes || null,
      });

    if (error) throw new Error(`提交反馈失败: ${error.message}`);

    return { success: true };
  }
}
