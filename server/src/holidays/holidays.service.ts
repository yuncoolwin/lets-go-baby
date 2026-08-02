import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface HolidayRecord {
  date: string;
  type: 'holiday' | 'work_weekend';
  name: string;
  year: number;
}

@Injectable()
export class HolidaysService {
  private get client() {
    return getSupabaseClient();
  }

  async getAll(year?: number) {
    let query = this.client
      .from('holidays')
      .select('*')
      .order('date', { ascending: true });

    if (year) {
      query = query.eq('year', year);
    }

    const { data, error } = await query;
    if (error) throw new Error(`查询节假日失败: ${error.message}`);
    return data || [];
  }

  /** 获取节假日日期集合，供日期计算器使用 */
  async getDateSets(year: number) {
    const { data, error } = await this.client
      .from('holidays')
      .select('date, type')
      .eq('year', year);

    if (error) throw new Error(`查询节假日数据失败: ${error.message}`);

    const holidays = new Set<string>();
    const workWeekends = new Set<string>();

    (data || []).forEach((row: { date: string; type: string }) => {
      if (row.type === 'holiday') {
        holidays.add(row.date);
      } else if (row.type === 'work_weekend') {
        workWeekends.add(row.date);
      }
    });

    return { holidays, workWeekends };
  }

  /** 从预设数据更新数据库 */
  async updateFromPreset() {
    const presetData = this.getPresetData();
    
    // 按年份分组，先清空再插入
    const years = [...new Set(presetData.map(d => d.year))];
    
    for (const year of years) {
      const yearData = presetData.filter(d => d.year === year);
      
      // 删除该年份旧数据
      const { error: delError } = await this.client
        .from('holidays')
        .delete()
        .eq('year', year);
      
      if (delError) throw new Error(`删除${year}年旧数据失败: ${delError.message}`);

      // 插入新数据
      const { error: insError } = await this.client
        .from('holidays')
        .insert(yearData);

      if (insError) throw new Error(`插入${year}年数据失败: ${insError.message}`);
    }

    return { count: presetData.length, years };
  }

  /** 2026年预设节假日数据（按国务院安排） */
  private getPresetData(): HolidayRecord[] {
    return [
      // 元旦：1月1日-1月3日（3天）
      { date: '2026-01-01', type: 'holiday', name: '元旦', year: 2026 },
      { date: '2026-01-02', type: 'holiday', name: '元旦', year: 2026 },
      { date: '2026-01-03', type: 'holiday', name: '元旦', year: 2026 },

      // 春节：2月15日-2月21日（7天）
      { date: '2026-02-15', type: 'holiday', name: '春节', year: 2026 },
      { date: '2026-02-16', type: 'holiday', name: '春节', year: 2026 },
      { date: '2026-02-17', type: 'holiday', name: '春节', year: 2026 },
      { date: '2026-02-18', type: 'holiday', name: '春节', year: 2026 },
      { date: '2026-02-19', type: 'holiday', name: '春节', year: 2026 },
      { date: '2026-02-20', type: 'holiday', name: '春节', year: 2026 },
      { date: '2026-02-21', type: 'holiday', name: '春节', year: 2026 },
      { date: '2026-02-14', type: 'work_weekend', name: '春节调休', year: 2026 },
      { date: '2026-02-28', type: 'work_weekend', name: '春节调休', year: 2026 },

      // 清明节：4月4日-4月6日（3天）
      { date: '2026-04-04', type: 'holiday', name: '清明节', year: 2026 },
      { date: '2026-04-05', type: 'holiday', name: '清明节', year: 2026 },
      { date: '2026-04-06', type: 'holiday', name: '清明节', year: 2026 },
      { date: '2026-03-28', type: 'work_weekend', name: '清明调休', year: 2026 },

      // 劳动节：5月1日-5月5日（5天）
      { date: '2026-05-01', type: 'holiday', name: '劳动节', year: 2026 },
      { date: '2026-05-02', type: 'holiday', name: '劳动节', year: 2026 },
      { date: '2026-05-03', type: 'holiday', name: '劳动节', year: 2026 },
      { date: '2026-05-04', type: 'holiday', name: '劳动节', year: 2026 },
      { date: '2026-05-05', type: 'holiday', name: '劳动节', year: 2026 },
      { date: '2026-05-09', type: 'work_weekend', name: '劳动节调休', year: 2026 },

      // 端午节：6月19日-6月21日（3天）
      { date: '2026-06-19', type: 'holiday', name: '端午节', year: 2026 },
      { date: '2026-06-20', type: 'holiday', name: '端午节', year: 2026 },
      { date: '2026-06-21', type: 'holiday', name: '端午节', year: 2026 },

      // 中秋节：9月25日-9月27日（3天）
      { date: '2026-09-25', type: 'holiday', name: '中秋节', year: 2026 },
      { date: '2026-09-26', type: 'holiday', name: '中秋节', year: 2026 },
      { date: '2026-09-27', type: 'holiday', name: '中秋节', year: 2026 },

      // 国庆节：10月1日-10月7日（7天）
      { date: '2026-10-01', type: 'holiday', name: '国庆节', year: 2026 },
      { date: '2026-10-02', type: 'holiday', name: '国庆节', year: 2026 },
      { date: '2026-10-03', type: 'holiday', name: '国庆节', year: 2026 },
      { date: '2026-10-04', type: 'holiday', name: '国庆节', year: 2026 },
      { date: '2026-10-05', type: 'holiday', name: '国庆节', year: 2026 },
      { date: '2026-10-06', type: 'holiday', name: '国庆节', year: 2026 },
      { date: '2026-10-07', type: 'holiday', name: '国庆节', year: 2026 },
      { date: '2026-10-10', type: 'work_weekend', name: '国庆调休', year: 2026 },
    ];
  }
}