import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { AuthzService } from '@/auth/authz.service';
import { addDays, isWeekend, isSaturday } from '@/utils/date.util';

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
  notes?: string;
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
  notes?: string;
}

@Injectable()
export class EnrollmentsService {

  constructor(private readonly authz: AuthzService) {}

  private get client() {
    return getSupabaseClient();
  }

  /**
   * 幼儿归属校验（家长仅能查看自己绑定幼儿的报读信息）
   */
  private async checkChildAccess(userId: string, childId: string): Promise<void> {
    const level = await this.authz.getRoleLevel(userId);
    if (level === 'superadmin' || level === 'admin') return;
    if (level === 'parent') {
      const childIds = await this.authz.getParentChildIds(userId);
      if (!childIds.includes(childId)) {
        throw new ForbiddenException('无权查看该幼儿的报读信息');
      }
      return;
    }
    if (level === 'teacher') {
      const classIds = await this.authz.getTeacherClassIds(userId);
      if (!classIds.length) {
        throw new ForbiddenException('无权查看该幼儿的报读信息');
      }
      const { data: child } = await this.client
        .from('children')
        .select('class_id')
        .eq('id', childId)
        .maybeSingle();
      if (!child?.class_id || !classIds.includes(child.class_id)) {
        throw new ForbiddenException('无权查看该幼儿的报读信息');
      }
      return;
    }
    throw new ForbiddenException('无权查看该幼儿的报读信息');
  }

  private async syncExpiredStatus(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await this.client
      .from('enrollments')
      .update({ status: '已结束', updated_at: new Date().toISOString() })
      .eq('status', '进行中')
      .lt('end_date', today);

    if (error) console.error('自动更新过期报读状态失败:', error.message);
  }

