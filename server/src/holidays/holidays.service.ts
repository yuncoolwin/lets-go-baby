import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { EnrollmentsService } from '@/enrollments/enrollments.service';

@Injectable()
export class HolidaysService {
  private supabase = getSupabaseClient();

  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  async findAll() {
    const { data, error } = await this.supabase
      .from('holidays')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { code: 200, msg: 'success', data: data || [] };
  }

  async create(body: { name: string; type: string; target_id?: string; start_date: string; end_date: string }) {
    const { data, error } = await this.supabase
      .from('holidays')
      .insert({
        name: body.name,
        type: body.type,
        target_id: body.type === 'all' ? null : (body.target_id || null),
        start_date: body.start_date,
        end_date: body.end_date,
      })
      .select()
      .single();
    if (error) throw error;

    // 触发受影响报读的顺延日期重算
    await this.recalcAffectedEnrollments(data);

    return { code: 200, msg: 'success', data };
  }

  async update(id: string, body: { name?: string; type?: string; target_id?: string; start_date?: string; end_date?: string }) {
    // 先获取旧数据
    const { data: oldData } = await this.supabase
      .from('holidays')
      .select('*')
      .eq('id', id)
      .single();

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.start_date !== undefined) updateData.start_date = body.start_date;
    if (body.end_date !== undefined) updateData.end_date = body.end_date;
    if (body.type !== undefined) {
      updateData.target_id = body.type === 'all' ? null : (body.target_id || null);
    } else if (body.target_id !== undefined) {
      updateData.target_id = body.target_id;
    }

    const { data, error } = await this.supabase
      .from('holidays')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // 触发受影响报读的顺延日期重算（旧数据和新数据的影响范围都要重算）
    if (oldData) await this.recalcAffectedEnrollments(oldData);
    await this.recalcAffectedEnrollments(data);

    return { code: 200, msg: 'success', data };
  }

  async remove(id: string) {
    // 先获取旧数据
    const { data: oldData } = await this.supabase
      .from('holidays')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await this.supabase
      .from('holidays')
      .delete()
      .eq('id', id);
    if (error) throw error;

    // 触发受影响报读的顺延日期重算
    if (oldData) await this.recalcAffectedEnrollments(oldData);

    return { code: 200, msg: '删除成功' };
  }

  async findByChild(childId: string) {
    const today = new Date().toISOString().split('T')[0];

    // 先查幼儿所在班级
    const { data: child } = await this.supabase
      .from('children')
      .select('class_id')
      .eq('id', childId)
      .single();

    const classId = child?.class_id || '';

    // 查询全园假期
    const { data: allHolidays } = await this.supabase
      .from('holidays')
      .select('*')
      .eq('type', 'all')
      .gte('end_date', today)
      .order('start_date', { ascending: true });

    // 查询班级假期
    const { data: classHolidays } = await this.supabase
      .from('holidays')
      .select('*')
      .eq('type', 'class')
      .eq('target_id', classId)
      .gte('end_date', today)
      .order('start_date', { ascending: true });

    // 查询个人假期
    const { data: personalHolidays } = await this.supabase
      .from('holidays')
      .select('*')
      .eq('type', 'personal')
      .eq('target_id', childId)
      .gte('end_date', today)
      .order('start_date', { ascending: true });

    const data = [
      ...(allHolidays || []),
      ...(classHolidays || []),
      ...(personalHolidays || []),
    ];

    return { code: 200, msg: 'success', data };
  }

  /**
   * 获取指定年份的节假日日期集合（用于日期计算器）
   * 将 holidays 表的日期范围展开为 Set<string>
   */
  async getDateSets(year: number): Promise<{ holidays: Set<string>; workWeekends: Set<string> }> {
    const holidays = new Set<string>();
    const workWeekends = new Set<string>();

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // 查询全园假期（type='all'）
    const { data: allHolidays } = await this.supabase
      .from('holidays')
      .select('*')
      .eq('type', 'all')
      .lte('start_date', yearEnd)
      .gte('end_date', yearStart);

    // 将日期范围展开为单个日期
    for (const h of allHolidays || []) {
      const start = new Date(h.start_date);
      const end = new Date(h.end_date);
      const current = new Date(start);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        holidays.add(dateStr);
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    return { holidays, workWeekends };
  }

  /**
   * 假期变更后，重新计算受影响报读的顺延结束日期
   * 全园假期→全部进行中报读；班级假期→该班级幼儿的进行中报读；个人假期→该幼儿的进行中报读
   */
  private async recalcAffectedEnrollments(holiday: { type: string; target_id?: string | null }): Promise<void> {
    let enrollmentIds: string[] = [];

    if (holiday.type === 'all') {
      // 全园假期→全部进行中报读
      const { data: enrollments } = await this.supabase
        .from('enrollments')
        .select('id')
        .eq('status', '进行中');
      enrollmentIds = (enrollments || []).map(e => e.id);
    } else if (holiday.type === 'class' && holiday.target_id) {
      // 班级假期→该班级幼儿的进行中报读
      const { data: children } = await this.supabase
        .from('children')
        .select('id')
        .eq('class_id', holiday.target_id);
      const childIds = (children || []).map(c => c.id);
      if (childIds.length > 0) {
        const { data: enrollments } = await this.supabase
          .from('enrollments')
          .select('id')
          .in('child_id', childIds)
          .eq('status', '进行中');
        enrollmentIds = (enrollments || []).map(e => e.id);
      }
    } else if (holiday.type === 'personal' && holiday.target_id) {
      // 个人假期→该幼儿的进行中报读
      const { data: enrollments } = await this.supabase
        .from('enrollments')
        .select('id')
        .eq('child_id', holiday.target_id)
        .eq('status', '进行中');
      enrollmentIds = (enrollments || []).map(e => e.id);
    }

    // 逐条重新计算并更新
    for (const enrId of enrollmentIds) {
      const { extended_end_date: extendedDate } = await this.enrollmentsService.calculateExtendedEndDate(enrId);
      if (extendedDate) {
        await this.supabase
          .from('enrollments')
          .update({ extended_end_date: extendedDate })
          .eq('id', enrId);
      } else {
        await this.supabase
          .from('enrollments')
          .update({ extended_end_date: null })
          .eq('id', enrId);
      }
    }
  }
}