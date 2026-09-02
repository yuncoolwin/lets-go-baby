import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { isSaturday, isWeekend } from '@/utils/date.util';

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

    // 教师班级并集：teachers.class_id + teacher_classes 多班关联
    let classIds: string[] = classId ? [classId] : [];
    if (teacher?.id) {
      const { data: tcRows, error: tcError } = await this.client
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', teacher.id);
      if (tcError) {
        console.warn('[teacherService] teacher_classes 查询失败:', tcError.message);
      } else {
        for (const cid of (tcRows || []).map(r => r.class_id)) {
          if (cid && !classIds.includes(cid)) classIds.push(cid);
        }
      }
    }
    let classNames: string[] = [];
    if (classIds.length > 0) {
      const { data: clsRows } = await this.client
        .from('classes')
        .select('id, name')
        .in('id', classIds);
      const nameMap = new Map((clsRows || []).map(c => [c.id, c.name]));
      classIds = classIds.filter(id => nameMap.has(id));
      classNames = classIds.map(id => nameMap.get(id) || '');
    }

    // 查询该班级在读幼儿数量
    let studentCount = 0;
    if (classId) {
      const { data: children } = await this.client
        .from('children')
        .select('id')
        .eq('class_id', classId)
        .eq('status', 'active');
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
      class_ids: classIds,
      class_names: classNames,
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
    let childrenMap: Record<string, { name: string; nickname: string; gender: string; birth_date: string }> = {};
    if (childIds.length > 0) {
      const { data: childrenData } = await this.client
        .from('children')
        .select('id, name, nickname, gender, birth_date')
        .in('id', childIds);
      childrenData?.forEach(c => { childrenMap[c.id] = { name: c.name, nickname: c.nickname || '', gender: c.gender, birth_date: c.birth_date }; });
    }

    // 组装学生列表（每人只显示一条）
    const students = childIds.map(childId => {
      const e = childEnrollmentMap.get(childId)!;
      return {
        id: childId,
        name: childrenMap[childId]?.name || '',
        gender: childrenMap[childId]?.gender || '',
        birth_date: childrenMap[childId]?.birth_date || '',
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
    const classIds: string[] = (teacherData?.class_ids?.length
      ? teacherData.class_ids
      : (teacherData?.class_id ? [teacherData.class_id] : []));
    if (classIds.length === 0) return [];

    const targetDate = date || new Date().toISOString().split('T')[0];

    // 全园假期（holidays type='all'）——循环外统一判断
    const { data: allHolidays } = await this.client
      .from('holidays')
      .select('name')
      .eq('type', 'all')
      .lte('start_date', targetDate)
      .gte('end_date', targetDate);
    if ((allHolidays || []).length > 0) return [];

    // 法定节假日（holidays_old type='holiday'）
    const holidayYear = parseInt(targetDate.substring(0, 4));
    const { data: statutory } = await this.client
      .from('holidays_old')
      .select('date, name')
      .eq('year', holidayYear)
      .eq('type', 'holiday');
    if ((statutory || []).some(h => h.date?.substring(0, 10) === targetDate)) return [];

    // 查询班级信息（含教室 room）
    const { data: classRows } = await this.client
      .from('classes')
      .select('id, name, room')
      .in('id', classIds);
    if (!classRows || classRows.length === 0) return [];

    // 按班级并集聚合分组（多班拼接，跳过无效 id）
    const allGroups: Awaited<ReturnType<typeof this.buildClassOverview>> = [];
    for (const clsRow of classRows) {
      allGroups.push(...(await this.buildClassOverview(clsRow, targetDate)));
    }
    return allGroups;
  }

  /** 单班考勤总览构建（教师端首页分组；多班教师按班拼接） */
  private async buildClassOverview(
    cls: { id: string; name: string; room: string | null },
    date?: string,
  ): Promise<Array<{
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
      nickname: string;
      extended_end_date: string | null;
    }>;
  }>> {
    const teacherClassId = cls.id;

    // 查询该班级的全部报读（通过 enrollments.class_id，关联 courses 获取课程名称）
    const { data: enrollments } = await this.client
      .from('enrollments')
      .select('id, child_id, course_type, course_id, status, start_date, end_date, extended_end_date')
      .eq('class_id', teacherClassId);

    const enrollmentList = enrollments || [];

    // 考勤查询日期（优先使用所选日期，其次今天）
    const queryDate = date || new Date().toISOString().split('T')[0];

    // 按所选日期对应的星期过滤课程（根据 date_calc_rule）
    let weekdayRule = '';
    if (isSaturday(queryDate)) {
      weekdayRule = '周六';
    } else if (isWeekend(queryDate)) {
      weekdayRule = '周日';
    } else {
      weekdayRule = '工作日';
    }
    // 查询当天有排课的课程 ID
    const { data: weekdayCourses } = await this.client
      .from('courses')
      .select('id, name')
      .eq('date_calc_rule', weekdayRule);
    const weekdayCourseIds = new Set((weekdayCourses || []).map(c => c.id));
    // 过滤：只保留 course_id 匹配当天排课的报读
    const filteredEnrollments = enrollmentList.filter(e => e.course_id && weekdayCourseIds.has(e.course_id));

    // 收集所有 child_id
    const childIds = [...new Set(filteredEnrollments.map(e => e.child_id))];

    // 查询幼儿信息（仅 active 状态）
    let childrenMap: Record<string, { name: string; gender: string; birth_date: string; nickname: string }> = {};
    if (childIds.length > 0) {
      const { data: childrenData } = await this.client
        .from('children')
        .select('id, name, gender, birth_date, nickname')
        .in('id', childIds)
        .eq('status', 'active');
      childrenData?.forEach(c => { childrenMap[c.id] = { name: c.name, gender: c.gender, birth_date: c.birth_date, nickname: c.nickname || "" }; });
    }

    // 按课程类型分组（一个 child 可出现在多个分组）
    const groupMap = new Map<string, Array<{
      child_id: string;
      name: string;
      gender: string;
      birth_date: string;
      start_date: string | null;
      end_date: string | null;
      nickname: string;
      extended_end_date: string | null;
    }>>();

    for (const e of filteredEnrollments) {
      const ct = e.course_type;
      // 过滤日期范围：queryDate 必须在 start_date ~ (extended_end_date || end_date) 之间
      if (queryDate && e.start_date && queryDate < e.start_date) continue;
      if (queryDate && (e.extended_end_date || e.end_date) && queryDate > (e.extended_end_date || e.end_date)) continue;
      if (!groupMap.has(ct)) groupMap.set(ct, []);
      groupMap.get(ct)!.push({
        child_id: e.child_id,
        name: childrenMap[e.child_id]?.name || '',
        gender: childrenMap[e.child_id]?.gender || '',
        birth_date: childrenMap[e.child_id]?.birth_date || '',
        start_date: e.start_date,
        nickname: childrenMap[e.child_id]?.nickname || '' ,
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
      attendanceMap.set(key, a.status === 'present' ? 'present' : a.status === 'absent' ? 'absent' : a.status === 'leave' ? 'leave' : a.status === 'full_day' ? 'full_day' : a.status === 'half_day' ? 'half_day' : 'unknown');
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
        nickname: string;
      extended_end_date: string | null;
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
        if (attStatus === 'present' || attStatus === 'full_day' || attStatus === 'half_day') present++;
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
          nickname: s.nickname || "",
          extended_end_date: s.extended_end_date || s.end_date,
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

  async getGroupedOverviewByClass(classId: string, date?: string) {
    if (!classId) return [];

    const targetDate = date || new Date().toISOString().split('T')[0];

    // 班级假期（holidays type='class' 且 target_id=当前班级 id）
    const { data: classHolidays } = await this.client
      .from('holidays')
      .select('name')
      .eq('type', 'class')
      .eq('target_id', classId)
      .lte('start_date', targetDate)
      .gte('end_date', targetDate);
    if ((classHolidays || []).length > 0) return [];

    // 法定节假日（holidays_old type='holiday'）
    const holidayYear = parseInt(targetDate.substring(0, 4));
    const { data: statutory } = await this.client
      .from('holidays_old')
      .select('date, name')
      .eq('year', holidayYear)
      .eq('type', 'holiday');
    if ((statutory || []).some(h => h.date?.substring(0, 10) === targetDate)) return [];

    // 查询班级信息
    const { data: cls, error: clsError } = await this.client
      .from('classes')
      .select('id, name, room')
      .eq('id', classId)
      .single();
    if (!cls) return [];

    // 查询该班级的进行中报读
    const { data: enrollments } = await this.client
      .from('enrollments')
      .select('id, child_id, course_type, course_id, status, start_date, end_date, extended_end_date')
      .eq('class_id', classId)
      .eq('status', '进行中');

    const enrollmentList = enrollments || [];

    // 考勤查询日期（优先使用所选日期，其次今天）
    const queryDate = date || new Date().toISOString().split('T')[0];

    // 按所选日期对应的星期过滤课程（根据 date_calc_rule）
    let weekdayRule = '';
    if (isSaturday(queryDate)) {
      weekdayRule = '周六';
    } else if (isWeekend(queryDate)) {
      weekdayRule = '周日';
    } else {
      weekdayRule = '工作日';
    }
    const { data: weekdayCourses } = await this.client
      .from('courses')
      .select('id, name')
      .eq('date_calc_rule', weekdayRule);
    const weekdayCourseIds = new Set((weekdayCourses || []).map(c => c.id));
    const filteredEnrollments = enrollmentList.filter(e => e.course_id && weekdayCourseIds.has(e.course_id));

    const childIds = [...new Set(filteredEnrollments.map(e => e.child_id))];

    // 查询幼儿信息
    let childrenMap: Record<string, { name: string; gender: string; birth_date: string; nickname: string }> = {};
    if (childIds.length > 0) {
      const { data: childrenData } = await this.client
        .from('children')
        .select('id, name, gender, birth_date, nickname')
        .in('id', childIds)
        .eq('status', 'active');
      childrenData?.forEach(c => { childrenMap[c.id] = { name: c.name, gender: c.gender, birth_date: c.birth_date, nickname: c.nickname || "" }; });
    }

    // 按课程类型分组
    const groupMap = new Map<string, Array<{
      child_id: string;
      name: string;
      gender: string;
      birth_date: string;
      start_date: string | null;
      end_date: string | null;
      nickname: string;
      extended_end_date: string | null;
    }>>();

    for (const e of filteredEnrollments) {
      const ct = e.course_type;
      if (queryDate && e.start_date && queryDate < e.start_date) continue;
      if (queryDate && (e.extended_end_date || e.end_date) && queryDate > (e.extended_end_date || e.end_date)) continue;
      if (!groupMap.has(ct)) groupMap.set(ct, []);
      groupMap.get(ct)!.push({
        child_id: e.child_id,
        name: childrenMap[e.child_id]?.name || '',
        gender: childrenMap[e.child_id]?.gender || '',
        birth_date: childrenMap[e.child_id]?.birth_date || '',
        start_date: e.start_date,
        nickname: childrenMap[e.child_id]?.nickname || '' ,
        end_date: e.end_date,
        extended_end_date: e.extended_end_date || e.end_date,
      });
    }

    // 查询当天考勤数据
    const { data: attendance } = await this.client
      .from('attendance')
      .select('child_id, course_type, status')
      .eq('class_id', classId)
      .eq('date', queryDate);

    const attendanceMap = new Map<string, string>();
    attendance?.forEach(a => {
      const key = a.course_type ? `${a.child_id}__${a.course_type}` : a.child_id;
      attendanceMap.set(key, a.status === 'present' ? 'present' : a.status === 'absent' ? 'absent' : a.status === 'leave' ? 'leave' : a.status === 'full_day' ? 'full_day' : a.status === 'half_day' ? 'half_day' : 'unknown');
    });

    const sortOrder = ['全日托', '半日托', '周六托', '晚间托', '兴趣班', '计日'];
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
        nickname: string;
      extended_end_date: string | null;
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
        if (attStatus === 'present' || attStatus === 'full_day' || attStatus === 'half_day') present++;
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
          nickname: s.nickname || "",
          extended_end_date: s.extended_end_date || s.end_date,
        };
      });

      groups.push({
        group_id: `${classId}__${ct}`,
        class_id: classId,
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

  async getClassStudents(classId: string, courseId?: string) {
    // 从报读记录中获取该班级的幼儿（enrollments.class_id 数据更完整）
    let enrollmentQuery = this.client
      .from('enrollments')
      .select('child_id')
      .eq('class_id', classId)
      .eq('status', '进行中');

    if (courseId) {
      enrollmentQuery = enrollmentQuery.eq('course_id', courseId);
    }

    const { data: enrollments, error: enrollError } = await enrollmentQuery;
    if (enrollError) throw new Error(`查询报读记录失败: ${enrollError.message}`);
    if (!enrollments || enrollments.length === 0) return [];

    const activeChildIds = [...new Set(enrollments.map(e => e.child_id))];

    // 查询幼儿信息
    const { data: children, error: childError } = await this.client
      .from('children')
      .select('id, name, gender, birth_date, nickname')
      .in('id', activeChildIds)
      .eq('status', 'active');

    if (childError) throw new Error(`查询幼儿失败: ${childError.message}`);
    if (!children || children.length === 0) return [];

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

    return children.map((c) => ({
      id: c.id,
      child_name: c.name,
      gender: c.gender || 'unknown',
      attendance_status: attendanceMap[c.id] || 'unknown',
    }));
  }

  async getTeacherClasses(teacherId: string) {
    // Try to find teacher by id directly (teachers.id)
    let { data: teacher } = await this.client
      .from('teachers')
      .select('id, class_id')
      .eq('id', teacherId)
      .single();

    // If not found, try via user_roles -> real_name
    if (!teacher?.class_id) {
      const { data: roleRecord } = await this.client
        .from('user_roles')
        .select('real_name')
        .eq('id', teacherId)
        .single();

      if (roleRecord?.real_name) {
        const { data: teacherByRole } = await this.client
          .from('teachers')
          .select('id, class_id')
          .eq('real_name', roleRecord.real_name)
          .single();
        teacher = teacherByRole;
      }
    }

    // 教师班级并集：teachers.class_id + teacher_classes 多班关联
    const classIds: string[] = teacher?.class_id ? [teacher.class_id] : [];
    if (teacher?.id) {
      const { data: tcRows, error: tcError } = await this.client
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', teacher.id);
      if (tcError) {
        console.warn('[teacherService] teacher_classes 查询失败:', tcError.message);
      } else {
        for (const cid of (tcRows || []).map(r => r.class_id)) {
          if (cid && !classIds.includes(cid)) classIds.push(cid);
        }
      }
    }

    if (classIds.length === 0) {
      return [];
    }

    const { data: classData } = await this.client
      .from('classes')
      .select('id, name')
      .in('id', classIds);

    return classData || [];
  }

  async getCourses(weekday?: string) {
    // 根据星期几过滤课程：
    //   weekday 0=周日, 1=周一, ..., 6=周六
    //   date_calc_rule: '工作日'=周一至周五, '周六'=周六, '周日'=周日
    let query = this.client
      .from('courses')
      .select('id, name')
      .order('name');

    if (weekday !== undefined && weekday !== '') {
      const wd = parseInt(weekday, 10);
      if (wd >= 1 && wd <= 5) {
        // 周一至周五 → 只显示 '工作日'
        query = query.eq('date_calc_rule', '工作日');
      } else if (wd === 6) {
        // 周六
        query = query.eq('date_calc_rule', '周六');
      } else if (wd === 0) {
        // 周日
        query = query.eq('date_calc_rule', '周日');
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getCourses] Error:', error);
      return [];
    }
    return data || [];
  }

  async getFeedbacks(teacherRoleId?: string, feedbackDate?: string) {
    // 默认查询今天的记录
    const today = new Date().toISOString().split('T')[0];
    const date = feedbackDate || today;

    // 从数据库查询真实记录
    let query = this.client
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
        group_id,
        teacher_id,
        class_id,
        course_id,
        course_name
      `)
      .eq('feedback_date', date)
      .order('feedback_date', { ascending: false })
      .limit(50);

    const { data, error } = await query;

    if (error) {
      console.error('[TeacherService] getFeedbacks error:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // 获取幼儿名称和班级
    const childIds = [...new Set(data.map(f => f.child_id))];
    const { data: children } = await this.client
      .from('children')
      .select('id, name, class_id, course_type')
      .in('id', childIds);
    const childMap = new Map(children?.map(c => [c.id, { name: c.name, class_id: c.class_id, course_type: c.course_type }]) || []);

    // 获取班级名称
    const classIds = [...new Set(children?.map(c => c.class_id).filter(Boolean) || [])];
    const { data: classes } = await this.client
      .from('classes')
      .select('id, name')
      .in('id', classIds);
    const classMap = new Map(classes?.map(c => [c.id, c.name]) || []);

    // 获取教师名称
    const teacherIds = [...new Set(data.map(f => f.teacher_id).filter(Boolean))];
    const { data: teachers } = await this.client
      .from('user_roles')
      .select('id, real_name')
      .in('id', teacherIds);
    const teacherMap = new Map(teachers?.map(t => [t.id, t.real_name]) || []);

    return data.map(f => {
      const child = childMap.get(f.child_id);
      return {
        id: f.id,
        child_id: f.child_id,
        child_name: child?.name || '未知',
        class_name: (classMap.get(f.class_id) || (child?.class_id ? (classMap.get(child.class_id) || '') : '')),
        course_name: f.course_name || '',
        feedback_date: f.feedback_date,
        meal_status: f.meal_status,
        sleep_status: f.sleep_status,
        mood_status: f.mood_status,
        activities: f.activities,
        notes: f.notes,
        group_id: f.group_id,
        class_id: f.class_id,
        course_id: f.course_id,
        teacher_name: f.teacher_id ? (teacherMap.get(f.teacher_id) || '老师') : '老师',
      };
    });
  }

  async submitAttendance(userId: string | undefined, data: {
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

      try {
        await this.client.from('audit_logs').insert({
          user_id: userId || null,
          user_role_id: data.teacher_role_id || null,
          action: 'attendance_upsert',
          target_type: 'attendance',
          target_id: null,
          detail: { source: 'teacher_page', teacher_role_id: data.teacher_role_id || null, records_count: data.records?.length || 0 },
          level: 'info',
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[AuditLog] 写入失败:', (e as Error)?.message);
      }
    }

    return { success: true, count: insertData.length };
  }

  async submitFeedback(userId: string | undefined, data: {
    child_id: string;
    teacher_role_id?: string;
    group_id?: string;
    class_id?: string;
    course_id?: string;
    course_name?: string;
    meal_status: string | number;
    sleep_status: string | number;
    mood_status: string | number;
    activities?: string;
    notes?: string;
  }) {
    const today = new Date().toISOString().split('T')[0];
    const groupId = data.group_id || '';
    
    const { data: saved, error } = await this.client
      .from('daily_feedbacks')
      .upsert({
        child_id: data.child_id,
        teacher_id: data.teacher_role_id || null,
        group_id: groupId,
        class_id: data.class_id || null,
        course_id: data.course_id || null,
        course_name: data.course_name || null,
        feedback_date: today,
        meal_status: String(data.meal_status || ''),
        sleep_status: String(data.sleep_status || ''),
        mood_status: String(data.mood_status || ''),
        activities: data.activities || null,
        notes: data.notes || null,
      }, {
        onConflict: 'child_id, feedback_date, group_id',
        ignoreDuplicates: false,
      })
      .select('id')
      .single();

    if (error) throw new Error(`提交反馈失败: ${error.message}`);

    try {
      await this.client.from('audit_logs').insert({
        user_id: userId || null,
        user_role_id: data.teacher_role_id || null,
        action: 'feedback_create',
        target_type: 'daily_feedback',
        target_id: (saved as any)?.id || null,
        detail: { child_id: data.child_id, teacher_role_id: data.teacher_role_id || null },
        level: 'info',
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[AuditLog] 写入失败:', (e as Error)?.message);
    }

    return { success: true };
  }

  async updateFeedback(userId: string | undefined, data: {
    id: string;
    meal_status: string | number;
    sleep_status: string | number;
    mood_status: string | number;
    activities?: string;
    notes?: string;
  }) {
    const { error } = await this.client
      .from('daily_feedbacks')
      .update({
        meal_status: String(data.meal_status || ''),
        sleep_status: String(data.sleep_status || ''),
        mood_status: String(data.mood_status || ''),
        activities: data.activities || null,
        notes: data.notes || null,
      })
      .eq('id', data.id);

    if (error) throw new Error(`更新反馈失败: ${error.message}`);

    try {
      await this.client.from('audit_logs').insert({
        user_id: userId || null,
        user_role_id: null,
        action: 'feedback_update',
        target_type: 'daily_feedback',
        target_id: data.id,
        detail: null,
        level: 'info',
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[AuditLog] 写入失败:', (e as Error)?.message);
    }

    return { success: true };
  }

  async deleteFeedback(userId: string | undefined, id: string, operatorRoleId?: string) {
    // 权限校验：超管可删任意记录；教师仅可删自己发的当天记录；其他角色不可删
    const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let operatorRoleType: string | null = null;
    if (operatorRoleId) {
      const { data: roleData } = await this.client
        .from('user_roles')
        .select('id, role_type')
        .eq('id', operatorRoleId)
        .maybeSingle();
      operatorRoleType = roleData?.role_type || null;
    }
    if (operatorRoleType !== 'superadmin') {
      // 先查记录再校验
      const { data: existing, error: fetchErr } = await this.client
        .from('daily_feedbacks')
        .select('id, teacher_id, feedback_date')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) throw new Error(`查询反馈失败: ${fetchErr.message}`);
      if (!existing) throw new Error('反馈记录不存在');
      const recordDate = (existing.feedback_date || '').slice(0, 10);
      const isOwnerToday = operatorRoleType === 'teacher' && existing.teacher_id === operatorRoleId && recordDate === todayStr;
      if (!isOwnerToday) {
        return { error: true, code: 403, msg: '无权限删除该反馈：仅超级管理员或教师本人可删除当天记录' };
      }
    }

    const { error } = await this.client
      .from('daily_feedbacks')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除反馈失败: ${error.message}`);

    try {
      await this.client.from('audit_logs').insert({
        user_id: userId || null,
        user_role_id: operatorRoleId || null,
        action: 'feedback_delete',
        target_type: 'daily_feedback',
        target_id: id,
        detail: null,
        level: 'info',
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[AuditLog] 写入失败:', (e as Error)?.message);
    }

    return { success: true };
  }

  async getById(id: string) {
    // 手机号脱敏：对外不返回 phone 字段
    const { data, error } = await this.client
      .from('teachers')
      .select('id, real_name, nickname, title, class_id, status, entry_date, leave_date, qualification, specialty, user_id')
      .eq('id', id)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !data) {
      return { error: true, code: 404, msg: '教师不存在或已离职' };
    }

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
