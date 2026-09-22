/* 同步 sync_reader 可见表：生产(sync_reader只读) -> 开发(PGDATABASE_URL) */
const { Client } = require('pg')

const SRC = 'postgresql://sync_reader:7sH9kP2vN5bR8mZ4@cp-goody-moon-513f0187.pg5.aidap-global.cn-beijing.volces.com:5432/postgres'
const DST = process.env.PGDATABASE_URL

// 按外键依赖顺序（主表→子表）; key: 生产表名
const TABLES = [
  'users',
  'families',
  'classes',
  'teachers',
  'children',
  'user_roles',
  'enrollments',
  'enrollment_extensions',
  'attendance',
  'attendance_records',
  'daily_feedbacks',
  'holidays_old',
]

async function main() {
  const src = new Client({ connectionString: SRC })
  const dst = new Client({ connectionString: DST })
  await src.connect()
  await dst.connect()
  const report = {}
  for (const t of TABLES) {
    try {
      const r = await src.query(`SELECT * FROM "${t}"`)
      const rows = r.rows
      const cols = r.fields.map(f => f.name)
      const colSql = cols.map(c => '"' + c + '"').join(',')
      const ph = cols.map((_, i) => '$' + (i + 1)).join(',')
      // dst 逐表清空（把该表设为空，因为开发库被整体 TRUNCATE 过，这里仅防残留/顺序）
      await dst.query(`DELETE FROM "${t}"`)
      for (const row of rows) {
        await dst.query(`INSERT INTO "${t}" (${colSql}) VALUES (${ph})`, cols.map(c => row[c]))
      }
      report[t] = { src: rows.length, dst: (await dst.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n }
      console.log(`${t}: src=${rows.length} dst=${report[t].dst}`)
    } catch (e) {
      report[t] = 'ERR:' + e.message.split('\n')[0]
      console.error(`ERR ${t}: ${e.message.split('\n')[0]}`)
    }
  }
  await src.end()
  await dst.end()
  require('fs').writeFileSync('/tmp/sync_backup/visible_report.json', JSON.stringify(report, null, 2))
  console.log('DONE')
}
main().catch(e => { console.error(e); process.exit(1) })