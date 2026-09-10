// lib/hotspot.ts —— 地点口碑榜聚合引擎（纯函数版）
//
// 从 travel-rank 项目 backend/src/aggregator.js 纯函数化移植：
// 原实现直接查 SQLite（db.prepare），本模块把所有 SQL 依赖抽离，
// 改为「传入 locations + posts 两个纯数据数组」，算法权重与排序规则逐字保留。
//
// 核心权重（与 travel-rank 一致，面试可两边 clone 对拍）：
//   地点热度分 = 发帖数 * 2 + 累计投票 * 3 + 平均评分 * 5
//
// 设计意图：业务逻辑零 I/O、零 MCP 依赖，可独立单测；MCP 工具层只做 schema + 转发。

export interface LocationInput {
  id: number | string;
  name: string;
  city?: string;
  category?: string;
  /** 置顶标记：truthy 表示置顶（对应原库 pinned 字段） */
  pinned?: boolean | number;
}

export interface PostInput {
  id: number | string;
  locationId: number | string;
  /** 评分（可为空，未评分的帖子不参与平均分计算） */
  rating?: number | null;
  /** 该帖累计投票数（原库 post_votes 的 SUM(value)） */
  votes?: number;
  /** 该帖被用户标注的优点标签 */
  advantages?: string[];
  createdAt?: string;
}

export interface AdvantageCount {
  name: string;
  freq: number;
}

export interface RankedLocation extends LocationInput {
  pinned: number;
  heat: number;
  postCount: number;
  topAdvantages: AdvantageCount[];
}

const WEIGHT_POST = 2;
const WEIGHT_VOTE = 3;
const WEIGHT_RATING = 5;

/** 按 locationId 过滤帖子 */
function postsOf(posts: PostInput[], locationId: number | string): PostInput[] {
  return posts.filter((p) => p.locationId === locationId);
}

/**
 * 单个地点热度分 = 发帖数*2 + 总投票*3 + 平均评分*5（权重可调）
 * 与 travel-rank/backend/src/aggregator.js 的 locationHeat 逐字一致。
 */
export function locationHeat(locationId: number | string, posts: PostInput[]): number {
  const lp = postsOf(posts, locationId);
  const postCount = lp.length;
  const voteSum = lp.reduce((sum, p) => sum + (p.votes ?? 0), 0);
  const rated = lp.filter((p) => p.rating != null && !Number.isNaN(Number(p.rating)));
  const avgRating = rated.length
    ? rated.reduce((sum, p) => sum + Number(p.rating), 0) / rated.length
    : 0;
  return postCount * WEIGHT_POST + voteSum * WEIGHT_VOTE + avgRating * WEIGHT_RATING;
}

/**
 * 聚合某地点被反复提到的优点（高频优先），
 * 排序规则与原库 SQL 一致：freq DESC, name ASC，取前 topN。
 */
export function summarizeAdvantages(
  locationId: number | string,
  posts: PostInput[],
  topN = 6,
): AdvantageCount[] {
  const freq = new Map<string, number>();
  for (const p of postsOf(posts, locationId)) {
    for (const a of p.advantages ?? []) {
      if (a) freq.set(a, (freq.get(a) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .map(([name, count]) => ({ name, freq: count }))
    .sort((a, b) => b.freq - a.freq || a.name.localeCompare(b.name))
    .slice(0, topN);
}

/**
 * 平台总榜：所有地点按「置顶优先 → 热度降序」排名，
 * 附带每地点的发帖数、热度分与高频优点（原库 getLeaderboard）。
 */
export function getLeaderboard(locations: LocationInput[], posts: PostInput[]): RankedLocation[] {
  const board: RankedLocation[] = locations.map((l) => {
    const heat = locationHeat(l.id, posts);
    return {
      ...l,
      pinned: l.pinned ? 1 : 0,
      heat: Math.round(heat * 10) / 10,
      postCount: postsOf(posts, l.id).length,
      topAdvantages: summarizeAdvantages(l.id, posts, 6),
    };
  });
  board.sort((a, b) => b.pinned - a.pinned || b.heat - a.heat);
  return board;
}

/**
 * 给某地点生成一句「平台总结」文本（规则版，原库 buildRuleSummary）。
 * 大模型可在此基础上重写；此处给出确定性兜底文案。
 */
export function buildRuleSummary(
  locationId: number | string,
  locations: LocationInput[],
  posts: PostInput[],
): string | null {
  const loc = locations.find((l) => l.id === locationId);
  if (!loc) return null;
  const lp = postsOf(posts, locationId);
  const postCount = lp.length;
  const voteSum = lp.reduce((sum, p) => sum + (p.votes ?? 0), 0);
  if (postCount === 0) return `${loc.name} 暂无用户分享，快来做第一个推荐人吧！`;
  const advText = summarizeAdvantages(locationId, posts, 5)
    .map((a) => a.name)
    .join('、');
  return `${loc.name} 被 ${postCount} 篇帖子推荐、累计 ${voteSum} 个赞，高频优点：${advText}。`;
}
