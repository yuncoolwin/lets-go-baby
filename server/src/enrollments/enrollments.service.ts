import { Injectable, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface HolidayDetail {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  overlapDays: number;
}

export interface Enrollment {
  id: string;
  child_id: string;
  class_id: string;
  course_type: string;
  course_id?: string;
  duration_type: string;
  duration_days: number;
  start_date: string | null;
  end_date: string | null;
  extended_end_date: string | null;
  payment_amount: string | null;
  payment_channel: string | null;
  status: string;
  date_calc_rule?: string;
  created_at: string;
  updated_at: string;
  attendance_stats?: {
    total_days: number;
    attended_days: number;
    leave_days: number;
    absent_days: number;
  };
}

export interface CreateEnrollmentDto {
  child_id: string;
  class_id?: string;
  course_type: string;
  course_id?: string;
  duration_type: string;
  duration_days: number;
  start_date?: string;
  end_date?: string;
  payment_amount?: string;
  payment_channel?: string;
  status?: string;
  date_calc_rule?: string;
}

export interface UpdateEnrollmentDto {
  course_type?: string;
  course_id?: string;
  duration_type?: string;
  duration_days?: number;
  start_date?: string;
  end_date?: string;
  extended_end_date?: string | null;
  payment_amount?: string;
  payment_channel?: string;
  status?: string;
  class_id?: string;
  date_calc_rule?: string;
}

@Injectable()
export class EnrollmentsService {

  private get client() {
    return getSupabaseClient();
  }

  private async syncExpiredStatus(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await this.client
      .from('enrollments')
      .update({ status: '已结束', updated_at: new Date().toISOString() })
      .eq('status', '进行中')
      .lt('end_date', today);

    if (error) console.error('自动更新过期报读状态失败:', error.message);
  }

  /**
   * 日期字符串加减天数（纯字符串操作，避免 timezone 问题）
   * 输入/输出格式均为 YYYY-MM-DD
   */
  private addDays(dateStr: string, days: number): string {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateStr;
    const [, y, m, d] = match;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d) + days);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  private toDateStr(dateStr: string): string {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateStr;
    const [, y, m, d] = match;
    return `${y}-${m}-${d}`;
  }

  private addDaysUTC(dateStr: string, days: number): string {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateStr;
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d) + days));
    const ny = date.getUTCFullYear();
    const nm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const nd = String(date.getUTCDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  }

  /**
   * 计算顺延结束日期
   */
  async calculateExtendedEndDate(enrollmentId: string): Promise<{ extended_end_date: string | null; details: HolidayDetail[] }> {
    const result = { extended_end_date: null as string | null, details: [] as HolidayDetail[] };

    const { data: enr, error: enrError } = await this.client
      .from('enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (enrError || !enr) return result;
    if (!enr.start_date || !enr.end_date) return result;

    const startDate = enr.start_date;
    const endDate = enr.end_date;

    // 判断是否为周六托课程
    const isSaturdayCourse = enr.course_type?.includes('周六') || false;

    // 查询全园假期：holidays 表 type=all
    const { data: allHolidays } = await this.client
      .from('holidays')
      .select('*')
      .eq('type', 'all');

    // 构建全园假期日期集合（holidays type=all ∪ holidays_old type=holiday）
    const holidaySet = new Set<string>();

    // 展开 holidays type=all 的日期范围
    if (allHolidays) {
      for (const h of allHolidays) {
        if (!h.start_date || !h.end_date) continue;
        let current = this.toDateStr(h.start_date > startDate ? h.start_date : startDate);
        const maxDate = this.toDateStr(h.end_date < endDate ? h.end_date : endDate);
        while (current <= maxDate) {
          holidaySet.add(current);
          current = this.addDaysUTC(current, 1);
        }
      }
    }

    // 合并 holidays_old type=holiday
    const startYear = parseInt(startDate.substring(0, 4));
    const endYear = parseInt(endDate.substring(0, 4));
    for (let y = startYear; y <= endYear; y++) {
      const { data: oldHolidays } = await this.client
        .from('holidays_old')
        .select('date, name')
        .eq('type', 'holiday')
        .eq('year', y);
      for (const h of oldHolidays || []) {
        const dateStr = h.date?.substring(0, 10);
        if (!dateStr || dateStr < startDate || dateStr > endDate) continue;
        holidaySet.add(dateStr);
      }
    }

    if (holidaySet.size === 0) return result;

    if (isSaturdayCourse) {
      // 周六托专属顺延逻辑：只统计假期中落在周六的天数
      let saturdayCount = 0;
      for (const dateStr of holidaySet) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getDay();
        if (dayOfWeek === 6) saturdayCount++;
      }

      if (saturdayCount === 0) return result;

      // 顺延天数 = 假期周六数量，调整到下一个周六（上课日）
      let extendedDate = this.addDays(endDate, saturdayCount);
      const [ey, em, ed] = extendedDate.split('-').map(Number);
      const rawDate = new Date(Date.UTC(ey, em - 1, ed));
      if (rawDate.getUTCDay() !== 6) {
        rawDate.setUTCDate(rawDate.getUTCDate() + ((6 - rawDate.getUTCDay() + 7) % 7));
      }
      const ey2 = rawDate.getUTCFullYear();
      const em2 = String(rawDate.getUTCMonth() + 1).padStart(2, '0');
      const ed2 = String(rawDate.getUTCDate()).padStart(2, '0');
      extendedDate = `${ey2}-${em2}-${ed2}`;
      result.extended_end_date = extendedDate;
      result.details = [{
        name: '周六托顺延',
        type: 'saturday',
        startDate: startDate,
        endDate: endDate,
        overlapDays: saturdayCount,
      }];
      return result;
    }

    // 非周六托：原有顺延逻辑
    const { data: child } = await this.client
      .from('children')
      .select('class_id')
      .eq('id', enr.child_id)
      .single();

    const classId = child?.class_id || '';

    // 查询班级假期和个人假期
    const { data: classPersonalHolidays } = await this.client
      .from('holidays')
      .select('*')
      .in('type', ['class', 'personal'])
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    const matchingHolidays = (classPersonalHolidays || []).filter((h: any) => {
      if (h.type === 'class') return h.target_id === classId;
      if (h.type === 'personal') return h.target_id === enr.child_id;
      return false;
    });

    for (const h of matchingHolidays) {
      let current = this.toDateStr(h.start_date > startDate ? h.start_date : startDate);
      const maxDate = this.toDateStr(h.end_date < endDate ? h.end_date : endDate);
      let overlapCount = 0;
      while (current <= maxDate) {
        holidaySet.add(current);
        overlapCount++;
        current = this.addDaysUTC(current, 1);
      }
      if (overlapCount > 0) {
        result.details.push({
          name: h.name,
          type: h.type,
          startDate: h.start_date,
          endDate: h.end_date,
          overlapDays: overlapCount,
        });
      }
    }

    const totalHolidayDays = holidaySet.size;
    if (totalHolidayDays === 0) return result;

    let extendedDate = endDate;
    let remainingDays = totalHolidayDays;

    while (remainingDays > 0) {
      extendedDate = this.addDays(extendedDate, 1);
      const [y, m, d] = extendedDate.split('-').map(Number);
      const dateUtc = Date.UTC(y, m - 1, d);
      const dayOfWeek = new Date(dateUtc).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      if (holidaySet.has(extendedDate)) continue;
      remainingDays--;
    }

    result.extended_end_date = extendedDate;
    return result;
  }

  async findByChild(childId: string): Promise<Enrollment[]> {
    await this.syncExpiredStatus();
    const { data, error } = await this.client
      .from('enrollments')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询报读记录失败: ${error.message}`);
    const enrollments = data || [];

    const enriched = await Promise.all(
      enrollments.map(async (enr) => {
        const attendanceStats = await this.calculateAttendanceStats(enr);
        return { ...enr, attendance_stats: attendanceStats };
      })
    );

    return enriched;
  }

  private async calculateAttendanceStats(enr: Enrollment): Promise<{
    total_days: number;
    attended_days: number;
    leave_days: number;
    absent_days: number;
  }> {
    if (!enr.start_date || !enr.end_date) {
      return { total_days: 0, attended_days: 0, leave_days: 0, absent_days: 0 };
    }

    const isSaturdayOnly = enr.course_type === '周六托';

    const year = parseInt(enr.start_date.substring(0, 4));

    // 统一假期数据源：holidays 表 type=all ∪ holidays_old 表 type='holiday'
    const allHolidays = new Set<string>();
    // 查询 holidays 表全园假期
    const { data: holidaysData } = await this.client
      .from('holidays')
      .select('*')
      .eq('type', 'all')
      .lte('start_date', enr.end_date)
      .gte('end_date', enr.start_date);
    for (const h of holidaysData || []) {
      let current = h.start_date > enr.start_date ? h.start_date : enr.start_date;
      const maxDate = h.end_date < enr.end_date ? h.end_date : enr.end_date;
      while (current <= maxDate) {
        allHolidays.add(this.toDateStr(current));
        current = this.addDaysUTC(current, 1);
      }
    }
    // 查询 holidays_old 表法定节假日
    const { data: oldHolidays } = await this.client
      .from('holidays_old')
      .select('date')
      .eq('type', 'holiday')
      .eq('year', year);
    for (const h of oldHolidays || []) {
      const dateStr = h.date?.substring(0, 10);
      if (dateStr && dateStr >= enr.start_date && dateStr <= enr.end_date) {
        allHolidays.add(dateStr);
      }
    }

    // 调休补班视为工作日：从 holidays_old 表取 type='work_weekend'
    const transferWorkdays = new Set<string>();
    const { data: workWeekendData } = await this.client
      .from('holidays_old')
      .select('date')
      .eq('type', 'work_weekend')
      .eq('year', year);
    for (const w of workWeekendData || []) {
      const dateStr = w.date?.substring(0, 10);
      if (dateStr && dateStr >= enr.start_date && dateStr <= enr.end_date) {
        transferWorkdays.add(dateStr);
      }
    }

    let totalDays = 0;
    let current = enr.start_date;
    while (current <= enr.end_date) {
      const [y, m, d] = current.split('-').map(Number);
      const dateUtc = Date.UTC(y, m - 1, d);
      const dayOfWeek = new Date(dateUtc).getDay();
      const dateStr = this.toDateStr(current);
      const isHoliday = allHolidays.has(dateStr);
      const isTransferWorkday = transferWorkdays.has(dateStr);
      if (isSaturdayOnly) {
        if (dayOfWeek === 6 && !isHoliday) totalDays++;
      } else {
        if ((dayOfWeek !== 0 && dayOfWeek !== 6 || isTransferWorkday) && !isHoliday) totalDays++;
      }
      current = this.addDaysUTC(current, 1);
    }

    const attEndDate = enr.extended_end_date || enr.end_date;

    let attendanceQuery = this.client
      .from('attendance')
      .select('status')
      .eq('child_id', enr.child_id)
      .gte('date', enr.start_date)
      .lte('date', attEndDate)
      .eq('course_type', enr.course_type);

    const { data: attendanceRecords } = await attendanceQuery;

    let attendedDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    (attendanceRecords || []).forEach((r: any) => {
      const s = r.status;
      if (s === 'present' || s === 'full_day' || s === 'half_day') {
        attendedDays++;
      } else if (s === 'leave') {
        leaveDays++;
      } else if (s === 'absent') {
        absentDays++;
      }
    });

    return {
      total_days: totalDays,
      attended_days: attendedDays,
      leave_days: leaveDays,
      absent_days: absentDays,
    };
  }

  async findActiveByChild(childId: string): Promise<Enrollment[]> {
    await this.syncExpiredStatus();
    const { data, error } = await this.client
      .from('enrollments')
      .select('*')
      .eq('child_id', childId)
      .eq('status', '进行中')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询进行中报读失败: ${error.message}`);
    return data || [];
  }

  async create(dto: CreateEnrollmentDto): Promise<Enrollment> {
    const { class_id, course_id, ...rest } = dto;

    let finalCourseId = course_id || null;
    let finalCourseType = rest.course_type || '';

    if (finalCourseId) {
      const { data: course } = await this.client
        .from('courses')
        .select('name')
        .eq('id', finalCourseId)
        .single();
      if (course) finalCourseType = course.name;
    } else if (finalCourseType) {
      const { data: course } = await this.client
        .from('courses')
        .select('id')
        .eq('name', finalCourseType)
        .maybeSingle();
      if (course) finalCourseId = course.id;
    }

    const { data, error } = await this.client
      .from('enrollments')
      .insert({
        child_id: rest.child_id,
        course_type: finalCourseType,
        course_id: finalCourseId,
        duration_type: rest.duration_type || '',
        duration_days: rest.duration_days || 0,
        start_date: rest.start_date || null,
        end_date: rest.end_date || null,
        payment_amount: rest.payment_amount || null,
        payment_channel: rest.payment_channel || null,
        status: rest.status || '进行中',
        class_id: class_id || null,
        date_calc_rule: rest.date_calc_rule || '工作日',
      })
      .select()
      .single();

    if (error) throw new Error(`创建报读记录失败: ${error.message}`);

    if (data.start_date && data.end_date) {
      const extended = await this.calculateExtendedEndDate(data.id);
      if (extended.extended_end_date) {
        await this.client
          .from('enrollments')
          .update({ extended_end_date: extended.extended_end_date })
          .eq('id', data.id);
        data.extended_end_date = extended.extended_end_date;
      }
    }

    if (class_id) {
      await this.client.from('children').update({ class_id }).eq('id', rest.child_id);
    }

    return data;
  }

  async update(id: string, dto: UpdateEnrollmentDto): Promise<Enrollment> {
    const { class_id, course_id, ...rest } = dto;
    const updateData: Record<string, any> = {};
    if (rest.course_type !== undefined) updateData.course_type = rest.course_type;
    if (course_id !== undefined) updateData.course_id = course_id;
    if (rest.duration_type !== undefined) updateData.duration_type = rest.duration_type;
    if (rest.duration_days !== undefined) updateData.duration_days = rest.duration_days;
    if (rest.start_date !== undefined) updateData.start_date = rest.start_date;
    if (rest.end_date !== undefined) updateData.end_date = rest.end_date;
    if (rest.extended_end_date !== undefined) updateData.extended_end_date = rest.extended_end_date;
    if (rest.payment_amount !== undefined) updateData.payment_amount = rest.payment_amount;
    if (rest.payment_channel !== undefined) updateData.payment_channel = rest.payment_channel;
    if (rest.status !== undefined) updateData.status = rest.status;
    if (rest.date_calc_rule !== undefined) updateData.date_calc_rule = rest.date_calc_rule;
    if (class_id !== undefined) updateData.class_id = class_id;
    updateData.updated_at = new Date().toISOString();

    if (course_id) {
      const { data: course } = await this.client
        .from('courses')
        .select('name')
        .eq('id', course_id)
        .single();
      if (course) updateData.course_type = course.name;
    }

    const { data, error } = await this.client
      .from('enrollments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`更新报读记录失败: ${error.message}`);

    if (data.start_date && data.end_date) {
      const { extended_end_date: extendedDate } = await this.calculateExtendedEndDate(data.id);
      if (extendedDate) {
        await this.client
          .from('enrollments')
          .update({ extended_end_date: extendedDate })
          .eq('id', data.id);
        data.extended_end_date = extendedDate;
      } else {
        await this.client
          .from('enrollments')
          .update({ extended_end_date: null })
          .eq('id', data.id);
        data.extended_end_date = null;
      }
    }

    if (class_id) {
      await this.client.from('children').update({ class_id }).eq('id', data.child_id);
    }

    return data;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client
      .from('enrollments')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除报读记录失败: ${error.message}`);
  }

  /**
   * 获取考勤日历数据
   * 返回 start_date 到 extended_end_date（或 end_date）区间内有考勤记录的日期+状态列表
   */
  async getAttendanceCalendar(enrollmentId: string): Promise<
    Array<{ date: string; status: 'full' | 'half' | 'leave' | 'absent' | 'holiday'; name?: string }>
  > {
    const { data: enr, error: enrError } = await this.client
      .from('enrollments')
      .select('start_date, end_date, extended_end_date, course_type, child_id')
      .eq('id', enrollmentId)
      .single();

    if (enrError || !enr) {
      throw new NotFoundException('报读记录不存在');
    }

    const endDate = enr.extended_end_date || enr.end_date;
    if (!endDate) return [];

    // 查询出勤记录
    const records = await this.client
      .from('attendance')
      .select('date, status')
      .eq('child_id', enr.child_id)
      .eq('course_type', enr.course_type)
      .gte('date', enr.start_date)
      .lte('date', endDate)
      .order('date', { ascending: true });

    const result: Array<{ date: string; status: 'full' | 'half' | 'leave' | 'absent' | 'holiday'; name?: string }> =
      (records.data || []).map((r: any) => {
        let status: 'full' | 'half' | 'leave' | 'absent';
        if (r.status === 'present' || r.status === 'full_day') {
          status = r.is_half_day ? 'half' : 'full';
        } else if (r.status === 'leave') {
          status = 'leave';
        } else {
          status = 'absent';
        }
        return { date: this.toDateStr(r.date), status };
      });

    // 查询该幼儿的班级
    const { data: child } = await this.client
      .from('children')
      .select('class_id')
      .eq('id', enr.child_id)
      .single();

    const classId = child?.class_id || '';

    // 查询假期（与报读日期范围重叠）
    const { data: holidays } = await this.client
      .from('holidays')
      .select('*')
      .in('type', ['all', 'class', 'personal'])
      .lte('start_date', endDate)
      .gte('end_date', enr.start_date);

    // 筛选与幼儿相关的假期
    const matchingHolidays = (holidays || []).filter((h: any) => {
      if (h.type === 'all') return true;
      if (h.type === 'class') return h.target_id === classId;
      if (h.type === 'personal') return h.target_id === enr.child_id;
      return false;
    });

    // 展开 holidays 表假期日期范围并追加到结果
    const holidaySet = new Set<string>();
    for (const h of matchingHolidays) {
      let current = h.start_date > enr.start_date ? h.start_date : enr.start_date;
      const maxDate = h.end_date < endDate ? h.end_date : endDate;
      while (current <= maxDate) {
        const dateStr = this.toDateStr(current);
        if (!holidaySet.has(dateStr)) {
          holidaySet.add(dateStr);
          result.push({ date: dateStr, status: 'holiday', name: h.name || '假期' });
        }
        current = this.addDaysUTC(current, 1);
      }
    }

    // 查询 holidays_old 表法定节假日（type='holiday'），与 holidays 表取并集去重
    const startYear = parseInt(enr.start_date.substring(0, 4));
    const endYear = parseInt(endDate.substring(0, 4));
    for (let y = startYear; y <= endYear; y++) {
      const { data: oldHolidays } = await this.client
        .from('holidays_old')
        .select('date, name')
        .eq('type', 'holiday')
        .eq('year', y);
      for (const h of oldHolidays || []) {
        const dateStr = h.date?.substring(0, 10);
        if (!dateStr || dateStr < enr.start_date || dateStr > endDate) continue;
        if (!holidaySet.has(dateStr)) {
          holidaySet.add(dateStr);
          result.push({ date: dateStr, status: 'holiday', name: h.name || '法定节假日' });
        }
      }
    }

    // 按日期排序：同一日期假期优先于考勤，所以把假期条目移到前面
    const dateOrder: Record<string, number> = { holiday: 0, full: 1, half: 1, leave: 1, absent: 1 };
    result.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (dateOrder[a.status] ?? 1) - (dateOrder[b.status] ?? 1);
    });

    return result;
  }
}
