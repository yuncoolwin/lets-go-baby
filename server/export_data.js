const { Client } = require('pg');
const fs = require('fs');
const url = process.env.PGDATABASE_URL;
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const queries = {
  holidays_old: "SELECT date, type, name, year FROM holidays_old ORDER BY date",
  enrollments: "SELECT id::text, child_id::text, course_type, duration_type, duration_days, start_date::text, end_date::text, extended_end_date::text, class_id::text, course_id::text FROM enrollments ORDER BY start_date",
  stat: "SELECT count(*) AS total, count(extended_end_date) AS with_extended, count(*) - count(extended_end_date) AS null_extended FROM enrollments"
};

(async () => {
  await client.connect();
  for (const [k, sql] of Object.entries(queries)) {
    const r = await client.query(sql);
    fs.writeFileSync(`/tmp/export_${k}.csv`, JSON.stringify(r.rows, null, 0), 'utf8');
    console.log(`${k} rows=${r.rows.length}`);
  }
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });