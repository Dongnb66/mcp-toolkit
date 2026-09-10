// lib/health.ts —— 健康检查信息（纯函数）

export interface HealthInfo {
  ok: true;
  name: string;
  version: string;
  uptimeSec: number;
  timestamp: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}

/** 组装健康检查信息；uptime 基于进程启动时间计算 */
export function getHealth(startTimeMs: number, name = 'mcp-toolkit', version = '1.0.0'): HealthInfo {
  return {
    ok: true,
    name,
    version,
    uptimeSec: Math.floor((Date.now() - startTimeMs) / 1000),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}
