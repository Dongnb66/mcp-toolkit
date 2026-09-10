// tools/index.ts —— 工具注册入口（schema 薄壳层）
//
// 分层铁律：tools/ 只做「zod schema + handler 转发」，业务逻辑全部在 lib/ 纯函数里。
// 这样 lib/ 可以脱离 MCP SDK 独立单测，tools/ 保持极薄、一眼看懂。

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface ToolContext {
  startTimeMs: number;
  name: string;
  version: string;
}

export type RegisterFn = (server: McpServer, ctx: ToolContext) => void;

/** 统一把结果序列化为 MCP text content */
export function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

import { registerTravelHotspotRank } from './travelHotspotRank.js';
import { registerTc3Sign } from './tc3Sign.js';
import { registerTextChunk } from './textChunk.js';
import { registerDateCalc } from './dateCalc.js';
import { registerSqliteQuery } from './sqliteQuery.js';
import { registerWebpageExtract } from './webpageExtract.js';
import { registerJwtDecode } from './jwtDecode.js';
import { registerHealthPing } from './healthPing.js';

export {
  registerTravelHotspotRank,
  registerTc3Sign,
  registerTextChunk,
  registerDateCalc,
  registerSqliteQuery,
  registerWebpageExtract,
  registerJwtDecode,
  registerHealthPing,
};

export const allRegisters: RegisterFn[] = [
  registerTravelHotspotRank,
  registerTc3Sign,
  registerTextChunk,
  registerDateCalc,
  registerSqliteQuery,
  registerWebpageExtract,
  registerJwtDecode,
  registerHealthPing,
];
