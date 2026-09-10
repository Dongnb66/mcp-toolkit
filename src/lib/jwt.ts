// lib/jwt.ts —— JWT 解码 / 验签（纯函数，零第三方依赖）
//
// 延续 campus-mutual-aid/backend/src/auth.js 的 JWT 经验：
//   - access 短效、refresh 长效的轮换思路；
//   - 解码（base64url + JSON 解析）与验签（HMAC）分离，解码不验签、验签才校验。
// 验签仅支持 HMAC 系（HS256/HS384/HS512），用 node:crypto 实现，常量时间比较防时序攻击。

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  [k: string]: unknown;
}

export interface JwtPayload {
  [k: string]: unknown;
  exp?: number;
  iat?: number;
}

export interface DecodedJwt {
  header: JwtHeader;
  payload: JwtPayload;
  signature: string;
  /** 结构是否合法（三段、header/payload 可 JSON 解析） */
  wellFormed: boolean;
  /** 若 payload 含 exp，给出是否已过期；无 exp 则为 undefined */
  expired?: boolean;
  expiresAt?: string;
}

const ALG_HASH: Record<string, string> = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' };

function base64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

/** 解码 JWT（不验签，仅解析结构 + 判断过期状态） */
export function decodeJwt(token: string): DecodedJwt {
  if (!token || typeof token !== 'string') {
    throw new Error('token 不能为空');
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('JWT 必须由三段组成（header.payload.signature）');
  }
  const header = JSON.parse(base64UrlDecode(parts[0])) as JwtHeader;
  const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
  const exp = payload.exp;
  const expired = typeof exp === 'number' ? exp * 1000 < Date.now() : undefined;
  return {
    header,
    payload,
    signature: parts[2],
    wellFormed: true,
    expired,
    expiresAt: typeof exp === 'number' ? new Date(exp * 1000).toISOString() : undefined,
  };
}

/** 用 HMAC 密钥验签（HS256/HS384/HS512），常量时间比较 */
export function verifyJwt(token: string, secret: string): boolean {
  if (!secret) throw new Error('secret 不能为空');
  const { header } = decodeJwt(token);
  const alg = String(header.alg ?? '');
  const hash = ALG_HASH[alg];
  if (!hash) {
    throw new Error(`不支持的签名算法：${alg}（仅支持 HS256/HS384/HS512）`);
  }
  const [h, p, sig] = token.split('.');
  const expected = createHmac(hash, secret).update(`${h}.${p}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
