import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class NotificationService {
  private get client() {
    return getSupabaseClient();
  }

  async getNotifications(targetType?: string, targetId?: string) {
    // Demo data
    return [
      {
        id: '1',
        title: '周末亲子活动通知',
        content: '本周六上午9:00将举办亲子户外活动，请家长们准时参加。活动地点：幼儿园操场集合。',
        type: 'activity',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        sender_name: '教务处',
      },
      {
        id: '2',
        title: '班级调课通知',
        content: '因王老师下周请假，向日葵班下周的课程将由李老师代课。',
        type: 'class',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        sender_name: '向日葵班',
      },
      {
        id: '3',
        title: '系统升级通知',
        content: '系统将于本周日凌晨2:00-4:00进行升级维护，届时部分功能可能暂时不可用。',
        type: 'system',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        sender_name: '系统',
      },
    ];
  }
}
