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
import { NotificationController } from '@/notification/notification.controller';
import { NotificationService } from '@/notification/notification.service';
import { ClassController } from '@/class/class.controller';
import { ClassService } from '@/class/class.service';

@Module({
  imports: [],
  controllers: [
    AppController,
    AuthController,
    ParentController,
    TeacherController,
    AdminController,
    NotificationController,
    ClassController,
  ],
  providers: [
    AppService,
    AuthService,
    ParentService,
    TeacherService,
    AdminService,
    NotificationService,
    ClassService,
  ],
})
export class AppModule {}
