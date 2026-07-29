import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

@Injectable()
export class ClassService {
  private get client() {
    return getSupabaseClient();
  }

  async getClassDetail(classId: string) {
    // Demo data
    return {
      class_info: {
        id: classId || 'class_1',
        name: '向日葵班',
        description: '适合3-4岁小朋友，注重艺术启蒙和社交能力培养',
        student_count: 15,
        teacher_count: 3,
      },
      students: [
        { id: 's1', name: '张小明', gender: 'male', attendance_status: 'present' },
        { id: 's2', name: '李小红', gender: 'female', attendance_status: 'present' },
        { id: 's3', name: '王小刚', gender: 'male', attendance_status: 'present' },
        { id: 's4', name: '赵小美', gender: 'female', attendance_status: 'absent' },
        { id: 's5', name: '刘小强', gender: 'male', attendance_status: 'present' },
      ],
    };
  }
}
