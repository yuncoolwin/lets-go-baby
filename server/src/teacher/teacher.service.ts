import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class TeacherService {
  private get client() {
    return getSupabaseClient();
  }

  async getClassOverview(teacherRoleId?: string) {
    // Demo data
    return [
      {
        id: 'class_1',
        name: '向日葵班',
        student_count: 15,
        today_attendance: 13,
      },
      {
        id: 'class_2',
        name: '小星星班',
        student_count: 12,
        today_attendance: 11,
      },
    ];
  }

  async getClassStudents(classId: string) {
    // Demo data
    return [
      { id: 's1', name: '张小明', gender: 'male', status: 'present' },
      { id: 's2', name: '李小红', gender: 'female', status: 'present' },
      { id: 's3', name: '王小刚', gender: 'male', status: 'present' },
      { id: 's4', name: '赵小美', gender: 'female', status: 'present' },
      { id: 's5', name: '刘小强', gender: 'male', status: 'present' },
      { id: 's6', name: '陈小丽', gender: 'female', status: 'present' },
    ];
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
}
