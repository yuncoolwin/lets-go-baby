#!/usr/bin/env node
/**
 * sync-prod-to-dev.js — 生产库 → 开发库数据同步（可复用）
 *
 * ⚠️ 前置约束【生产源依赖 exec_sql product】
 *  Node 进程无法调用 Coze 平台的 exec_sql 工具。生产库全量数据（含 RLS 表）
 *  必须先在平台对话中用 `exec_sql product`（只读）导出为 snapshot JSON，
 *  再传给本脚本作为数据源。脱离该环境本脚本无法自动从生产读取。
 *
 *  snapshot JSON 约定（每张表一个对象数组，字段值用 to_jsonb(t)::text 保真序列化）：
 *  {
 *    "_meta": { "source": "exec_sql product", "exported_at": "..." , "tables": ["..."] },
 *    "users": [ { "id": "...", "nickname": "...", ... } ],
 *    ...
 *  }
 *  其中 date 列='YYYY-MM-DD'、timestamp without time zone=无偏移文本、
 *  timestamptz=ISO带偏移文本，杜绝 JS Date.toISOString() 造成的展示偏移。
 *
 *  开发库：通过环境变量 PGDATABASE_URL（可写）直连。
 *
 * 用法（未传参数 = 全量同步 + RLS5表字段级比对）：
 *  node scripts/sync-prod-to-dev.js \
 *        --snapshot /tmp/sync_backup/prod_snapshot.json \
 *        [--tables all|t1,t2] [--skip-tables a,b] \
 *        [--backup true|false] [--field-check true|false] \
 *        [--only-report] [--out /tmp/sync_backup/sync_report_日期.md]
 *
 * 行为：
 *  1) 读取生产 snapshot
 *  2) 可选：开发库全量备份（按表 SELECT to_jsonb::text + 生成 INSERT SQL，带时间戳）
 *  3) 清空开发库目标表（TRUNCATE ... CASCADE，自动处理外键顺序）
 *  4) 按表依赖顺序灌入生产数据
 *  5) 逐表比对行数
 *  6) 默认对 RLS 5 表（courses/teacher_classes/holidays/teacher_invite_codes/drop_in_records）
 *     做字段级逐行比对
 *  7) 生成差异报告（不写 Git、不写日志）
 *
 * 约定：默认跳过 audit_logs（审计日志）与 backup/cleanup 快照类表；可用 --tables 显式包含。
 */
'use strict'

const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

// ---- 解析 pg（根目录未安装，从 server/node_modules 兜底）----
function loadPg() {
  try { return require('pg') } catch (_) { /* continue */ }
  const candidates = [
    path.resolve(__dirname, '../server/node_modules/pg'),
    path.resolve(__dirname, '../node_modules/pg'),
  ]
  for (const c of candidates) {
    try { return require(c) } catch (_) { /* continue */ }
  }
  throw new Error('未找到 pg 依赖，请在项目根执行 pnpm install 或使用 server/node_modules')
}
const { Client } = loadPg()

// ---- 业务表清单（依赖顺序：主表在前，子表在后）----
const ALL_TABLES = [
  // 主表（被外键引用）
  'users', 'families', 'classes', 'teachers', 'children', 'user_roles',
  'teacher_classes', 'courses', 'teacher_invite_codes', 'holidays',
  // 子表（依赖主表 id）
  'enrollments', 'enrollment_extensions', 'attendance', 'attendance_records',
  'drop_in_records', 'daily_feedbacks', 'growth_records', 'holidays_old',
]
// 默认跳过的表（可 --tables 显式包含）
const SKIP_BY_DEFAULT = [
  'audit_logs', 'notifications', 'notification_recipients', 'notification_reads',
  'attendance_holiday_backup', 'attendance_records_cleanup_backup_20260916',
  'teachers_user_id_backup_20260908', 'backup_linlong_20260921',
]
// RLS 5 表（字段级逐行比对的默认对象）
const RLS_FIELD_CHECK = ['courses', 'teacher_classes', 'holidays', 'teacher_invite_codes', 'drop_in_records']

