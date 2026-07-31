import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class AttendanceService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 批量获取某班级某天的点名记录（含幼儿姓名）
   * @param classId 班级ID
   * @param date 可选，默认当天
   */
  async findByClassAndDate(classId: string, date?: string) {
    // 默认当天
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 先查询班级在读幼儿
    const { data: children, error: childErr } = await this.client
      .from('children')
      .select('id, name')
      .eq('class_id', classId)
      .eq('status', 'active');
    if (childErr) throw childErr;

    // 查询当天点名记录
    const { data: records, error } = await this.client
      .from('attendance')
      .select('id, child_id, status, updated_at')
      .eq('class_id', classId)
      .eq('date', targetDate);
    if (error) throw error;

    // 建立 child_id -> name 映射
    const childNameMap: Record<string, string> = {};
    (children || []).forEach(c => { childNameMap[c.id] = c.name; });

    // 合并：所有在班幼儿（无记录则 unknown）+ 已有记录的幼儿
    const mergedMap: Record<string, any> = {};
    (children || []).forEach(c => {
      mergedMap[c.id] = {
        id: null,
        child_id: c.id,
        child_name: c.name,
        status: 'unknown',
        updated_at: null,
      };
    });
    (records || []).forEach(r => {
      mergedMap[r.child_id] = {
        id: r.id,
        child_id: r.child_id,
        child_name: childNameMap[r.child_id] || '未知',
        status: r.status,
        updated_at: r.updated_at,
      };
    });

    return Object.values(mergedMap).sort((a, b) => a.child_name.localeCompare(b.child_name, 'zh'));
  }

  /**
   * 获取某幼儿某天的点名状态
   */
  async findByChildAndDate(childId: string, date: string) {
    const { data, error } = await this.client
      .from('attendance')
      .select('*')
      .eq('child_id', childId)
      .eq('date', date)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * 记录/更新点名状态（upsert）
   */
  async upsert(dto: {
    child_id: string;
    teacher_id: string;
    class_id: string;
    date: string;
    status: string;
  }) {
    const { data, error } = await this.client
      .from('attendance')
      .upsert({
        child_id: dto.child_id,
        teacher_id: dto.teacher_id,
        class_id: dto.class_id,
        date: dto.date,
        status: dto.status,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'child_id,date',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
