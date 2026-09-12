import { addDays, isSaturday, isWeekend } from '../../utils/date.util';

/**
 * 假期管理新增字段的辅助工具
 * calculate_extension: 是否参与顺延
 * makeup_start_date / makeup_end_date: 补课区间（该区间内覆盖对应课程类型的日期作为上课日）
 */

/** 判定某日期是否为【工作日类课程】的实际上课日（周一~周五 或 调休上班日） */
export function isWorkdayClassDay(dateStr: string, transferWorkdaySet: Set<string>): boolean {
  const d = new Date(dateStr + 'T00:00:00Z');
  const isWeekendDay = isWeekend(dateStr);
  const isTransfer = transferWorkdaySet.has(dateStr);
  // 周一~周五：上课；调休上班的周六/周日：上课；其余周末：休息
  return !isWeekendDay || isTransfer;
}

/** 判定某日期是否为【周六托】的实际上课日（周六，且非调休补班） */
export function isSaturdayClassDay(dateStr: string, transferWorkdaySet: Set<string>): boolean {
  // 周六且未被调休为工作日（补班周六不上周六托）
  return isSaturday(dateStr) && !transferWorkdaySet.has(dateStr);
}

/**
 * 计算补课区间内落合法上课日，用于判断某日期是否可作为补课上课日。
 * 核心口径：一个假期覆盖哪些课程取决于其假期区间落在的日期——区间内有工作日则覆盖工作日类课程，区间内有周六则覆盖周六托。
 * 这里的"区间"同时适用于假期区间与补课区间。
 */
export interface MakeupRangeInfo {
  /** 补课区间是否覆盖工作日类课程（区间内存在工作日） */
  coversWorkday: boolean;
  /** 补课区间是否覆盖周六托（区间内存在周六） */
  coversSaturday: boolean;
  /** 补课区间内所有日期（YYYY-MM-DD），用于扩展上课日 */
  daySet: Set<string>;
}

/** 解析一个假期记录的补课区间，判断其覆盖的课程类型与日期集合 */
export function evaluateMakeupRange(
  startDate: string,
  endDate: string,
): { coversWorkday: boolean; coversSaturday: boolean; daySet: Set<string> } {
  const daySet = new Set<string>();
  let coversWorkday = false;
  let coversSaturday = false;
  let current = startDate;
  while (current <= endDate) {
    const ds = current;
    daySet.add(ds);
    if (isWorkdayClassDay(ds, new Set())) coversWorkday = true;
    if (isSaturdayClassDay(ds, new Set())) coversSaturday = true;
    current = addDays(current, 1);
  }
  return { coversWorkday, coversSaturday, daySet };
}

/** 单日课程类型：workday=工作日类课程，saturday=周六托，rest=休息日(周日等不可上课) */
export type DayCategory = 'workday' | 'saturday' | 'rest';

/** 判定单日课程类型（不依赖调休集合：周六→周六托，周一~周五→工作日类，其余→rest） */
export function categorizeDay(dateStr: string): DayCategory {
  if (isSaturday(dateStr)) return 'saturday';
  if (isWeekend(dateStr)) return 'rest';
  return 'workday';
}

/**
 * 收集补课区间内属于指定课程类别的上课日集合（裁剪到 [clipStart, clipEnd]）。
 * 用于课时记录 total_days / 考勤日历：补课区间内覆盖该课程类别的日期作为实际上课日。
 * 覆盖判定为区间级：区间内含工作日→覆盖工作日类课程（则该区间内所有日期均为该类补课日，
 * 故周末补课日也计入，不因补课日是周末而被排除）；区间内含周六→覆盖周六托（仅周六计入）。
 * 注：合法节假日/管理假期的排除由调用方结合各自的假期集合处理。
 */
