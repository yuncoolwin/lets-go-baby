/**
 * 计算课程「考勤最后上课日」（last attend date）
 *
 * 口径：课程在读期间最后一个实际上课日 = max(end_date, extended_end_date, 读区间内最后一个需补课的调休补班日)。
 * - judge_end_date 仅用作「判节日上界」：决定读区间内哪些调休补班日需补课，本身不作为上课日。
 *   （温文涛全日托 9-1~9-30、实际顺延0天、judge=10-13，补课日为 9-20 与 10-10，故结果为 10-10）
 * - 无补课日时退回 extended_end_date || end_date。
 */

interface AttendEnr {
  start_date?: string | null;
  end_date?: string | null;
  extended_end_date?: string | null;
  judge_end_date?: string | null;
}

interface AttendClient {
  from: (table: string) => any;
}

/** 取日期前 10 位 yyyy-mm-dd（纯字符串，不涉及时区） */
function toDateStr(value: unknown): string {
  if (!value) return '';
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10);
}

/** 读取 enr 涉及年份的法定节假日 + 调休补班日 */
async function fetchHolidayRows(client: AttendClient, startDate: string, judge: string) {
  const sYear = parseInt(startDate.slice(0, 4), 10);
  const eYear = parseInt(judge.slice(0, 4), 10);
  const years: number[] = [];
  for (let y = sYear; y <= eYear; y++) years.push(y);
  const { data } = await client
    .from('holidays_old')
    .select('date,name,type')
    .in('year', years)
    .in('type', ['holiday', 'work_weekend']);
  return (data || []) as { date: unknown; name: string | null; type: string }[];
}

export async function resolveAttendEndDate(
  client: AttendClient,
  enr: AttendEnr,
): Promise<string | null> {
  const startDate = toDateStr(enr.start_date);
  const raw = [enr.end_date, enr.extended_end_date].filter(Boolean).map(toDateStr);
  if (!startDate) return raw.length ? raw.slice().sort().pop()! : null;
  if (!raw.length) return startDate;

  let attend = raw.slice().sort().pop()!;
  const judge = toDateStr(enr.judge_end_date) || attend;

  // 若顺延/判节日上界未超过现有 attend，无需扩展
  if (judge <= attend) return attend;

  const rows = await fetchHolidayRows(client, startDate, judge);
  const holidayDatesByName: Record<string, string[]> = {};
  const makeupNameByDate: Record<string, string> = {};
  for (const h of rows) {
    const d = toDateStr(h.date);
    if (!d || d < startDate || d > judge) continue;
    if (h.type === 'holiday') {
      const key = String(h.name || '未命名');
      (holidayDatesByName[key] = holidayDatesByName[key] || []).push(d);
    } else {
      makeupNameByDate[d] = String(h.name || '');
    }
  }

  const festivalNames = Object.keys(holidayDatesByName);
  let last = attend;
  for (const d of Object.keys(makeupNameByDate)) {
    if (d <= startDate) continue;
    const nm = makeupNameByDate[d];
    const base = nm.endsWith('调休') ? nm.slice(0, -2) : nm;
    const full = festivalNames.find(
      (fn) => fn === base || fn.endsWith(base) || fn.replace(/节$/, '') === base,
    );
    if (!full) continue;
    const fd = holidayDatesByName[full];
    if (fd && fd.some((x) => x >= startDate && x <= judge)) {
      if (d > last) last = d;
    }
  }
  return last;
}