import { describe, it, expect } from 'vitest';
import { getHealth } from '../src/lib/health.js';

describe('getHealth 健康检查', () => {
  it('正常：返回完整健康信息', () => {
    const h = getHealth(Date.now() - 3000);
    expect(h.ok).toBe(true);
    expect(h.name).toBe('mcp-toolkit');
    expect(h.version).toBe('1.0.0');
    expect(h.uptimeSec).toBeGreaterThanOrEqual(2);
    expect(h.nodeVersion).toMatch(/^v\d+/);
    expect(h.timestamp).toMatch(/Z$/);
    expect(['win32', 'linux', 'darwin']).toContain(h.platform);
  });

  it('边界：刚启动 uptime 为 0', () => {
    const h = getHealth(Date.now());
    expect(h.uptimeSec).toBe(0);
  });
});
