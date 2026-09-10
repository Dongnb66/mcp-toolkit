// lib/tc3.ts —— 腾讯云 API 3.0 TC3-HMAC-SHA256 签名（纯函数版）
//
// 从 python-learning-agent/app/sms.py 的 build_tc3_headers 移植，
// 用 Node 标准库 node:crypto 实现，零第三方依赖。
//
// 签名算法参考：https://cloud.tencent.com/document/api/382/52071
//
// 关键点（延续 Python 版工程约束）：
//   - 密钥只作为函数入参传入，本模块绝不读环境变量、绝不打印密钥；
//   - 日期必须取 UTC，否则凌晨时段（东八区跨日）必然签名失败；
//   - 官方公开测试向量见 test/tc3.test.ts，逐字节对拍。

import { createHash, createHmac, type BinaryLike } from 'node:crypto';

export const ALGORITHM = 'TC3-HMAC-SHA256';

export const DEFAULTS = {
  service: 'sms',
  host: 'sms.tencentcloudapi.com',
  action: 'SendSms',
  region: 'ap-guangzhou',
  version: '2021-01-11',
} as const;

export interface Tc3Options {
  secretId: string;
  secretKey: string;
  service?: string;
  host?: string;
  action?: string;
  region?: string;
  version?: string;
  /** Unix 秒级时间戳；缺省取当前时间 */
  timestamp?: number;
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export function hmacSha256(key: BinaryLike, msg: string): Buffer {
  return createHmac('sha256', key).update(msg, 'utf8').digest();
}

/** 派生签名密钥：SecretDate → SecretService → SecretSigning */
function deriveSigningKey(secretKey: string, date: string, service: string): Buffer {
  const secretDate = hmacSha256(Buffer.from(`TC3${secretKey}`, 'utf8'), date);
  const secretService = hmacSha256(secretDate, service);
  return hmacSha256(secretService, 'tc3_request');
}

/**
 * 对 string_to_sign 做 HMAC-SHA256 签名，返回十六进制签名串。
 * 暴露为独立函数，便于单测对拍官方向量（GET 向量等）。
 */
export function signStringToSign(
  stringToSign: string,
  secretKey: string,
  date: string,
  service: string,
): string {
  const key = deriveSigningKey(secretKey, date, service);
  return createHmac('sha256', key).update(stringToSign, 'utf8').digest('hex');
}

/** UTC 日期（YYYY-MM-DD），必须用 UTC，凌晨时段才不翻车 */
export function utcDate(timestampSec: number): string {
  return new Date(timestampSec * 1000).toISOString().slice(0, 10);
}

/**
 * 构造 canonical request（POST 通用形态）。参数化以便测试复用。
 */
export function buildCanonicalRequest(opts: {
  method: string;
  path: string;
  query: string;
  canonicalHeaders: string;
  signedHeaders: string;
  payloadHash: string;
}): string {
  return [
    opts.method,
    opts.path,
    opts.query,
    opts.canonicalHeaders,
    opts.signedHeaders,
    opts.payloadHash,
  ].join('\n');
}

/**
 * 按 TC3-HMAC-SHA256 规范生成请求头（含 Authorization）。
 * 与 python 版 build_tc3_headers 行为一致；密钥由调用方显式传入。
 */
export function buildTc3Headers(payload: unknown, opts: Tc3Options): Record<string, string> {
  const service = opts.service ?? DEFAULTS.service;
  const host = opts.host ?? DEFAULTS.host;
  const action = opts.action ?? DEFAULTS.action;
  const region = opts.region ?? DEFAULTS.region;
  const version = opts.version ?? DEFAULTS.version;
  const ts = opts.timestamp ?? Math.floor(Date.now() / 1000);

  // 与 Python json.dumps(..., separators=(",", ":"), ensure_ascii=False) 对齐：
  // 紧凑输出 + 非 ASCII 原样保留（JSON.stringify 默认即如此）
  const payloadStr = JSON.stringify(payload);
  const date = utcDate(ts);

  const contentType = 'application/json; charset=utf-8';
  const canonicalHeaders =
    `content-type:${contentType}\n` + `host:${host}\n` + `x-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = buildCanonicalRequest({
    method: 'POST',
    path: '/',
    query: '',
    canonicalHeaders,
    signedHeaders,
    payloadHash: sha256Hex(payloadStr),
  });

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = `${ALGORITHM}\n${ts}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;
  const signature = signStringToSign(stringToSign, opts.secretKey, date, service);

  const authorization =
    `${ALGORITHM} Credential=${opts.secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Content-Type': contentType,
    Host: host,
    'X-TC-Action': action,
    'X-TC-Version': version,
    'X-TC-Region': region,
    'X-TC-Timestamp': String(ts),
    Authorization: authorization,
  };
}
