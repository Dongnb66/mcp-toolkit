// examples/smoke-client.mjs —— MCP 端到端冒烟测试客户端
//
// 用 SDK 的 Client + StdioClientTransport 连上 dist/index.js（或 tsx src/index.ts），
// 走完整协议链路：initialize → tools/list → tools/call(health_ping)。
// 运行：node examples/smoke-client.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const cmd = process.argv[2] ?? 'node';
const args = process.argv[2] ? process.argv.slice(3) : ['dist/index.js'];

const transport = new StdioClientTransport({ command: cmd, args });
const client = new Client({ name: 'smoke-client', version: '1.0.0' });

await client.connect(transport);

const tools = await client.listTools();
console.log('注册工具数:', tools.tools.length);
console.log('工具清单:', tools.tools.map((t) => t.name).join(', '));

const result = await client.callTool({ name: 'health_ping', arguments: {} });
console.log('health_ping 返回:');
console.log(result.content[0].text);

await client.close();
console.log('\n[smoke] 端到端验证通过');
