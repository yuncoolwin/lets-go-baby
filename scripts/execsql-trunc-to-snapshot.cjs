/**
 * 从 Coze 平台 exec_sql product 落盘的 trunc 文件重建标准快照 JSON。
 *
 * 背景：生产库唯一权威读源是平台 exec_sql product（Node 无法程序化连接）。
 * 对单张表执行 `SELECT 't', json_agg(to_jsonb(x))::text FROM t x`，输出过大时平台
 * 会将完整文本落盘到 `<workspace>/.cozeproj/.../trunc/<call>_<id>` 格式的文件。
 * 本脚本读取该文件（CSV 两列: table,"json数组文本"），反转成 { [table]: rows[] }，
 * 并按表清单组装成标准 prod_snapshot.json（含 _meta）。
 *
 * 用法：
 *   node scripts/execsql-trunc-to-snapshot.cjs <trunc 文件> [--out <快照路径>]
 * 默认输出 /tmp/sync_backup/prod_snapshot.json
 *
 * 前置约束：生产源依赖 exec_sql product（平台查询），本脚本只做本地格式转换，不连接任何库。
 */
const fs = require('fs');
const path = require('path');

const ALL_TABLES = [
  'users', 'families', 'classes', 'teachers', 'children',
  'user_roles', 'teacher_classes', 'courses', 'teacher_invite_codes', 'holidays',
  'enrollments', 'enrollment_extensions', 'attendance', 'attendance_records',
  'drop_in_records', 'daily_feedbacks', 'growth_records', 'holidays_old',
];

function parseTrunc(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const nl = raw.indexOf('\n');
  const body = raw.slice(nl + 1);
  const out = {};
  for (let line of body.split('\n')) {
    line = line.trim();
    if (!line) continue;
    const c = line.indexOf(',');
    if (c <= 0) continue;
    const table = line.slice(0, c);
    let jsonText = line.slice(c + 1).trim();
    if (!jsonText) { out[table] = []; continue; }
    if (jsonText.startsWith('"') && jsonText.endsWith('"') && !jsonText.startsWith('""')) {
      jsonText = jsonText.slice(1, -1);
    }
    jsonText = jsonText.replace(/""/g, '"');
    try {
      const arr = JSON.parse(jsonText);
      out[table] = Array.isArray(arr) ? arr : [arr];
    } catch (e) {
      throw new Error(`表 ${table} JSON 解析失败: ${e.message}`);
    }
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const file = argv[0];
  const outIdx = argv.indexOf('--out');
  const outPath = outIdx >= 0 ? argv[outIdx + 1] : '/tmp/sync_backup/prod_snapshot.json';
  if (!file || !fs.existsSync(file)) {
    console.error('用法: node scripts/execsql-trunc-to-snapshot.cjs <trunc文件> [--out <快照>]');
    process.exit(1);
  }
  const data = parseTrunc(file);
  const missing = ALL_TABLES.filter((t) => !(t in data));
  if (missing.length) {
    console.warn('警告: 快照中缺少表 ->', missing.join(', '));
  }
  const snap = { _meta: { source: 'exec_sql product', exported_at: new Date().toISOString(), tables: ALL_TABLES } };
  for (const t of ALL_TABLES) snap[t] = data[t] || [];
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snap));
  console.log('已写入快照:', outPath, '(' + fs.statSync(outPath).size + ' bytes)');
  for (const t of ALL_TABLES) console.log('  ', t.padEnd(22), snap[t].length);
}

if (require.main === module) main();
module.exports = { parseTrunc, ALL_TABLES };