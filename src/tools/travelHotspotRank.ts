// tools/travelHotspotRank.ts —— 地点口碑榜工具（薄壳）
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getLeaderboard, type LocationInput, type PostInput } from '../lib/hotspot.js';
import { jsonResult, type ToolContext } from './index.js';

const locationSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  city: z.string().optional(),
  category: z.string().optional(),
  pinned: z.union([z.boolean(), z.number()]).optional(),
});

const postSchema = z.object({
  id: z.union([z.string(), z.number()]),
  locationId: z.union([z.string(), z.number()]),
  rating: z.number().nullable().optional(),
  votes: z.number().optional(),
  advantages: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
});

export function registerTravelHotspotRank(server: McpServer, _ctx: ToolContext): void {
  server.tool(
    'travel_hotspot_rank',
    '地点口碑榜聚合：输入地点列表与用户帖子，按「发帖数*2 + 投票*3 + 平均评分*5」计算热度并排序，同时聚合每地点的高频优点。算法源自 travel-rank 项目，面试可两边对拍。',
    {
      locations: z.array(locationSchema).describe('地点列表'),
      posts: z.array(postSchema).describe('帖子列表（含投票、评分、优点标签）'),
    },
    async (args) => {
      const locations = args.locations as LocationInput[];
      const posts = args.posts as PostInput[];
      const board = getLeaderboard(locations, posts);
      return jsonResult({
        ranking: board.map((r, i) => ({
          rank: i + 1,
          name: r.name,
          heat: r.heat,
          postCount: r.postCount,
          topAdvantages: r.topAdvantages,
        })),
        totalLocations: board.length,
      });
    },
  );
}
