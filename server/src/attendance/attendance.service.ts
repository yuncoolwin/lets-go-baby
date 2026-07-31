import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class AttendanceService {
  private get client() {
    return getSupabaseClient();
  }

  /**
   * 批量获取某班级某天的点名记录（含完整幼儿信息）
   * @param classId 班级ID
   * @param date 可选，默认当天
   */
  async findByClassAndDate(classId: string, date?: string) {
    // 默认当天
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 先查询班级在读幼儿（完整信息）
    const { data: children, error: childErr } = await this.client
      .from('children')
      .select('id, name, gender, birth_date, avatar_url, allergies, status')
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

    // 建立 child_id -> 考勤记录 映射
    const recordMap: Record<string, any> = {};
    (records || []).forEach(r => { recordMap[r.child_id] = r; });

    // 合并：所有在班幼儿 + 考勤状态
    const mergedList = (children || []).map(c => {
      const record = recordMap[c.id];
      return {
        ...c,
        attendance_id: record?.id || null,
        attendance_status: record?.status || null,
        updated_at: record?.updated_at || null,
      };
    });

    // 按考勤状态排序：出勤 > 缺席 > 请假 > 无记录
    const statusOrder: Record<string, number> = { present: 0, absent: 1, leave: 2, null: 3 };
    return mergedList.sort((a, b) => {
      const orderA = statusOrder[a.attendance_status] ?? 4;
      const orderB = statusOrder[b.attendance_status] ?? 4;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'zh');
    });
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
