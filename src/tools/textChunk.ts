// tools/textChunk.ts —— 文本切块工具（薄壳）
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { chunkText } from '../lib/chunk.js';
import { jsonResult, type ToolContext } from './index.js';

export function registerTextChunk(server: McpServer, _ctx: ToolContext): void {
  server.tool(
    'text_chunk',
    'RAG 文本切块：把长文本按 chunkSize 切成若干片段，支持 overlap 重叠，优先在句末断点切割。适合做检索增强的预处理。',
    {
      text: z.string().describe('待切块的原始文本'),
      chunkSize: z.number().int().positive().optional().describe('每块最大字符数，默认 500'),
      overlap: z.number().int().nonnegative().optional().describe('相邻块重叠字符数，默认 50'),
    },
    async (args) => {
      const chunks = chunkText(args.text, {
        chunkSize: args.chunkSize,
        overlap: args.overlap,
      });
      return jsonResult({ chunks, chunkCount: chunks.length });
    },
  );
}
