-- =============================================================
-- 脚本：清理「假期管理」中假期日期范围内的幼儿考勤记录
-- 目标表：attendance
-- 范围来源：holidays 表（type = all / class / personal）
--
-- 执行步骤：
--   STEP 1  备份待删除记录到 attendance_holiday_backup
--   STEP 2  执行删除
--   STEP 3  验证剩余命中记录数为 0
--
-- 回滚方式：
--   INSERT INTO attendance SELECT * FROM attendance_holiday_backup;
-- =============================================================

-- ---------- STEP 1：备份 ----------
DROP TABLE IF EXISTS attendance_holiday_backup;

CREATE TABLE attendance_holiday_backup AS
SELECT a.*
FROM attendance a
WHERE
    -- all：全园假期（覆盖所有幼儿）
    EXISTS (
        SELECT 1
        FROM holidays h
        WHERE h.type = 'all'
          AND a.date BETWEEN h.start_date::date AND h.end_date::date
    )
    -- class：班级假期（仅该班级）
    OR EXISTS (
        SELECT 1
        FROM holidays h
        WHERE h.type = 'class'
          AND a.class_id = h.target_id::text
          AND a.date BETWEEN h.start_date::date AND h.end_date::date
    )
    -- personal：个人假期（仅该幼儿）
    OR EXISTS (
        SELECT 1
        FROM holidays h
        WHERE h.type = 'personal'
          AND a.child_id = h.target_id::text
          AND a.date BETWEEN h.start_date::date AND h.end_date::date
    );

-- 备份条数（应与「删除前统计」一致）
SELECT COUNT(*) AS backup_cnt FROM attendance_holiday_backup;

-- ---------- STEP 2：删除 ----------
DELETE FROM attendance AS a
WHERE
    EXISTS (
        SELECT 1
        FROM holidays h
        WHERE h.type = 'all'
          AND a.date BETWEEN h.start_date::date AND h.end_date::date
    )
    OR EXISTS (
        SELECT 1
        FROM holidays h
        WHERE h.type = 'class'
          AND a.class_id = h.target_id::text
          AND a.date BETWEEN h.start_date::date AND h.end_date::date
    )
    OR EXISTS (
        SELECT 1
        FROM holidays h
        WHERE h.type = 'personal'
          AND a.child_id = h.target_id::text
          AND a.date BETWEEN h.start_date::date AND h.end_date::date
    );

-- ---------- STEP 3：验证 ----------
-- 剩余命中记录数（应为 0）
SELECT COUNT(*) AS remain_cnt
FROM attendance a
WHERE
    EXISTS (
        SELECT 1
        FROM holidays h
        WHERE h.type = 'all'
          AND a.date BETWEEN h.start_date::date AND h.end_date::date
    )
    OR EXISTS (
        SELECT 1
        FROM holidays h
        WHERE h.type = 'class'
          AND a.class_id = h.target_id::text
          AND a.date BETWEEN h.start_date::date AND h.end_date::date
    )
    OR EXISTS (
        SELECT 1
        FROM holidays h
        WHERE h.type = 'personal'
          AND a.child_id = h.target_id::text
          AND a.date BETWEEN h.start_date::date AND h.end_date::date
    );