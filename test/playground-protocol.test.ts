// protocol.js 纯函数测试：trace 帧 / MCP 报文序列 / 零件视图 / 握手 diff / 课程解锁。
// 这些是前端展示层的报文构造逻辑（lib 之外），src/lib 零改动。
import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION, TOOL_META, TOOL_ORDER, MCP_TOOL_ORDER, TOOL_SCHEMAS,
  walkParts, explainField, previewOf,
  defaultCaps, buildHandshake, diffHandshake, buildToolsList, buildToolsCall,
  buildMcpSequence, mcpResultFor, buildEdgeFrames, libReturnFor, HOST_DIFF,
  COURSE, checkQuiz,
} from '../playground/web/protocol.js';

describe('MCP 握手与 capability 对照开关', () => {
  it('默认握手：3 条消息，jsonrpc 全 2.0，id 配对，initialized 无 id', () => {
    const seq = buildHandshake(defaultCaps());
    expect(seq).toHaveLength(3);
    for (const m of seq) expect(m.msg.jsonrpc).toBe('2.0');
    expect(seq[0].msg.id).toBe(seq[1].msg.id);
    expect(seq[0].msg.params.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(seq[1].msg.result.capabilities.tools).toEqual({});
    expect(seq[2].msg.method).toBe('notifications/initialized');
    expect(seq[2].msg.id).toBeUndefined();
  });

  it('开关改变握手报文：sampling/roots/listChanged 各自增删字段', () => {
    const on = buildHandshake({ listChanged: true, sampling: true, roots: true });
    expect(on[0].msg.params.capabilities.sampling).toEqual({});
    expect(on[0].msg.params.capabilities.roots).toEqual({ listChanged: true });
    expect(on[1].msg.result.capabilities.tools).toEqual({ listChanged: true });
    const diffs = diffHandshake(defaultCaps(), { listChanged: true, sampling: true, roots: true });
    expect(diffs.every((d) => d.kind === 'added')).toBe(true);
    expect(diffs.map((d) => d.path)).toContain('.params.capabilities.sampling');
    const off = diffHandshake({ listChanged: true }, defaultCaps());
    expect(off.some((d) => d.kind === 'removed' && d.path.includes('listChanged'))).toBe(true);
    expect(diffHandshake(defaultCaps(), defaultCaps())).toEqual([]);
    // 全开 → 全关：3 个 capability 字段消失，空容器展开不算 diff
    const fullOff = diffHandshake({ listChanged: true, sampling: true, roots: true }, defaultCaps());
    expect(fullOff).toHaveLength(3);
    expect(fullOff.every((d) => d.kind === 'removed')).toBe(true);
  });
});

describe('MCP 序列构造（与 src/tools 注册形态一致）', () => {
  it('tools/list 返回 8 工具，schema 与 required 正确', () => {
    const [req, resp] = buildToolsList();
    expect(req.msg.method).toBe('tools/list');
    const tools = resp.msg.result.tools;
    expect(tools.map((t) => t.name)).toEqual(MCP_TOOL_ORDER);
    expect(tools).toHaveLength(8);
    const chunk = tools.find((t) => t.name === 'text_chunk');
    expect(chunk.inputSchema.required).toEqual(['text']);
    expect(chunk.inputSchema.properties.overlap.type).toBe('integer');
    expect(TOOL_SCHEMAS.sqlite_query.inputSchema.required).toEqual(['dbPath', 'sql']);
  });

  it('完整序列 7 条：握手→发现→调用；arguments 与入参同源，content 可解析', () => {
    const args = { text: '第一句。第二句。', chunkSize: 12, overlap: 2 };
    const edgeResp = { ok: true, chunks: ['第一句。', '第二句。'], count: 2 };
    const seq = buildMcpSequence('text_chunk', args, edgeResp, defaultCaps());
    expect(seq).toHaveLength(7);
    expect(seq.map((m) => m.msg.method ?? 'response')).toEqual([
      'initialize', 'response', 'notifications/initialized', 'tools/list', 'response', 'tools/call', 'response',
    ]);
    const call = seq[5].msg;
    expect(call.params.name).toBe('text_chunk');
    expect(call.params.arguments).toEqual(args);
    const result = seq[6].msg.result;
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0].text)).toEqual({ chunks: edgeResp.chunks, chunkCount: 2 });
  });

  it('mcpResultFor：两种薄壳包装同源（count→chunkCount、leaderboard→ranking、jwt 合并 verified）', () => {
    expect(mcpResultFor('date_calc', { op: 'add_days' }, { ok: true, result: '2026-12-12' })).toEqual({ op: 'add_days', result: '2026-12-12' });
    const board = [{ name: '图书馆', heat: 38.5, postCount: 2, topAdvantages: [] }];
    const r = mcpResultFor('hotspot_rank', {}, { ok: true, leaderboard: board });
    expect(r.ranking[0].rank).toBe(1);
    expect(r.totalLocations).toBe(1);
    expect(TOOL_META.hotspot_rank.mcpName).toBe('travel_hotspot_rank');
    const j = mcpResultFor('jwt_decode', {}, { ok: true, decoded: { header: {}, payload: {} }, verified: true });
    expect(j.verified).toBe(true);
    expect(mcpResultFor('text_chunk', {}, { ok: false, error: 'x' })).toEqual({ error: 'x' });
  });

  it('buildToolsCall 的 id 配对与 isError 语义', () => {
    const [req, resp] = buildToolsCall(42, 'health_ping', {}, { ok: true });
    expect(req.msg.id).toBe(42);
    expect(resp.msg.id).toBe(42);
    expect(resp.msg.result.content[0].type).toBe('text');
  });
});

