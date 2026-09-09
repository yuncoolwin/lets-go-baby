const { Client } = require('pg');
const url = process.env.PGDATABASE_URL;
const mode = process.argv[2] || 'verify'; // verify | commit
const sql = `
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
SELECT 'CHECK1' AS check_id,
  count(*) AS total,
  count(enrollment_id) AS with_enrollment,
  count(*) - count(enrollment_id) AS null_enrollment
FROM attendance;
SELECT 'CHECK2_NAME' AS check_id, e.course_type, e.start_date, e.end_date, e.extended_end_date,
  (SELECT count(*) FROM attendance a WHERE a.enrollment_id = e.id) AS linked_count
FROM enrollments e
JOIN children c ON c.id = e.child_id
WHERE c.name = '孙韵珊'
ORDER BY e.start_date;
SELECT 'CHECK3_NAME' AS check_id, e.course_type, e.start_date, e.end_date, e.extended_end_date,
  (SELECT count(*) FROM attendance a WHERE a.enrollment_id = e.id) AS linked_count
FROM enrollments e
JOIN children c ON c.id = e.child_id
WHERE c.name = '刘予墨'
ORDER BY e.start_date;
${mode === 'commit' ? 'COMMIT;' : 'ROLLBACK;'}`;
(async () => {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const res = await client.query(sql);
    for (let i = 0; i < res.length; i++) {
      const rows = res[i].rows || [];
      if (i === 0) {
        console.log('--- UPDATE rows ---', rows[0] ? rows[0].affected : 'n/a');
      } else {
        console.log(`--- ${rows[0] && rows[0].check_id || ('result-' + i)} ---`);
        for (const r of rows) {
          if (r.check_id) {
            console.log(JSON.stringify({ total: r.total, with_enc: r.with_enrollment, null_enc: r.null_enrollment }));
          } else {
            console.log(JSON.stringify(r));
          }
        }
      }
    }
    console.log(mode === 'commit' ? '*** COMMITTED ***' : '*** ROLLED BACK (verify only) ***');
  } catch (e) {
    console.error('ERROR:', e.message);
    try { await client.query('ROLLBACK;'); } catch (_) {}
  } finally {
    await client.end();
  }
})();