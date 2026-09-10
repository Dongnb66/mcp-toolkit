// index.ts —— MCP 服务器入口
//
// 注册 8 个工具，通过 StdioServerTransport 暴露给任意 MCP 宿主
// （Claude Desktop / Cherry Studio / Cline / Inspector）。
//
// 运行方式：
//   npm run dev        # 开发（tsx）
//   npm run build && npm start   # 生产（tsc 编译后 node）
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { allRegisters } from './tools/index.js';

const NAME = 'mcp-toolkit';
const VERSION = '1.0.0';
const startTimeMs = Date.now();

const server = new McpServer({
  name: NAME,
  version: VERSION,
});

for (const register of allRegisters) {
  register(server, { startTimeMs, name: NAME, version: VERSION });
}

const transport = new StdioServerTransport();
await server.connect(transport);

// stdio 下 stdout 用于协议通信，日志一律走 stderr，避免污染 JSON-RPC 流
process.stderr.write(`[mcp-toolkit] 已启动，注册 ${allRegisters.length} 个工具\n`);
