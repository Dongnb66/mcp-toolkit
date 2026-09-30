// tools/healthPing.ts —— 健康检查工具（薄壳）
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHealth } from '../lib/health.js';
import { jsonResult, type ToolContext } from './index.js';

export function registerHealthPing(server: McpServer, ctx: ToolContext): void {
  // 唯一一个没有 zod schema 的工具：它本来就不收参数，所以 schema 是空对象字面量。
  // 其余 7 个工具的入参都走 zod 校验（见 tc3Sign.ts / sqliteQuery.ts 等）。
  server.tool(
    'health_ping',
    '健康检查：返回服务名、版本、运行时长、Node 版本与平台信息，用于验证 MCP 服务器连通性。',
    {},
    async () => jsonResult(getHealth(ctx.startTimeMs, ctx.name, ctx.version)),
  );
}
