// edge runtime 缺 Node 全局（Buffer/process），而 lib（jwt/tc3/health）用到
// Buffer.from/toString 与 process.version/platform/arch。
// 在部署入口补最小等价物，lib 源码零改动；等价性对拍 node:crypto（见测试与线上跨运行时对拍）。
class BufferLite extends Uint8Array {
  static from(data: string | Uint8Array | ArrayLike<number>, enc?: string): BufferLite {
    if (typeof data !== 'string') return new BufferLite(data as ArrayLike<number>);
    const e = (enc ?? 'utf8').toLowerCase();
    if (e === 'utf8' || e === 'utf-8') return new BufferLite(new TextEncoder().encode(data));
    if (e === 'base64' || e === 'base64url') {
      let b64 = data.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const bin = atob(b64);
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new BufferLite(u);
    }
    if (e === 'hex') {
      const u = new Uint8Array(Math.floor(data.length / 2));
      for (let i = 0; i < u.length; i++) u[i] = parseInt(data.slice(i * 2, i * 2 + 2), 16);
      return new BufferLite(u);
    }
    throw new Error('BufferLite 不支持的编码：' + enc);
  }
  toString(enc?: string): string {
    const e = (enc ?? 'utf8').toLowerCase();
    if (e === 'utf8' || e === 'utf-8') return new TextDecoder().decode(this);
    if (e === 'base64' || e === 'base64url') {
      let bin = '';
      for (const b of this) bin += String.fromCharCode(b);
      const b64 = btoa(bin);
      return e === 'base64url' ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
    }
    if (e === 'hex') return [...this].map((b) => b.toString(16).padStart(2, '0')).join('');
    throw new Error('BufferLite 不支持的编码：' + enc);
  }
}

const g = globalThis as Record<string, unknown>;
if (typeof g.Buffer === 'undefined') g.Buffer = BufferLite;
if (typeof g.process === 'undefined') {
  g.process = { version: 'edge-deno-compat', platform: 'edge', arch: 'unknown' };
}
export { BufferLite };