  /**
   * 将日期字符串规整为 YYYY-MM-DD（纯字符串提取，不涉及时区）
   */
  private toDateStr(dateStr: string): string {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateStr;
    const [, y, m, d] = match;
    return `${y}-${m}-${d}`;
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

    // 根据课程日期计算规则判断上课日类型（date_calc_rule = 周六 / 工作日）
    const dateCalcRule = await this.resolveDateCalcRule(enr);
    const isSaturdayCourse = dateCalcRule === '周六';
    // 固定月数课程（1个月/3个月/6个月/12个月）：法定节假日不顺延
    const isMonthlyDuration = ['1个月', '3个月', '6个月', '12个月'].includes(enr.duration_type);

    // 查询全园假期：holidays 表 type=all
    const { data: allHolidays } = await this.client
      .from('holidays')
      .select('*')
      .eq('type', 'all');

    // 构建全园假期日期集合（holidays type=all ∪ holidays_old type=holiday）
    const holidaySet = new Set<string>();
    // 记录每个日期来自哪个假期（用于顺延原因归因）
    const holidaySourceMap = new Map<string, { name: string; type: string }>();

    // 展开 holidays type=all 的日期范围，并记录顺延原因
    if (allHolidays) {
      for (const h of allHolidays) {
        if (!h.start_date || !h.end_date) continue;
        const overlapStart = h.start_date > startDate ? h.start_date : startDate;
        const overlapEnd = h.end_date < endDate ? h.end_date : endDate;
        let overlapDays = 0;
        let current = this.toDateStr(overlapStart);
        const maxDate = this.toDateStr(overlapEnd);
        while (current <= maxDate) {
          holidaySet.add(current);
          holidaySourceMap.set(current, { name: h.name, type: 'all' });
          if (!isWeekend(current)) overlapDays++;
          current = addDays(current, 1);
        }
        if (overlapDays > 0) {
          result.details.push({
            name: h.name, type: '全园',
            startDate: overlapStart,
            endDate: overlapEnd,
            overlapDays,
          });
        }
      }
    }

    // 固定月数课程：法定节假日不顺延
    if (!isMonthlyDuration) {
      // 合并 holidays_old type=holiday，并记录顺延原因
      const startYear = parseInt(startDate.substring(0, 4));
      const endYear = parseInt(endDate.substring(0, 4));
      const oldHolidayNames = new Map<string, string[]>();
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
          holidaySourceMap.set(dateStr, { name: h.name, type: 'all' });
          if (!oldHolidayNames.has(h.name)) oldHolidayNames.set(h.name, []);
          oldHolidayNames.get(h.name)!.push(dateStr);
        }
      }
      for (const [name, dates] of oldHolidayNames) {
        dates.sort();
        const workdayDates = dates.filter(d => !isWeekend(d));
        if (workdayDates.length === 0) continue;
        result.details.push({
          name, type: '全园',
          startDate: workdayDates[0],
          endDate: workdayDates[workdayDates.length - 1],
          overlapDays: workdayDates.length,
        });
      }
    }

    if (holidaySet.size === 0) return result;

    if (isSaturdayCourse) {
      // 周六托专属顺延逻辑：只统计假期中落在周六的天数
      // 按假期名称+来源类型分组，展示实际假期名称
      const saturdayHolidayMap = new Map<string, { name: string; type: string; dates: string[] }>();
      for (const dateStr of holidaySet) {
        if (!isSaturday(dateStr)) continue;
        const source = holidaySourceMap.get(dateStr);
        if (!source) continue;
        // 来源类型归一化：all 视为 "全园"
        const displayType = '全园';
        const key = `${source.name}::${displayType}`;
        if (!saturdayHolidayMap.has(key)) {
          saturdayHolidayMap.set(key, { name: source.name, type: displayType, dates: [] });
        }
        saturdayHolidayMap.get(key)!.dates.push(dateStr);
      }

      if (saturdayHolidayMap.size === 0) return result;

      // 统计总顺延天数
      let saturdayCount = 0;
      const details: any[] = [];
      for (const [, group] of saturdayHolidayMap) {
        const dates = group.dates.sort();
        saturdayCount += dates.length;
        details.push({
          name: group.name,
          type: group.type,
          startDate: dates[0],
          endDate: dates[dates.length - 1],
          overlapDays: dates.length,
        });
      }
      // 按开始日期排序：早的放前面
      details.sort((a, b) => a.startDate.localeCompare(b.startDate));

      // 顺延结束日期必须落在合法周六（非法定节假日/非假期管理节假日/非调休补班日）
      // 预加载 end_date 之后的非法周六，供顺延落点跳过
      const satClassId = enr.class_id || '';
      const futureInvalidSaturdays = new Set<string>();
      const futureSStart = addDays(endDate, 1);
      const futureSEnd = addDays(endDate, 730);
      const futureSStartYear = parseInt(futureSStart.substring(0, 4));
      const futureSEndYear = parseInt(futureSEnd.substring(0, 4));
      for (let y = futureSStartYear; y <= futureSEndYear; y++) {
        const { data: futureSOld } = await this.client
          .from('holidays_old')
          .select('date, type')
          .eq('year', y)
          .in('type', ['holiday', 'work_weekend']);
        for (const h of futureSOld || []) {
          const d = h.date?.substring(0, 10);
          if (!d || d < futureSStart || d > futureSEnd) continue;
          if (!isSaturday(d)) continue;
          futureInvalidSaturdays.add(d);
        }
      }
      const { data: futureSHolidays } = await this.client
        .from('holidays')
        .select('*')
        .lte('start_date', futureSEnd)
        .gte('end_date', futureSStart);
      for (const h of futureSHolidays || []) {
        if (h.type === 'class' && h.target_id !== satClassId) continue;
        if (h.type === 'personal' && h.target_id !== enr.child_id) continue;
        if (!h.start_date || !h.end_date) continue;
        let c = this.toDateStr(h.start_date > futureSStart ? h.start_date : futureSStart);
        const max = this.toDateStr(h.end_date < futureSEnd ? h.end_date : futureSEnd);
        while (c <= max) {
          if (isSaturday(c)) futureInvalidSaturdays.add(c);
          c = addDays(c, 1);
        }
      }

      // 从 end_date 之后逐个周六推进，跳过非法周六，数满 saturdayCount 个合法周六
      let extendedDate = endDate;
      let satRemaining = saturdayCount;
      while (satRemaining > 0) {
        extendedDate = addDays(extendedDate, 1);
        if (!isSaturday(extendedDate)) continue;
        if (futureInvalidSaturdays.has(extendedDate)) continue;
        satRemaining--;
      }
      result.extended_end_date = extendedDate;
      result.details = details;
      return result;
    }

    // 非周六托：原有顺延逻辑
    // 班级假期按报读记录所属班级匹配，而非孩子当前所在班级
    const classId = enr.class_id || '';

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
      const overlapStart = h.start_date > startDate ? h.start_date : startDate;
      const overlapEnd = h.end_date < endDate ? h.end_date : endDate;
      let overlapCount = 0;
      let current = this.toDateStr(overlapStart);
      const maxDate = this.toDateStr(overlapEnd);
      while (current <= maxDate) {
        holidaySet.add(current);
        holidaySourceMap.set(current, { name: h.name, type: h.type });
        if (!isWeekend(current)) overlapCount++;
        current = addDays(current, 1);
      }
      if (overlapCount > 0) {
        const displayType = h.type === 'class' ? '班级' : h.type === 'personal' ? '个人' : h.type;
        result.details.push({
          name: h.name,
          type: displayType,
          startDate: h.start_date,
          endDate: h.end_date,
          overlapDays: overlapCount,
        });
      }
    }

    let totalHolidayDays = 0;
    for (const dateStr of holidaySet) {
      if (!isWeekend(dateStr)) totalHolidayDays++;
    }
    if (totalHolidayDays === 0) return result;

    // 顺延结束日期若落在 end_date 之后的节假日（法定节假日 / 假期管理内节假日），需继续顺延至下一个工作日。
    // 预加载未来两年的节假日集合，供顺延落点时跳过。
    const futureHolidaySet = new Set<string>();
    const futureStart = addDays(endDate, 1);
    const futureEnd = addDays(endDate, 730);
    const futureStartYear = parseInt(futureStart.substring(0, 4));
    const futureEndYear = parseInt(futureEnd.substring(0, 4));
    for (let y = futureStartYear; y <= futureEndYear; y++) {
      const { data: futureOldHolidays } = await this.client
        .from('holidays_old')
        .select('date')
        .eq('type', 'holiday')
        .eq('year', y);
      for (const h of futureOldHolidays || []) {
        const d = h.date?.substring(0, 10);
        if (d && d >= futureStart && d <= futureEnd) futureHolidaySet.add(d);
      }
    }
    const { data: futureHolidaysData } = await this.client
      .from('holidays')
      .select('*')
      .lte('start_date', futureEnd)
      .gte('end_date', futureStart);
    for (const h of futureHolidaysData || []) {
      if (h.type === 'class' && h.target_id !== classId) continue;
      if (h.type === 'personal' && h.target_id !== enr.child_id) continue;
      if (!h.start_date || !h.end_date) continue;
      let c = this.toDateStr(h.start_date > futureStart ? h.start_date : futureStart);
      const max = this.toDateStr(h.end_date < futureEnd ? h.end_date : futureEnd);
      while (c <= max) {
        futureHolidaySet.add(c);
        c = addDays(c, 1);
      }
    }

    let extendedDate = endDate;
    let remainingDays = totalHolidayDays;

    while (remainingDays > 0) {
      extendedDate = addDays(extendedDate, 1);
      if (isWeekend(extendedDate)) continue;
      if (holidaySet.has(extendedDate) || futureHolidaySet.has(extendedDate)) continue;
      remainingDays--;
    }

    result.extended_end_date = extendedDate;
    // 按开始日期排序：早的放前面
    result.details.sort((a, b) => a.startDate.localeCompare(b.startDate));

    // ====== 请假顺延逻辑（仅全日托/半日托） ======
    const isFullOrHalfDay = enr.course_type === '全日托' || enr.course_type === '半日托';
    if (isFullOrHalfDay) {
      // 查询该报读记录在课程区间内的请假记录（按 enrollment_id 精确匹配当前报读）
      const { data: leaveRecords, error: leaveError } = await this.client
        .from('attendance')
        .select('date')
        .eq('enrollment_id', enr.id)
        .eq('status', 'leave')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (leaveRecords && leaveRecords.length > 0) {
        // 按日期排序，识别连续请假段
        const leaveDates = leaveRecords.map(r => r.date?.substring(0, 10)).filter(Boolean).sort() as string[];
        const segments: { startDate: string; endDate: string; days: number }[] = [];
        let segStart = leaveDates[0];
        let segEnd = leaveDates[0];
        let segCount = 1;
        for (let i = 1; i < leaveDates.length; i++) {
          const prev = leaveDates[i - 1];
          const curr = leaveDates[i];
          // 判断是否连续（工作日连续：相邻日历日，或中间只隔周六日）
          const diff = (new Date(curr).getTime() - new Date(prev).getTime()) / 86400000;
          let isConsecutive = diff === 1;
          if (!isConsecutive && diff > 1) {
            let gapAllWeekend = true;
            let d = addDays(prev, 1);
            while (d < curr) {
              if (!isWeekend(d)) { gapAllWeekend = false; break; }
              d = addDays(d, 1);
            }
            isConsecutive = gapAllWeekend;
          }
          if (isConsecutive) {
            segEnd = curr;
            segCount++;
          } else {
            if (segCount >= 5) {
              segments.push({ startDate: segStart, endDate: segEnd, days: segCount });
            }
            segStart = curr;
            segEnd = curr;
            segCount = 1;
          }
        }
        // 处理最后一个段
        if (segCount >= 5) {
          segments.push({ startDate: segStart, endDate: segEnd, days: segCount });
        }

        if (segments.length > 0) {
          const totalLeaveDays = segments.reduce((sum, s) => sum + s.days, 0);
          // 在已有顺延基础上再叠加请假天数
          let currentExtDate = result.extended_end_date || endDate;
          let remaining = totalLeaveDays;
          while (remaining > 0) {
            currentExtDate = addDays(currentExtDate, 1);
            if (isWeekend(currentExtDate)) continue;
            if (holidaySet.has(currentExtDate) || futureHolidaySet.has(currentExtDate)) continue;
            remaining--;
          }
          result.extended_end_date = currentExtDate;

          // 添加请假顺延详情
          for (const seg of segments) {
            result.details.push({
              name: '请假',
              type: '个人',
              startDate: seg.startDate,
              endDate: seg.endDate,
              overlapDays: seg.days,
            });
          }
          // 重新排序
          result.details.sort((a, b) => a.startDate.localeCompare(b.startDate));
        }
      }
    }

    return result;
  }

  async calcExtendedEndDateAndPersist(enrollmentId: string): Promise<{ extended_end_date: string | null; details: HolidayDetail[] }> {
    const { extended_end_date: extendedDate, details } = await this.calculateExtendedEndDate(enrollmentId);
    if (extendedDate) {
      await this.client
        .from('enrollments')
        .update({ extended_end_date: extendedDate })
        .eq('id', enrollmentId);
    } else {
      await this.client
        .from('enrollments')
        .update({ extended_end_date: null })
        .eq('id', enrollmentId);
    }
    return { extended_end_date: extendedDate, details };
  }

  async findByChild(userId: string, childId: string): Promise<Enrollment[]> {
    await this.checkChildAccess(userId, childId);
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

    let totalDays = 0;

    // 总课时按报读时长类型计算，不参与 date_calc_rule（date_calc_rule 仅用于日期字段与考勤日历上课日）
    if (enr.duration_type === '一周体验') {
      // 一周体验：固定 5 个工作日，不查数据库
      totalDays = 5;
    } else if (enr.duration_type === '计日') {
      // 计日：直接取计日日数，不做任何日期计算
      totalDays = enr.duration_days || 0;
    } else {
      // 1个月 / 3个月 / 6个月 / 12个月：遍历 start_date ~ end_date 逐日统计工作日天数
      const holidaySet = new Set<string>();          // 法定节假日（不再排除假期管理内日期）
      const transferWorkdaySet = new Set<string>();  // 调休补班日（视为工作日）

      // 法定节假日（type=holiday）与调休补班日（type=work_weekend），跨年查询
      const yearStart = parseInt(enr.start_date.substring(0, 4));
      const yearEnd = parseInt(enr.end_date.substring(0, 4));
      for (let y = yearStart; y <= yearEnd; y++) {
        const { data: oldHolidays } = await this.client
          .from('holidays_old')
          .select('date, type')
          .eq('year', y)
          .in('type', ['holiday', 'work_weekend']);
        for (const h of oldHolidays || []) {
          const dateStr = h.date?.substring(0, 10);
          if (!dateStr || dateStr < enr.start_date || dateStr > enr.end_date) continue;
          if (h.type === 'holiday') holidaySet.add(dateStr);
          else if (h.type === 'work_weekend') transferWorkdaySet.add(dateStr);
        }
      }

      // 逐日统计工作日：排除周六日、法定节假日；调休补班日视为工作日；周六日与假期重叠只扣一次（周六日本身不算工作日）
      let current = enr.start_date;
      while (current <= enr.end_date) {
        const dateStr = this.toDateStr(current);
        const isWorkday = !isWeekend(dateStr) || transferWorkdaySet.has(dateStr);
        const isHoliday = holidaySet.has(dateStr);
        if (isWorkday && !isHoliday) {
          totalDays++;
        }
        current = addDays(current, 1);
      }
    }

    const attEndDate = enr.extended_end_date || enr.end_date;

    // 构建"假期日"集合（与 getAttendanceCalendar 完全一致的四类假期），用于扣除假期日的出勤记录
    const attHolidaySet = new Set<string>();

    // 假期管理内日期（全园/本班级/本幼儿个人）
    const { data: attHolidays } = await this.client
      .from('holidays')
      .select('*')
      .in('type', ['all', 'class', 'personal'])
      .lte('start_date', attEndDate)
      .gte('end_date', enr.start_date);
    for (const h of attHolidays || []) {
      if (h.type === 'class' && h.target_id !== enr.class_id) continue;
      if (h.type === 'personal' && h.target_id !== enr.child_id) continue;
      let hCurrent = h.start_date > enr.start_date ? h.start_date : enr.start_date;
      const maxDate = h.end_date < attEndDate ? h.end_date : attEndDate;
      while (hCurrent <= maxDate) {
        attHolidaySet.add(this.toDateStr(hCurrent));
        hCurrent = addDays(hCurrent, 1);
      }
    }

    // 法定节假日（type=holiday）；调休补班日不算假期
    const attStartYear = parseInt(enr.start_date.substring(0, 4));
    const attEndYear = parseInt(attEndDate.substring(0, 4));
    for (let y = attStartYear; y <= attEndYear; y++) {
      const { data: oldAttHolidays } = await this.client
        .from('holidays_old')
        .select('date, type')
        .eq('year', y)
        .eq('type', 'holiday');
      for (const h of oldAttHolidays || []) {
        const dateStr = h.date?.substring(0, 10);
        if (!dateStr || dateStr < enr.start_date || dateStr > attEndDate) continue;
        attHolidaySet.add(dateStr);
      }
    }

    // 精确按 enrollment_id 匹配当前报读（与 getAttendanceCalendar 保持一致）
    const { data: attendanceRecords } = await this.client
      .from('attendance')
      .select('status, date')
      .eq('enrollment_id', enr.id)
      .gte('date', enr.start_date)
      .lte('date', attEndDate);

    let attendedDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    (attendanceRecords || []).forEach((r: any) => {
      const s = r.status;
      // 落在四类假期日的考勤（present/leave/absent）一律剔除，与考勤日历假期标记对齐
      const dateStr = this.toDateStr(r.date);
      if (attHolidaySet.has(dateStr)) return;
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

  async findActiveByChild(userId: string, childId: string): Promise<Enrollment[]> {
    await this.checkChildAccess(userId, childId);
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

  async findByCourse(courseId: string): Promise<{ child_id: string; child_name: string }[]> {
    await this.syncExpiredStatus();
    const { data: enrollments, error } = await this.client
      .from('enrollments')
      .select('child_id')
      .eq('course_id', courseId)
      .eq('status', '进行中');

    if (error) throw new Error(`查询课程报读失败: ${error.message}`);

    const childIds = Array.from(new Set((enrollments || []).map((e: any) => e.child_id as string).filter(Boolean)));
    if (childIds.length === 0) return [];

    const { data: children, error: childError } = await this.client
      .from('children')
      .select('id, name')
      .in('id', childIds);

    if (childError) throw new Error(`查询幼儿失败: ${childError.message}`);

    const nameMap = new Map<string, string>();
    (children || []).forEach((c: any) => nameMap.set(c.id, c.name));

    return childIds.map((id) => ({ child_id: id, child_name: nameMap.get(id) || '' }));
  }

  async create(userId: string, dto: CreateEnrollmentDto): Promise<Enrollment> {
    const level = await this.authz.getRoleLevel(userId);
    if (!['admin', 'superadmin'].includes(level)) {
      throw new ForbiddenException('仅管理员可创建报读记录');
    }
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
        notes: rest.notes || null,
      })
      .select()
      .single();

    if (error) throw new Error(`创建报读记录失败: ${error.message}`);

    if (data.start_date && data.end_date) {
      const { extended_end_date: extendedDate } = await this.calculateExtendedEndDate(data.id);
      if (extendedDate) {
        await this.client
          .from('enrollments')
          .update({ extended_end_date: extendedDate })
          .eq('id', data.id);
        data.extended_end_date = extendedDate;
      }
    }

    if (class_id) {
      await this.client.from('children').update({ class_id }).eq('id', rest.child_id);
    }

    return data;
  }

  async update(userId: string, id: string, dto: UpdateEnrollmentDto): Promise<Enrollment> {
    const level = await this.authz.getRoleLevel(userId);
    if (!['admin', 'superadmin'].includes(level)) {
      throw new ForbiddenException('仅管理员可更新报读记录');
    }
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
    if (rest.notes !== undefined) updateData.notes = rest.notes;
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

  async remove(userId: string, id: string): Promise<any> {
    // 权限校验：仅超管可删除报读记录
    const level = await this.authz.getRoleLevel(userId);
    if (level !== 'superadmin') {
      return { error: true, code: 403, msg: '仅超级管理员可删除报读记录' };
    }

    const { error } = await this.client
      .from('enrollments')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除报读记录失败: ${error.message}`);
  }

  /**
   * 从课程管理动态解析上课日规则（date_calc_rule）
   * 优先级：课程管理 courses.date_calc_rule -> 报读冗余 date_calc_rule -> 按课程类型推断
   */
  private async resolveDateCalcRule(enr: {
    course_id?: string | null;
    date_calc_rule?: string | null;
    course_type?: string | null;
  }): Promise<string> {
    if (enr.course_id) {
      const { data: course } = await this.client
        .from('courses')
        .select('date_calc_rule')
        .eq('id', enr.course_id)
        .maybeSingle();
      if (course?.date_calc_rule) return course.date_calc_rule;
    }
    if (enr.date_calc_rule) return enr.date_calc_rule;
    return enr.course_type === '周六托' ? '周六' : '工作日';
  }

  /**
   * 判断某天是否符合规则中的星期/调休上课条件（不含假期排除）
   * - 工作日：工作日上课；调休补班日算工作日
   * - 周六：非调休周六上课
   * - 工作日+周六：工作日与非调休周六上课；调休补班日算工作日
   */
  private matchesWeekRule(
    dateStr: string,
    rule: string,
    transferWorkdaySet: Set<string>,
  ): boolean {
    const hasWeekday = rule.includes('工作日');
    const hasSaturday = rule.includes('周六');
    const isTransfer = transferWorkdaySet.has(dateStr);
    const weekend = isWeekend(dateStr);
    const saturday = isSaturday(dateStr);

    if (hasWeekday && hasSaturday) {
      if (isTransfer) return true;
      if (!weekend) return true;
      return saturday;
    }
    if (hasWeekday) {
      if (isTransfer) return true;
      return !weekend;
    }
    if (hasSaturday) {
      return saturday && !isTransfer;
    }
    return false;
  }

  /**
   * 获取考勤日历数据
   * 返回 start_date 到 extended_end_date（或 end_date）完整区间，每个日期标记是否上课日
   */
  async getAttendanceCalendar(enrollmentId: string): Promise<
    Array<{ date: string; status: 'full' | 'half' | 'present' | 'leave' | 'absent' | 'holiday' | null; is_class_day: boolean; name?: string }>
  > {
    const { data: enr, error: enrError } = await this.client
      .from('enrollments')
      .select('id, start_date, end_date, extended_end_date, course_type, child_id, class_id, course_id, date_calc_rule')
      .eq('id', enrollmentId)
      .single();

    if (enrError || !enr) {
      throw new NotFoundException('报读记录不存在');
    }

    const startDate = enr.start_date;
    if (!startDate) return [];
    // 上课期间：start_date ~ 顺延结束日期（无顺延取原始结束日期，未填结束日期则取今天起往后 2 年，保证未来假期都能返回）
    const endDate = enr.extended_end_date || enr.end_date || new Date(Date.now() + 730 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    // 解析上课日规则（从课程管理动态读取）
    const rule = await this.resolveDateCalcRule(enr);

    // 构建假期集合（用于排除非上课日）与调休补班日集合
    const holidaySet = new Set<string>();
    const holidayNameMap = new Map<string, string>();
    const transferWorkdaySet = new Set<string>();

    // 全园/班级/个人假期：班级按报读记录所属班级匹配，个人按 child_id 匹配
    const classId = enr.class_id || '';
    const { data: holidays } = await this.client
      .from('holidays')
      .select('*')
      .in('type', ['all', 'class', 'personal'])
      .lte('start_date', endDate)
      .gte('end_date', startDate);
    const matchingHolidays = (holidays || []).filter((h: any) => {
      if (h.type === 'all') return true;
      if (h.type === 'class') return h.target_id === classId;
      if (h.type === 'personal') return h.target_id === enr.child_id;
      return false;
    });
    for (const h of matchingHolidays) {
      let current = h.start_date > startDate ? h.start_date : startDate;
      const maxDate = h.end_date < endDate ? h.end_date : endDate;
      while (current <= maxDate) {
        const dateStr = this.toDateStr(current);
        holidaySet.add(dateStr);
        if (!holidayNameMap.has(dateStr)) holidayNameMap.set(dateStr, h.name || '假期');
        current = addDays(current, 1);
      }
    }

    // 法定节假日（type=holiday）与调休补班日（type=work_weekend），跨年查询
    const startYear = parseInt(startDate.substring(0, 4));
    const endYear = parseInt(endDate.substring(0, 4));
    for (let y = startYear; y <= endYear; y++) {
      const { data: oldHolidays } = await this.client
        .from('holidays_old')
        .select('date, name, type')
        .eq('year', y)
        .in('type', ['holiday', 'work_weekend']);
      for (const h of oldHolidays || []) {
        const dateStr = h.date?.substring(0, 10);
        if (!dateStr || dateStr < startDate || dateStr > endDate) continue;
        if (h.type === 'holiday') {
          holidaySet.add(dateStr);
          if (!holidayNameMap.has(dateStr)) holidayNameMap.set(dateStr, h.name || '法定节假日');
        } else if (h.type === 'work_weekend') {
          transferWorkdaySet.add(dateStr);
        }
      }
    }

    // 查询出勤记录（按 enrollment_id 精准关联），构建状态映射
    const records = await this.client
      .from('attendance')
      .select('date, status, is_half_day')
      .eq('enrollment_id', enrollmentId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    const statusMap = new Map<string, 'full' | 'half' | 'present' | 'leave' | 'absent'>();
    const isFullDayCourse = enr.course_type === '全日托' || enr.course_type === '周六托';
    for (const r of records.data || []) {
      const dateStr = this.toDateStr(r.date);
      let status: 'full' | 'half' | 'present' | 'leave' | 'absent';
      if (r.status === 'leave') {
        status = 'leave';
      } else if (r.status === 'absent') {
        status = 'absent';
      } else if (isFullDayCourse) {
        // 全日托/周六托：half_day 或 is_half_day 标记 -> 半天；present/full_day 历史记录默认全天
        status = r.status === 'half_day' || r.is_half_day ? 'half' : 'full';
      } else {
        status = 'present';
      }
      statusMap.set(dateStr, status);
    }

    // 遍历完整区间，返回每天（含上课日标记）
    const result: Array<{ date: string; status: 'full' | 'half' | 'present' | 'leave' | 'absent' | 'holiday' | null; is_class_day: boolean; name?: string }> = [];
    let cursor = startDate;
    while (cursor <= endDate) {
      const dateStr = this.toDateStr(cursor);
      const matchesWeek = this.matchesWeekRule(dateStr, rule, transferWorkdaySet);
      const isHoliday = holidayNameMap.has(dateStr);
      let status: 'full' | 'half' | 'present' | 'leave' | 'absent' | 'holiday' | null = null;
      let isClassDay = false;
      if (matchesWeek) {
        if (isHoliday) {
          // 符合上课日规律但因法定节假日/假期放假
          status = 'holiday';
        } else {
          // 实际可上课日
          isClassDay = true;
          status = statusMap.get(dateStr) || null;
        }
      }
      // 非上课日（matchesWeek=false）无论是否假期，status 保持 null，前端置灰、不显示放假标签
      result.push({ date: dateStr, status, is_class_day: isClassDay, name: matchesWeek && isHoliday ? holidayNameMap.get(dateStr) : undefined });
      cursor = addDays(cursor, 1);
    }

    return result;
  }
}
