-- ============================================================
-- 回填 attendance.enrollment_id（第 7 步导入时未填充，导致课时统计与考勤日历全空）
-- 生成时间：2026-09-09
-- 匹配规则：child_id + course_type + 日期落在报读区间 [start_date, COALESCE(extended_end_date, end_date)]
-- 优先级：同一考勤命中多条报读时，取结束日期最早（extended/end 取小）的报读，兼顾定金拆分/体验课重叠场景
-- 幂等：仅更新 enrollment_id 为 NULL 的考勤，可重复执行
-- 事务包裹：先核对行数，确认无误再 COMMIT
-- ============================================================
BEGIN;

UPDATE attendance a
SET enrollment_id = matched.enrollment_id,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (a.id)
    a.id AS attendance_id,
    e.id AS enrollment_id
  FROM attendance a
  JOIN enrollments e
    ON e.child_id = a.child_id
   AND e.course_type = a.course_type
   AND a.date >= e.start_date
   AND a.date <= COALESCE(e.extended_end_date, e.end_date)
  WHERE a.enrollment_id IS NULL
  ORDER BY a.id, COALESCE(e.extended_end_date, e.end_date) ASC, e.id ASC
) matched
WHERE a.id = matched.attendance_id;

-- 核对 1：回填后 enrollment_id 填充情况
SELECT count(*) AS total,
       count(enrollment_id) AS with_enrollment,
       count(*) - count(enrollment_id) AS null_enrollment
FROM attendance;

-- 核对 2：抽查孙韵珊 6 条报读的课时匹配数（应与页面一致，全日托 2025-03-12~09-11 为 104、2026-01-27~07-26 为 99 等）
SELECT e.course_type, e.start_date, e.end_date, e.extended_end_date,
       (SELECT count(*) FROM attendance a
        WHERE a.enrollment_id = e.id) AS linked_count
FROM enrollments e
JOIN children c ON c.id = e.child_id
WHERE c.name = '孙韵珊'
ORDER BY e.start_date;

-- 核对 3：抽查刘予墨 4 条报读
SELECT e.course_type, e.start_date, e.end_date, e.extended_end_date,
       (SELECT count(*) FROM attendance a
        WHERE a.enrollment_id = e.id) AS linked_count
FROM enrollments e
JOIN children c ON c.id = e.child_id
WHERE c.name = '刘予墨'
ORDER BY e.start_date;

-- 确认核对结果无误后，将最后的 ROLLBACK 改为 COMMIT 提交
ROLLBACK;
