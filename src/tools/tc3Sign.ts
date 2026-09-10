// tools/tc3Sign.ts —— 腾讯云 TC3 签名工具（薄壳）
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildTc3Headers } from '../lib/tc3.js';
import { jsonResult, type ToolContext } from './index.js';

export function registerTc3Sign(server: McpServer, _ctx: ToolContext): void {
  server.tool(
    'tc3_sign',
    '生成腾讯云 API 3.0 的 TC3-HMAC-SHA256 签名请求头（含 Authorization）。密钥可入参或从环境变量 TC3_SECRET_ID / TC3_SECRET_KEY 读取，真实密钥不入日志。签名实现与官方公开测试向量逐字节一致。',
    {
      payload: z.record(z.string(), z.unknown()).describe('请求体 JSON 对象'),
      secretId: z.string().optional().describe('腾讯云 SecretId，缺省读 TC3_SECRET_ID'),
      secretKey: z.string().optional().describe('腾讯云 SecretKey，缺省读 TC3_SECRET_KEY'),
      service: z.string().optional().describe('服务名，如 sms / cvm，默认 sms'),
      host: z.string().optional().describe('接口域名，默认 sms.tencentcloudapi.com'),
      action: z.string().optional().describe('API 动作，默认 SendSms'),
      region: z.string().optional().describe('地域，默认 ap-guangzhou'),
      version: z.string().optional().describe('版本号，默认 2021-01-11'),
      timestamp: z.number().int().optional().describe('Unix 秒级时间戳，缺省当前时间'),
    },
    async (args) => {
      const secretId = args.secretId || process.env.TC3_SECRET_ID || '';
      const secretKey = args.secretKey || process.env.TC3_SECRET_KEY || '';
      if (!secretId || !secretKey) {
        throw new Error('缺少 secretId/secretKey：请通过入参或环境变量 TC3_SECRET_ID / TC3_SECRET_KEY 提供');
      }
      const headers = buildTc3Headers(args.payload, {
        secretId,
        secretKey,
        service: args.service,
        host: args.host,
        action: args.action,
        region: args.region,
        version: args.version,
        timestamp: args.timestamp,
      });
      return jsonResult({ headers });
    },
  );
}
