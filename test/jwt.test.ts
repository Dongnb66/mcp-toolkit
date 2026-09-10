import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { decodeJwt, verifyJwt } from '../src/lib/jwt.js';

function sign(payload: object, secret: string, alg = 'HS256'): string {
  const header = { alg, typ: 'JWT' };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const h = b64(header);
  const p = b64(payload);
  const hash = alg === 'HS512' ? 'sha512' : alg === 'HS384' ? 'sha384' : 'sha256';
  const sig = createHmac(hash, secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

describe('decodeJwt 解码', () => {
  it('正常：解析 header 与 payload（含中文）', () => {
    const token = sign({ uid: 1, nickname: '栋' }, 'secret');
    const d = decodeJwt(token);
    expect(d.wellFormed).toBe(true);
    expect(d.header.alg).toBe('HS256');
    expect(d.payload.uid).toBe(1);
    expect(d.payload.nickname).toBe('栋');
    expect(d.expired).toBeUndefined();
  });

  it('正常：判断过期', () => {
    const expired = sign({ uid: 1, exp: Math.floor(Date.now() / 1000) - 10 }, 'secret');
    expect(decodeJwt(expired).expired).toBe(true);
    const future = sign({ uid: 1, exp: Math.floor(Date.now() / 1000) + 3600 }, 'secret');
    expect(decodeJwt(future).expired).toBe(false);
  });

  it('非法：结构不合法抛错', () => {
    expect(() => decodeJwt('')).toThrow();
    expect(() => decodeJwt('a.b')).toThrow(/三段/);
    expect(() => decodeJwt('a.b.c')).toThrow();
  });
});

describe('verifyJwt 验签', () => {
  it('正常：密钥匹配则通过', () => {
    const token = sign({ uid: 1 }, 'secret');
    expect(verifyJwt(token, 'secret')).toBe(true);
  });

  it('正常：密钥不匹配则不通过', () => {
    const token = sign({ uid: 1 }, 'secret');
    expect(verifyJwt(token, 'wrong')).toBe(false);
  });

  it('非法：不支持的算法抛错', () => {
    const header = { alg: 'RS256', typ: 'JWT' };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify({})).toString('base64url');
    expect(() => verifyJwt(`${h}.${p}.sig`, 'secret')).toThrow(/不支持/);
  });
});
