// tools/dateCalc.ts —— 日期计算工具（薄壳）
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { dateCalc } from '../lib/date.js';
import { jsonResult, type ToolContext } from './index.js';

export function registerDateCalc(server: McpServer, _ctx: ToolContext): void {
  server.tool(
    'date_calc',
    '日期计算：加减天数、求日期差、查星期几、判断闰年、查当月天数、取今天日期。日期统一 YYYY-MM-DD 格式，按 UTC 处理规避跨日误差。',
    {
      op: z
        .enum(['add_days', 'diff_days', 'weekday', 'days_in_month', 'is_leap_year', 'today'])
        .describe('操作类型'),
      date: z.string().optional().describe('YYYY-MM-DD，add_days/weekday 需要'),
      days: z.number().int().optional().describe('加减天数，add_days 需要'),
      from: z.string().optional().describe('起始日期，diff_days 需要'),
      to: z.string().optional().describe('结束日期，diff_days 需要'),
      year: z.number().int().optional().describe('年份，days_in_month/is_leap_year 需要'),
      month: z.number().int().optional().describe('月份 1-12，days_in_month 需要'),
    },
    async (args) => {
      const result = dateCalc(args.op, {
        date: args.date,
        days: args.days,
        from: args.from,
        to: args.to,
        year: args.year,
        month: args.month,
      });
      return jsonResult({ op: args.op, result });
    },
  );
}