describe('edge trace 帧构造', () => {
  it('成功调用 → 四帧三层链路，ms/status 透传，lib 接线正确', () => {
    const body = { text: 'abc', chunkSize: 10, overlap: 2 };
    const resp = { ok: true, chunks: ['abc'], count: 1 };
    const frames = buildEdgeFrames('text_chunk', body, resp, 87, 200);
    expect(frames.map((f) => f.from + '>' + f.to)).toEqual(['browser>edge', 'edge>lib', 'lib>edge', 'edge>browser']);
    expect(frames[0].label).toBe('POST /functions/v1/app/text_chunk');
    expect(frames[0].payload).toEqual(body);
    expect(frames[1].payload.module).toBe('src/lib/chunk.ts');
    expect(frames[1].payload.fn).toBe('chunkText');
    expect(frames[2].kind).toBe('return');
    expect(frames[2].payload).toEqual(['abc']);
    expect(frames[3].ms).toBe(87);
    expect(frames[3].status).toBe(200);
    expect(frames[3].payload).toEqual(resp);
  });

  it('失败调用 → lib 帧为 throw，响应帧带错误体；health_ping 走 GET 无请求体', () => {
    const frames = buildEdgeFrames('jwt_decode', { token: 'two.parts' }, { ok: false, error: 'token 必须是三段式' }, 12, 400);
    expect(frames[2].kind).toBe('throw');
    expect(frames[2].payload).toEqual({ error: 'token 必须是三段式' });
    expect(frames[3].status).toBe(400);
    const g = buildEdgeFrames('health_ping', {}, { ok: true, health: { ok: true, uptimeSec: 3 } }, 9, 200);
    expect(g[0].label.startsWith('GET ')).toBe(true);
    expect(g[3].payload.health.uptimeSec).toBe(3);
    expect(libReturnFor('health_ping', { ok: true, health: { uptimeSec: 3 } })).toEqual({ uptimeSec: 3 });
  });

  it('7 个公网工具都有 lib 接线映射', () => {
    for (const t of TOOL_ORDER) {
      expect(TOOL_META[t].lib).toMatch(/\.ts$/);
      expect(TOOL_META[t].fn.length).toBeGreaterThan(0);
    }
  });
});

describe('零件视图：摊平与字段解释', () => {
  it('walkParts 摊平嵌套对象/数组，路径与深度正确', () => {
    const parts = walkParts({ a: 1, b: { c: [true, 'x'] } });
    expect(parts.map((p) => p.path)).toEqual(['$.a', '$.b', '$.b.c', '$.b.c[0]', '$.b.c[1]']);
    expect(parts[2].depth).toBe(1);
    expect(parts[3].leaf).toBe(true);
    expect(parts[1].leaf).toBe(false);
    expect(previewOf([1, 2])).toBe('[ … 2 项 ]');
    expect(previewOf('y'.repeat(100)).endsWith('…')).toBe(true);
  });

  it('explainField：协议字段/业务字段/语境化 name 都有解释，未知 key 兜底', () => {
    for (const k of ['jsonrpc', 'id', 'method', 'inputSchema', 'arguments', 'isError', 'verified', 'Authorization', 'tool_choice']) {
      const ex = explainField('$.' + k, k);
      expect(ex.title.length).toBeGreaterThan(0);
      expect(ex.text.length).toBeGreaterThan(10);
    }
    expect(explainField('$.params.name', 'name').title).toContain('目标工具名');
    expect(explainField('$.result.serverInfo.name', 'name').title).toContain('serverInfo');
    expect(explainField('$.whatever', 'whatever').text).toContain('纯函数');
  });
});

describe('宿主对照表与引导课程', () => {
  it('HOST_DIFF 覆盖传输/鉴权/生命周期三个必选维度', () => {
    const dims = HOST_DIFF.map((r) => r.dim);
    for (const d of ['传输', '鉴权', '生命周期']) expect(dims).toContain(d);
    for (const r of HOST_DIFF) expect(r.stdio.length + r.edge.length).toBeGreaterThan(20);
  });

  it('课程 3 步各一题，答案合法，答对解锁逻辑正确', () => {
    expect(COURSE).toHaveLength(3);
    expect(COURSE.map((s) => s.tool)).toEqual(['text_chunk', 'jwt_decode', 'tc3_sign']);
    COURSE.forEach((s, i) => {
      expect(s.quiz.options).toHaveLength(3);
      expect(s.quiz.answer).toBeGreaterThanOrEqual(0);
      expect(s.quiz.answer).toBeLessThan(3);
      expect(checkQuiz(i, s.quiz.answer)).toBe(true);
      expect(checkQuiz(i, (s.quiz.answer + 1) % 3)).toBe(false);
      expect(s.quiz.review.length).toBeGreaterThan(10);
    });
    expect(checkQuiz(99, 0)).toBe(false);
    // 演示密钥必须是连字符格式，不得是真实形态
    expect(COURSE[2].demo.secretId).toBe('AKID-demo-not-a-real-key');
  });
});