// playground/functions/handler.ts —— MCP 工具层之外的第二宿主：HTTP handler。
// lib 层纯函数零 MCP 依赖的 payoff：同一份 src/lib 源码，MCP stdio 服务器与 Sites edge 函数共用。
import { chunkText } from '../../src/lib/chunk.js';
import { dateCalc, type DateOp } from '../../src/lib/date.js';
import { getLeaderboard } from '../../src/lib/hotspot.js';
import { decodeJwt, verifyJwt } from '../../src/lib/jwt.js';
import { buildTc3Headers } from '../../src/lib/tc3.js';
import { extractFromHtml, fetchHtml } from '../../src/lib/webpage.js';
import { getHealth } from '../../src/lib/health.js';

const START = Date.now();
const MAX_BODY = 100_000;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' || h.endsWith('.local') || h === '::1' || h === '0.0.0.0' ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^0\./.test(h)
  );
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new Error('请求体超过 100KB 上限');
  if (!text) return {};
  const v = JSON.parse(text);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('请求体必须是 JSON 对象');
  return v as Record<string, unknown>;
}

function str(v: unknown, name: string): string {
  if (typeof v !== 'string' || !v) throw new Error(`${name} 必须是非空字符串`);
  return v;
}

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const tool = url.pathname.split('/').filter(Boolean).pop() ?? '';
  try {
    if (tool === 'health_ping') {
      if (req.method !== 'GET') return json(405, { ok: false, error: 'health_ping 仅支持 GET' });
      return json(200, { ok: true, health: getHealth(START, 'mcp-toolkit-playground', '1.0.0') });
    }
    if (req.method !== 'POST') return json(405, { ok: false, error: `${tool} 仅支持 POST` });
    const body = await readBody(req);

    if (tool === 'text_chunk') {
      const text = str(body.text, 'text');
      const opts: { chunkSize?: number; overlap?: number } = {};
      if (body.chunkSize !== undefined) opts.chunkSize = Number(body.chunkSize);
      if (body.overlap !== undefined) opts.overlap = Number(body.overlap);
      const chunks = chunkText(text, opts);
      return json(200, { ok: true, chunks, count: chunks.length });
    }
    if (tool === 'date_calc') {
      const op = str(body.op, 'op') as DateOp;
      const result = dateCalc(op, body);
      return json(200, { ok: true, result });
    }
    if (tool === 'hotspot_rank') {
      if (!Array.isArray(body.locations) || !Array.isArray(body.posts)) {
        throw new Error('locations 与 posts 必须是数组');
      }
      const leaderboard = getLeaderboard(body.locations, body.posts);
      return json(200, { ok: true, leaderboard });
    }
    if (tool === 'jwt_decode') {
      const token = str(body.token, 'token');
      const decoded = decodeJwt(token);
      let verified: boolean | undefined;
      if (body.secret !== undefined) verified = verifyJwt(token, str(body.secret, 'secret'));
      return json(200, { ok: true, decoded, verified });
    }
    if (tool === 'tc3_sign') {
      const secretId = str(body.secretId, 'secretId');
      const secretKey = str(body.secretKey, 'secretKey');
      const opts: Record<string, unknown> = { secretId, secretKey };
      for (const k of ['service', 'host', 'action', 'region', 'version']) {
        if (body[k] !== undefined) opts[k] = str(body[k], k);
      }
      if (body.timestamp !== undefined) {
        if (!Number.isInteger(Number(body.timestamp))) throw new Error('timestamp 必须是整数秒');
        opts.timestamp = Number(body.timestamp);
      }
      const headers = buildTc3Headers(body.payload ?? {}, opts as never);
      return json(200, { ok: true, headers });
    }
    if (tool === 'webpage_extract') {
      const raw = str(body.url, 'url');
      let u: URL;
      try { u = new URL(raw); } catch { throw new Error('url 不是合法 URL'); }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('仅支持 http/https');
      if (isPrivateHost(u.hostname)) throw new Error('拒绝访问私网/本机地址');
      const timeoutMs = body.timeoutMs === undefined ? 10_000 : Number(body.timeoutMs);
      if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 15_000) {
        throw new Error('timeoutMs 必须是 1-15000 的整数');
      }
      const html = await fetchHtml(u.toString(), timeoutMs);
      return json(200, { ok: true, page: extractFromHtml(html) });
    }
    return json(404, { ok: false, error: `未知工具：${tool}` });
  } catch (e) {
    return json(400, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}