// tools/sqliteQuery.ts —— SQLite 只读查询工具（薄壳）
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SQLInputValue } from 'node:sqlite';
import { querySqlite } from '../lib/sqlite.js';
import { jsonResult, type ToolContext } from './index.js';

// SQLInputValue = null | number | bigint | string | Uint8Array（bigint/Uint8Array 无法经 JSON 传输，故收窄）
const sqlParam = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export function registerSqliteQuery(server: McpServer, _ctx: ToolContext): void {
  server.tool(
    'sqlite_query',
    '对 SQLite 数据库执行只读查询（SELECT / WITH / PRAGMA）。基于 Node 内置 node:sqlite，以只读模式打开，拒绝任何写操作。',
    {
      dbPath: z.string().describe('SQLite 数据库文件路径'),
      sql: z.string().describe('只读 SQL 语句（? 占位符可用 params 传参）'),
      params: z.array(sqlParam).optional().describe('位置参数，按 ? 顺序传入'),
    },
    async (args) => {
      const result = querySqlite(
        args.dbPath,
        args.sql,
        (args.params ?? []) as SQLInputValue[],
      );
      return jsonResult(result);
    },
  );
}
