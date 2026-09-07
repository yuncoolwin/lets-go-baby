-- ============================================================
-- 考勤显示问题定位核对 SQL（只读 SELECT，不修改数据）
-- 用途：核对前端截图反映的三个问题：
--   ① CASA班 2026-02-03 页面显示 5 行无姓名幼儿全天
--   ② IC班 2026-02-12 页面雷特瑞显示"全天"、龚如一未记录
--   ③ 考勤日历（dates 接口）与点名页显示的日期差异
-- 期望：把每段查询结果原样发回
-- ============================================================

-- ① 2026-02-03 当天 CASA班(241786d9) 的全部考勤记录及幼儿状态
-- 预期：孙韵珊、李潇月、覃隽逸、莫雅恬、魏铭嘉等，且这些幼儿 status 多为 graduated
SELECT c.name, c.status, a.child_id, a.date, a.status AS att_status, a.course_type
FROM attendance a
JOIN children c ON c.id = a.child_id
WHERE a.class_id = '241786d9-f8cb-4497-8777-280255a00a5c'
  AND a.date = '2026-02-03'
ORDER BY c.name;

-- ② 2026-02-12 当天 IC班(0f973ad4) 的全部考勤记录
-- 预期：如果无记录则返回 0 行（数据库 2/12 无考勤）
SELECT c.name, a.child_id, a.date, a.status AS att_status, a.course_type
FROM attendance a
JOIN children c ON c.id = a.child_id
WHERE a.class_id = '0f973ad4-694c-4c7f-af81-bd233cb6d62b'
  AND a.date = '2026-02-12'
ORDER BY c.name;

-- ③ IC班 2026-02-12 当天按 getAdminOverview 逻辑应显示的在读幼儿（enrollment 覆盖）
-- 预期：龚如一（全日托，1/4~8/7 在读）、雷特瑞（全日托，2025-10-10~2026-04-10 在读）
SELECT c.name, e.course_type, e.start_date, e.end_date, e.extended_end_date
FROM enrollments e
JOIN children c ON c.id = e.child_id
WHERE e.class_id = '0f973ad4-694c-4c7f-af81-bd233cb6d62b'
  AND e.start_date <= '2026-02-12'
  AND (e.extended_end_date IS NOT NULL OR e.end_date IS NOT NULL)
  AND COALESCE(e.extended_end_date, e.end_date) >= '2026-02-12'
  AND e.course_type <> '周六托'
  AND c.status = 'active'
ORDER BY e.course_type, c.name;

-- ④ dates 接口数据源：IC班 attendance 表全部日期（去重，倒序前30）
SELECT DISTINCT date FROM attendance
WHERE class_id = '0f973ad4-694c-4c7f-af81-bd233cb6d62b'
ORDER BY date DESC
LIMIT 30;

-- ⑤ 全库检查：attendance 中 child_id 在 children 里 status 非 active 的数量
-- 预期：大量记录属于已结课/暂停幼儿（这些会通过 enrollment 骨架显示但名字为空）
SELECT c.status, count(*) AS att_count
FROM attendance a
JOIN children c ON c.id = a.child_id
GROUP BY c.status
ORDER BY att_count DESC;
