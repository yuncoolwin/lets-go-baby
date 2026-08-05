import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

@Injectable()
export class StatutoryHolidaysService {
  async findAll(year?: number) {
    const supabase = getSupabaseClient()
    let query = supabase.from('holidays_old').select('*').order('date', { ascending: true })
    if (year) {
      query = query.eq('year', year)
    }
    const { data, error } = await query
    if (error) {
      console.error('[StatutoryHolidays] findAll error:', error)
      throw new Error(error.message)
    }
    return { data: data || [] }
  }

  /**
   * 获取指定年份的法定节假日日期集合（用于基础结束日期计算）
   * type='holiday' → 跳过（放假）
   * type='work_weekend' → 算工作日（补班）
   */
  async getDateSets(year: number): Promise<{ holidays: Set<string>; workWeekends: Set<string> }> {
    const supabase = getSupabaseClient();
    const holidays = new Set<string>();
    const workWeekends = new Set<string>();

    const { data, error } = await supabase
      .from('holidays_old')
      .select('date, type')
      .eq('year', year);

    if (error) {
      console.error('[StatutoryHolidays] getDateSets error:', error);
      throw new Error(error.message);
    }

    for (const row of data || []) {
      const dateStr = row.date?.substring(0, 10);
      if (!dateStr) continue;
      if (row.type === 'work_weekend') {
        workWeekends.add(dateStr);
      } else {
        holidays.add(dateStr);
      }
    }

    return { holidays, workWeekends };
  }

  async getYears() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('holidays_old')
      .select('year')
      .order('year', { ascending: false })
    if (error) {
      console.error('[StatutoryHolidays] getYears error:', error)
      throw new Error(error.message)
    }
    const years = [...new Set((data || []).map((r: any) => r.year))]
    return { data: years }
  }
}