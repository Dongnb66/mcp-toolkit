import { describe, it, expect } from 'vitest';
import {
  locationHeat,
  summarizeAdvantages,
  getLeaderboard,
  buildRuleSummary,
} from '../src/lib/hotspot.js';

const locations = [
  { id: 1, name: 'A地', pinned: true },
  { id: 2, name: 'B地' },
];

const posts = [
  { id: 1, locationId: 1, rating: 5, votes: 10, advantages: ['安静', '风景好'] },
  { id: 2, locationId: 1, rating: 4, votes: 5, advantages: ['安静'] },
  { id: 3, locationId: 2, rating: 3, votes: 2, advantages: ['便宜'] },
];

describe('locationHeat 热度公式', () => {
  it('正常：发帖数*2 + 投票*3 + 平均评分*5', () => {
    // A地：postCount=2, voteSum=15, avgRating=4.5 → 2*2 + 15*3 + 4.5*5 = 4+45+22.5 = 71.5
    expect(locationHeat(1, posts)).toBeCloseTo(71.5);
    // B地：postCount=1, voteSum=2, avgRating=3 → 2 + 6 + 15 = 23
    expect(locationHeat(2, posts)).toBeCloseTo(23);
  });

  it('边界：无帖子时热度为 0', () => {
    expect(locationHeat(99, posts)).toBe(0);
  });
});

describe('summarizeAdvantages 高频优点聚合', () => {
  it('正常：按频次降序、同名升序', () => {
    const advs = summarizeAdvantages(1, posts, 6);
    expect(advs[0]).toEqual({ name: '安静', freq: 2 });
    expect(advs[1]).toEqual({ name: '风景好', freq: 1 });
  });

  it('边界：无优点时返回空数组', () => {
    expect(summarizeAdvantages(2, posts, 6).length).toBe(1);
    expect(summarizeAdvantages(99, posts, 6)).toEqual([]);
  });
});

describe('getLeaderboard 平台总榜', () => {
  it('正常：置顶优先，其次热度降序', () => {
    const board = getLeaderboard(locations, posts);
    // 即使 B 热度可能更低，A 置顶仍排第一
    expect(board[0].id).toBe(1);
    expect(board[0].heat).toBeCloseTo(71.5);
    expect(board[1].id).toBe(2);
    expect(board[1].postCount).toBe(1);
  });

  it('非法/空：空地点返回空榜', () => {
    expect(getLeaderboard([], posts)).toEqual([]);
  });
});

describe('buildRuleSummary 规则版总结', () => {
  it('正常：生成含数字的总结文案', () => {
    const s = buildRuleSummary(1, locations, posts);
    expect(s).toContain('A地');
    expect(s).toContain('安静');
  });

  it('边界：无帖子与未知地点', () => {
    expect(buildRuleSummary(1, locations, [])).toBe('A地 暂无用户分享，快来做第一个推荐人吧！');
    expect(buildRuleSummary(99, locations, posts)).toBeNull();
  });
});
