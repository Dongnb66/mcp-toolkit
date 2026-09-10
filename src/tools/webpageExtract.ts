// tools/webpageExtract.ts —— 网页正文抽取工具（薄壳）
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { extractFromHtml, fetchHtml } from '../lib/webpage.js';
import { jsonResult, type ToolContext } from './index.js';

export function registerWebpageExtract(server: McpServer, _ctx: ToolContext): void {
  server.tool(
    'webpage_extract',
    '抓取网页并抽取纯文本：返回标题、各级标题、链接列表与去标签正文，适合做网页内容的结构化提取。',
    {
      url: z.string().url().describe('目标网页 URL'),
      timeoutMs: z.number().int().positive().optional().describe('请求超时毫秒，默认 10000'),
    },
    async (args) => {
      const html = await fetchHtml(args.url, args.timeoutMs ?? 10_000);
      const page = extractFromHtml(html);
      return jsonResult({ url: args.url, ...page });
    },
  );
}