// ---- 参数解析 ----
// 需要显式取值的参数（其余均为无值布尔开关，写 --only-report 即 true）
const VALUE_ARGS = ['snapshot', 'out', 'tables', 'skip-tables', 'backup', 'field-check']
function parseArgs(argv) {
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i]
    if (!s.startsWith('--')) continue
    const eq = s.indexOf('=')
    const key = eq > 0 ? s.slice(2, eq) : s.slice(2)
    if (eq > 0) {
      a[key] = s.slice(eq + 1)
    } else if (VALUE_ARGS.includes(key)) {
      // 取值参数：消费下一个非 '--' 裸值（或 '=' 已含）
      a[key] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : 'true'
    } else {
      // 布尔开关
      a[key] = (argv[i + 1] && !argv[i + 1].startsWith('--') && /^(true|false)$/i.test(argv[i + 1])) ? argv[++i] : 'true'
    }
  }
  return a
}

// ---- 工具 ----
const now = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)

function pick(obj, key, def) {
  return Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== '' ? obj[key] : def
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`
  return `'${String(v).replace(/'/g, "''")}'`
}
const q = (i) => '"' + String(i).replace(/"/g, '""') + '"'
const outDir = () => fs.mkdirSync('/tmp/sync_backup', { recursive: true }) || '/tmp/sync_backup'

// ---- 备份开发库（按表生成 INSERT SQL，带时间戳）----
async function backupDev(client, tables) {
  const dir = outDir()
  const stamp = now()
  const file = path.join(dir, `sync_backup_${stamp}.sql`)
  const lines = ['-- 开发库数据备份（sync-prod-to-dev.js）', `-- created_at: ${new Date().toISOString()}`, '']
  for (const t of tables) {
    const r = await client.query(`SELECT to_jsonb(t)::text AS j FROM (SELECT * FROM ${q(t)}) t`)
    lines.push(`-- === ${t} (${r.rows.length} rows) ===`)
    if (r.rows.length === 0) { lines.push(`-- (empty)`); continue }
    // 用第一条记录的键做列清单（顺序稳定），逐行 INSERT
    const first = JSON.parse(r.rows[0].j)
    const cols = Object.keys(first)
    const colSql = cols.map(q).join(',')
    for (const row of r.rows) {
      const obj = JSON.parse(row.j)
      lines.push(`INSERT INTO ${q(t)} (${colSql}) VALUES (${cols.map(c => sqlVal(obj[c])).join(',')});`)
    }
  }
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8')
  return { file, tables: tables.length }
}

// ---- TRUNCATE（CASCADE 自动处理外键顺序）----
async function truncate(client, tables) {
  if (tables.length === 0) return
  const list = tables.map(q).join(', ')
  await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

// ---- 按依赖顺序灌入 ----
async function insertRows(client, table, rows) {
  if (!rows || rows.length === 0) return 0
  const cols = Object.keys(rows[0])
  const colSql = cols.map(q).join(',')
  const ph = cols.map((_, i) => '$' + (i + 1)).join(',')
  const cleanCols = cols.map(c => c.replace(/"/g, ''))
  for (const row of rows) {
    const vals = cleanCols.map(c => {
      const v = row[c]
      if (v === undefined) return null
      // jsonb/json 列：JS 对象/数组须序列化为字符串，否则 pg 报 invalid input syntax for type json
      if (v !== null && typeof v === 'object') return JSON.stringify(v)
      return v
    })
    await client.query(`INSERT INTO ${q(table)} (${colSql}) VALUES (${ph})`, vals)
  }
  return rows.length
}

// ---- 逐表行数比对 ----
async function compareCounts(client, snapshot, tables) {
  const res = {}
  for (const t of tables) {
    const src = (snapshot[t] || []).length
    let dst = 'ERR'
    try { dst = (await client.query(`SELECT count(*)::int n FROM ${q(t)}`)).rows[0].n } catch (e) { dst = 'ERR:' + e.message.split('\n')[0] }
    res[t] = { prod: src, dev: dst, match: src === dst }
  }
  return res
}

// ---- RLS 5 表字段级逐行比对（以生产 snapshot 为基准，dev 用 to_jsonb::text 还原）----
function normalize(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.map(normalize)
    const o = {}
    for (const k of Object.keys(v)) o[k] = normalize(v[k])
    return o
  }
  return String(v) // date/timestamp/文本统一按字符串比较
}
async function fieldCheck(client, snapshot, tables) {
  const report = {}
  for (const t of tables) {
    const srcRows = snapshot[t] || []
    const devRows = []
    try {
      const r = await client.query(`SELECT to_jsonb(x)::text AS j FROM (SELECT * FROM ${q(t)}) x`)
      devRows.push(...r.rows.map(x => JSON.parse(x.j)))
    } catch (e) {
      report[t] = { status: 'ERR', msg: e.message.split('\n')[0] }
      continue
    }
    report[t] = { status: '完全一致', prod: srcRows.length, dev: devRows.length, diffs: [] }
    if (srcRows.length !== devRows.length) {
      report[t].status = '行数不一致'
      report[t].diffs.push({ type: 'count', prod: srcRows.length, dev: devRows.length })
    }
    const devById = new Map(devRows.map(r => [String(r.id), r]))
    let diffCount = 0
    for (const s of srcRows) {
      const id = String(s.id)
      const d = devById.get(id)
      const rowDiff = []
      if (!d) { rowDiff.push({ field: '__missing__', prod: normalize(s.id), dev: null }); diffCount++; continue }
      for (const f of Object.keys(s)) {
        const sp = normalize(s[f])
        const dp = normalize(d[f])
        if (JSON.stringify(sp) !== JSON.stringify(dp)) {
          rowDiff.push({ id, field: f, prod: sp, dev: dp })
          diffCount++
        }
      }
      if (rowDiff.length) report[t].diffs.push(...rowDiff)
    }
    if (!report[t].diffs.length) report[t].status = '完全一致'
    else if (report[t].diffs.filter(x => x.type === 'count').length) report[t].status = '行数不一致'
    else report[t].status = '存在不一致字段'
  }
  return report
}

// ---- 主流程 ----
async function main() {
  const args = parseArgs(process.argv.slice(2))
  const snapshotPath = args.snapshot
  const tablesArg = pick(args, 'tables', 'all')
  const skipArg = (pick(args, 'skip-tables', '') || '').split(',').map(s => s.trim()).filter(Boolean)
  const doBackup = pick(args, 'backup', 'true') !== 'false'
  const doFieldCheck = pick(args, 'field-check', 'true') !== 'false'
  const onlyReport = pick(args, 'only-report', '') !== '' && pick(args, 'only-report', '') !== 'false'
  const reportOut = args.out || path.join(outDir(), `sync_report_${now()}.md`)

  if (!snapshotPath) { console.error('缺少 --snapshot <生产快照.json>'); process.exit(2) }
  if (!fs.existsSync(snapshotPath)) { console.error('未找到快照:', snapshotPath); process.exit(2) }
  if (!process.env.PGDATABASE_URL) { console.error('缺少环境变量 PGDATABASE_URL（开发库可写连接）'); process.exit(2) }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
  const meta = snapshot._meta || {}
  const tablePool = (meta.tables && Array.isArray(meta.tables)) ? meta.tables : ALL_TABLES

  // 解析目标表清单
  let targetTables
  if (tablesArg === 'all') {
    targetTables = tablePool.filter(t => !SKIP_BY_DEFAULT.includes(t))
  } else {
    targetTables = tablesArg.split(',').map(s => s.trim()).filter(Boolean)
  }
  if (skipArg.length) targetTables = targetTables.filter(t => !skipArg.includes(t))
  // 去重且保持依赖顺序（存在则按 ALL_TABLES 顺序）
  targetTables = ALL_TABLES.filter(t => targetTables.includes(t))
  if (targetTables.length === 0) { console.error('目标表为空'); process.exit(2) }

  const client = new Client({ connectionString: process.env.PGDATABASE_URL })
  await client.connect()
  const stamp = new Date().toISOString()
  const lines = []
  try {
    console.log(`生产 snapshot: ${snapshotPath}`)
    console.log(`来源: ${meta.source || '(未标注)'} | 导出时间: ${meta.exported_at || '-'}`)
    console.log(`目标表 (${targetTables.length}): ${targetTables.join(', ')}`)
    console.log(`backup=${doBackup} field-check=${doFieldCheck} only-report=${onlyReport}\n`)

    if (onlyReport) {
      // 仅比对，不备份/不清空/不灌入
    } else {
      if (doBackup) {
        const bk = await backupDev(client, targetTables)
        console.log(`[1/5] 开发库备份已生成: ${bk.file}`)
        lines.push(`- **备份**: \`${bk.file}\` (${bk.tables} 张表)`)
      } else {
        console.log('[1/5] 备份已跳过 (--backup=false)')
        lines.push('- **备份**: 已跳过')
      }
      await truncate(client, targetTables)
      console.log(`[2/5] 已清空开发库 ${targetTables.length} 张表 (TRUNCATE CASCADE)`)
      for (const t of targetTables) {
        const n = await insertRows(client, t, snapshot[t] || [])
        console.log(`[3/5] 灌入 ${t}: ${n} 行`)
      }
    }

    console.log('[4/5] 逐表行数比对...')
    const counts = await compareCounts(client, snapshot, targetTables)
    const countBad = Object.values(counts).filter(c => c.match === false || typeof c.dev === 'string').length

    // RLS 字段级比对
    let fieldReport = null
    if (doFieldCheck) {
      const fT = RLS_FIELD_CHECK.filter(t => targetTables.includes(t) && snapshot[t] !== undefined)
      if (fT.length) {
        console.log('[5/5] RLS 5 表字段级逐行比对...')
        fieldReport = await fieldCheck(client, snapshot, fT)
      }
    }

    // 汇总
    lines.unshift(`# 生产→开发 数据同步报告`)
    lines.push('')
    lines.push(`- 生成时间: ${stamp}`)
    lines.push(`- 生产快照: ${snapshotPath}`)
    lines.push(`- 生产源: ${meta.source || '(未标注)'}（exec_sql product 只读）`)
    lines.push(`- 模式: ${onlyReport ? '仅比对（only-report）' : '全量同步'}`)
    lines.push(`- 目标表数量: ${targetTables.length}`)
    lines.push('')
    lines.push('## 逐表行数比对')
    lines.push('| 表 | 生产 | 开发 | 一致 |')
    lines.push('|---|---|---|---|')
    for (const t of targetTables) {
      const c = counts[t]
      const ok = c.match === true ? '✅' : '❌'
      lines.push(`| ${t} | ${c.prod} | ${c.dev} | ${ok} |`)
    }
    lines.push('')
    lines.push(`行数不一致表数: **${countBad}**`)
    lines.push('')
    if (fieldReport) {
      lines.push('## RLS 5 表字段级比对')
      lines.push('| 表 | 结果 | 生产行数 | 开发行数 |')
      lines.push('|---|---|---|---|')
      for (const t of Object.keys(fieldReport)) {
        const f = fieldReport[t]
        lines.push(`| ${t} | ${f.status} | ${f.prod} | ${f.dev} |`)
      }
      for (const t of Object.keys(fieldReport)) {
        const f = fieldReport[t]
        if (f.status === '完全一致') continue
        lines.push('')
        lines.push(`### ${t} 差异明细`)
        for (const d of f.diffs) {
          lines.push(`- id=${d.id} 字段\`${d.field}\`: 生产=\`${JSON.stringify(d.prod)}\` vs 开发=\`${JSON.stringify(d.dev)}\``)
        }
      }
    }
    fs.writeFileSync(reportOut, lines.join('\n') + '\n', 'utf8')
    console.log('\n=== 完成 ===')
    console.log('差异报告: ' + reportOut)
    // 打印报告摘要（去掉首行标题后）
    console.log('\n' + lines.slice(1).join('\n'))
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch(e => { console.error('FATAL:', e.stack || e); process.exit(1) })