// playground handler 接线测试：lib 已有 48 条断言（含 TC3 官方向量），这里测 HTTP 层路由/校验/安全边界。
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { handler } from '../playground/functions/handler.js';
import { BufferLite } from '../playground/functions/node-globals.js';

describe('BufferLite 与 node Buffer 等价', () => {
  it('utf8/base64/base64url/hex 双向对拍（含中文与二进制）', () => {
    const samples = ['hello', '中文混排 ABC 123', '', 'a+b/c=d'];
    for (const s of samples) {
      const node = Buffer.from(s, 'utf8');
      const lite = BufferLite.from(s, 'utf8');
      expect([...lite]).toEqual([...node]);
      expect(lite.toString('utf8')).toBe(s);
      expect(lite.toString('base64')).toBe(node.toString('base64'));
      expect(lite.toString('base64url')).toBe(node.toString('base64url'));
      expect(lite.toString('hex')).toBe(node.toString('hex'));
      expect([...BufferLite.from(node.toString('base64'), 'base64')]).toEqual([...node]);
      expect([...BufferLite.from(node.toString('base64url'), 'base64url')]).toEqual([...node]);
      expect([...BufferLite.from(node.toString('hex'), 'hex')]).toEqual([...node]);
    }
    const bin = Buffer.from([0, 1, 2, 250, 255]);
    expect([...BufferLite.from(bin.toString('base64'), 'base64')]).toEqual([...bin]);
  });
});

function post(tool: string, body: unknown): Promise<Response> {
  return handler(new Request(`http://local/functions/v1/app/${tool}`, {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

describe('playground handler', () => {
  it('text_chunk 切块并计数', async () => {
    const r = await post('text_chunk', { text: '第一句。第二句！第三句？第四句.', chunkSize: 12, overlap: 2 });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.count).toBe(j.chunks.length);
    expect(j.chunks.length).toBeGreaterThan(1);
  });

  it('text_chunk 非法参数 400', async () => {
    const r = await post('text_chunk', { text: 'abc', chunkSize: 0 });
    expect(r.status).toBe(400);
  });

  it('date_calc add_days 与 diff_days', async () => {
    const a = await (await post('date_calc', { op: 'add_days', date: '2026-11-17', days: 25 })).json();
    expect(a.result).toBe('2026-12-12');
    const d = await (await post('date_calc', { op: 'diff_days', from: '2026-11-17', to: '2026-12-12' })).json();
    expect(d.result).toBe(25);
  });

  it('hotspot_rank 热度权重与置顶', async () => {
    const r = await post('hotspot_rank', {
      locations: [{ id: 1, name: '图书馆', pinned: 1 }, { id: 2, name: '食堂' }],
      posts: [
        { id: 1, locationId: 1, rating: 5, votes: 3 },
        { id: 2, locationId: 1, rating: 4, votes: 1 },
        { id: 3, locationId: 2, rating: 4, votes: 6 },
      ],
    });
    const j = await r.json();
    expect(j.leaderboard[0].name).toBe('图书馆');
    expect(j.leaderboard[0].heat).toBe(38.5); // 2*2 + 4*3 + 4.5*5
    expect(j.leaderboard[1].heat).toBe(40); // 1*2 + 6*3 + 4*5
  });

  it('jwt_decode 验签真/假/坏结构', async () => {
    const b64 = (s: string) => Buffer.from(s).toString('base64url');
    const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const p = b64(JSON.stringify({ sub: 't', exp: Math.floor(Date.now() / 1000) + 60 }));
    const sig = createHmac('sha256', 's3cret').update(`${h}.${p}`).digest('base64url');
    const token = `${h}.${p}.${sig}`;
    const ok = await (await post('jwt_decode', { token, secret: 's3cret' })).json();
    expect(ok.verified).toBe(true);
    expect(ok.decoded.payload.sub).toBe('t');
    const bad = await (await post('jwt_decode', { token, secret: 'wrong' })).json();
    expect(bad.verified).toBe(false);
    const broken = await post('jwt_decode', { token: 'two.parts' });
    expect(broken.status).toBe(400);
  });

  it('tc3_sign 与 lib 直调逐字节一致（接线）', async () => {
    const { buildTc3Headers } = await import('../src/lib/tc3.js');
    const opts = { secretId: 'AKIDtest', secretKey: 'testkey', timestamp: 1700000000 };
    const payload = { PhoneNumberSet: ['+8613800000000'] };
    const j = await (await post('tc3_sign', { ...opts, payload })).json();
    expect(j.headers).toEqual(buildTc3Headers(payload, opts));
  });

  it('webpage_extract 私网/非法 URL 拒绝', async () => {
    for (const url of ['http://127.0.0.1/x', 'http://localhost/', 'http://10.0.0.1/', 'http://192.168.1.1/', 'http://169.254.169.254/', 'ftp://x.com/', 'not a url']) {
      const r = await post('webpage_extract', { url });
      expect(r.status).toBe(400);
    }
  });

  it('health_ping GET 200 / POST 405；未知工具 404；POST 工具 GET 405', async () => {
    const g = await handler(new Request('http://local/functions/v1/app/health_ping'));
    expect(g.status).toBe(200);
    const p = await handler(new Request('http://local/functions/v1/app/health_ping', { method: 'POST' }));
    expect(p.status).toBe(405);
    const u = await post('nope', {});
    expect(u.status).toBe(404);
    const m = await handler(new Request('http://local/functions/v1/app/text_chunk'));
    expect(m.status).toBe(405);
  });
});