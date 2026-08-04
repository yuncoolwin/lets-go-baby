import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

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
    const targetDate = date || new Date().toISOString().split('T')[0];

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

    // 查询该班级进行中的报读记录（不按 child_id 去重）
    const enrollmentList: Array<{ child_id: string; course_type: string }> = [];
    if (childIds.length > 0) {
      const { data: enrollments } = await this.client
        .from('enrollments')
        .select('child_id, course_type')
        .in('child_id', childIds)
        .eq('class_id', classId)
        .eq('status', '进行中');
      (enrollments || []).forEach(e => {
        enrollmentList.push({ child_id: e.child_id, course_type: e.course_type });
      });
    }

    // 合并：每个幼儿按课程类型展开，每行一个 child_id + course_type 组合
    const childMap: Record<string, any> = {};
    childList.forEach(c => { childMap[c.id] = c; });

    const mergedList = enrollmentList.map(e => {
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
    const statusOrder: Record<string, number> = { present: 0, absent: 1, leave: 2, null: 3 };
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
    const { data, error } = await this.client
      .from('attendance')
      .upsert({
        child_id: dto.child_id,
        teacher_id: dto.teacher_id,
        class_id: dto.class_id,
        date: dto.date,
        status: dto.status,
        course_type: dto.course_type || '',
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
}