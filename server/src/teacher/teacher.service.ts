import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class TeacherService {
  private get client() {
    return getSupabaseClient();
  }

  async getMe(teacherRoleId?: string) {
    // teacherRoleId 即 teachers.id，先查 teachers 表
    let { data: teacher, error: teacherError } = teacherRoleId
      ? await this.client
          .from('teachers')
          .select('*')
          .eq('id', teacherRoleId)
          .eq('status', 'active')
          .single()
      : { data: null, error: null };
    
    // 若 teachers 表无记录，降级查 user_roles
    let role: any = null;
    if (!teacher && teacherRoleId) {
      const { data: roleData } = await this.client
        .from('user_roles')
        .select('*')
        .eq('id', teacherRoleId)
        .eq('role_type', 'teacher')
        .single();
      role = roleData;

      // 从 user_roles 找到后，再按 real_name 查找 teachers 表获取 class_id
      if (role?.real_name) {
        const { data: teacherByName } = await this.client
          .from('teachers')
          .select('*')
          .eq('real_name', role.real_name)
          .eq('status', 'active')
          .maybeSingle();
        if (teacherByName) {
          teacher = teacherByName;
        }
      }
    }

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
    
    // 查询该班级在读幼儿数量
    let studentCount = 0;
    if (classId) {
      const { data: children } = await this.client
        .from('children')
        .select('id')
        .eq('class_id', classId)
        .eq('status', '在读');
      studentCount = children?.length || 0;
      
      // 如果有 enrollment 系统，进一步过滤有进行中报读的幼儿
      if (studentCount > 0) {
        const childIds = children!.map(c => c.id);
        const { data: enrollments } = await this.client
          .from('enrollments')
          .select('child_id')
          .in('child_id', childIds)
          .eq('status', '进行中');
        const activeChildIds = [...new Set(enrollments?.map(e => e.child_id) || [])];
        studentCount = activeChildIds.length;
      }
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

    if (classError || !cls) {
      return [];
    }

    // 查询该班级的进行中报读（通过 enrollments.class_id）
    const { data: enrollments } = await this.client
      .from('enrollments')
      .select('id, child_id, course_type, status, start_date, end_date, extended_end_date')
      .eq('class_id', teacherClassId)
      .eq('status', '进行中');

    const enrollmentList = enrollments || [];

    // 按 child_id 分组，每人只取一条（全日托优先）
    const childEnrollmentMap = new Map<string, typeof enrollmentList[0]>();
    const sortOrder = ['全日托', '半日托', '周六托', '晚间托', '兴趣班', '计日'];
    for (const e of enrollmentList) {
      const existing = childEnrollmentMap.get(e.child_id);
      if (!existing) {
        childEnrollmentMap.set(e.child_id, e);
      } else {
        // 全日托 > 半日托 > 周六托 > 晚间托 > 兴趣班 > 计日
        const existingIdx = sortOrder.indexOf(existing.course_type);
        const newIdx = sortOrder.indexOf(e.course_type);
        if (newIdx < existingIdx) {
          childEnrollmentMap.set(e.child_id, e);
        }
      }
    }

    const childIds = [...childEnrollmentMap.keys()];

    // 查询幼儿姓名
    let childrenMap: Record<string, { name: string; gender: string }> = {};
    if (childIds.length > 0) {
      const { data: childrenData } = await this.client
        .from('children')
        .select('id, name, gender')
        .in('id', childIds);
      childrenData?.forEach(c => { childrenMap[c.id] = { name: c.name, gender: c.gender }; });
    }

    // 组装学生列表（每人只显示一条）
    const students = childIds.map(childId => {
      const e = childEnrollmentMap.get(childId)!;
      return {
        id: childId,
        name: childrenMap[childId]?.name || '',
        gender: childrenMap[childId]?.gender || '',
        course_type: e.course_type,
        status: e.status,
      };
    });

    // 查询当天该班级的考勤人数
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const today = todayUTC.toISOString().split('T')[0];
    const tomorrowStr = tomorrowUTC.toISOString().split('T')[0];
    const { data: attendance, error: attError } = await this.client
      .from('attendance')
      .select('id, status')
      .eq('class_id', teacherClassId)
      .gte('date', today)
      .lt('date', tomorrowStr);

    if (attError) {
      console.error('查询考勤失败:', attError);
    }

    const presentCount = attendance?.filter(a => a.status === '出勤')?.length || 0;
    const absentCount = attendance?.filter(a => a.status === '缺勤')?.length || 0;
    const leaveCount = attendance?.filter(a => a.status === '请假')?.length || 0;

    return [{
      id: cls.id,
      name: cls.name,
      student_count: childIds.length,
      today_attendance: { present: presentCount, absent: absentCount, leave: leaveCount },
      students,
    }];
  }

  async getGroupedOverview(teacherRoleId?: string, date?: string) {
    // 获取教师信息
    const teacherData = await this.getMe(teacherRoleId);
    const teacherClassId = teacherData?.class_id || null;
    if (!teacherClassId) return [];

    // 查询班级信息（含教室 room）
    const { data: cls, error: clsError } = await this.client
      .from('classes')
      .select('id, name, room')
      .eq('id', teacherClassId)
      .single();
    if (!cls) return [];

    // 查询该班级的进行中报读（通过 enrollments.class_id，关联 courses 获取课程名称）
    const { data: enrollments } = await this.client
      .from('enrollments')
      .select('id, child_id, course_type, course_id, status, start_date, end_date, extended_end_date')
      .eq('class_id', teacherClassId)
      .eq('status', '进行中');

    const enrollmentList = enrollments || [];

    // 收集所有 child_id
    const childIds = [...new Set(enrollmentList.map(e => e.child_id))];

    // 查询幼儿信息（仅 active 状态）
    let childrenMap: Record<string, { name: string; gender: string }> = {};
    if (childIds.length > 0) {
      const { data: childrenData } = await this.client
        .from('children')
        .select('id, name, gender')
        .in('id', childIds)
        .eq('status', 'active');
      childrenData?.forEach(c => { childrenMap[c.id] = { name: c.name, gender: c.gender }; });
    }

    // 考勤查询日期
    const queryDate = date || new Date().toISOString().split('T')[0];

    // 按课程类型分组（一个 child 可出现在多个分组）
    const groupMap = new Map<string, Array<{
      child_id: string;
      name: string;
      gender: string;
      start_date: string | null;
      end_date: string | null;
    }>>();

    for (const e of enrollmentList) {
      const ct = e.course_type;
      // 过滤日期范围：queryDate 必须在 start_date ~ end_date 之间
      if (queryDate && e.start_date && queryDate < e.start_date) continue;
      if (queryDate && e.end_date && queryDate > e.end_date) continue;
      if (!groupMap.has(ct)) groupMap.set(ct, []);
      groupMap.get(ct)!.push({
        child_id: e.child_id,
        name: childrenMap[e.child_id]?.name || '',
        gender: childrenMap[e.child_id]?.gender || '',
        start_date: e.start_date,
        end_date: e.end_date,
        extended_end_date: e.extended_end_date || e.end_date,
      });
    }

    // 查询当天考勤数据（含 course_type）
    const { data: attendance } = await this.client
      .from('attendance')
      .select('child_id, course_type, status')
      .eq('class_id', teacherClassId)
      .eq('date', queryDate);

    const attendanceMap = new Map<string, string>();
    attendance?.forEach(a => {
      const key = a.course_type ? `${a.child_id}__${a.course_type}` : a.child_id;
      attendanceMap.set(key, a.status === 'present' ? 'present' : a.status === 'absent' ? 'absent' : a.status === 'leave' ? 'leave' : 'unknown');
    });

    // 排序优先级
    const sortOrder = ['全日托', '半日托', '周六托', '晚间托', '兴趣班', '计日'];

    // 组装分组结果，按优先级排序
    const groups: Array<{
      group_id: string;
      class_id: string;
      class_name: string;
      room: string | null;
      course_type: string;
      student_count: number;
      today_attendance: { present: number; absent: number; leave: number };
      students: Array<{
        id: string;
        name: string;
        gender: string;
        course_type: string;
        attendance_status: string;
        start_date: string | null;
        end_date: string | null;
      }>;
    }> = [];

    const sortedTypes = [...groupMap.keys()].sort((a, b) => {
      const ai = sortOrder.indexOf(a);
      const bi = sortOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    for (const ct of sortedTypes) {
      const students = groupMap.get(ct)!;
      let present = 0, absent = 0, leave = 0;
      const studentList = students.map(s => {
        const attKey = ct ? `${s.child_id}__${ct}` : s.child_id;
        const attStatus = attendanceMap.get(attKey) || 'unknown';
        if (attStatus === 'present') present++;
        else if (attStatus === 'absent') absent++;
        else if (attStatus === 'leave') leave++;
        return {
          id: s.child_id,
          name: s.name,
          gender: s.gender,
          course_type: ct,
          attendance_status: attStatus,
          start_date: s.start_date,
          end_date: s.end_date,
        };
      });

      groups.push({
        group_id: `${teacherClassId}__${ct}`,
        class_id: teacherClassId,
        class_name: cls.name,
        room: cls.room || null,
        course_type: ct,
        student_count: students.length,
        today_attendance: { present, absent, leave },
        students: studentList,
      });
    }

    return groups;
  }

  async getClassStudents(classId: string) {
    // 查询该班级的在读幼儿
    const { data: children, error: childError } = await this.client
      .from('children')
      .select('id, name, gender')
      .eq('class_id', classId)
      .eq('status', '在读');

    if (childError) throw new Error(`查询幼儿失败: ${childError.message}`);
    if (!children || children.length === 0) return [];

    // 过滤有进行中报读的幼儿
    const childIds = children.map(c => c.id);
    let activeChildIds: string[] = [];
    if (childIds.length > 0) {
      const { data: enrollments } = await this.client
        .from('enrollments')
        .select('child_id')
        .in('child_id', childIds)
        .eq('status', '进行中');
      activeChildIds = [...new Set(enrollments?.map(e => e.child_id) || [])];
    }

    // 筛选出有进行中报读的幼儿
    const activeChildren = children.filter(c => activeChildIds.includes(c.id));

    // 查询当天考勤记录（使用日期字符串匹配）
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: attendanceData } = await this.client
      .from('attendance')
      .select('child_id, status')
      .eq('class_id', classId)
      .eq('date', todayStr);

    // 构建考勤状态映射
    const attendanceMap: Record<string, string> = {};
    if (attendanceData) {
      attendanceData.forEach((a: any) => {
        attendanceMap[a.child_id] = a.status;
      });
    }

    return activeChildren.map((c) => ({
      id: c.id,
      child_name: c.name,
      gender: c.gender || 'unknown',
      attendance_status: attendanceMap[c.id] || 'unknown',
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
      .upsert({
        child_id: data.child_id,
        teacher_id: data.teacher_role_id || null,
        feedback_date: today,
        meal_status: data.meal_status,
        sleep_status: data.sleep_status,
        mood_status: data.mood_status,
        activities: data.activities || null,
        notes: data.notes || null,
      }, {
        onConflict: 'child_id, feedback_date',
        ignoreDuplicates: false,
      });

    if (error) throw new Error(`提交反馈失败: ${error.message}`);

    return { success: true };
  }

  async updateFeedback(data: {
    id: string;
    meal_status: string;
    sleep_status: string;
    mood_status: string;
    activities?: string;
    notes?: string;
  }) {
    const { error } = await this.client
      .from('daily_feedbacks')
      .update({
        meal_status: data.meal_status,
        sleep_status: data.sleep_status,
        mood_status: data.mood_status,
        activities: data.activities || null,
        notes: data.notes || null,
      })
      .eq('id', data.id);

    if (error) throw new Error(`更新反馈失败: ${error.message}`);

    return { success: true };
  }

  async deleteFeedback(id: string) {
    const { error } = await this.client
      .from('daily_feedbacks')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除反馈失败: ${error.message}`);

    return { success: true };
  }

  async getById(id: string) {
    const { data, error } = await this.client
      .from('teachers')
      .select('id, real_name, nickname, title, class_id, status, entry_date, leave_date, phone, qualification, specialty, user_id')
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
