SELECT 'users', count(*) FROM "users"
UNION ALL
SELECT 'teachers', count(*) FROM "teachers"
UNION ALL
SELECT 'children', count(*) FROM "children"
UNION ALL
SELECT 'classes', count(*) FROM "classes"
UNION ALL
SELECT 'courses', count(*) FROM "courses"
UNION ALL
SELECT 'families', count(*) FROM "families"
UNION ALL
SELECT 'user_roles', count(*) FROM "user_roles"
UNION ALL
SELECT 'teacher_classes', count(*) FROM "teacher_classes"
UNION ALL
SELECT 'class_members', count(*) FROM "class_members"
UNION ALL
SELECT 'parent_child_relations', count(*) FROM "parent_child_relations"
UNION ALL
SELECT 'teacher_invite_codes', count(*) FROM "teacher_invite_codes"
UNION ALL
SELECT 'enrollments', count(*) FROM "enrollments"
UNION ALL
SELECT 'enrollment_extensions', count(*) FROM "enrollment_extensions"
UNION ALL
SELECT 'attendance', count(*) FROM "attendance"
UNION ALL
SELECT 'attendance_records', count(*) FROM "attendance_records"
UNION ALL
SELECT 'drop_in_records', count(*) FROM "drop_in_records"
UNION ALL
SELECT 'daily_feedbacks', count(*) FROM "daily_feedbacks"
UNION ALL
SELECT 'growth_records', count(*) FROM "growth_records"
UNION ALL
SELECT 'holidays', count(*) FROM "holidays"
UNION ALL
SELECT 'holidays_old', count(*) FROM "holidays_old"
UNION ALL
SELECT 'audit_logs', count(*) FROM "audit_logs"
UNION ALL
SELECT 'notifications', count(*) FROM "notifications"
UNION ALL
SELECT 'notification_recipients', count(*) FROM "notification_recipients"
UNION ALL
SELECT 'notification_reads', count(*) FROM "notification_reads"
UNION ALL
SELECT 'binding_requests', count(*) FROM "binding_requests"
UNION ALL
-- SELECT 'health_check' cannot be counted: RLS denied
UNION ALL
SELECT 'attendance_holiday_backup', count(*) FROM "attendance_holiday_backup"
UNION ALL
SELECT 'attendance_records_cleanup_backup_20260916', count(*) FROM "attendance_records_cleanup_backup_20260916"
UNION ALL
SELECT 'teachers_user_id_backup_20260908', count(*) FROM "teachers_user_id_backup_20260908";
