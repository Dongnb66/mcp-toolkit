// 部署入口：edge runtime 用 Deno.serve；本地验证走 handler（Node/vitest 可直接调）。
import './node-globals.js';
import { handler } from './handler.js';

Deno.serve(handler);