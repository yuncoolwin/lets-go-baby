import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { AuthzService } from '@/auth/authz.service';
import { WechatService } from '@/auth/wechat.service';
import { addDays, isWeekend, isSaturday } from '@/utils/date.util';
import { collectMakeupClassDays } from '@/children/utils/holiday-helper';
import { festivalBaseName } from '@/children/utils/date-calculator';
import { resolveAttendEndDate } from '@/children/utils/attendance-dates';
import { isChildActive } from '@/common/active-children.util';

export interface HolidayDetail {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  overlapDays: number;
  id?: string;
  isAuto?: boolean;
  isFrozen?: boolean;
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

  constructor(
    private readonly authz: AuthzService,
    private readonly wechat: WechatService,
  ) {}

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
    const { data: actives, error: actErr } = await this.client
      .from('enrollments')
      .select('id, start_date, end_date, extended_end_date, judge_end_date, status')
      .in('status', ['进行中', '已结束']);

    if (actErr) {
      console.error('自动更新过期报读状态失败(查询):', actErr.message);
      return;
    }

    const fromExpired: string[] = []; // 应置为已结束（最后上课日已过）
    const reviveActive: string[] = []; // 应恢复为进行中（最后上课日未过，含补课日）
    for (const e of actives || []) {
      try {
        const attend = await resolveAttendEndDate(this.client, e);
        const activeNow = !!attend && attend >= today;
        if (!activeNow && e.status === '进行中') fromExpired.push(e.id);
        else if (activeNow && e.status === '已结束') reviveActive.push(e.id);
      } catch (err) {
        // 单条计算失败不影响整体，沿用原状态
      }
    }

