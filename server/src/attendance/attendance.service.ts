import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getShanghaiToday, isSaturday, isWeekend } from '@/utils/date.util';
import { AuthzService } from '@/auth/authz.service';

@Injectable()
export class AttendanceService {
  constructor(private readonly authz: AuthzService) {}

  private get client() {
    return getSupabaseClient();
  }

  /**
   * 班级访问权限校验：
   * - admin/superadmin：全部班级
   * - teacher：仅自己带教的班级
   * - parent/none：403
   * @returns 无权限时返回错误文案，有权限返回 null
   */
  private async canAccessClass(userId: string, classId: string): Promise<string | null> {
    const level = await this.authz.getRoleLevel(userId);
    if (level === 'admin' || level === 'superadmin') return null;
    if (level === 'teacher') {
      const classIds = await this.authz.getTeacherClassIds(userId);
      if (classId && classIds.includes(classId)) return null;
      return '无权操作该班级考勤';
    }
    return '无权操作考勤';
  }

  /**
   * 批量获取某班级某天的点名记录（含完整幼儿信息和课程类型）
   * 每个幼儿可有多条记录（每个课程类型一条）
   * @param userId 当前登录用户ID
   * @param classId 班级ID
   * @param date 可选，默认当天
   */
  async findByClassAndDate(userId: string, classId: string, date?: string) {
    const targetDate = date || getShanghaiToday();

    // 归属校验：教师仅能查看自己带教班级，家长无权查看
    const level = await this.authz.getRoleLevel(userId);
    if (level === 'admin' || level === 'superadmin') {
      // 全部班级
    } else if (level === 'teacher') {
      const classIds = await this.authz.getTeacherClassIds(userId);
      if (!classId || !classIds.includes(classId)) return [];
    } else {
      return [];
    }

    // 查询班级在读幼儿
    const { data: children, error: childErr } = await this.client
      .from('children')
      .select('id, name, gender, birth_date, avatar_url, allergies, status')
      .eq('class_id', classId)
      .eq('status', 'active');
    if (childErr) throw childErr;
    const childList = children || [];
    const childIds = childList.map(c => c.id);

    // 查询当天点名记录（含 course_type）
    const { data: records, error: recErr } = await this.client
      .from('attendance')
      .select('id, child_id, status, course_type, updated_at')
      .eq('class_id', classId)
      .eq('date', targetDate);
    if (recErr) throw recErr;

    // 建立 child_id + course_type -> 考勤记录 映射
    const recordMap: Record<string, any> = {};
    (records || []).forEach(r => {
      const key = `${r.child_id}__${r.course_type || ''}`;
      recordMap[key] = r;
    });

    // 查询该班级在所选日期区间内的报读记录（按日期范围过滤，不限制状态）
    const enrollmentList: Array<{ child_id: string; course_type: string; start_date: string; end_date: string; extended_end_date: string | null }> = [];
    if (childIds.length > 0) {
      const { data: enrollments } = await this.client
        .from('enrollments')
        .select('child_id, course_type, start_date, end_date, extended_end_date')
        .in('child_id', childIds)
        .eq('class_id', classId);
      (enrollments || []).forEach(e => {
        // 所选日期在 start_date 到 extended_end_date（或 end_date）区间内才返回
        const effectiveEnd = e.extended_end_date || e.end_date;
        if (e.start_date && targetDate >= e.start_date && targetDate <= effectiveEnd) {
          enrollmentList.push({ child_id: e.child_id, course_type: e.course_type, start_date: e.start_date, end_date: e.end_date, extended_end_date: e.extended_end_date });
        }
      });
    }

    // 按星期几过滤课程类型：周六只显示周六托，工作日只显示非周六托，周日报空
    const isSat = isSaturday(targetDate);
    const isSun = isWeekend(targetDate) && !isSat;
    const filteredEnrollmentList = enrollmentList.filter(e => {
      if (isSun) return false; // 周日不显示任何课程
      if (isSat) return e.course_type === '周六托'; // 周六只显示周六托
      return e.course_type !== '周六托'; // 工作日不显示周六托
    });

    // 合并：每个幼儿按课程类型展开，每行一个 child_id + course_type 组合
    const childMap: Record<string, any> = {};
    childList.forEach(c => { childMap[c.id] = c; });

    const mergedList = filteredEnrollmentList.map(e => {
      const child = childMap[e.child_id];
      if (!child) return null;
      const key = `${e.child_id}__${e.course_type}`;
      const record = recordMap[key];
      return {
        id: child.id,
        name: child.name,
        gender: child.gender,
        birth_date: child.birth_date,
        avatar_url: child.avatar_url,
        allergies: child.allergies,
        course_type: e.course_type,
        attendance_id: record?.id || null,
        attendance_status: record?.status || null,
        updated_at: record?.updated_at || null,
      };
    }).filter(Boolean);

    // 按课程类型排序，同类型按考勤状态排序
    const courseTypeOrder: Record<string, number> = {
      '全日托': 0, '半日托': 1, '周六托': 2, '晚间托': 3, '兴趣班': 4, '计日': 5,
    };
    const statusOrder: Record<string, number> = { full_day: 0, present: 0, half_day: 0, absent: 1, leave: 2, null: 3 };
    return mergedList
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
      const ctA = courseTypeOrder[a.course_type || ''] ?? 99;
      const ctB = courseTypeOrder[b.course_type || ''] ?? 99;
      if (ctA !== ctB) return ctA - ctB;
      const orderA = statusOrder[a.attendance_status || 'null'] ?? 4;
      const orderB = statusOrder[b.attendance_status || 'null'] ?? 4;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'zh');
    });
  }

  /**
   * 管理员端：按班级获取考勤分组概览（仅 admin/superadmin 可访问）
   */
  async getAdminOverview(userId: string, classId: string, date?: string) {
    if (!classId) return [];

    const level = await this.authz.getRoleLevel(userId);
    if (level !== 'admin' && level !== 'superadmin') {
      return { error: true, code: 403, msg: '仅管理员可查看考勤概览' };
    }

    const queryDate = date || getShanghaiToday();
    console.log(`[AdminOverview] classId=${classId}, date=${queryDate}`);

    // 假期：全园/班级/法定假期时，不显示在读幼儿
    const holidayStatus = await this.getHolidayStatus(classId, queryDate);
    if (holidayStatus.is_class_holiday) {
      console.log(`[AdminOverview] Class holiday, return empty`);
      return [];
    }

    // 查询班级信息
    const { data: cls } = await this.client
      .from('classes')
      .select('id, name, room')
      .eq('id', classId)
      .single();
    if (!cls) {
      console.log(`[AdminOverview] Class not found: ${classId}`);
      return [];
    }
    console.log(`[AdminOverview] Class found: ${cls.name}`);

    // 查询该班级在所选日期区间内的报读记录（按日期范围过滤，不限制状态）
    const { data: enrollments } = await this.client
      .from('enrollments')
      .select('id, child_id, course_type, course_id, status, start_date, end_date, extended_end_date')
      .eq('class_id', classId);

    const enrollmentList = enrollments || [];
    console.log(`[AdminOverview] Enrollments count: ${enrollmentList.length}`);
    const childIds = [...new Set(enrollmentList.map(e => e.child_id))];
    console.log(`[AdminOverview] Unique child IDs: ${childIds.length}`);

    // 查询幼儿信息
    let childrenMap: Record<string, { name: string; gender: string; birth_date: string }> = {};
    if (childIds.length > 0) {
      const { data: childrenData } = await this.client
        .from('children')
        .select('id, name, gender, birth_date')
        .in('id', childIds)
        .eq('status', 'active');
      childrenData?.forEach(c => { childrenMap[c.id] = { name: c.name, gender: c.gender, birth_date: c.birth_date }; });
    }
    console.log(`[AdminOverview] Children found: ${Object.keys(childrenMap).length}`);

    // 按课程类型分组
    const groupMap = new Map<string, Array<{
      child_id: string;
      name: string;
      gender: string;
      birth_date: string;
      start_date: string | null;
      end_date: string | null;
      extended_end_date: string | null;
    }>>();

    for (const e of enrollmentList) {
      const ct = e.course_type;
      if (queryDate && e.start_date && queryDate < e.start_date) continue;
      const effectiveEnd = e.extended_end_date || e.end_date;
      if (queryDate && effectiveEnd && queryDate > effectiveEnd) continue;
      // 按星期几过滤课程类型
      const isSat = isSaturday(queryDate);
      const isSun = isWeekend(queryDate) && !isSat;
      if (isSun) continue; // 周日不显示任何课程
      if (isSat && ct !== '周六托') continue; // 周六只显示周六托
      if (!isSat && ct === '周六托') continue; // 工作日不显示周六托
      if (!groupMap.has(ct)) groupMap.set(ct, []);
      groupMap.get(ct)!.push({
        child_id: e.child_id,
        name: childrenMap[e.child_id]?.name || '',
        gender: childrenMap[e.child_id]?.gender || '',
        birth_date: childrenMap[e.child_id]?.birth_date || '',
        start_date: e.start_date,
        end_date: e.end_date,
        extended_end_date: e.extended_end_date || e.end_date,
      });
    }
    console.log(`[AdminOverview] Group map types: ${[...groupMap.keys()].join(', ')}`);

    // 查询当天考勤数据
    const { data: attendance } = await this.client
      .from('attendance')
      .select('child_id, course_type, status')
      .eq('class_id', classId)
      .eq('date', queryDate);
    console.log(`[AdminOverview] Attendance records: ${(attendance || []).length}`);

    const attendanceMap = new Map<string, string>();
    attendance?.forEach(a => {
      const key = a.course_type ? `${a.child_id}__${a.course_type}` : a.child_id;
      attendanceMap.set(key, a.status === 'present' ? 'present' : a.status === 'absent' ? 'absent' : a.status === 'leave' ? 'leave' : a.status === 'full_day' ? 'full_day' : a.status === 'half_day' ? 'half_day' : 'unknown');
    });

    // 查询当天接送记录（check_in_time / check_out_time / status）
    const { data: attendanceRecords } = await this.client
      .from('attendance_records')
      .select('child_id, course_type, check_in_time, check_out_time, status')
      .eq('record_date', queryDate)
      .in('child_id', childIds);
    const recordMap = new Map<string, any>();
    attendanceRecords?.forEach(r => {
      const key = r.course_type ? `${r.child_id}__${r.course_type}` : r.child_id;
      recordMap.set(key, r);
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
        check_in_time: string | null;
        check_out_time: string | null;
        status: string | null;
        start_date: string | null;
        end_date: string | null;
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
        const rec = recordMap.get(attKey);
        return {
          id: s.child_id,
          name: s.name,
          gender: s.gender,
          course_type: ct,
          attendance_status: attStatus,
          check_in_time: rec?.check_in_time || null,
          check_out_time: rec?.check_out_time || null,
          status: rec?.status || null,
          start_date: s.start_date,
          end_date: s.end_date,
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

  /**
   * 获取某幼儿某天某课程类型的点名状态
   */
  async findByChildAndDate(childId: string, date: string, courseType?: string) {
    let query = this.client
      .from('attendance')
      .select('*')
      .eq('child_id', childId)
      .eq('date', date);
    if (courseType) {
      query = query.eq('course_type', courseType);
    }
    const { data, error } = await query.single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * 记录/更新点名状态（upsert），按 child_id + date + course_type 唯一
   */
  async upsert(userId: string, dto: {
    child_id: string;
    teacher_id: string;
    class_id: string;
    date: string;
    status: string;
    course_type?: string;
  }) {
    // 归属校验：教师仅能操作自己带教的班级，admin/superadmin 全部班级，家长 403
    const denied = await this.canAccessClass(userId, dto.class_id);
    if (denied) return { error: true, code: 403, msg: denied };

    // 根据 child_id + course_type 匹配"进行中"的报读记录，取得 enrollment_id
    const courseType = dto.course_type || '';
    let enrollmentId: string | null = null;
    const { data: enr } = await this.client
      .from('enrollments')
      .select('id')
      .eq('child_id', dto.child_id)
      .eq('course_type', courseType)
      .eq('status', '进行中')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    enrollmentId = enr?.id || null;

    // 全天/半天标记：half_day -> true，full_day -> false，其余（present/absent/leave）-> null
    const isHalfDay = dto.status === 'half_day' ? true : dto.status === 'full_day' ? false : null;

    const { data, error } = await this.client
      .from('attendance')
      .upsert({
        child_id: dto.child_id,
        teacher_id: dto.teacher_id,
        class_id: dto.class_id,
        date: dto.date,
        status: dto.status,
        course_type: courseType,
        enrollment_id: enrollmentId,
        is_half_day: isHalfDay,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'child_id,date,course_type',
      })
      .select()
      .single();
    if (error) throw error;

    // 同步维护接送记录（按 child_id + record_date + course_type）
    await this.syncAttendanceRecord(dto.child_id, dto.class_id, dto.date, courseType, dto.status);

    if (data) {
      const { error: logErr } = await this.client.from('audit_logs').insert({
        user_id: userId,
        action: 'attendance_upsert',
        target_type: 'attendance',
        target_id: data.id,
        detail: { child_id: dto.child_id, class_id: dto.class_id, date: dto.date, status: dto.status },
        level: 'info',
        created_at: new Date().toISOString(),
      });
      if (logErr) console.warn('[audit-log] attendance_upsert 写入失败:', logErr.message);
    }

    return data;
  }

  /**
   * 按 child_id + record_date + course_type 同步维护接送记录
   */
  private async syncAttendanceRecord(
    childId: string,
    classId: string,
    date: string,
    courseType: string,
    status: string,
  ) {
    const { data: existing } = await this.client
      .from('attendance_records')
      .select('id, check_in_time, check_out_time')
      .eq('child_id', childId)
      .eq('record_date', date)
      .eq('course_type', courseType)
      .maybeSingle();

    const now = new Date().toISOString();
    const isPresent = status === 'present' || status === 'full_day' || status === 'half_day';
    const isLeave = status === 'leave';
    const isAbsent = status === 'absent';

    if (isPresent) {
      if (!existing || !existing.check_in_time) {
        if (existing) {
          await this.client
            .from('attendance_records')
            .update({ check_in_time: now, status: 'present', check_out_time: null, course_type: courseType })
            .eq('id', existing.id);
        } else {
          await this.client
            .from('attendance_records')
            .insert({ child_id: childId, class_id: classId, record_date: date, course_type: courseType, check_in_time: now, status: 'present' });
        }
      }
      // 已有 check_in_time -> 不覆盖
    } else if (isLeave) {
      if (existing) {
        await this.client
          .from('attendance_records')
          .update({ status: 'leave', check_out_time: null, course_type: courseType })
          .eq('id', existing.id);
      } else {
        await this.client
          .from('attendance_records')
          .insert({ child_id: childId, class_id: classId, record_date: date, course_type: courseType, status: 'leave' });
      }
    } else if (isAbsent) {
      if (existing) {
        await this.client
          .from('attendance_records')
          .update({ status: 'absent', check_out_time: null, course_type: courseType })
          .eq('id', existing.id);
      } else {
        await this.client
          .from('attendance_records')
          .insert({ child_id: childId, class_id: classId, record_date: date, course_type: courseType, status: 'absent' });
      }
    }
  }

  /**
   * 离园：将该幼儿当天该课程接送记录 check_out_time=now()、status 清空为正常
   */
  async checkOut(userId: string, dto: {
    childId: string;
    classId: string;
    date: string;
    courseType?: string;
  }) {
    // 归属校验：教师仅能操作自己带教的班级
    const denied = await this.canAccessClass(userId, dto.classId);
    if (denied) return { error: true, code: 403, msg: denied };

    const courseType = dto.courseType || '';
    const { data: existing } = await this.client
      .from('attendance_records')
      .select('id')
      .eq('child_id', dto.childId)
      .eq('record_date', dto.date)
      .eq('course_type', courseType)
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing) {
      const { error } = await this.client
        .from('attendance_records')
        .update({ check_out_time: now, status: 'present' })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await this.client
        .from('attendance_records')
        .insert({ child_id: dto.childId, class_id: dto.classId, record_date: dto.date, course_type: courseType, check_in_time: now, check_out_time: now, status: 'present' });
      if (error) throw error;
    }

    return { success: true, child_id: dto.childId };
  }

  async clearByClassAndDate(
    userId: string,
    classId: string,
    date: string,
    courseType?: string,
  ) {
    // 班级归属校验：教师仅能清空自己带教班级的考勤
    const denied = await this.canAccessClass(userId, classId);
    if (denied) return { error: true, code: 403, msg: denied };

    // 权限校验：仅允许清空服务器当天（上海时区）的考勤记录
    const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (date !== todayStr) {
      return { error: true, code: 403, msg: '仅允许清空当天的考勤记录' };
    }

    let query = this.client
      .from('attendance')
      .delete()
      .eq('class_id', classId)
      .eq('date', date);
    if (courseType) {
      query = query.eq('course_type', courseType);
    }
    const { error } = await query;
    if (error) throw error;

    const { error: logErr } = await this.client.from('audit_logs').insert({
      user_id: userId,
      action: 'attendance_clear',
      target_type: 'attendance',
      detail: { class_id: classId, date: date },
      level: 'info',
      created_at: new Date().toISOString(),
    });
    if (logErr) console.warn('[audit-log] attendance_clear 写入失败:', logErr.message);

    return { deleted: true };
  }

  async getDates(classId: string, courseType?: string) {
    let query = this.client
      .from('attendance')
      .select('date')
      .eq('class_id', classId);
    if (courseType) {
      query = query.eq('course_type', courseType);
    }
    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;
    const dates = [...new Set(data?.map((r: any) => r.date?.split('T')[0]) || [])];
    return dates;
  }

  /**
   * 获取某班级某天的假期状态（用于点名页：假期日出勤按钮置灰）
   * 覆盖四类假期：法定节假日、全园假期、班级假期、个人假期
   */
  async getHolidayStatus(classId: string, date?: string) {
    const targetDate = date || getShanghaiToday();
    let holidayLabel: string | null = null;

    // 1. 全园假期（type=all）
    const { data: allHolidays } = await this.client
      .from('holidays')
      .select('name, start_date, end_date')
      .eq('type', 'all')
      .lte('start_date', targetDate)
      .gte('end_date', targetDate);
    if ((allHolidays || []).length > 0) {
      holidayLabel = allHolidays![0].name || '全园放假';
    }

    // 2. 班级假期（type=class，target_id=班级id）
    if (!holidayLabel && classId) {
      const { data: classHolidays } = await this.client
        .from('holidays')
        .select('name')
        .eq('type', 'class')
        .eq('target_id', classId)
        .lte('start_date', targetDate)
        .gte('end_date', targetDate);
      if ((classHolidays || []).length > 0) {
        holidayLabel = classHolidays![0].name || '班级放假';
      }
    }

    // 3. 法定节假日（holidays_old type=holiday）
    if (!holidayLabel) {
      const year = parseInt(targetDate.substring(0, 4));
      const { data: statutory } = await this.client
        .from('holidays_old')
        .select('date, name')
        .eq('year', year)
        .eq('type', 'holiday');
      const hit = (statutory || []).find(h => h.date?.substring(0, 10) === targetDate);
      if (hit) holidayLabel = hit.name || '法定节假日';
    }

    // 4. 个人假期（type=personal，target_id=幼儿id）：返回命中该日期的幼儿列表
    const personalHolidayChildIds: string[] = [];
    if (classId) {
      const { data: children } = await this.client
        .from('children')
        .select('id')
        .eq('class_id', classId)
        .eq('status', 'active');
      const childIds = (children || []).map(c => c.id);
      if (childIds.length > 0) {
        const { data: personalHolidays } = await this.client
          .from('holidays')
          .select('target_id')
          .eq('type', 'personal')
          .in('target_id', childIds)
          .lte('start_date', targetDate)
          .gte('end_date', targetDate);
        (personalHolidays || []).forEach(h => {
          if (h.target_id) personalHolidayChildIds.push(h.target_id);
        });
      }
    }

    return {
      is_class_holiday: !!holidayLabel,
      holiday_label: holidayLabel,
      personal_holiday_child_ids: personalHolidayChildIds,
    };
  }
}
    