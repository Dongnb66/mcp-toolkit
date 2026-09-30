# mcp-toolkit

把分散的手写工具能力，标准化为 **8 个即插即用的 MCP 工具**。任何支持 Model Context Protocol 的宿主（Claude Desktop / Cherry Studio / Cline / MCP Inspector）都能通过 stdio 直接调用。

[![CI](https://github.com/Dongnb66/mcp-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/Dongnb66/mcp-toolkit/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178C6)](https://www.typescriptlang.org)

## 为什么做这个项目

写过一个又一个后端小项目后，发现很多「手写工具」能力高度可复用，却散落在不同仓库里：聚合排名的热度公式、腾讯云 TC3 签名器、RAG 切块逻辑、JWT 双令牌经验…… MCP（Model Context Protocol）正是把这些能力「一次封装、处处复用」的标准协议——写成一个 MCP 服务器，任何 AI 宿主都能即插即用。

本项目是一次「**从 0 手写 MCP 服务器**」的完整实践：不抄模板，逐行理解协议、分层设计、单测对拍官方向量。

## 架构

```
┌────────────────────────────────────────────────────────────┐
│                     MCP 宿主（任意）                          │
│        Claude Desktop / Cherry Studio / Cline / Inspector     │
└──────────────────────────┬─────────────────────────────────┘
                           │ JSON-RPC over stdio
┌──────────────────────────▼─────────────────────────────────┐
│                    src/index.ts                              │
│        McpServer + StdioServerTransport（协议入口）            │
│        注册 8 个工具，日志走 stderr 不污染协议流                 │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                 src/tools/（薄壳层）                           │
│   每个工具 = zod schema + handler 转发，不含业务逻辑           │
│   travel_hotspot_rank · tc3_sign · text_chunk · date_calc   │
│   sqlite_query · webpage_extract · jwt_decode · health_ping │
└──────────────────────────┬─────────────────────────────────┘
                           │ 只调用纯函数
┌──────────────────────────▼─────────────────────────────────┐
│                 src/lib/（纯函数层）                           │
│   零 MCP 依赖、零副作用，可独立单测                            │
│   hotspot · tc3 · chunk · date · sqlite · webpage · jwt · health │
└────────────────────────────────────────────────────────────┘
```

**分层铁律**：业务逻辑全部在 `lib/` 纯函数（可脱离 MCP 独立测试）；`tools/` 只做「zod 校验 + 转发」，保持极薄、一眼看懂。

## 8 个工具

| 工具 | 说明 | 能力来源 |
|------|------|----------|
| `travel_hotspot_rank` | 地点口碑榜聚合：`发帖数×2 + 投票×3 + 平均评分×5` 计算热度并排序，聚合高频优点 | 复用 travel-rank 聚合算法 |
| `tc3_sign` | 腾讯云 API 3.0 TC3-HMAC-SHA256 签名请求头（含 Authorization） | 复用 python-learning-agent 签名器 |
| `text_chunk` | RAG 文本切块：滑动窗口 + overlap，优先句末断点 | 复用 RAG 预处理经验 |
| `date_calc` | 日期计算：加减/求差/星期/闰年/当月天数/今天（UTC 规避跨日误差） | 独立纯函数 |
| `sqlite_query` | SQLite 只读查询（SELECT/WITH/PRAGMA），readOnly 打开杜绝写操作；可读路径受 `MCP_SQLITE_ROOT` 限制 | Node 22 内置 `node:sqlite` |
| `webpage_extract` | 抓取网页抽取纯文本：标题/标题层级/链接/正文（带超时） | 独立纯函数 |
| `jwt_decode` | JWT 解码 + HMAC 验签（HS256/384/512，常量时间比较） | 复用 campus-mutual-aid JWT 经验 |
| `health_ping` | 健康检查：服务名/版本/运行时长/Node 版本/平台 | 独立纯函数 |

## 快速开始

```bash
# 依赖（需 Node >= 22.5，因为用到了内置 node:sqlite）
npm install

# 类型检查 + 构建
npm run typecheck && npm run build

# 单元测试（48 个用例）
npm test

# 端到端冒烟测试（连上编译产物走完整协议链路）
node examples/smoke-client.mjs
```

### 在 MCP Inspector 里手动调试

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

浏览器打开后即可可视化地列出工具、传参调用。

### 接入 Claude Desktop

把 `examples/claude_desktop_config.json` 合并到 `claude_desktop_config.json`（路径改成你自己的绝对路径），重启 Claude Desktop 即可。

## 设计决策（面试叙事）

1. **分层**：`lib/` 纯函数 + `tools/` 薄壳，业务逻辑可脱离 MCP 独立测试，也让每个文件职责单一、review 一眼看懂。
2. **零第三方依赖的签名器**：TC3-HMAC-SHA256 用 Node 内置 `node:crypto` 实现，密钥只走函数入参/环境变量、绝不入日志；用腾讯云官方公开测试向量做单测对拍（`HashedCanonicalRequest` 逐字节一致）。
3. **只读 SQLite 三重保险**：`sqlite_query` ①用正则限制语句前缀（只允许 SELECT/WITH/PRAGMA）、②以 `readOnly: true` 打开、③**限制可读路径的根目录**。前两条杜绝写操作，第三条杜绝「本机任意 sqlite 都能读」。
   - 路径边界由环境变量 **`MCP_SQLITE_ROOT`** 指定，不设则用进程工作目录；`dbPath` 必须落在该目录内。
   - 判边界分两层：先按解析后的字面路径判（挡住 `..` 与越界绝对路径），再按 `realpath` 判（挡住软链接绕过）。
   - 为什么需要第三条：MCP 宿主里的模型可能被**间接提示注入**（读到不可信内容后被诱导继续调工具）——一个不设边界的读取工具就是数据外泄面。「不可信返回内容不得扩大工具权限」这条原则，落到工具层就是这个边界。
4. **`node:sqlite` 的坑**：它是 Node 22 实验内置模块，不在 `builtinModules` 清单里，vite/vitest 会误当普通包解析失败 → 用 `createRequire` 运行时加载 + 纯类型查询绕开。
5. **日志隔离**：stdio 下 stdout 走协议通信，日志一律写 stderr，避免污染 JSON-RPC 流。
6. **安全**：真实密钥通过 `.env`（已 gitignore）+ 环境变量注入，官方向量密钥只经 `TC3_SAMPLE_SECRET_KEY` 测试专用变量，不触发 GitHub Secret Scanning。

## 目录结构

```
mcp-toolkit/
├── src/
│   ├── index.ts            # MCP 入口：注册 8 工具 + stdio 连接
│   ├── lib/                # 纯函数层（零 MCP 依赖）
│   │   ├── hotspot.ts      #   地点热度聚合
│   │   ├── tc3.ts          #   TC3-HMAC-SHA256 签名
│   │   ├── chunk.ts        #   文本滑动窗口切块
│   │   ├── date.ts         #   日期计算
│   │   ├── sqlite.ts       #   SQLite 只读查询
│   │   ├── webpage.ts      #   网页抓取 + 正文抽取
│   │   ├── jwt.ts          #   JWT 解码/验签
│   │   └── health.ts       #   健康检查
│   └── tools/              # 薄壳层（zod schema + 转发）
│       └── *.ts            #   8 个工具 + index.ts 统一注册
├── test/                   # 48 个单测用例
├── examples/               # Claude Desktop 配置 + 冒烟客户端
├── .github/workflows/ci.yml
└── package.json
```

## License

[MIT](./LICENSE)
