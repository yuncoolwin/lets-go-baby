import fs from 'node:fs'
import path from 'node:path'

const URL0 = process.env.COZE_SUPABASE_URL || ''
const KEY = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || ''
if (!URL0 || !KEY) { console.error('missing env'); process.exit(1) }
const URL = URL0.replace(/\/+$/, '')
const OUT = path.resolve('dev_to_prod_export')
fs.mkdirSync(OUT, { recursive: true })

const TABLES = [
  'users', 'teachers', 'children', 'classes', 'courses', 'families', 'user_roles',
  'teacher_classes', 'class_members', 'parent_child_relations', 'teacher_invite_codes',
  'enrollments', 'enrollment_extensions', 'attendance', 'attendance_records', 'drop_in_records',
  'daily_feedbacks', 'growth_records', 'holidays', 'holidays_old', 'audit_logs', 'notifications',
  'notification_recipients', 'notification_reads', 'binding_requests', 'health_check',
  'attendance_holiday_backup', 'attendance_records_cleanup_backup_20260916', 'teachers_user_id_backup_20260908',
]

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', Prefer: 'count=exact' }

async function fetchAll(table) {
  const all = []
  let off = 0
  for (;;) {
    const r = await fetch(`${URL}/rest/v1/${table}?select=*`, {
      headers: { ...H, Range: `${off}-${off + 999}` },
    })
    if (!r.ok) {
      if (r.status === 403) return { locked: true, rows: [] }
      throw new Error(`${table}: ${r.status} ${await r.text()}`)
    }
    const j = await r.json()
    all.push(...j)
    const cr = r.headers.get('content-range') || ''
    const m = cr.match(/^\d+-(?:\d+|\*)\/(\d+)$/)
    const total = m ? +m[1] : all.length
    if (off + 1000 >= total) break
    off += 1000
  }
  return { locked: false, rows: all }
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`
  return `'${String(v).replace(/'/g, "''")}'`
}
const q = (i) => `"${String(i).replace(/"/g, '""')}"`

const counts = {}
const tableNames = []
for (const t of TABLES) {
  const res = await fetchAll(t)
  const rows = res.rows
  counts[t] = res.locked ? 'RESTRICTED' : rows.length
  tableNames.push(t)
  const lines = []
  if (res.locked) {
    lines.push(`-- ${t}: PERMISSION DENIED (RLS), no data exported`)
  } else if (rows.length === 0) {
    lines.push(`-- ${t}: 0 rows (no data)`)
  } else {
    const cols = Object.keys(rows[0])
    const header = `INSERT INTO ${q(t)} (${cols.map(q).join(', ')}) VALUES`
    for (const row of rows) {
      lines.push(`${header} (${cols.map((c) => sqlVal(row[c])).join(', ')});`)
    }
  }
  fs.writeFileSync(path.join(OUT, `${t}.sql`), lines.join('\n') + '\n', 'utf8')
  console.log(`${t}: ${counts[t]} rows`)
}

// count snapshot
const snap = tableNames.map((t) =>
  counts[t] === 'RESTRICTED'
    ? `-- SELECT '${t}' cannot be counted: RLS denied`
    : `SELECT '${t}', count(*) FROM ${q(t)}`
).join('\nUNION ALL\n')
fs.writeFileSync(path.join(OUT, '_count_snapshot.sql'), snap + ';\n', 'utf8')

// order md
const order = [
  ['主表（先导，被其余表外键引用）', ['users', 'teachers', 'children', 'classes', 'courses', 'families', 'user_roles', 'teacher_classes', 'class_members', 'parent_child_relations', 'teacher_invite_codes']],
  ['子表（依赖主表 id）', ['enrollments', 'enrollment_extensions', 'attendance', 'attendance_records', 'drop_in_records', 'daily_feedbacks', 'growth_records', 'holidays', 'holidays_old', 'audit_logs', 'notifications', 'notification_recipients', 'notification_reads', 'binding_requests', 'health_check']],
  ['备份/复核表（仅历史备份，非业务主数据，可最后导）', ['attendance_holiday_backup', 'attendance_records_cleanup_backup_20260916', 'teachers_user_id_backup_20260908']],
]
let md = `# 导入顺序说明（develop → prod）\n\n`
md += `> 先导主表（被引用），再导子表。导数据时建议临时关闭触发器/FK 约束或按此顺序避免外键冲突。\n\n`
md += `| 顺序 | 阶段 | 表 | develop 记录数 |\n|---|---|---|---|\n`
let idx = 0
for (const [stage, list] of order) {
  for (const t of list) { idx++; md += `| ${idx} | ${stage} | ${t} | ${counts[t]} |\n` }
}
fs.writeFileSync(path.join(OUT, '_导入顺序.md'), md, 'utf8')

console.log('\n--- counts snapshot ---')
for (const t of tableNames) console.log(`${t}\t${counts[t]}`)
console.log('\nDONE')