import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { ParentController } from '@/parent/parent.controller';
import { ParentService } from '@/parent/parent.service';
import { TeacherController } from '@/teacher/teacher.controller';
import { TeacherService } from '@/teacher/teacher.service';
import { AdminController } from '@/admin/admin.controller';
import { AdminService } from '@/admin/admin.service';
import { ClassesController } from '@/classes/classes.controller';
import { ClassesService } from '@/classes/classes.service';
import { ChildrenController } from '@/children/children.controller';
import { ChildrenService } from '@/children/children.service';
import { TeachersController } from '@/teachers/teachers.controller';
import { TeachersService } from '@/teachers/teachers.service';
import { NotificationsController } from '@/notifications/notifications.controller';
import { NotificationsService } from '@/notifications/notifications.service';
import { AttendanceController } from '@/attendance/attendance.controller';
import { AttendanceService } from '@/attendance/attendance.service';
import { HolidaysController } from '@/holidays/holidays.controller';
import { HolidaysService } from '@/holidays/holidays.service';

@Module({
  imports: [],
  controllers: [
    AppController,
    AuthController,
    ParentController,
    TeacherController,
    AdminController,
    ClassesController,
    ChildrenController,
    TeachersController,
    NotificationsController,
    AttendanceController,
    HolidaysController,
  ],
  providers: [
    AppService,
    AuthService,
    ParentService,
    TeacherService,
    AdminService,
    ClassesService,
    ChildrenService,
    TeachersService,
    NotificationsService,
    AttendanceService,
    HolidaysService,
  ],
})
export class AppModule {}