    if (fromExpired.length) {
      const { error } = await this.client
        .from('enrollments')
        .update({ status: '已结束', updated_at: new Date().toISOString() })
        .in('id', fromExpired)
        .eq('status', '进行中');
      if (error) console.error('自动更新过期报读状态失败:', error.message);
    }
    if (reviveActive.length) {
      const { error } = await this.client
        .from('enrollments')
        .update({ status: '进行中', updated_at: new Date().toISOString() })
        .in('id', reviveActive)
        .eq('status', '已结束');
      if (error) console.error('恢复进行中报读状态失败:', error.message);
    }
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
  async calculateExtendedEndDate(
    enrollmentId: string,
    previewManualRows?: Array<{ name?: string; source_type?: string; start_date?: string | null; end_date?: string | null; overlap_days?: number }>,
    previewFrozen?: Array<{ type?: string; name?: string; startDate?: string | null; endDate?: string | null }>,
  ): Promise<{ extended_end_date: string | null; judge_end_date: string | null; details: HolidayDetail[]; actualExtendDays: number }> {
    const result = { extended_end_date: null as string | null, judge_end_date: null as string | null, details: [] as HolidayDetail[], actualExtendDays: 0 } as { extended_end_date: string | null; judge_end_date: string | null; details: HolidayDetail[]; actualExtendDays: number };

    // 手动顺延明细（基准）：用户在顺延原因弹窗中编辑保存的明细。
    // 提前查询，使下方所有提前 return 分支都能合并手动明细（保证再打开能回显）。
    let manualDays = 0;
    let manualDetails: HolidayDetail[] = [];
    let manualRows: any[] = [];
    if (previewManualRows !== undefined) {
      // 预览模式：使用前端编辑中的临时明细作为手动基准（不落库，仅计算）
      manualRows = previewManualRows;
    } else {
      const { data } = await this.client
        .from('enrollment_extensions')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .eq('source_type', 'manual');
      manualRows = data || [];
    }
    if (manualRows && manualRows.length) {
      manualDetails = manualRows.map((r: any) => ({
        id: r.id,
        name: r.name ?? '',
        // 展示类型优先取 display_type（固化的原类型：全园/个人/...），无则回退 source_type
        type: r.display_type ?? r.source_type ?? 'manual',
        startDate: r.start_date,
        endDate: r.end_date,
        overlapDays: Number(r.overlap_days || 0),
        isAuto: false,
      }));
      manualDays = manualRows.reduce(
        (s: number, r: any) => s + Number(r.overlap_days || 0),
        0,
      );
    }

    // 手动保存时刻：存在手动明细时取其最大 created_at，作为自动顺延源的时间分界。
    // 归一为 'YYYY-MM-DD HH:MM:SS' 以便与 holidays/attendance 的 timestamp 比较。
    let manualSetAt: string | null = null;
    if (manualRows.length > 0) {
      const normTs = (s: any) => (s ? String(s).replace('T', ' ').slice(0, 19) : '');
      for (const r of manualRows) {
        const ts = normTs(r.created_at);
        if (ts && (!manualSetAt || ts > manualSetAt)) manualSetAt = ts;
      }
    }
    // 仅当存在手动明细时，以下自动源查询追加 created_at > manualSetAt：
    // 只统计"手动保存之后新增"的假期/请假，避免追溯改变手动保存前的自动顺延基准。
    // 自动明细始终按假期/考勤配置动态计算，不再按手动保存时间切割
    const manualCut = (q: any) => q;

    const { data: enr, error: enrError } = await this.client
      .from('enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (enrError || !enr) {
      result.details = [...manualDetails, ...(result.details as any[])];
      return result;
    }
    if (!enr.start_date || !enr.end_date) {
      result.details = [...manualDetails, ...(result.details as any[])];
      return result;
    }

    const startDate = enr.start_date;
    const endDate = enr.end_date;

    // 根据课程日期计算规则判断上课日类型（date_calc_rule = 周六 / 工作日）
    const dateCalcRule = await this.resolveDateCalcRule(enr);
    const isSaturdayCourse = dateCalcRule === '周六';
    // 月数课程：新数据统一判 '计月'；历史 1个月/3个月/6个月/12个月 仍按月数课程兼容
    const isMonthlyDuration = enr.duration_type === '计月' || ['1个月', '3个月', '6个月', '12个月'].includes(enr.duration_type);

    // ===== 冻结机制 =====
    // 自动明细冻结占位（kind='frozen_auto'）：存被冻结自动明细的【展示类型::名称::区间】稳定标识。
    // 冻结的自动明细仍展示（置灰）但不参与顺延天数累计与结束日期推进；恢复即删除占位。
    const autoKey = (type: string, name: string, s: string, e: string) =>
      `${type}::${name}::${this.toDateStr(s)}~${this.toDateStr(e)}`;
    let frozenKeys = new Set<string>();
    if (previewFrozen && previewFrozen.length) {
      // 预览模式：使用前端编辑中的【本次冻结集合】实时计算（覆盖库中占位）
      for (const pf of previewFrozen) {
        frozenKeys.add(autoKey(pf.type || '', pf.name || '', pf.startDate || '', pf.endDate || ''));
      }
    } else {
      const { data: frozenRows } = await this.client
        .from('enrollment_extensions')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .eq('kind', 'frozen_auto');
      for (const fr of frozenRows || []) {
        frozenKeys.add(autoKey(fr.display_type || '', fr.name || '', fr.start_date || '', fr.end_date || ''));
      }
    }

    // 查询全园假期：holidays 表 type=all
    const { data: allHolidays } = await manualCut(
      this.client
        .from('holidays')
        .select('*')
        .eq('type', 'all'),
    );

    // 构建全园假期日期集合（holidays type=all ∪ holidays_old type=holiday）
    const holidaySet = new Set<string>();
    // 记录每个日期来自哪个假期（用于顺延原因归因）
    const holidaySourceMap = new Map<string, { name: string; type: string }>();

    // 展开 holidays type=all 的日期范围，并记录顺延原因
    // 仅 calculate_extension===true 的假期参与顺延
    if (allHolidays) {
      for (const h of allHolidays) {
        if (h.calculate_extension === false) continue;
        if (!h.start_date || !h.end_date) continue;
        const overlapStart = h.start_date > startDate ? h.start_date : startDate;
        const overlapEnd = h.end_date < endDate ? h.end_date : endDate;
        let overlapDays = 0;
        let current = this.toDateStr(overlapStart);
        const maxDate = this.toDateStr(overlapEnd);
        while (current <= maxDate) {
          if (!isWeekend(current)) overlapDays++;
          current = addDays(current, 1);
        }
        const key = autoKey('全园', h.name, overlapStart, overlapEnd);
        if (frozenKeys.has(key)) {
          // 冻结：仍展示（置灰）但不计入 holidaySet 与顺延天数
          result.details.push({
            name: h.name, type: '全园',
            startDate: overlapStart, endDate: overlapEnd,
            overlapDays, isFrozen: true,
          });
          continue;
        }
        current = this.toDateStr(overlapStart);
        while (current <= maxDate) {
          holidaySet.add(current);
          holidaySourceMap.set(current, { name: h.name, type: 'all' });
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
        const fs = workdayDates[0];
        const fe = workdayDates[workdayDates.length - 1];
        const key = autoKey('全园', name, fs, fe);
        if (frozenKeys.has(key)) {
          // 冻结：移除该法定节假日全部日期（不计跳过/计数），仍展示置灰
          for (const dd of dates) {
            holidaySet.delete(dd);
            holidaySourceMap.delete(dd);
          }
          result.details.push({
            name, type: '全园',
            startDate: fs, endDate: fe,
            overlapDays: workdayDates.length, isFrozen: true,
          });
          continue;
        }
        result.details.push({
          name, type: '全园',
          startDate: fs,
          endDate: fe,
          overlapDays: workdayDates.length,
        });
      }
    }

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

      // 请假周六：查询 [start_date, end_date+730] 区间内的周六请假（无连续门槛）。
      // 按区间区分处理：
      //  - 原始区间（date <= end_date）请假周六：属正常上课日缺课，计入 saturdayCount（欠课）参与顺延补课；
      //  - 延伸区间（date >  end_date）请假周六：属补课日请假，不计入 saturdayCount，仅将日期加入
      //    futureInvalidSaturdays 跳过集合，使落点跳过这些未补课的周六继续往后找合法周六。
      // 收敛性：请假为人工录入的有限集合，顺延落点每次从原始 end_date 推进，结果确定；
      // 延伸区间请假只做落点跳过、不计入欠课，天然保证不越补越多。
      // 查询上限取 end_date + 730，与落点搜索范围一致，确保所有补课日请假周六都能纳入跳过集合。
      const leaveUpper = addDays(endDate, 730);
      const { data: leaveSatRows } = await manualCut(
        this.client
          .from('attendance')
          .select('date')
          .eq('child_id', enr.child_id)
          .eq('course_type', enr.course_type)
          .eq('status', 'leave')
          .gte('date', startDate)
          .lte('date', leaveUpper),
      );
      const leaveSatDates: string[] = [];
      for (const r of leaveSatRows || []) {
        const dd = r.date?.substring(0, 10);
        if (dd && isSaturday(dd)) leaveSatDates.push(dd);
      }
      leaveSatDates.sort();
      const originalLeaveSat = leaveSatDates.filter((d) => d <= endDate);
      const extendedLeaveSat = leaveSatDates.filter((d) => d > endDate);

      if (saturdayHolidayMap.size === 0 && originalLeaveSat.length === 0 && (!manualRows || manualRows.length === 0)) return result;

      // 若存在手动明细行（即使天数为 0），合并回显并返回
      if (saturdayHolidayMap.size === 0 && originalLeaveSat.length === 0 && manualDays === 0) {
        result.details = [...manualDetails, ...(result.details as any[])];
        return result;
      }

      // 统计总顺延天数（假期周六 + 请假周六）
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
      if (originalLeaveSat.length > 0) {
        saturdayCount += originalLeaveSat.length;
        details.push({
          name: '请假',
          type: '个人',
          startDate: originalLeaveSat[0],
          endDate: originalLeaveSat[originalLeaveSat.length - 1],
          overlapDays: originalLeaveSat.length,
        });
      }
      // 延伸区间请假周六：不计入 saturdayCount（不新增欠课），仅作顺延原因展示
      if (extendedLeaveSat.length > 0) {
        details.push({
          name: '请假',
          type: '个人',
          startDate: extendedLeaveSat[0],
          endDate: extendedLeaveSat[extendedLeaveSat.length - 1],
          overlapDays: extendedLeaveSat.length,
        });
      }
      // 按开始日期排序：早的放前面
      details.sort((a, b) => { const as = String((a as any).startDate || ''); const bs = String((b as any).startDate || ''); if (!as && bs) return 1; if (as && !bs) return -1; return as.localeCompare(bs) });

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
      const { data: futureSHolidays } = await manualCut(
        this.client
          .from('holidays')
          .select('*')
          .lte('start_date', futureSEnd)
          .gte('end_date', futureSStart),
      );
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

      // 延伸区间内（end_date 之后）的请假周六：属补课日请假未完成补课，加入 futureInvalidSaturdays
      // 跳过集合继续往后找合法周六（原始区间内的请假周六不加入跳过集合，它们已被计为欠课参与顺延）
      for (const dd of extendedLeaveSat) {
        if (dd >= futureSStart && dd <= futureSEnd) {
          futureInvalidSaturdays.add(dd);
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
      // 手动覆盖：一旦该报读存在手动顺延明细（enrollment_extensions 非空），
      // 顺延结束日期与明细展示完全以手动明细为准（覆盖自动，不叠加自动假期/自动请假）
      if (manualRows && manualRows.length > 0) {
        let mm = endDate;
        let mmr = manualDays;
        while (mmr > 0) {
          mm = addDays(mm, 1);
          if (!isSaturday(mm)) continue;
          if (futureInvalidSaturdays.has(mm)) continue;
          mmr--;
        }
        result.extended_end_date = mm;
        result.details = [...manualDetails];
        return result;
      }
      result.extended_end_date = extendedDate;
      result.details = [...details];
      return result;
    }

    // 非周六托：原有顺延逻辑
    // 班级假期按报读记录所属班级匹配，而非孩子当前所在班级
    const classId = enr.class_id || '';

    // 查询班级假期和个人假期
    const { data: classPersonalHolidays } = await manualCut(
      this.client
        .from('holidays')
        .select('*')
        .in('type', ['class', 'personal'])
        .lte('start_date', endDate)
        .gte('end_date', startDate),
    );

    const matchingHolidays = (classPersonalHolidays || []).filter((h: any) => {
      if (h.type === 'class') return h.target_id === classId;
      if (h.type === 'personal') return h.target_id === enr.child_id;
      return false;
    });

    for (const h of matchingHolidays) {
      if (h.calculate_extension === false) continue;
      const overlapStart = h.start_date > startDate ? h.start_date : startDate;
      const overlapEnd = h.end_date < endDate ? h.end_date : endDate;
      const displayType = h.type === 'class' ? '班级' : h.type === 'personal' ? '个人' : h.type;
      const frozenKey = `${displayType}::${h.name}::${h.start_date}~${h.end_date}`;
      const isFrozen = frozenKeys.has(frozenKey);
      let overlapCount = 0;
      let current = this.toDateStr(overlapStart);
      const maxDate = this.toDateStr(overlapEnd);
      while (current <= maxDate) {
        if (!isFrozen) {
          holidaySet.add(current);
          holidaySourceMap.set(current, { name: h.name, type: h.type });
        }
        if (!isWeekend(current)) overlapCount++;
        current = addDays(current, 1);
      }
      result.details.push({
        name: h.name,
        type: displayType,
        startDate: h.start_date,
        endDate: h.end_date,
        overlapDays: overlapCount,
        ...(isFrozen ? { isFrozen: true } : {}),
      });
    }

    let totalHolidayDays = 0;
    for (const dateStr of holidaySet) {
      if (!isWeekend(dateStr)) totalHolidayDays++;
    }

    // 顺延结束日期若落在 end_date 之后的节假日（法定节假日 / 假期管理内节假日），需继续顺延至下一个工作日。
    // 预加载未来两年的节假日集合，供顺延落点时跳过（请假顺延同样需要，故不在此提前 return）。
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
    // 园区/班级/个人假期是既定的出勤日历事实（如台风停课），不受手动保存时间分界影响，始终完整纳入未来跳过集合
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

    // 构建园区停课假期的补课日出勤集合（makeup 区间内的日期作为合法出勤落点，不算周末）
    const makeupDaySet = new Set<string>();
    for (const h of futureHolidaysData || []) {
      if (h.type === 'class' && h.target_id !== classId) continue;
      if (h.type === 'personal' && h.target_id !== enr.child_id) continue;
      if (!h.makeup_start_date || !h.makeup_end_date) continue;
      let mc = this.toDateStr(h.makeup_start_date > futureStart ? h.makeup_start_date : futureStart);
      const mcMax = this.toDateStr(h.makeup_end_date < futureEnd ? h.makeup_end_date : futureEnd);
      while (mc <= mcMax) {
        makeupDaySet.add(mc);
        mc = addDays(mc, 1);
      }
    }

    // ====== 调休补班日上课判定条件化（工作日在读课程，非周六托） ======
    // 目标：某法定节假日的调休补班日(work_weekend)是否该幼儿工作日在读课程的实际上课日，
    // 取决于该法定节假日(type=holiday)是否落在幼儿在读课程区间 [start_date, 顺延结束时间] 内。
    //  - 落在区间内 → 该补班日是上课日（需补课、可作顺延落点/计入）
    //  - 不在区间内 → 该补班日不算该课程上课日（不补课，按普通周末处理）
    // festivalDatesByName: Map<name, string[]> —— 各法定节假日日期按 name 归组
    // makeupDateToName: Map<date, name> —— 补班日(work_weekend) → 其法定节假日名
    const festivalDatesByName = new Map<string, string[]>();
    const makeupDateToName = new Map<string, string>();
    const origMinYear = Math.min(parseInt(startDate.substring(0, 4)), parseInt(endDate.substring(0, 4)));
    {
      const { data: festivalRows } = await this.client
        .from('holidays_old')
        .select('date, type, name, year');
      // 先收集节日名全集（用于补班日名称模糊归一化）
      const festivalNames = new Set<string>();
      for (const r of festivalRows || []) {
        if (r.type === 'holiday' && String(r.name || '')) festivalNames.add(String(r.name));
      }
      for (const r of festivalRows || []) {
        const y = Number(r.year);
        const d = String(r.date || '').substring(0, 10);
        if (!d || y < origMinYear || y > futureEndYear) continue;
        if (r.type === 'holiday') {
          const nm = String(r.name || '');
          if (!nm) continue;
          if (!festivalDatesByName.has(nm)) festivalDatesByName.set(nm, []);
          festivalDatesByName.get(nm)!.push(d);
        } else if (r.type === 'work_weekend') {
          // 补班日 name 为空或匹配不到节假日，一律按非上课日处理；归一到节日全名后与 festivalDatesByName 关联
          if (String(r.name || '')) makeupDateToName.set(d, festivalBaseName(String(r.name), festivalNames));
        }
      }
    }
    // 节假日是否落在在读区间 [start_date, upper]（upper 随顺延结束日期动态推进）
    const isFestivalInReadRange = (name: string, upper: string): boolean => {
      const dates = festivalDatesByName.get(name);
      if (!dates || dates.length === 0) return false;
      for (const d of dates) if (d >= startDate && d <= upper) return true;
      return false;
    };
    // 原始区间内法定节假日集合（无论月数/计日，用于连续性判定与段内实际上课日统计）
    const statutorySetFull = new Set<string>();
    const statutoryStartYear = parseInt(startDate.substring(0, 4));
    const statutoryEndYear = parseInt(endDate.substring(0, 4));
    for (let y = statutoryStartYear; y <= statutoryEndYear; y++) {
      const { data: origOldHols } = await this.client
        .from('holidays_old')
        .select('date')
        .eq('type', 'holiday')
        .eq('year', y);
      for (const h of origOldHols || []) {
        const d = String(h.date || '').substring(0, 10);
        if (d && d >= startDate && d <= endDate) statutorySetFull.add(d);
      }
    }
    // 原始区间内"非实际上课日"集合：全园/班级/个人假期 + 法定节假日（用于连续性判定）
    const nonClassSetFull = new Set<string>(holidaySet);
    for (const s of statutorySetFull) nonClassSetFull.add(s);
    // 统一判定：工作日在读课程某日是否为实际上课日（upper 为在读区间上界，默认 endDate，随顺延动态推进）
    const makeIsClassDay = (upper: string) => (d: string): boolean => {
      // 法定/园定/假期管理停课日 → 非上课日
      if (holidaySet.has(d) || futureHolidaySet.has(d) || statutorySetFull.has(d)) return false;
      // 自然周末：仅当为园区补课日，或法定调休补班日且其对应节假日落在在读区间内才是上课日
      if (isWeekend(d)) {
        if (makeupDaySet.has(d)) return true;                       // 园区停课补课日：无条件上课
        const fname = makeupDateToName.get(d);                      // 法定调休补班日
        if (fname && isFestivalInReadRange(fname, upper)) return true;
        return false;
      }
      // 自然周一~周五
      return true;
    };

    // 手动 + 未冻结自动（自动假期 totalHolidayDays）合计顺延天数，一次推进。
    // 手动明细始终并入 details 用于回显（即使 overlapDays 全为 0）
    if (manualRows && manualRows.length > 0) {
      result.details = [...manualDetails, ...result.details];
    }
    // 按开始日期排序：早的放前面
    result.details.sort((a, b) => { const as = String((a as any).startDate || ''); const bs = String((b as any).startDate || ''); if (!as && bs) return 1; if (as && !bs) return -1; return as.localeCompare(bs) });

    

    // ====== 请假顺延逻辑（按报读时长口径执行：计月 / 计日等非周六课程） ======
    // 适用对象重定义：不再用 course_type==='全日托'||'半日托' 判断，改按 enr.duration_type：
    //  - 月数课程(duration_type === '计月'，历史 1/3/6/12个月 仍兼容)：单段连续请假自然日跨度≥5 计入顺延
    //  - 计日课程(duration_type === '计日')：无门槛，每一段连续请假都计入顺延
    //  - 周六托(isSaturdayCourse 为真)：不做本块处理，走上方"周六请假顺延分支"，避免重复双算
    //  - 其余工作日/非周六课程：统一走本块（非月数非计日按 ≥5 门槛保守处理，维持原有行为）
    if (!isSaturdayCourse) {
      // 请假统计范围：仅落在原始报读区间 [start_date, end_date]（原始结课日期，不含顺延部分）内的
      // status='leave' 日期；查询上界用 enr.end_date（不再用 extended_end_date），
      // 位于 end_date 之后延伸区间内发生的请假不参与顺延天数计算（不作为向后落点推进输入）。
      const { data: leaveRecords } = await manualCut(
        this.client
          .from('attendance')
          .select('date')
          .eq('child_id', enr.child_id)
          .eq('course_type', enr.course_type)
          .eq('status', 'leave')
          .gte('date', startDate)
          .lte('date', enr.end_date)
          .order('date', { ascending: true }),
      );
      const rawLeaveDates = ((leaveRecords || [])
        .map(r => String(r.date || '').substring(0, 10))
        .filter(Boolean) as string[]).sort();

      // 固定点迭代：计算"判定上界 judgeEnd"（综合落点）——由 combined = 假期/手动 + 请假 + 缺课补偿(missedMakeup)
      // 从 end_date 逐日按 isClassDay 推进得到。用于判断"幼儿在读区间是否覆盖某法定节假日"、计算 actualExtendDays、
      // 决定哪些调休补班日需补课。（与"顺延至 extended_end_date"解耦，见下方实际顺延天数推进）
      let upperBound = endDate;
      let judgeEnd = endDate;
      let finalSegments: { startDate: string; endDate: string; span: number; n: number }[] = [];
      let finalCounted: typeof finalSegments = [];
      const totalExtendBase = totalHolidayDays + (manualDays || 0);
      for (let iter = 0; iter < 6; iter++) {
        const isClassDay = makeIsClassDay(upperBound);
        // 仅保留原始区间内"实际上课日"的请假日（调休补班日若上课也计入），再按自然日升序分段
        const leaveDates = rawLeaveDates.filter(d => isClassDay(d));
        const segments: { startDate: string; endDate: string; span: number; n: number }[] = [];
        if (leaveDates.length > 0) {
          let segStart = leaveDates[0];
          let segEnd = leaveDates[0];
          const flush = (s: string, e: string) => {
            const span = Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1);
            let n = 0;
            let d = s;
            while (d <= e) {
              if (isClassDay(d)) n++;
              d = addDays(d, 1);
            }
            segments.push({ startDate: s, endDate: e, span, n });
          };
          // 连续性判定：相邻请假日中间只要是"周末 或法定/园/班/个人停课日"即视为同一次连续请假
          for (let i = 1; i < leaveDates.length; i++) {
            const prev = leaveDates[i - 1];
            const curr = leaveDates[i];
            const diff = (new Date(curr).getTime() - new Date(prev).getTime()) / 86400000;
            let isConsecutive = diff === 1;
            if (!isConsecutive && diff > 1) {
              let gapOk = true;
              let d = addDays(prev, 1);
              while (d < curr) {
                if (!isWeekend(d) && !nonClassSetFull.has(d)) { gapOk = false; break; }
                d = addDays(d, 1);
              }
              isConsecutive = gapOk;
            }
            if (isConsecutive) segEnd = curr;
            else { flush(segStart, segEnd); segStart = curr; segEnd = curr; }
          }
          flush(segStart, segEnd);
        }
        // 触发门槛：月数课程单段连续请假"自然日跨度≥5"才计入；计日无门槛每段计入
        const needThreshold = enr.duration_type !== '计日';
        const countedSegs = segments.filter((s) => {
          if (frozenKeys.has(`个人::请假::${s.startDate}~${s.endDate}`)) return false;
          if (needThreshold && s.span < 5) return false;
          return true;
        });
        const totalLeaveDays = countedSegs.reduce((sum, s) => sum + s.n, 0);
        finalSegments = segments;
        finalCounted = countedSegs;

        // ====== 缺课补偿（missedMakeup） ======
        // 在顺延后在读区间 [start_date, upperBound] 内，按 isClassDay 找出所有应上课的法定调休补班日；
        // 其中日期 < 计算当天系统日期的每个补班日：当天无考勤记录 → missedMakeup += 1（已提前补课的不计）；
        // 日期 ≥ 今天的补班日不计。missedMakeup 只影响落点延伸与补课日安排，不影响 actualExtendDays。
        let missedMakeup = 0;
        if (upperBound) {
          const { data: attRows } = await manualCut(
            this.client
              .from('attendance')
              .select('date')
              .eq('child_id', enr.child_id)
              .eq('course_type', enr.course_type)
              .gte('date', startDate)
              .lte('date', upperBound),
          );
          const presentSet = new Set((attRows || []).map(r => String(r.date || '').substring(0, 10)));
          const todayStr = this.toDateStr(new Date().toISOString().slice(0, 10));
          let dd = startDate;
          while (dd <= upperBound) {
            if (isWeekend(dd) && makeupDateToName.has(dd) && isClassDay(dd) && dd < todayStr && !presentSet.has(dd)) missedMakeup++;
            dd = addDays(dd, 1);
          }
        }

        // 判定上界推进（综合落点）：假期/手动/请假累计 + 缺课补偿一起从 endDate 逐日按 isClassDay 推进，数满即停。
        // 此结果仅用作 judgeEnd（判断节日在读区间、取算 actualExtendDays、补课安排），不再直接作为"顺延至"。
        const combined = totalExtendBase + totalLeaveDays + missedMakeup;
        let ext = endDate;
        let rem = combined;
        while (rem > 0) {
          ext = addDays(ext, 1);
          if (!isClassDay(ext)) continue;
          rem--;
        }
        if (ext === judgeEnd) break;
        judgeEnd = ext;
        upperBound = ext;
      }
      if (judgeEnd > endDate) result.judge_end_date = judgeEnd;

      // 添加请假顺延详情：计入顺延的段 overlapDays 填"段内实际上课日天数"（非自然日）；
      // 命中 个人::请假::startDate~endDate 冻结的段不参与推进但仍展示并标 frozen；跨度<5 的非冻结段忽略
      for (const seg of finalSegments) {
        const frz = frozenKeys.has(`个人::请假::${seg.startDate}~${seg.endDate}`);
        if (!finalCounted.includes(seg) && !frz) continue;
        result.details.push({
          name: '请假',
          type: '个人',
          startDate: seg.startDate,
          endDate: seg.endDate,
          overlapDays: seg.n,
          ...(frz ? { isFrozen: true } : {}),
        });
      }
      if (result.details.length) {
        result.details.sort((a, b) => { const as = String((a as any).startDate || ''); const bs = String((b as any).startDate || ''); if (!as && bs) return 1; if (as && !bs) return -1; return as.localeCompare(bs) });
      }
    }

    // ====== 实际顺延天数（展示口径） ======
    // detailsSum = details 各条 overlapDays 之和
    // 取判定上界 judgeEnd 遍历其中出现的法定节假日组（任一天在区间即整组计入）：
    //   H = 该节假日在读区间内全部法定日期数；MW = 该节假日全部调休补班日数；SW = 该节假日法定日期落在周六/周日数
    // actualExtendDays = detailsSum - Σ(H - MW - SW) - ΣMW = detailsSum - Σ(H - SW)，结果 <0 归 0
    {
      const detailsSum = result.details.reduce((sum, x) => sum + (Number((x as any).overlapDays) || 0), 0);
      const judgeUpper = result.judge_end_date || endDate;
      const makeupCountByName = new Map<string, number>();
      for (const mwDate of makeupDateToName.keys()) {
        const nm = makeupDateToName.get(mwDate)!;
        makeupCountByName.set(nm, (makeupCountByName.get(nm) || 0) + 1);
      }
      let festAdj = 0;
      let sumMW = 0;
      for (const [name, dates] of festivalDatesByName.entries()) {
        if (!dates.some((d) => d >= startDate && d <= judgeUpper)) continue;
        const H = dates.length;
        const MW = makeupCountByName.get(name) || 0;
        const SW = dates.filter((d) => isWeekend(d)).length;
        festAdj += H - MW - SW;
        sumMW += MW;
      }
      result.actualExtendDays = Math.max(0, detailsSum - festAdj - sumMW);
    }

    // ====== 顺延至落点 extended_end_date（与判定上界解耦） ======
    // 由 end_date + actualExtendDays 个"自然工作日上课日"推进得到；actual 为 0 时落点即 end_date。
    // 推进只数自然周一~五上课日（排除法定/园区停课日与周末），法定节假日调休补班日不占顺延（由补课单独承载）。
    {
      const advanceClassDay = (d: string): boolean => {
        if (isWeekend(d)) return false;
        if (holidaySet.has(d) || futureHolidaySet.has(d) || statutorySetFull.has(d)) return false;
        return true;
      };
      let extEnd = endDate;
      let rem = result.actualExtendDays;
      while (rem > 0) {
        extEnd = addDays(extEnd, 1);
        if (!advanceClassDay(extEnd)) continue;
        rem--;
      }
      result.extended_end_date = extEnd;
    }

    return result;
  }

  async getManualExtensions(enrollmentId: string): Promise<{ manual: any[]; frozen: any[] }> {
    const { data, error } = await this.client
      .from('enrollment_extensions')
      .select('id, name, source_type, kind, display_type, start_date, end_date, overlap_days')
      .eq('enrollment_id', enrollmentId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`查询手动顺延明细失败: ${error.message}`);
    const rows = data || [];
    const toDto = (r: any) => ({
      id: r.id,
      name: r.name ?? '',
      type: r.display_type ?? r.source_type ?? 'manual',
      startDate: r.start_date,
      endDate: r.end_date,
      overlapDays: Number(r.overlap_days || 0),
    });
    return {
      manual: rows.filter((r: any) => r.kind !== 'frozen_auto').map(toDto),
      frozen: rows.filter((r: any) => r.kind === 'frozen_auto').map(toDto),
    };
  }

  async previewManualExtensions(
    enrollmentId: string,
    payload:
      | {
          manualDetails?: Array<{ name?: string; type?: string; startDate?: string; endDate?: string; overlapDays?: number }>;
          frozenAuto?: Array<{ name?: string; type?: string; startDate?: string; endDate?: string; overlapDays?: number }>;
        }
      | Array<{ name?: string; type?: string; startDate?: string; endDate?: string; overlapDays?: number }>,
  ): Promise<{ extended_end_date: string | null; judge_end_date: string | null; actualExtendDays: number }> {
    // 仅计算预览结果，不落库；以编辑中的临时明细作为手动基准
    const details = Array.isArray(payload) ? payload : payload.manualDetails || [];
    const frozenAuto = Array.isArray(payload) ? [] : payload.frozenAuto || [];
    const rows = (details || [])
      .filter((d) => d)
      .map((d) => ({
        name: d.name ?? '',
        source_type: d.type || 'manual',
        start_date: d.startDate || null,
        end_date: d.endDate || null,
        overlap_days: Number(d.overlapDays || 0),
      }));
    const frozenPreview = (frozenAuto || []).filter((d) => d && d.name).map((d) => ({
      type: d.type,
      name: d.name,
      startDate: d.startDate,
      endDate: d.endDate,
    }));
    const { extended_end_date: extendedDate, judge_end_date: judgeEndDate, actualExtendDays } = await this.calculateExtendedEndDate(enrollmentId, rows, frozenPreview);
    return { extended_end_date: extendedDate, judge_end_date: judgeEndDate, actualExtendDays };
  }

  async saveManualExtensions(
    enrollmentId: string,
    payload:
      | {
          manualDetails?: Array<{ name: string; type?: string; startDate?: string; endDate?: string; overlapDays?: number }>;
          frozenAuto?: Array<{ name: string; type?: string; startDate?: string; endDate?: string; overlapDays?: number }>;
        }
      | Array<{ name: string; type?: string; startDate?: string; endDate?: string; overlapDays?: number }>,
  ): Promise<{ extended_end_date: string | null; judge_end_date: string | null; details: HolidayDetail[]; actualExtendDays: number }> {
    // 兼容旧形态：直接传手动明细数组
    const manualDetails = Array.isArray(payload) ? payload : payload?.manualDetails || [];
    const frozenAuto = Array.isArray(payload) ? [] : (payload as any)?.frozenAuto || [];

    // 先确认报读存在
    const { data: enr, error: enrErr } = await this.client
      .from('enrollments')
      .select('id')
      .eq('id', enrollmentId)
      .maybeSingle();
    if (enrErr || !enr) throw new Error('报读记录不存在');

    // 删除旧的手动明细与冻结占位，按本次集合重建
    const { error: delErr } = await this.client
      .from('enrollment_extensions')
      .delete()
      .eq('enrollment_id', enrollmentId);
    if (delErr) throw new Error(`清空手动顺延明细失败: ${delErr.message}`);

    // 手动明细：source_type=manual + kind=manual，展示类型存 display_type
    const mRows = (manualDetails || [])
      .filter((d) => d && d.name)
      .map((d) => ({
        enrollment_id: enrollmentId,
        name: d.name,
        source_type: 'manual',
        kind: 'manual',
        display_type: d.type || '手动',
        start_date: d.startDate || null,
        end_date: d.endDate || null,
        overlap_days: Number(d.overlapDays || 0),
      }));
    if (mRows.length) {
      const { error: insErr } = await this.client.from('enrollment_extensions').insert(mRows);
      if (insErr) throw new Error(`保存手动顺延明细失败: ${insErr.message}`);
    }

    // 冻结占位：记录被冻结自动明细的稳定标识（展示类型::名称::区间），恢复时删除
    const fRows = (frozenAuto || [])
      .filter((d) => d && d.name)
      .map((d) => ({
        enrollment_id: enrollmentId,
        name: d.name,
        source_type: 'frozen',
        kind: 'frozen_auto',
        display_type: d.type || '全园',
        start_date: d.startDate || null,
        end_date: d.endDate || null,
        overlap_days: Number(d.overlapDays || 0),
      }));
    if (fRows.length) {
      const { error: insErr } = await this.client.from('enrollment_extensions').insert(fRows);
      if (insErr) throw new Error(`保存冻结占位失败: ${insErr.message}`);
    }

    // 重算并写回 extended_end_date
    return this.calcExtendedEndDateAndPersist(enrollmentId);
  }

  async calcExtendedEndDateAndPersist(enrollmentId: string): Promise<{ extended_end_date: string | null; judge_end_date: string | null; details: HolidayDetail[]; actualExtendDays: number }> {
    const { extended_end_date: extendedDate, judge_end_date: judgeEndDate, details, actualExtendDays } = await this.calculateExtendedEndDate(enrollmentId);
    await this.client
      .from('enrollments')
      .update({ extended_end_date: extendedDate, judge_end_date: judgeEndDate })
      .eq('id', enrollmentId);
    return { extended_end_date: extendedDate, judge_end_date: judgeEndDate, details, actualExtendDays };
  }

  /**
   * 判定上界（判节日/划补课区间）读取，缺失时惰性重算并落库回填 judge_end_date（沿用 calcExtendedEndDateAndPersist），
   * 确保补课日（如调休补班日国庆 10-10）能进入考勤日历与考勤统计，而非退回原始结束日期导致不显示。
   * @returns { judge, extended } —— 判定上界与顺延落点（可能被回填更新）
   */
  private async ensureJudgeUpper(enr: {
    id?: string;
    start_date?: string | null;
    end_date?: string | null;
    extended_end_date?: string | null;
    judge_end_date?: string | null;
  }): Promise<{ judge: string | null; extended: string | null }> {
    const oriEnd = enr.end_date || '';
    const extNow = enr.extended_end_date || oriEnd;
    if (enr.judge_end_date) return { judge: enr.judge_end_date, extended: enr.extended_end_date || null };
    if (enr.id) {
      try {
        const r = await this.calcExtendedEndDateAndPersist(enr.id);
        return { judge: r.judge_end_date || extNow, extended: r.extended_end_date };
      } catch (e) {
        console.log(`[JudgeUpper] backfill failed for ${enr.id}, fallback to extended`, (e as Error)?.message || e);
      }
    }
    return { judge: extNow, extended: enr.extended_end_date || null };
  }

  async findByChild(userId: string, childId: string): Promise<Enrollment[]> {
    await this.checkChildAccess(userId, childId);
    await this.syncExpiredStatus();
    // 已删除（archived）幼儿：报读记录不再返回
    if (!(await isChildActive(childId))) return [];
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

    const dateCalcRule = await this.resolveDateCalcRule(enr);
    const isSaturdayCourse = dateCalcRule === '周六';
    // 考勤统计上界：默认顺延落点；judge_end_date 缺失时惰性重算回填，覆盖可能的补课日（调休补班日）
    const oriStatEnd = enr.extended_end_date || enr.end_date;
    let attEndDate = oriStatEnd;
    try {
      const { judge: judgeUp, extended: extUp } = await this.ensureJudgeUpper(enr);
      const extRef = extUp || enr.extended_end_date || enr.end_date;
      attEndDate = judgeUp && judgeUp > extRef ? judgeUp : extRef;
    } catch (e) {
      attEndDate = oriStatEnd;
    }
    const attStartDate = enr.start_date;

    // 法定节假日（type=holiday）与调休补班日（type=work_weekend），跨 start~attEndDate 查询
    // 注意：周六托在调休补班日（周末被调为工作日）不上课，故调休补班日在周六托中视为非法上课日
    const legalHolidaySet = new Set<string>();
    const transferWorkdaySet = new Set<string>();
    const calStartYear = parseInt(enr.start_date.substring(0, 4));
    const calEndYear = parseInt(attEndDate.substring(0, 4));
    // 法定节假日与调休补班日的名称映射（用于判定补班日是否属于在读区间内的节日）
    const festivalDatesByName: Record<string, string[]> = {};
    const makeupDateToName: Record<string, string> = {};
    for (let y = calStartYear; y <= calEndYear; y++) {
      const { data: oldHols } = await this.client
        .from('holidays_old')
        .select('date, type, name')
        .eq('year', y)
        .in('type', ['holiday', 'work_weekend']);
      for (const h of oldHols || []) {
        const dateStr = h.date?.substring(0, 10);
        if (!dateStr || dateStr < enr.start_date || dateStr > attEndDate) continue;
        if (h.type === 'holiday') {
          legalHolidaySet.add(dateStr);
          const nm = String(h.name || '');
          if (nm) {
            if (!festivalDatesByName[nm]) festivalDatesByName[nm] = [];
            festivalDatesByName[nm].push(dateStr);
          }
        } else if (h.type === 'work_weekend') {
          if (String(h.name || '')) makeupDateToName[dateStr] = festivalBaseName(String(h.name));
          transferWorkdaySet.add(dateStr);
        }
      }
    }
    // 调休补班日上课条件化：仅当该补班日所属节假日落在在读区间 [start_date, 顺延结束时间(attEndDate)] 内才算上课日，
    // 否则按普通周末处理（不计入应出勤）
    const inReadRange = (name: string) => {
      const dates = festivalDatesByName[name];
      if (!dates || dates.length === 0) return false;
      return dates.some((d) => d >= attStartDate && d <= attEndDate);
    };
    // 用节日全名集对补班日归一化名做模糊匹配（兼容历史简名：国庆调休→国庆节）
    const festivalNames = new Set<string>(Object.keys(festivalDatesByName));
    for (const wd of Object.keys(makeupDateToName)) {
      makeupDateToName[wd] = festivalBaseName(makeupDateToName[wd], festivalNames);
    }
    for (const wd of [...transferWorkdaySet]) {
      const nm = makeupDateToName[wd];
      if (!nm || !inReadRange(nm)) transferWorkdaySet.delete(wd);
    }

    // 假期管理内日期（全园/本班级/本幼儿个人），覆盖 start~attEndDate
    const mgmtHolidaySet = new Set<string>();
    const { data: mgmtHols } = await this.client
      .from('holidays')
      .select('*')
      .in('type', ['all', 'class', 'personal'])
      .lte('start_date', attEndDate)
      .gte('end_date', enr.start_date);
    for (const h of mgmtHols || []) {
      if (h.type === 'class' && h.target_id !== enr.class_id) continue;
      if (h.type === 'personal' && h.target_id !== enr.child_id) continue;
      let hCurrent = h.start_date > enr.start_date ? h.start_date : enr.start_date;
      const maxDate = h.end_date < attEndDate ? h.end_date : attEndDate;
      while (hCurrent <= maxDate) {
        mgmtHolidaySet.add(this.toDateStr(hCurrent));
        hCurrent = addDays(hCurrent, 1);
      }
    }

    // 补课上课日集合：只有设置了补课区间的假期（本作用域内）才产生补课上课日。
    // 补课区间覆盖本课程类型的日期作为实际上课日计入总课时与出勤；不因补课日是周末而被排除。
    const makeupDaySet = collectMakeupClassDays(
      (mgmtHols || []).filter((h: any) =>
        (h.type === 'all') ||
        (h.type === 'class' && h.target_id === enr.class_id) ||
        (h.type === 'personal' && h.target_id === enr.child_id),
      ),
      isSaturdayCourse,
      enr.start_date,
      attEndDate,
    );

    let totalDays = 0;
    // 总课时按报读时长类型计算
    if (enr.duration_type === '一周体验') {
      // 一周体验：固定 5 个上课日
      totalDays = 5;
    } else if (enr.duration_type === '计日') {
      // 计日：直接取计日日数，不参与日期规则
      totalDays = enr.duration_days || 0;
    } else if (isSaturdayCourse) {
      // 周六托固定月数/周数：按 date_calc_rule=周六 统计原始报读区间(start~end_date)内合法周六（排除法定节假日、管理假期、调休补班日）。
      // 总课时为报读区间固定值，不随顺延补课期膨胀；补课周六不计入。
      let cur = enr.start_date;
      while (cur <= enr.end_date) {
        const ds = this.toDateStr(cur);
        const regular = isSaturday(ds) && !legalHolidaySet.has(ds) && !mgmtHolidaySet.has(ds) && !transferWorkdaySet.has(ds);
        if (regular) totalDays++;
        cur = addDays(cur, 1);
      }
    } else {
      // 工作日课程固定月数/周数：仅统计原始报读区间(start~end_date)内纯工作日 + 调休补班日、排除法定节假日的天数。
      // 补课日不计入总课时。
      let cur = enr.start_date;
      while (cur <= enr.end_date) {
        const ds = this.toDateStr(cur);
        const isWorkday = !isWeekend(ds) || transferWorkdaySet.has(ds);
        const isHoliday = legalHolidaySet.has(ds);
        const regular = isWorkday && !isHoliday;
        if (regular) totalDays++;
        cur = addDays(cur, 1);
      }
    }

    // 出勤统计扣除集合 = 法定节假日 ∪ 管理假期
    const attHolidaySet = new Set<string>(legalHolidaySet);
    for (const d of mgmtHolidaySet) attHolidaySet.add(d);

    const { data: attendanceRecords } = await this.client
      .from('attendance')
      .select('status, date')
      .eq('child_id', enr.child_id)
      .eq('course_type', enr.course_type)
      .gte('date', enr.start_date)
      .lte('date', attEndDate);

    let attendedDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    (attendanceRecords || []).forEach((r: any) => {
      const s = r.status;
      const dateStr = this.toDateStr(r.date);
      // 落在假期日（法定节假日/管理假期）的考勤一律剔除，与考勤日历假期标记对齐
      if (attHolidaySet.has(dateStr)) return;
      // 补课日（包含顺延补课期）出勤正常计入 attended/leave/absent。
      // 总课时为固定上限，不强制"出勤+请假+缺席 ≤ 总课时"；补课的实际出勤应予以体现。
      if (makeupDaySet.has(dateStr)) {
        if (!(['present', 'full_day', 'half_day', 'leave', 'absent'].includes(s as string))) return;
        if (s === 'leave') leaveDays++;
        else if (s === 'absent') absentDays++;
        else attendedDays++;
        return;
      }
      // 上课日规则过滤：只统计符合上课日的日期，与考勤日历口径一致
      if (isSaturdayCourse) {
        // 周六托：仅周六且非调休补班日
        if (!isSaturday(dateStr) || transferWorkdaySet.has(dateStr)) return;
      } else {
        // 工作日托：工作日 + 调休补班日
        if (isWeekend(dateStr) && !transferWorkdaySet.has(dateStr)) return;
      }
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
    // 已删除（archived）幼儿：在读课程不再返回
    if (!(await isChildActive(childId))) return [];
    const { data, error } = await this.client
      .from('enrollments')
      .select('*')
      .eq('child_id', childId)
      .eq('status', '进行中')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询进行中报读失败: ${error.message}`);
    return data || [];
  }

  async findByCourse(courseId: string, date?: string): Promise<{ child_id: string; child_name: string; class_id?: string | null; is_drop_in?: boolean }[]> {
    await this.syncExpiredStatus();

    // 课程名：临时来园记录以课程名作为 course_type 匹配
    let courseName = '';
    {
      const { data: course, error } = await this.client
        .from('courses')
        .select('name')
        .eq('id', courseId)
        .maybeSingle();
      if (!error && course) courseName = (course as any).name || '';
    }

    const { data: enrollments, error } = await this.client
      .from('enrollments')
      .select('child_id, class_id')
      .or(`course_id.eq.${courseId},course_type.eq.${courseName}`)
      .eq('status', '进行中');

    if (error) throw new Error(`查询课程报读失败: ${error.message}`);

    const childIds = Array.from(new Set((enrollments || []).map((e: any) => e.child_id as string).filter(Boolean)));
    const classMap = new Map<string, string | null>();
    (enrollments || []).forEach((e: any) => classMap.set(e.child_id as string, (e as any).class_id ?? null));

    // 报读幼儿（不提前 return，保留后面的临时来园合并）
    const result: { child_id: string; child_name: string; class_id: string | null; is_drop_in: boolean }[] = [];

    if (childIds.length > 0) {
      const { data: children, error: childError } = await this.client
        .from('children')
        .select('id, name, class_id')
        .in('id', childIds);

      if (childError) throw new Error(`查询幼儿失败: ${childError.message}`);

      (children || []).forEach((c: any) => {
        result.push({
          child_id: c.id,
          child_name: c.name || '',
          class_id: c.class_id ?? classMap.get(c.id) ?? null,
          is_drop_in: false,
        });
      });
    }

    // 临时来园幼儿：drop_in_records 按 course_type=课程名、date=指定日期
    if (date && courseName) {
      const { data: dropIns, error: dropInError } = await this.client
        .from('drop_in_records')
        .select('child_id, class_id')
        .eq('course_type', courseName)
        .eq('date', date);
      if (dropInError) throw new Error(`查询临时来园幼儿失败: ${dropInError.message}`);

      // 补充幼儿姓名（drop_in_records 不存 child_name）
      const dropChildIds = Array.from(new Set((dropIns || []).map((d: any) => d.child_id as string).filter(Boolean)));
      const nameMap = new Map<string, string>();
      if (dropChildIds.length > 0) {
        const { data: dropChildren, error: dropChildError } = await this.client
          .from('children')
          .select('id, name')
          .in('id', dropChildIds);
        if (dropChildError) throw new Error(`查询临时来园幼儿姓名失败: ${dropChildError.message}`);
        (dropChildren || []).forEach((c: any) => nameMap.set(c.id, c.name || ''));
      }

      const existing = new Set(result.map(r => r.child_id));
      (dropIns || []).forEach((d: any) => {
        if (!d.child_id || existing.has(d.child_id)) return;
        existing.add(d.child_id);
        result.push({
          child_id: d.child_id,
          child_name: nameMap.get(d.child_id) || '',
          class_id: d.class_id ?? null,
          is_drop_in: true,
        });
      });
    }

    return result;
  }

  /**
   * 按日期返回当天「课程 ↔ 在读幼儿」映射（含临时来园）
   * 供成长档案等「先选课程再看幼儿 / 先选幼儿再看课程」双向联动使用
   */
  async findByDate(date?: string): Promise<{
    date: string;
    courses: Array<{
      course_id: string;
      course_name: string;
      children: Array<{ child_id: string; child_name: string; class_id: string | null; is_drop_in: boolean }>;
    }>;
  }> {
    await this.syncExpiredStatus();
    const day = date || '';

    const { data: courses } = await this.client.from('courses').select('id, name');
    const courseList = courses || [];
    const courseNameById = new Map<string, string>(courseList.map((c: any) => [c.id, c.name]));
    const courseIdByName = new Map<string, string>(courseList.map((c: any) => [c.name, c.id]));

    // 进行中报读：course_id -> 幼儿集合
    const { data: enrollments } = await this.client
      .from('enrollments')
      .select('child_id, class_id, course_id, course_type')
      .eq('status', '进行中');
    const courseChildSet: Record<string, Set<string>> = {};
    const childClassMap: Record<string, string | null> = {};
    for (const e of enrollments || []) {
      // course_id 为空时按 course_type（课程名）兜底归入对应课程
      let cid: string = e.course_id;
      if (!cid && e.course_type) cid = courseIdByName.get(e.course_type) || '';
      if (!cid) continue;
      if (!courseChildSet[cid]) courseChildSet[cid] = new Set();
      courseChildSet[cid].add(e.child_id);
      if (!(e.child_id in childClassMap)) childClassMap[e.child_id] = e.class_id ?? null;
    }

    // 临时来园：date 命中，按 course_type（课程名）归入对应课程
    const dropInCourseChildSet: Record<string, Set<string>> = {};
    if (day) {
      const { data: dropIns } = await this.client
        .from('drop_in_records')
        .select('child_id, class_id, course_type, date')
        .eq('date', day);
      for (const d of dropIns || []) {
        if (!d.child_id) continue;
        const cid = courseIdByName.get(d.course_type);
        if (!cid) continue; // 课程已停用/删除，跳过
        if (!courseChildSet[cid]) courseChildSet[cid] = new Set();
        courseChildSet[cid].add(d.child_id);
        if (!dropInCourseChildSet[cid]) dropInCourseChildSet[cid] = new Set();
        dropInCourseChildSet[cid].add(d.child_id);
        if (!(d.child_id in childClassMap)) childClassMap[d.child_id] = d.class_id ?? null;
      }
    }

    // 汇总所有涉及幼儿，批量取姓名
    const allChildIds = Array.from(new Set(Object.values(courseChildSet).flatMap((s) => [...s])));
    const childNameMap = new Map<string, string>();
    if (allChildIds.length > 0) {
      const { data: children } = await this.client
        .from('children')
        .select('id, name')
        .in('id', allChildIds);
      for (const c of children || []) childNameMap.set(c.id, c.name || '');
    }

    // 仅保留当天有在读幼儿（报读或临时任一）的课程
    const coursesOut: any[] = [];
    for (const c of courseList) {
      const childIds = courseChildSet[c.id] ? Array.from(courseChildSet[c.id]) : [];
      if (childIds.length === 0) continue;
      const dropSet = dropInCourseChildSet[c.id];
      coursesOut.push({
        course_id: c.id,
        course_name: c.name,
        children: childIds
          .map((chid) => ({
            child_id: chid,
            child_name: childNameMap.get(chid) || '',
            class_id: childClassMap[chid] ?? null,
            is_drop_in: !!dropSet?.has(chid),
          }))
          .filter((x) => x.child_id),
      });
    }

    return { date: day, courses: coursesOut };
  }

  async create(userId: string, dto: CreateEnrollmentDto): Promise<Enrollment> {
    const level = await this.authz.getRoleLevel(userId);
    if (!['admin', 'superadmin', 'teacher'].includes(level)) {
      throw new ForbiddenException('无权创建报读记录');
    }
    const { class_id, course_id, ...rest } = dto;

    // teacher：放开创建，但仅限本人带教的班级（报读班级与幼儿所在班级均须在带教集合内）
    if (level === 'teacher') {
      const classIds = await this.authz.getTeacherClassIds(userId);
      if (!classIds.length) {
        throw new ForbiddenException('当前教师账号未绑定班级，无权创建报读记录');
      }
      const has = (cid: string | null | undefined) => !!cid && classIds.includes(cid);
      if (!has(class_id)) {
        throw new ForbiddenException('无权为该班级幼儿创建报读记录');
      }
      if (!rest.child_id) {
        throw new ForbiddenException('创建报读记录缺少 child_id');
      }
      const { data: childRow } = await this.client
        .from('children')
        .select('class_id')
        .eq('id', rest.child_id)
        .maybeSingle();
      if (!childRow || !has(childRow.class_id)) {
        throw new ForbiddenException('无权为该班级幼儿创建报读记录');
      }
    }

    // 内容安全：报读备注入库前过检
    const notesSafe = await this.wechat.checkText(rest.notes || '');
    if (!notesSafe) {
      throw new ForbiddenException('备注包含违规内容，请修改后再提交');
    }

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
    if (!['admin', 'superadmin', 'teacher'].includes(level)) {
      throw new ForbiddenException('无权更新报读记录');
    }
    const { class_id, course_id, ...rest } = dto;

    // 内容安全：报读备注入库前过检（仅当有变更时）
    if (rest.notes !== undefined) {
      const notesSafe = await this.wechat.checkText(rest.notes || '');
      if (!notesSafe) {
        throw new ForbiddenException('备注包含违规内容，请修改后再提交');
      }
    }

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

    // 查询旧报读记录，保存旧值用于联动考勤
    const { data: oldEnr } = await this.client
      .from('enrollments')
      .select('id, child_id, course_type, start_date, end_date, extended_end_date, class_id')
      .eq('id', id)
      .single();
    const oldCourseType = oldEnr?.course_type;
    const oldStartDate = oldEnr?.start_date;
    const oldEndDate = oldEnr?.end_date;
    const oldExtendedDate = oldEnr?.extended_end_date;
    const oldClassId = oldEnr?.class_id;

    // teacher：放开更新，但仅限本人带教的班级（旧记录班级、幼儿所在班级、新班级均须在带教集合内）
    if (level === 'teacher') {
      const classIds = await this.authz.getTeacherClassIds(userId);
      if (!classIds.length) {
        throw new ForbiddenException('当前教师账号未绑定班级，无权更新报读记录');
      }
      const has = (cid: string | null | undefined) => !!cid && classIds.includes(cid);
      if (!has(oldEnr?.class_id)) {
        throw new ForbiddenException('无权更新该班级幼儿的报读记录');
      }
      if (oldEnr?.child_id) {
        const { data: childRow } = await this.client
          .from('children')
          .select('class_id')
          .eq('id', oldEnr.child_id)
          .maybeSingle();
        if (!childRow || !has(childRow.class_id)) {
          throw new ForbiddenException('无权更新该班级幼儿的报读记录');
        }
      }
      if (class_id !== undefined && !has(class_id)) {
        throw new ForbiddenException('无权将报读记录改到非本班班级');
      }
    }

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
    const newCourseType = data?.course_type;

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

    // 联动更新考勤：课程调整时同步该报读名下考勤的 course_type / status / is_half_day，并按新区间重算 enrollment_id
    if (oldCourseType && newCourseType && oldCourseType !== newCourseType) {
      // 1) 该报读名下（已关联 enrollment_id）考勤 course_type 更新为新值
      await this.client
        .from('attendance')
        .update({ course_type: newCourseType })
        .eq('enrollment_id', id);

      // 2) 兼容历史未回填 enrollment_id 的考勤：按 child_id + 旧 course_type + 旧区间匹配更新
      const oldEnd = oldExtendedDate || oldEndDate;
      await this.client
        .from('attendance')
        .update({ course_type: newCourseType })
        .eq('child_id', data.child_id)
        .eq('course_type', oldCourseType)
        .gte('date', data.start_date ? data.start_date : oldStartDate)
        .lte('date', oldEnd || data.end_date)
        .is('enrollment_id', null);
    }

    // 3) 联动转换考勤 status：仅当涉及全日托与其它课程互转时处理 full_day/half_day/present，absent/leave 一律保持
    if (oldCourseType && newCourseType && oldCourseType !== newCourseType) {
      const fromFullDay = oldCourseType === '全日托';
      const toFullDay = newCourseType === '全日托';
      if (fromFullDay && !toFullDay) {
        // 全日托 → 其它：status full_day/half_day 统一改 present，清空 is_half_day
        await this.client
          .from('attendance')
          .update({ status: 'present', is_half_day: null })
          .eq('enrollment_id', id)
          .in('status', ['full_day', 'half_day']);
      } else if (toFullDay && !fromFullDay) {
        // 其它 → 全日托：status present 统一改 full_day（全天出勤），half_day 保持
        await this.client
          .from('attendance')
          .update({ status: 'full_day' })
          .eq('enrollment_id', id)
          .eq('status', 'present');
      }
      // 其它方向（非全日托互转）status 不变；absent/leave 一律不变
    }

    // 4) 按新区间重算 enrollment_id：先解除本报读原关联（区间外置 null），再按新区间归属
    if (data.start_date && data.end_date) {
      const newEnd = data.extended_end_date || data.end_date;
      // 4a) 将本报读中不在新区间内的考勤 enrollment_id 置为 null
      await this.client
        .from('attendance')
        .update({ enrollment_id: null, updated_at: new Date().toISOString() })
        .eq('enrollment_id', id)
        .lt('date', data.start_date);
      await this.client
        .from('attendance')
        .update({ enrollment_id: null, updated_at: new Date().toISOString() })
        .eq('enrollment_id', id)
        .gt('date', newEnd || data.end_date);
      // 4b) 按 child_id + 新 course_type + date 落在新区间 [start_date, COALESCE(extended, end)] 内匹配，更新 enrollment_id
      await this.client
        .from('attendance')
        .update({ enrollment_id: id, updated_at: new Date().toISOString() })
        .eq('child_id', data.child_id)
        .eq('course_type', newCourseType)
        .gte('date', data.start_date)
        .lte('date', newEnd);
    }

    // 5) 班级变更联动：报读班级变化时，同步该报读名下考勤的 class_id 到新班级
    if (class_id && oldClassId && class_id !== oldClassId) {
      // 5a) 已关联 enrollment_id 的考勤 class_id 更新为新班级
      await this.client
        .from('attendance')
        .update({ class_id, updated_at: new Date().toISOString() })
        .eq('enrollment_id', id);

      // 5b) 兼容历史未回填 enrollment_id 的考勤：按 child_id + 旧课程类型 + 旧区间匹配更新
      const oldEnd2 = oldExtendedDate || oldEndDate;
      await this.client
        .from('attendance')
        .update({ class_id, updated_at: new Date().toISOString() })
        .eq('child_id', data.child_id)
        .eq('course_type', oldCourseType)
        .gte('date', oldStartDate)
        .lte('date', oldEnd2 || oldEndDate)
        .is('enrollment_id', null);
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
    Array<{ date: string; status: 'full' | 'half' | 'present' | 'leave' | 'absent' | 'holiday' | null; is_class_day: boolean; name?: string; is_adjust?: boolean; is_makeup?: boolean }>
  > {
    const { data: enr, error: enrError } = await this.client
      .from('enrollments')
      .select('id, start_date, end_date, extended_end_date, judge_end_date, course_type, child_id, class_id, course_id, date_calc_rule')
      .eq('id', enrollmentId)
      .single();

    if (enrError || !enr) {
      throw new NotFoundException('报读记录不存在');
    }

    const startDate = enr.start_date;
    if (!startDate) return [];
    // 原始结束/默认观察窗口
    const oriEnd = enr.end_date || new Date(Date.now() + 730 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    // 判定上界与顺延落点：judge_end_date 缺失时惰性重算回填，避免补课日不进日历
    const { judge: judgeBack, extended: extBack } = await this.ensureJudgeUpper(enr);
    // 判定上界（判节日在读区间用）
    const judgeRef = judgeBack || oriEnd;
    // 顺延至上界（普通实际上课日仅到此处为止）
    const extScope = extBack || oriEnd;
    // 日历区间上界：覆盖到能显示所需补课日的上界，取 max(extended_end_date, judge_end_date)
    const endDate = extScope > judgeRef ? extScope : judgeRef;

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

    // 补课上课日集合：区间覆盖本课程类型的日期作为实际上课日（可上课、不标放假），可显示考勤状态
    const makeupDaySet = collectMakeupClassDays(matchingHolidays, rule === '周六', startDate, endDate);

    // 法定节假日（type=holiday）与调休补班日（type=work_weekend），跨年查询
    // 调休补班日是否上课，取决于其对应法定节假日是否落在幼儿在读课程区间 [start_date, endDate(顺延后)]
    const startYear = parseInt(startDate.substring(0, 4));
    const endYear = parseInt(endDate.substring(0, 4));
    const festivalDatesByName = new Map<string, string[]>();
    const makeupDateToName = new Map<string, string>();
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
          const nm = String(h.name || '');
          if (nm) {
            if (!festivalDatesByName.has(nm)) festivalDatesByName.set(nm, []);
            festivalDatesByName.get(nm)!.push(dateStr);
          }
        } else if (h.type === 'work_weekend') {
          if (String(h.name || '')) makeupDateToName.set(dateStr, festivalBaseName(String(h.name)));
        }
      }
    }
    // 仅当补班日对应节假日在判定上界 [start_date, judgeRef] 内时，该补班日(调休补班)才作为该幼儿的补课日
    // 用节日全名集对补班日归一化名做模糊匹配（兼容历史简名：国庆调休→国庆节）
    const fNames = new Set(festivalDatesByName.keys());
    for (const dt of makeupDateToName.keys()) {
      makeupDateToName.set(dt, festivalBaseName(makeupDateToName.get(dt)!, fNames));
    }
    for (const dt of makeupDateToName.keys()) {
      const nm = makeupDateToName.get(dt)!;
      const fd = festivalDatesByName.get(nm);
      if (fd && fd.some((x) => x >= startDate && x <= judgeRef)) transferWorkdaySet.add(dt);
    }

    // 查询出勤记录（按 child_id+course_type 关联，兼容 enrollment_id 为 null/错配的历史考勤），构建状态映射
    const records = await this.client
      .from('attendance')
      .select('date, status, is_half_day')
      .eq('child_id', enr.child_id)
      .eq('course_type', enr.course_type)
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
    const result: Array<{ date: string; status: 'full' | 'half' | 'present' | 'leave' | 'absent' | 'holiday' | null; is_class_day: boolean; is_adjust?: boolean; is_makeup?: boolean; name?: string }> = [];
    let cursor = startDate;
    while (cursor <= endDate) {
      const dateStr = this.toDateStr(cursor);
      const matchesWeek = this.matchesWeekRule(dateStr, rule, transferWorkdaySet);
      const isHoliday = holidayNameMap.has(dateStr);
      // 补课上课日（园区/班/个人停课补课日）：区间覆盖本课程类型，标记为可上课
      const isMakeupDay = makeupDaySet.has(dateStr);
      // 法定节假日调休补班日：仅在判定上界内作为该幼儿的"补课"日（区别于普通上课日）
      const isTransferMakeup = transferWorkdaySet.has(dateStr);
      let status: 'full' | 'half' | 'present' | 'leave' | 'absent' | 'holiday' | null = null;
      let isClassDay = false;
      if (isTransferMakeup || isMakeupDay) {
        // 调休补班/园区补课日：均为可上课（补课）日，可显示考勤状态
        isClassDay = true;
        status = statusMap.get(dateStr) || null;
      } else if (matchesWeek) {
        if (isHoliday) {
          // 符合上课日规律但放假日
          status = 'holiday';
        } else if (dateStr <= extScope) {
          // 普通实际上课日——仅限"顺延至上界"之内；超出 extScope 的普通工作日不作为上课日（如 10-8、9、12、13、14）
          isClassDay = true;
          status = statusMap.get(dateStr) || null;
        }
      }
      // 非上课日（不在补课/补班集合，或超出顺延而至的普通工作日）无论是否假期，status 保持 null，前端置灰
      result.push({ date: dateStr, status, is_class_day: isClassDay, is_adjust: isTransferMakeup || isMakeupDay, is_makeup: isTransferMakeup, name: matchesWeek && isHoliday && !isTransferMakeup && !isMakeupDay ? holidayNameMap.get(dateStr) : undefined });
      cursor = addDays(cursor, 1);
    }

    return result;
  }
}