export function collectMakeupClassDays(
  holidays: Array<{ makeup_start_date?: string | null; makeup_end_date?: string | null }>,
  isSaturdayCourse: boolean,
  clipStart: string,
  clipEnd: string,
): Set<string> {
  const set = new Set<string>();
  for (const h of holidays) {
    const ms = h.makeup_start_date;
    const me = h.makeup_end_date;
    if (!ms || !me) continue;
    // 区间级覆盖判定（与 evaluateMakeupRange 一致，但不依赖调休集合）
    const ev = evaluateMakeupRange(ms, me);
    if (isSaturdayCourse) {
      if (!ev.coversSaturday) continue;
      // 周六托：仅补课区间内落在周六的日期
      const from = ms > clipStart ? ms : clipStart;
      const to = me < clipEnd ? me : clipEnd;
      if (from > to) continue;
      let cur = from;
      while (cur <= to) {
        if (isSaturday(cur)) set.add(cur);
        cur = addDays(cur, 1);
      }
    } else {
      if (!ev.coversWorkday) continue;
      // 工作日类课程：补课区间内所有日期均为补课上课日（含周末补课日）
      const from = ms > clipStart ? ms : clipStart;
      const to = me < clipEnd ? me : clipEnd;
      if (from > to) continue;
      let cur = from;
      while (cur <= to) {
        set.add(cur);
        cur = addDays(cur, 1);
      }
    }
  }
  return set;
}

/**
 * 补课作用域两层集合
 * - global：全园(all) + 本班(class) 的补课类别，作用于整班在读判定
 * - personal：按幼儿 child_id 的 personal 补课类别，仅作用于该幼儿在读判定
 */
export interface MakeupLayers {
  global: { workday: boolean; saturday: boolean };
  personal: Record<string, { workday: boolean; saturday: boolean }>;
}

/**
 * 将已查出的补课区间假期记录（含 all/class/personal）构建为两层集合。
 * 一次查询全部命中目标日期的补课记录，避免为每个幼儿做 N+1 查询。
 * - all / 本班(class)：并入 global（对整班生效）
 * - personal：并入 personal[child_id]（仅对该幼儿生效）
 * 判断口径：role 对 course 判定覆盖 —— 区间命中本日且区间覆盖对应课程类别。
 * @param rows 已做 makeup* 非空过滤的 holidays 原记录
 * @param classId 当前班级
 * @param dateStr 目标日期
 */
export function buildMakeupLayers(
  rows: Array<{
    type?: string | null;
    target_id?: string | null;
    makeup_start_date?: string | null;
    makeup_end_date?: string | null;
  }>,
  classId: string,
  dateStr: string,
): MakeupLayers {
  const global: { workday: boolean; saturday: boolean } = { workday: false, saturday: false };
  const personal: Record<string, { workday: boolean; saturday: boolean }> = {};
  for (const h of rows) {
    const ms = h.makeup_start_date;
    const me = h.makeup_end_date;
    if (!ms || !me) continue;
    if (dateStr < ms || dateStr > me) continue;
    const ev = evaluateMakeupRange(ms, me);
    const isSat = isSaturday(dateStr);
    if (h.type === 'personal') {
      if (!h.target_id) continue;
      const bucket = personal[h.target_id] || { workday: false, saturday: false };
      if (isSat) {
        if (ev.coversSaturday) bucket.saturday = true;
      } else {
        if (ev.coversWorkday) bucket.workday = true;
      }
      personal[h.target_id] = bucket;
    } else if (h.type === 'class') {
      if (h.target_id && h.target_id !== classId) continue;
      if (isSat) {
        if (ev.coversSaturday) global.saturday = true;
      } else {
        if (ev.coversWorkday) global.workday = true;
      }
    } else {
      // all
      if (isSat) {
        if (ev.coversSaturday) global.saturday = true;
      } else {
        if (ev.coversWorkday) global.workday = true;
      }
    }
  }
  return { global, personal };
}

/**
 * 判断某日期是否为补课日，并返回它覆盖的课程类别（工作日本/周六托）。
 * 用于考勤页在读幼儿判定：补课日当天按对应课程类型的上课日处理、允许点名。
 * @param holidays 已按作用域(all/class/personal)过滤的假期记录
 * @param dateStr 目标日期
 */
export function isMakeupDateFor(
  holidays: Array<{ makeup_start_date?: string | null; makeup_end_date?: string | null; type?: string }>,
  dateStr: string,
): DayCategory | 'none' {
  const myCat = categorizeDay(dateStr);
  if (myCat === 'rest') return 'none'; // 周日非调休补班，不因补课而成为周六托/工作日的上课日
  for (const h of holidays) {
    const ms = h.makeup_start_date;
    const me = h.makeup_end_date;
    if (!ms || !me) continue;
    if (dateStr >= ms && dateStr <= me) {
      // 落入补课区间：该日期自身的课程类型即它覆盖的课程类别
      return myCat;
    }
  }
  return 'none';
}