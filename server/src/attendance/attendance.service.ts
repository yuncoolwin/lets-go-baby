import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getShanghaiToday, isSaturday, isWeekend } from '@/utils/date.util';

@Injectable()
export class AttendanceService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 批量获取某班级某天的点名记录（含完整幼儿信息和课程类型）
   * 每个幼儿可有多条记录（每个课程类型一条）
   * @param classId 班级ID
   * @param date 可选，默认当天
   */
  async findByClassAndDate(classId: string, date?: string) {
    const targetDate = date || getShanghaiToday();

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
   * 管理员端：按班级获取考勤分组概览
   */
  async getAdminOverview(classId: string, date?: string) {
    if (!classId) return [];

    const queryDate = date || getShanghaiToday();
    console.log(`[AdminOverview] classId=${classId}, date=${queryDate}`);

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
  async upsert(dto: {
    child_id: string;
    teacher_id: string;
    class_id: string;
    date: string;
    status: string;
    course_type?: string;
  }) {
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
    return data;
  }

  async clearByClassAndDate(classId: string, date: string, courseType?: string) {
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
    