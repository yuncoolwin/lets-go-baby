-- ============================================================
-- 生产快照导出模板（exec_sql product 执行用）
-- 用途：触发「同步」时，先在平台对话中用 exec_sql product 执行本模板，
--       导出生产业务表全量数据（to_jsonb::text 保真类型），用于生成
--       /tmp/sync_backup/prod_snapshot.json，再交给 scripts/sync-prod-to-dev.js。
--
-- ⚠️ 只读模板：切勿在其中混入任何 DML/DDL；生产库严格只读。
-- ⚠️ 数据源唯一权威：exec_sql product（可读全量，含 RLS 表）。
-- ============================================================

-- 按依赖顺序列出，每张业务表一条导出查询。
-- 结果列 j 即 to_jsonb(row) 的文本，包含 _meta 所需各表数据。
-- 导出的对象数组即脚本 snapshot 里对应表的数据。

-- [主表]
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM users) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM families) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM classes) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM teachers) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM children) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM user_roles) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM teacher_classes) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM courses) x;         -- RLS
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM teacher_invite_codes) x; -- RLS(查 inviter_admin_role_id 原值)
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM holidays) x;        -- RLS(created_at 无时区列，to_jsonb 保原值)

-- [子表]
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM enrollments) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM enrollment_extensions) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM attendance) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM attendance_records) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM drop_in_records) x; -- RLS(可空字段 NULL/值须一一对应)
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM daily_feedbacks) x;
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM growth_records) x;  -- 含 jsonb 列(photo_urls/video_urls)
SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM holidays_old) x;

-- 说明：
-- 1) 脚本默认跳过 audit_logs 及 backup/cleanup 快照类表（如 attendance_holiday_backup 等），
--    子表 list 中未列即被默认跳过；如需同步可用 --tables 显式包含并补充查询。
-- 2) to_jsonb(x) 对 date 列返回 'YYYY-MM-DD'、timestamp without time zone 返回无偏移文本、
--    timestamptz 返回带偏移文本，从而避免 JS Date.toISOString() 造成 holidays 那种展示偏移。
-- 3) 导出后用下方约定 JSON 结构落盘：
--    { "_meta": { "source":"exec_sql product","exported_at":"<ISO>","tables":["..."] }, "<表>":[ {...}, ... ], ... }