// lib/sqlite.ts —— SQLite 只读查询（node:sqlite）
//
// 使用 Node 22 内置的 node:sqlite（DatabaseSync），零原生编译依赖。
// 安全约束：仅允许只读语句（SELECT / WITH / PRAGMA），且以 readOnly 模式打开，
// 双重保险杜绝通过 MCP 工具对数据库执行写操作。

import { createRequire } from 'node:module';
import type { SQLInputValue } from 'node:sqlite';

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

const READ_ONLY_RE = /^(select|with|pragma)\b/i;

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
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const stmt = db.prepare(trimmed);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { columns, rows, rowCount: rows.length };
  } finally {
    db.close();
  }
}
