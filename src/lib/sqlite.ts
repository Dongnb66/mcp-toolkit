// lib/sqlite.ts —— SQLite 只读查询（node:sqlite）
//
// 使用 Node 22 内置的 node:sqlite（DatabaseSync），零原生编译依赖。
// 安全约束：仅允许只读语句（SELECT / WITH / PRAGMA），且以 readOnly 模式打开，
// 双重保险杜绝通过 MCP 工具对数据库执行写操作。

import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import type { SQLInputValue } from 'node:sqlite';

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

const READ_ONLY_RE = /^(select|with|pragma)\b/i;

/** 允许读取的根目录由它指定；不设则用进程工作目录。 */
export const SQLITE_ROOT_ENV = 'MCP_SQLITE_ROOT';

function allowedRoot(): string {
  const raw = process.env[SQLITE_ROOT_ENV] || process.cwd();
  try {
    return realpathSync(resolve(raw));
  } catch {
    return resolve(raw);
  }
}

/**
 * 把 dbPath 解析成绝对真实路径，并确认它落在允许的根目录内。
 *
 * 为什么必须做这一步：sqlite_query 本身是只读的，但**不限路径**就等于
 * 「本机任意 sqlite 文件都能读」。MCP 宿主里的模型可能被**间接提示注入**
 * （读到不可信内容后被诱导继续调工具），一个不设边界的读取工具就是数据外泄面。
 * 这也是「不可信返回内容不得扩大工具权限」这条原则在工具层的落实。
 *
 * 用 realpathSync 而不是字符串前缀判断，是为了同时挡住 `..` 与软链接绕过。
 */
function resolveDbPath(dbPath: string): string {
  if (dbPath === ':memory:') return dbPath;
  const root = allowedRoot();
  const abs = resolve(root, dbPath);

  // ① 先按解析后的字面路径判边界 —— 这一层才能给出准确的「越界」错误。
  //    （若先做 realpath，不存在的越界路径会误报成「文件不存在」，掩盖真实原因。）
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error(
      `dbPath 越界：只允许读取 ${root} 下的数据库；解析结果 ${abs} 不在该目录内。` +
        `如需扩大范围，请设置环境变量 ${SQLITE_ROOT_ENV}。`,
    );
  }

  // ② 再解析真实路径，挡住软链接把边界绕过去
  let real: string;
  try {
    real = realpathSync(abs);
  } catch {
    throw new Error(`数据库文件不存在或不可读：${abs}`);
  }
  if (real !== root && !real.startsWith(root + sep)) {
    throw new Error(
      `dbPath 越界（软链接解析后）：${abs} 实际指向 ${real}，不在 ${root} 内。`,
    );
  }
  return real;
}

// node:sqlite 是 Node 22 的实验内置模块，不在 builtinModules 清单里，
// vite/vitest 会误当普通包静态解析而失败。用 createRequire 运行时加载，
// 类型通过 typeof import() 纯类型查询获取（编译期擦除，vite 不感知）。
const nodeRequire = createRequire(import.meta.url);
type DatabaseSyncCtor = typeof import('node:sqlite').DatabaseSync;
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: DatabaseSyncCtor };

/**
 * 对 SQLite 数据库执行只读查询。
 * @param dbPath 数据库文件路径（或 ':memory:'）
 * @param sql 只读 SQL 语句
 * @param params 位置参数（? 占位符，按顺序传入）
 */
export function querySqlite(dbPath: string, sql: string, params: SQLInputValue[] = []): QueryResult {
  if (!sql || !sql.trim()) throw new Error('sql 不能为空');
  const trimmed = sql.trim();
  if (!READ_ONLY_RE.test(trimmed)) {
    throw new Error('sqlite_query 仅支持只读查询（SELECT / WITH / PRAGMA），拒绝写操作');
  }
  const db = new DatabaseSync(resolveDbPath(dbPath), { readOnly: true });
  try {
    const stmt = db.prepare(trimmed);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { columns, rows, rowCount: rows.length };
  } finally {
    db.close();
  }
}
