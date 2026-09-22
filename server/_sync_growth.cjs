const { Client } = require('pg')
const SRC = 'postgresql://sync_reader:7sH9kP2vN5bR8mZ4@cp-goody-moon-513f0187.pg5.aidap-global.cn-beijing.volces.com:5432/postgres'
const DST = process.env.PGDATABASE_URL
const T = 'growth_records'
const JSONB_COLS = ['photo_urls', 'video_urls']
async function main() {
  const src = new Client({ connectionString: SRC })
  const dst = new Client({ connectionString: DST })
  await src.connect(); await dst.connect()
  const r = await src.query(`SELECT * FROM "${T}"`)
  const rows = r.rows
  const cols = r.fields.map(f => f.name)
  const colSql = cols.map(c => '"' + c + '"').join(',')
  const ph = cols.map((_, i) => '$' + (i + 1)).join(',')
  for (const row of rows) {
    const vals = cols.map(c => JSONB_COLS.includes(c) && row[c] != null ? JSON.stringify(row[c]) : row[c])
    await dst.query(`INSERT INTO "${T}" (${colSql}) VALUES (${ph})`, vals)
  }
  const d = await dst.query(`SELECT count(*)::int n FROM "${T}"`)
  console.log(`${T}: src=${rows.length} dst=${d.rows[0].n}`)
  await src.end(); await dst.end()
}
main().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })