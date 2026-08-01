import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class TeacherService {
  private get client() {
    return getSupabaseClient();
  }

  async getMe(teacherRoleId?: string) {
    // teacherRoleId 即 teachers.id，先查 teachers 表
    const { data: teacher, error: teacherError } = teacherRoleId
      ? await this.client
          .from('teachers')
          .select('*')
          .eq('id', teacherRoleId)
          .eq('status', 'active')
          .single()
      : { data: null, error: null };
    
    // 若 teachers 表无记录，降级查 user_roles
    const { data: role } = !teacher && teacherRoleId
      ? await this.client
          .from('user_roles')
          .select('*')
          .eq('id', teacherRoleId)
          .eq('role_type', 'teacher')
          .single()
      : { data: null };

    if (!teacher && !role) return null;

    const classId = teacher?.class_id || null;
    
    // 查询班级名称
    let className = null;
    if (classId) {
      const { data: cls } = await this.client
        .from('classes')
        .select('name')
        .eq('id', classId)
        .single();
      className = cls?.name || null;
    }
    
    // 查询该班级的在读幼儿数量
    let studentCount = 0;
    if (classId) {
      const { count } = await this.client
        .from('children')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('status', 'active');
      studentCount = count || 0;
    }

    // 查询当天该班级的考勤人数
    let todayAttendance = 0;
    if (classId) {
      // 使用 UTC 日期
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const tomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const today = todayUTC.toISOString().split('T')[0];
      const tomorrowStr = tomorrowUTC.toISOString().split('T')[0];
      const { count: attCount } = await this.client
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .gte('date', today)
        .lt('date', tomorrowStr);
      todayAttendance = attCount || 0;
    }

    return {
      ...(role || {}),
      id: teacher?.id || role?.id,
      real_name: teacher?.nickname || teacher?.real_name || role?.real_name,
      class_id: classId,
      class_name: className,
      title: teacher?.title || role?.title || null,
      student_count: studentCount,
      today_attendance: todayAttendance,
      teacher: teacher || null,
    };
  }

  async getClassOverview(teacherRoleId?: string) {
    // 获取当前教师的班级ID
    let teacherClassId: string | null = null;
    
    if (teacherRoleId) {
      const teacherData = await this.getMe(teacherRoleId);
      teacherClassId = teacherData?.class_id || null;
    }

    if (!teacherClassId) return [];

    // 查询该教师所在的班级
    const { data: cls, error: classError } = await this.client
      .from('classes')
      .select('id, name, level')
      .eq('id', teacherClassId)
      .eq('status', 'active')
      .single();

    if (classError || !cls) return [];

    // 查询该班级的在读幼儿数量
    const { data: children, error: childError } = await this.client
      .from('children')
      .select('id')
      .eq('class_id', teacherClassId)
      .eq('status', 'active');

    if (childError) throw new Error(`查询幼儿失败: ${childError.message}`);

    const studentCount = children?.length || 0;

    // 查询当天该班级的考勤人数
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const today = todayUTC.toISOString().split('T')[0];
    const tomorrowStr = tomorrowUTC.toISOString().split('T')[0];
    const { data: attendance, error: attError } = await this.client
      .from('attendance')
      .select('id')
      .eq('class_id', teacherClassId)
      .gte('date', today)
      .lt('date', tomorrowStr);

    if (attError) {
      console.error('查询考勤失败:', attError);
    }

    const todayAttendance = attendance?.length || 0;

    return [{
      id: cls.id,
      name: cls.name,
      student_count: studentCount,
      today_attendance: todayAttendance,
    }];
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
    // 从数据库查询真实记录
    const { data, error } = await this.client
      .from('daily_feedbacks')
      .select(`
        id,
        child_id,
        feedback_date,
        meal_status,
        sleep_status,
        mood_status,
        activities,
        notes,
        teacher_id
      `)
      .order('feedback_date', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[TeacherService] getFeedbacks error:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // 获取幼儿名称
    const childIds = [...new Set(data.map(f => f.child_id))];
    const { data: children } = await this.client
      .from('children')
      .select('id, name')
      .in('id', childIds);
    const childMap = new Map(children?.map(c => [c.id, c.name]) || []);

    // 获取教师名称
    const teacherIds = [...new Set(data.map(f => f.teacher_id).filter(Boolean))];
    const { data: teachers } = await this.client
      .from('user_roles')
      .select('id, real_name')
      .in('id', teacherIds);
    const teacherMap = new Map(teachers?.map(t => [t.id, t.real_name]) || []);

    return data.map(f => ({
      id: f.id,
      child_id: f.child_id,
      child_name: childMap.get(f.child_id) || '未知',
      feedback_date: f.feedback_date,
      meal_status: f.meal_status,
      sleep_status: f.sleep_status,
      mood_status: f.mood_status,
      activities: f.activities,
      notes: f.notes,
      teacher_name: f.teacher_id ? (teacherMap.get(f.teacher_id) || '老师') : '老师',
    }));
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

  async getById(id: string) {
    const { data, error } = await this.client
      .from('teachers')
      .select('id, real_name, nickname, title, class_id, status')
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (error) throw new Error(`获取教师信息失败: ${error.message}`);
    if (!data) throw new Error('教师不存在或已离职');

    // 获取班级信息
    let className = null;
    let studentCount = 0;
    let todayAttendance: number | { present: number; absent: number; leave: number } = 0;
    
    if (data.class_id) {
      const { data: classData } = await this.client
        .from('classes')
        .select('id, name')
        .eq('id', data.class_id)
        .single();
      className = classData?.name || null;

      // 查询该班级的在读幼儿数量
      const { count } = await this.client
        .from('children')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', data.class_id)
        .eq('status', 'active');
      studentCount = count || 0;

      // 查询当天该班级的考勤人数（使用UTC日期）
      const utcNow = new Date();
      const utcDate = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate()));
      const todayStart = utcDate.toISOString().split('T')[0];
      const todayEnd = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate() + 1)).toISOString().split('T')[0];
      
      // 查询出勤人数
      const { count: presentCount } = await this.client
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', data.class_id)
        .eq('status', 'present')
        .gte('date', todayStart)
        .lt('date', todayEnd);
      
      // 查询缺勤人数
      const { count: absentCount } = await this.client
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', data.class_id)
        .eq('status', 'absent')
        .gte('date', todayStart)
        .lt('date', todayEnd);
      
      // 查询请假人数
      const { count: leaveCount } = await this.client
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', data.class_id)
        .eq('status', 'leave')
        .gte('date', todayStart)
        .lt('date', todayEnd);
      
      todayAttendance = {
        present: presentCount || 0,
        absent: absentCount || 0,
        leave: leaveCount || 0,
      };
    }

    return {
      ...data,
      class_name: className,
      display_name: data.nickname || data.real_name,
      student_count: studentCount,
      today_attendance: todayAttendance,
    };
  }
}
