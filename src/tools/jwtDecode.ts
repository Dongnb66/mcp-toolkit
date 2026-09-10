// tools/jwtDecode.ts —— JWT 解码/验签工具（薄壳）
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { decodeJwt, verifyJwt } from '../lib/jwt.js';
import { jsonResult, type ToolContext } from './index.js';

export function registerJwtDecode(server: McpServer, _ctx: ToolContext): void {
  server.tool(
    'jwt_decode',
    '解码 JWT（不验签），解析 header 与 payload 并判断是否过期；提供 secret 时用 HMAC（HS256/384/512）验签。',
    {
      token: z.string().describe('JWT 字符串'),
      secret: z.string().optional().describe('HMAC 密钥，提供则同时验签'),
    },
    async (args) => {
      const decoded = decodeJwt(args.token);
      const result: Record<string, unknown> = { ...decoded };
      if (args.secret) {
        result.verified = verifyJwt(args.token, args.secret);
      }
      return jsonResult(result);
    },
  );
}
