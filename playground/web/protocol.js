// playground/web/protocol.js —— trace / 零件视图 / 宿主对照的纯函数层（lib 之外，零依赖）。
// 构建时由 scripts/build-playground.mjs 内联进 index.html（去掉 export 前缀）；
// vitest 直接 import 本文件做报文构造断言。src/lib 零改动。

export const PROTOCOL_VERSION = '2024-11-05';
export const SERVER_INFO = { name: 'mcp-toolkit', version: '1.0.0' };
export const CLIENT_INFO = { name: 'playground-host', version: '1.0.0' };

// edge 工具名 → lib 接线与 MCP 侧工具名（MCP 侧口碑榜叫 travel_hotspot_rank，薄壳命名差异是对照点之一）
export const TOOL_META = {
  text_chunk: { title: '文本切块', lib: 'chunk.ts', fn: 'chunkText', mcpName: 'text_chunk' },
  jwt_decode: { title: 'JWT 解码/验签', lib: 'jwt.ts', fn: 'decodeJwt + verifyJwt', mcpName: 'jwt_decode' },
  tc3_sign: { title: 'TC3 签名', lib: 'tc3.ts', fn: 'buildTc3Headers', mcpName: 'tc3_sign' },
  date_calc: { title: '日期计算', lib: 'date.ts', fn: 'dateCalc', mcpName: 'date_calc' },
  hotspot_rank: { title: '地点口碑榜', lib: 'hotspot.ts', fn: 'getLeaderboard', mcpName: 'travel_hotspot_rank' },
  webpage_extract: { title: '网页抽取', lib: 'webpage.ts', fn: 'fetchHtml + extractFromHtml', mcpName: 'webpage_extract' },
  health_ping: { title: '健康检查', lib: 'health.ts', fn: 'getHealth', mcpName: 'health_ping', method: 'GET' },
};

export const TOOL_ORDER = ['text_chunk', 'jwt_decode', 'tc3_sign', 'date_calc', 'hotspot_rank', 'webpage_extract', 'health_ping'];

// 与 src/tools/*.ts 的 zod 注册一一对应的 JSON Schema（MCP tools/list 的真实形态）
export const TOOL_SCHEMAS = {
  text_chunk: {
    description: 'RAG 文本切块：把长文本按 chunkSize 切成若干片段，支持 overlap 重叠，优先在句末断点切割。适合做检索增强的预处理。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '待切块的原始文本' },
        chunkSize: { type: 'integer', description: '每块最大字符数，默认 500' },
        overlap: { type: 'integer', description: '相邻块重叠字符数，默认 50' },
      },
      required: ['text'],
    },
  },
  date_calc: {
    description: '日期计算：加减天数、求日期差、查星期几、判断闰年、查当月天数、取今天日期。日期统一 YYYY-MM-DD 格式，按 UTC 处理规避跨日误差。',
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['add_days', 'diff_days', 'weekday', 'days_in_month', 'is_leap_year', 'today'], description: '操作类型' },
        date: { type: 'string', description: 'YYYY-MM-DD，add_days/weekday 需要' },
        days: { type: 'integer', description: '加减天数，add_days 需要' },
        from: { type: 'string', description: '起始日期，diff_days 需要' },
        to: { type: 'string', description: '结束日期，diff_days 需要' },
        year: { type: 'integer', description: '年份，days_in_month/is_leap_year 需要' },
        month: { type: 'integer', description: '月份 1-12，days_in_month 需要' },
      },
      required: ['op'],
    },
  },
  travel_hotspot_rank: {
    description: '地点口碑榜聚合：输入地点列表与用户帖子，按「发帖数*2 + 投票*3 + 平均评分*5」计算热度并排序，同时聚合每地点的高频优点。',
    inputSchema: {
      type: 'object',
      properties: {
        locations: { type: 'array', description: '地点列表', items: { type: 'object' } },
        posts: { type: 'array', description: '帖子列表（含投票、评分、优点标签）', items: { type: 'object' } },
      },
      required: ['locations', 'posts'],
    },
  },
  jwt_decode: {
    description: '解码 JWT（不验签），解析 header 与 payload 并判断是否过期；提供 secret 时用 HMAC（HS256/384/512）验签。',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'JWT 字符串' },
        secret: { type: 'string', description: 'HMAC 密钥，提供则同时验签' },
      },
      required: ['token'],
    },
  },
  tc3_sign: {
    description: '生成腾讯云 API 3.0 的 TC3-HMAC-SHA256 签名请求头（含 Authorization）。签名实现与官方公开测试向量逐字节一致。',
    inputSchema: {
      type: 'object',
      properties: {
        payload: { type: 'object', description: '请求体 JSON 对象' },
        secretId: { type: 'string', description: '腾讯云 SecretId，缺省读 TC3_SECRET_ID' },
        secretKey: { type: 'string', description: '腾讯云 SecretKey，缺省读 TC3_SECRET_KEY' },
        service: { type: 'string', description: '服务名，如 sms / cvm，默认 sms' },
        host: { type: 'string', description: '接口域名，默认 sms.tencentcloudapi.com' },
        action: { type: 'string', description: 'API 动作，默认 SendSms' },
        region: { type: 'string', description: '地域，默认 ap-guangzhou' },
        version: { type: 'string', description: '版本号，默认 2021-01-11' },
        timestamp: { type: 'integer', description: 'Unix 秒级时间戳，缺省当前时间' },
      },
      required: ['payload'],
    },
  },
  webpage_extract: {
    description: '抓取网页并抽取纯文本：返回标题、各级标题、链接列表与去标签正文，适合做网页内容的结构化提取。',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '目标网页 URL' },
        timeoutMs: { type: 'integer', description: '请求超时毫秒，默认 10000' },
      },
      required: ['url'],
    },
  },
  health_ping: {
    description: '健康检查：返回服务名、版本、运行时长、Node 版本与平台信息，用于验证 MCP 服务器连通性。',
    inputSchema: { type: 'object', properties: {} },
  },
  sqlite_query: {
    description: '对 SQLite 数据库执行只读查询（SELECT / WITH / PRAGMA）。基于 Node 内置 node:sqlite，以只读模式打开，拒绝任何写操作。',
    inputSchema: {
      type: 'object',
      properties: {
        dbPath: { type: 'string', description: 'SQLite 数据库文件路径' },
        sql: { type: 'string', description: '只读 SQL 语句（? 占位符可用 params 传参）' },
        params: { type: 'array', description: '位置参数，按 ? 顺序传入' },
      },
      required: ['dbPath', 'sql'],
    },
  },
};

export const MCP_TOOL_ORDER = ['text_chunk', 'date_calc', 'travel_hotspot_rank', 'jwt_decode', 'tc3_sign', 'webpage_extract', 'health_ping', 'sqlite_query'];

// ---------- 零件视图：把任意 JSON 摊平成可点击零件 ----------

export function previewOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '[ … ' + v.length + ' 项 ]';
  if (typeof v === 'object') return '{ … ' + Object.keys(v).length + ' 键 }';
  const s = typeof v === 'string' ? '"' + v + '"' : String(v);
  return s.length > 64 ? s.slice(0, 61) + '…' : s;
}

/** 摊平 JSON：每个 key（含数组下标）都是一个零件 {path,key,depth,type,preview,leaf} */
export function walkParts(value, prefix, depth) {
  prefix = prefix || '$';
  depth = depth || 0;
  const out = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      const path = prefix + '[' + i + ']';
      const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
      out.push({ path, key: '[' + i + ']', depth, type: t, preview: previewOf(v), leaf: t !== 'object' && t !== 'array' });
      if (t === 'object' || t === 'array') out.push(...walkParts(v, path, depth + 1));
    });
  } else if (value !== null && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      const v = value[k];
      const path = prefix + '.' + k;
      const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
      out.push({ path, key: k, depth, type: t, preview: previewOf(v), leaf: t !== 'object' && t !== 'array' });
      if (t === 'object' || t === 'array') out.push(...walkParts(v, path, depth + 1));
    }
  }
  return out;
}

// 字段级解释词典：key → {title, text}。path 用于区分同名 key 的语境。
export const FIELD_EXPLAIN = {
  jsonrpc: { title: 'jsonrpc — 协议版本标记', text: '固定 "2.0"。JSON-RPC 2.0 是 MCP 的报文底座：每条消息都带它，接收方据此知道按哪套规则解析 id/method/params/result。缺了它就不是合法 JSON-RPC 消息。' },
  id: { title: 'id — 请求/响应配对键', text: '客户端给每个请求分配的唯一编号，服务端原样带回。stdio 是全双工流，多条请求可能交错返回，靠 id 才能把响应认领回对应请求。通知（notification）没有 id，也不需要回应。' },
  method: { title: 'method — 要做什么', text: 'RPC 方法名。MCP 生命周期：initialize 握手 → notifications/initialized 确认 → tools/list 发现工具 → tools/call 调用。方法名决定 params 的形状。' },
  params: { title: 'params — 方法入参', text: '本次调用的参数对象，形状由 method 决定。initialize 里是协议版本与能力声明；tools/call 里是 {name, arguments}。' },
  result: { title: 'result — 成功返回', text: 'JSON-RPC 规定：成功响应带 result，失败响应带 error，二者互斥。MCP 在此之上再包一层业务结构（如 tools/call 的 content 数组）。' },
  error: { title: 'error — 失败返回', text: 'JSON-RPC 错误对象 {code, message}。注意区分两层错误：协议层错误走 error；工具执行失败走 result.isError=true，让模型能读到失败原因并自我修正。' },
  protocolVersion: { title: 'protocolVersion — 协议版本协商', text: '客户端提议自己支持的 MCP 版本（如 2024-11-05），服务端在响应里确认实际使用的版本。版本不一致时双方按协商结果降级兼容，这是握手的核心动作。' },
  capabilities: { title: 'capabilities — 能力声明', text: '握手时双方各自声明「我支持什么」：服务端声明 tools/prompts/resources，客户端声明 sampling/roots。没声明的能力对方不应使用——本页上方的对照开关就是在改这份声明，看握手报文如何随之变化。' },
  clientInfo: { title: 'clientInfo — 客户端身份', text: '宿主自报家门 {name, version}，用于日志与兼容性判断，不参与鉴权。MCP stdio 场景里宿主是本地进程，身份只是元信息。' },
  serverInfo: { title: 'serverInfo — 服务端身份', text: 'MCP 服务器自报 {name, version}。宿主据此展示服务器信息；同一份 lib 换个薄壳，这里名字不变——因为业务根本没动。' },
  tools: { title: 'tools — 工具清单', text: 'tools/list 的返回：每个工具含 name/description/inputSchema。宿主（或背后的模型）读这份清单决定「有什么可用、怎么填参」。这就是 MCP 的工具发现机制。' },
  name: { title: 'name — 名字（看语境）', text: '在 tools/call 的 params 里是要调用的工具名，必须与 tools/list 清单一致；在 clientInfo/serverInfo 里是进程身份；在工具清单里是工具标识。同名 key，三种语境。' },
  description: { title: 'description — 给模型看的说明书', text: '工具/参数的自然语言描述。模型靠它理解工具用途与填参规则——描述写得好坏直接影响调用正确率，这是 MCP 工具设计里最容易被低估的一环。' },
  inputSchema: { title: 'inputSchema — 参数合同', text: 'JSON Schema 描述工具入参：type/properties/required。宿主据此渲染表单或约束模型输出，服务端据此校验（本仓库用 zod 注册，SDK 自动转成这份 Schema）。合同两边共用，填错参数在边界就被拦下。' },
  arguments: { title: 'arguments — 实际入参', text: 'tools/call 时按 inputSchema 填好的参数对象。它和 edge 版 HTTP 请求体是同一份数据——传输换了，业务入参一字不改，这正是「协议薄壳」的含义。' },
  content: { title: 'content — 工具输出容器', text: 'MCP 工具结果统一包成 content 数组，元素可以是 text/image/resource。本仓库所有工具用 jsonResult() 包成单个 text 元素（JSON 字符串），宿主再解析展示。' },
  text: { title: 'text — 文本载荷', text: 'content 元素 type=text 时的实际内容。这里是工具返回值的 JSON 序列化字符串——与 edge 版响应体里的业务字段同源同一份 lib 计算结果。' },
  isError: { title: 'isError — 工具级失败标记', text: 'true 表示工具执行失败（但协议调用本身成功）。失败原因放在 content 里给模型看，模型可据此换参数重试。与 JSON-RPC 的 error（协议级失败）是两层不同的错误语义。' },
  tool_choice: { title: 'tool_choice — 对照概念（MCP 没有这个字段）', text: 'tool_choice 是 LLM 聊天 API（如 OpenAI）的参数，控制模型「是否/必须调用工具」。MCP 报文里没有它：MCP 只负责把工具清单与调用通道标准化，选哪个工具由宿主侧的模型决策。理解这个边界，就理解了 MCP 与 function calling 的分工。' },
  sampling: { title: 'sampling — 客户端能力：反向请求模型', text: '声明后，服务端可以反过来请求宿主「帮我调一次 LLM」。这是 MCP 少见的反向调用能力。开关打开后，initialize 的 params.capabilities 里会多出 sampling 字段——看左侧握手 diff。' },
  roots: { title: 'roots — 客户端能力：文件系统边界', text: '声明后，宿主告知服务端可访问的目录根列表，服务端据此约束文件操作范围。listChanged 表示根列表变化时会发通知。' },
  listChanged: { title: 'listChanged — 清单变更通知', text: '能力修饰符：tools.listChanged=true 承诺「工具清单变化时主动发 notifications/tools/list_changed」，宿主收到后重新 tools/list。关掉它，握手报文里这个字段就消失——对照开关演示的正是这种 capability 协商。' },
  ok: { title: 'ok — edge 薄壳的成功标记', text: 'HTTP 宿主自己加的业务成功位。MCP 版没有它（成功语义由 JSON-RPC result/error 与 isError 承担）——同一份 lib 结果，两个薄壳各自包装，这就是协议与业务解耦的直接证据。' },
  chunks: { title: 'chunks — 切块结果', text: 'chunkText 的返回：字符串数组。优先在句末断点切割，块长不超过 chunkSize，相邻块保留 overlap 个字符的重叠。' },
  count: { title: 'count — edge 版计数字段', text: 'edge 薄壳附带的块数。MCP 薄壳同一信息叫 chunkCount——包装命名不同，数值同源。' },
  chunkCount: { title: 'chunkCount — MCP 版计数字段', text: 'MCP 薄壳附带的块数，与 edge 版的 count 同源同值，只是包装命名不同。' },
  chunkSize: { title: 'chunkSize — 每块上限', text: '每块最大字符数。太小语义碎片化，太大稀释检索相关性；lib 默认 500，演示用 40 便于肉眼观察。' },
  overlap: { title: 'overlap — 相邻块重叠', text: '相邻块重叠的字符数，保证跨块边界的信息不丢。必须小于 chunkSize，lib 在边界处校验。' },
  verified: { title: 'verified — 验签结论', text: '只有传了 secret 才出现：HMAC 重算签名并常量时间比较的结果。true=签名可信；false=签名不符。解码（decode）永远不做这件事——解码只看结构，验签才谈信任。' },
  decoded: { title: 'decoded — 解码产物', text: 'decodeJwt 的返回：header/payload/signature/wellFormed/expired。注意：解码不验签，payload 内容此时不可信，仅用于观察。' },
  header: { title: 'header — JWT 头部', text: 'base64url 解码后的第一段：alg 声明签名算法，typ 声明令牌类型。验签时按 alg 选择 HMAC 哈希。' },
  payload: { title: 'payload — 声明集合', text: 'JWT 第二段：sub/exp/iat 等声明（claims）。它是明文可解码的——JWT 的保密性不靠编码，靠签名防篡改；敏感信息不应放 payload。' },
  signature: { title: 'signature — 签名段', text: '对 header.payload 的 HMAC 摘要（base64url）。改任何一个字符，验签即失败。' },
  alg: { title: 'alg — 签名算法', text: '本工具支持 HS256/384/512（HMAC 对称族）。alg=none 的令牌会被拒绝——历史上「算法混淆」是 JWT 经典漏洞。' },
  typ: { title: 'typ — 令牌类型', text: '通常为 JWT，声明媒体类型，帮助接收方识别令牌格式。' },
  sub: { title: 'sub — 主体', text: '令牌描述的主体（用户/服务标识），演示令牌里是 demo。' },
  exp: { title: 'exp — 过期时间', text: 'Unix 秒。lib 解码时据此给出 expired 判断；过期令牌即使签名正确也不应被接受。' },
  iat: { title: 'iat — 签发时间', text: 'Unix 秒，令牌签发时刻，用于时效审计。' },
  token: { title: 'token — 三段式令牌', text: 'header.payload.signature，两段点号分隔。本页「生成示例 token」用浏览器 WebCrypto 现签一个 HS256 演示令牌。' },
  secret: { title: 'secret — HMAC 密钥', text: '对称密钥：签名与验签共用。填了才验签；不填只解码。演示请用演示密钥，真实密钥不要进公网页面。' },
  secretId: { title: 'secretId — 云 API 身份标识', text: '标识调用者身份，会明文出现在 Authorization 的 Credential 段。演示使用连字符格式的假密钥。' },
  secretKey: { title: 'secretKey — 云 API 签名密钥', text: '只参与本地 HMAC 推导，绝不出现在任何请求头里——TC3 的设计要点：密钥不上行，上行的是派生签名。' },
  Authorization: { title: 'Authorization — TC3 签名头', text: 'TC3-HMAC-SHA256 Credential=身份/日期/服务/tc3_request, SignedHeaders=…, Signature=…。四层 HMAC 派生（密钥→日期→服务→请求）的终点，服务端用同样推导验证请求未被篡改。' },
  'X-TC-Action': { title: 'X-TC-Action — API 动作', text: '要调用的云 API（如 SendSms），参与规范化头部签名——改动作名签名即失效。' },
  'X-TC-Timestamp': { title: 'X-TC-Timestamp — 防重放时间戳', text: 'Unix 秒，参与签名。服务端校验时间窗口，过期请求拒绝——签名不仅防篡改，还防重放。' },
  'X-TC-Version': { title: 'X-TC-Version — API 版本', text: '接口版本号，云 API 按版本路由行为。' },
  'X-TC-Region': { title: 'X-TC-Region — 地域', text: '目标地域（如 ap-guangzhou），部分 API 必填。' },
  'Content-Type': { title: 'Content-Type — 载荷类型', text: 'application/json; charset=utf-8。它参与规范化头部，payload 的 SHA256 也进签名——头与体一起被保护。' },
  Host: { title: 'Host — 目标域名', text: '参与签名的目标主机名，防止签名被挪用到其他接口。' },
  timestamp: { title: 'timestamp — 签名时间锚', text: '固定它可以让签名结果可复现（对拍官方测试向量就靠固定时间戳）；缺省取当前时间。' },
  op: { title: 'op — 日期操作选择子', text: 'date_calc 的分派开关：add_days/diff_days/weekday/days_in_month/is_leap_year/today。一个工具多操作，schema 用 enum 约束。' },
  date: { title: 'date — 基准日期', text: 'YYYY-MM-DD，lib 统一按 UTC 解析，规避本地时区导致的跨日翻车。' },
  days: { title: 'days — 偏移天数', text: '整数，可负。add_days 的偏移量。' },
  from: { title: 'from — 起始日期', text: 'diff_days 的起点。' },
  to: { title: 'to — 结束日期', text: 'diff_days 的终点，结果 = to − from 的天数。' },
  year: { title: 'year — 年份', text: 'is_leap_year/days_in_month 的入参。闰年规则：四年一闰，百年不闰，四百年再闰。' },
  month: { title: 'month — 月份', text: '1-12，lib 用「下月第 0 天」技巧求当月天数。' },
  locations: { title: 'locations — 地点列表', text: '口碑榜的候选地点：id/name/pinned 等。pinned 置顶优先于热度排序。' },
  posts: { title: 'posts — 帖子列表', text: '用户帖子：locationId 关联地点，rating/votes 参与热度。热度 = 发帖数×2 + 累计投票×3 + 平均评分×5。' },
  locationId: { title: 'locationId — 关联键', text: '帖子归属的地点 id，聚合时按它分组。' },
  rating: { title: 'rating — 评分', text: '可空；未评分的帖子不参与平均分，避免 0 分拉低热度。' },
  votes: { title: 'votes — 投票数', text: '累计投票，权重 3。' },
  pinned: { title: 'pinned — 置顶', text: '置顶地点排在所有非置顶之前，其余按热度降序。' },
  heat: { title: 'heat — 热度分', text: '发帖数×2 + 累计投票×3 + 平均评分×5。与 travel-rank 后端算法逐字一致，可两边对拍。' },
  postCount: { title: 'postCount — 发帖数', text: '该地点的帖子数量，热度权重 2。' },
  topAdvantages: { title: 'topAdvantages — 高频优点', text: '聚合帖子 advantages 标签的词频榜，MCP 薄壳额外包装进 ranking。' },
  ranking: { title: 'ranking — MCP 版榜单包装', text: 'MCP 薄壳把 lib 榜单再包一层 {rank,name,heat,…}；edge 薄壳直接返回 leaderboard。同一份 lib 计算，两种包装。' },
  leaderboard: { title: 'leaderboard — edge 版榜单', text: 'getLeaderboard 的原始返回，edge 薄壳原样透出。' },
  url: { title: 'url — 抓取目标', text: '仅 http/https；私网/保留地址在服务端被拒绝（SSRF 边界），超时上限 15 秒。' },
  timeoutMs: { title: 'timeoutMs — 抓取超时', text: '1-15000 的整数毫秒，默认 10000。edge 冷启动环境下给抓取设硬超时是必要的自保。' },
  title: { title: 'title — 页面标题', text: '从 <title> 抽取并解码 HTML 实体。' },
  headings: { title: 'headings — 标题链', text: 'h1-h6 文本序列，保留文档结构骨架。' },
  links: { title: 'links — 链接列表', text: '页面 a[href] 抽取结果。' },
  textLength: { title: 'textLength — 正文长度', text: '去标签正文的字符数，快速判断抽取是否有效。' },
  uptimeSec: { title: 'uptimeSec — 运行时长', text: '进程启动至今的秒数。edge 冷启动后这个值很小——可以直观看到无服务器宿主的按需生命周期。' },
  nodeVersion: { title: 'nodeVersion — 运行时版本', text: '宿主 JS 运行时版本。stdio 宿主是你本机的 Node；edge 宿主是平台运行时——同一份 lib 对运行时无感。' },
  platform: { title: 'platform — 操作系统', text: '宿主平台标识，健康检查的一部分。' },
  arch: { title: 'arch — CPU 架构', text: '宿主架构标识。' },
  status: { title: 'status — HTTP 状态码', text: 'edge 薄壳的传输层语义：200 成功 / 400 参数或业务错误 / 405 方法不符 / 404 未知工具。MCP 版没有 HTTP 状态码，对应语义由 JSON-RPC error 与 isError 承担。' },
  ms: { title: 'ms — 端到端耗时', text: '浏览器视角的往返毫秒数：含网络 + edge 冷启动（若命中）+ lib 计算。lib 本身是纯函数，通常 <1ms，耗时大头在传输与宿主。' },
  fn: { title: 'fn — lib 函数名', text: 'edge 薄壳实际调用的 src/lib 纯函数。MCP 薄壳调用的是同一个函数——两个宿主共用同一份源码，零复制。' },
  module: { title: 'module — lib 模块', text: 'src/lib 下的模块文件。这一层零 MCP 依赖、零 I/O（网页抓取除外），可以被任何宿主接线：stdio、HTTP、测试、CLI。' },
  args: { title: 'args — 传给 lib 的入参', text: '薄壳校验后透传给纯函数的参数。对比左侧 MCP 的 arguments：同一份数据，不同信封。' },
  dbPath: { title: 'dbPath — 数据库路径', text: 'sqlite_query 专属：路径被限制在 MCP_SQLITE_ROOT 内，realpath 挡软链。公网版不提供此工具——没有你的本机文件，放上来只能是假演示。' },
  sql: { title: 'sql — 只读 SQL', text: '仅 SELECT/WITH/PRAGMA，写操作在 lib 边界直接拒绝。' },
};

/** 字段解释：path 语境优先，回退词典，再回退通用说明。永远有返回。 */
export function explainField(path, key) {
  const p = String(path || '');
  if (key === 'name') {
    if (/params\.name$/.test(p)) return { title: 'name — 目标工具名', text: 'tools/call 要调用的工具，必须出现在 tools/list 清单里。宿主按名字路由到对应薄壳，薄壳再调 lib。' };
    if (/clientInfo\.name$/.test(p)) return FIELD_EXPLAIN.clientInfo;
    if (/serverInfo\.name$/.test(p)) return FIELD_EXPLAIN.serverInfo;
  }
  if (key === 'id' && /\[\d+\]$/.test(p)) return { title: '[' + key + '] — 数组元素', text: '数组下标零件。点开它的子字段继续看。' };
  if (key === 'text' && /content\[\d+\]\.text$/.test(p)) return FIELD_EXPLAIN.text;
  if (key === 'type' && /content\[\d+\]\.type$/.test(p)) return { title: 'type — content 元素类型', text: 'MCP 工具输出元素的类型：text/image/resource。本仓库统一 text（JSON 字符串）。' };
  if (key === 'type' && /inputSchema/.test(p)) return { title: 'type — JSON Schema 类型', text: '参数合同里的类型约束：object/string/integer/array。宿主与模型据此填参，服务端据此校验。' };
  const hit = FIELD_EXPLAIN[key];
  if (hit) return hit;
  if (/^\[\d+\]$/.test(String(key))) return { title: key + ' — 数组元素', text: '数组下标零件，点开子字段继续看。' };
  return { title: String(key) + ' — 业务字段', text: '这是工具业务数据的一部分，由 src/lib 纯函数计算产出。协议层（JSON-RPC/HTTP）只负责搬运，不理解它——协议与业务解耦。' };
}

// ---------- MCP stdio 宿主：报文序列构造（静态仿真，形态与真实 SDK 一致） ----------

export function defaultCaps() { return { listChanged: false, sampling: false, roots: false }; }

export function buildHandshake(caps) {
  const c = Object.assign(defaultCaps(), caps || {});
  const clientCaps = {};
  if (c.sampling) clientCaps.sampling = {};
  if (c.roots) clientCaps.roots = { listChanged: true };
  const serverTools = c.listChanged ? { listChanged: true } : {};
  return [
    { dir: 'c2s', label: 'initialize 请求', msg: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION, capabilities: clientCaps, clientInfo: CLIENT_INFO } } },
    { dir: 's2c', label: 'initialize 响应', msg: { jsonrpc: '2.0', id: 1, result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: serverTools }, serverInfo: SERVER_INFO } } },
    { dir: 'c2s', label: 'initialized 通知（无 id，无需回应）', msg: { jsonrpc: '2.0', method: 'notifications/initialized' } },
  ];
}

export function buildToolsList() {
  const tools = MCP_TOOL_ORDER.map((n) => ({ name: n, description: TOOL_SCHEMAS[n].description, inputSchema: TOOL_SCHEMAS[n].inputSchema }));
  return [
    { dir: 'c2s', label: 'tools/list 请求', msg: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} } },
    { dir: 's2c', label: 'tools/list 响应（8 工具清单）', msg: { jsonrpc: '2.0', id: 2, result: { tools } } },
  ];
}

/** edge 响应 → MCP 薄壳的 jsonResult 数据形态（与 src/tools/*.ts 的包装逐一对应） */
export function mcpResultFor(tool, body, resp) {
  if (!resp || resp.ok !== true) return { error: resp && resp.error ? resp.error : '调用失败' };
  switch (tool) {
    case 'text_chunk': return { chunks: resp.chunks, chunkCount: resp.count };
    case 'date_calc': return { op: body && body.op, result: resp.result };
    case 'hotspot_rank': return {
      ranking: (resp.leaderboard || []).map((r, i) => ({ rank: i + 1, name: r.name, heat: r.heat, postCount: r.postCount, topAdvantages: r.topAdvantages })),
      totalLocations: (resp.leaderboard || []).length,
    };
    case 'jwt_decode': {
      const out = Object.assign({}, resp.decoded);
      if (resp.verified !== undefined) out.verified = resp.verified;
      return out;
    }
    case 'tc3_sign': return { headers: resp.headers };
    case 'webpage_extract': return Object.assign({ url: body && body.url }, resp.page);
    case 'health_ping': return resp.health;
    default: return resp;
  }
}

export function buildToolsCall(id, mcpName, args, resultData) {
  return [
    { dir: 'c2s', label: 'tools/call 请求', msg: { jsonrpc: '2.0', id, method: 'tools/call', params: { name: mcpName, arguments: args || {} } } },
    { dir: 's2c', label: 'tools/call 响应', msg: { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(resultData, null, 2) }], isError: false } } },
  ];
}

/** 完整 stdio 序列：握手(3) + 发现(2) + 调用(2)。edge 响应可为 null（尚未调用）。 */
export function buildMcpSequence(tool, args, edgeResp, caps) {
  const meta = TOOL_META[tool];
  const seq = [...buildHandshake(caps), ...buildToolsList()];
  const resultData = edgeResp ? mcpResultFor(tool, args, edgeResp) : { note: '等待右侧 edge 真实调用后，这里同步展示同一份 lib 结果的 MCP 包装' };
  seq.push(...buildToolsCall(3, meta.mcpName, args, resultData));
  return seq.map((m, i) => Object.assign({ seq: i + 1 }, m));
}

/** 握手 diff：以全关基线为参照，返回 [{msgIndex, path, kind:'added'|'removed', value}] */
export function diffHandshake(baseCaps, nextCaps) {
  const leaves = (msgs) => {
    const map = new Map();
    msgs.forEach((m, i) => {
      const flat = (v, p) => {
        if (v !== null && typeof v === 'object') {
          const keys = Array.isArray(v) ? v.map((_, j) => j) : Object.keys(v);
          if (keys.length === 0) map.set(i + p, JSON.stringify(v));
          for (const k of keys) flat(v[k], p + (Array.isArray(v) ? '[' + k + ']' : '.' + k));
        } else map.set(i + p, JSON.stringify(v));
      };
      flat(m.msg, '');
    });
    return map;
  };
  const a = leaves(buildHandshake(baseCaps));
  const b = leaves(buildHandshake(nextCaps));
  const added = [];
  const removed = [];
  const mk = (k, v, kind) => ({ msgIndex: Number(k.slice(0, 1)), path: k.slice(1), kind, value: v });
  for (const [k, v] of b) if (!a.has(k)) added.push(mk(k, v, 'added'));
  for (const [k, v] of a) if (!b.has(k)) removed.push(mk(k, v, 'removed'));
  // 空容器 {} 的增删若伴随子字段变化，只是「容器展开/收起」，不算真实字段 diff
  const hasChild = (p, list) => list.some((q) => q.path.startsWith(p + '.') || q.path.startsWith(p + '['));
  const isEmpty = (v) => v === '{}' || v === '[]';
  return [
    ...added.filter((d) => !(isEmpty(d.value) && hasChild(d.path, removed))),
    ...removed.filter((d) => !(isEmpty(d.value) && hasChild(d.path, added))),
  ];
}

// ---------- edge 宿主：真实调用的三层 trace 帧 ----------

export function libReturnFor(tool, resp) {
  if (!resp || resp.ok !== true) return { error: resp && resp.error ? resp.error : '调用失败' };
  switch (tool) {
    case 'text_chunk': return resp.chunks;
    case 'date_calc': return resp.result;
    case 'hotspot_rank': return resp.leaderboard;
    case 'jwt_decode': return resp.verified === undefined ? resp.decoded : Object.assign({}, resp.decoded, { verified: resp.verified });
    case 'tc3_sign': return resp.headers;
    case 'webpage_extract': return resp.page;
    case 'health_ping': return resp.health;
    default: return resp;
  }
}

/** 一次真实 edge 调用 → browser→edge→lib→edge→browser 四帧 */
export function buildEdgeFrames(tool, body, resp, ms, status) {
  const meta = TOOL_META[tool] || { lib: '?', fn: '?' };
  const method = meta.method || 'POST';
  const ok = !!(resp && resp.ok === true);
  return [
    { from: 'browser', to: 'edge', kind: 'request', label: method + ' /functions/v1/app/' + tool, payload: method === 'GET' ? { note: 'GET 无请求体' } : body },
    { from: 'edge', to: 'lib', kind: 'call', label: '调用纯函数', payload: { module: 'src/lib/' + meta.lib, fn: meta.fn, args: method === 'GET' ? {} : body } },
    { from: 'lib', to: 'edge', kind: ok ? 'return' : 'throw', label: ok ? '纯函数返回' : '边界校验抛错', payload: libReturnFor(tool, resp) },
    { from: 'edge', to: 'browser', kind: 'response', label: 'HTTP ' + status + ' · ' + ms + 'ms', status, ms, payload: resp },
  ];
}

// ---------- 宿主对照表 ----------

export const HOST_DIFF = [
  { dim: '传输', stdio: 'JSON-RPC 2.0 over stdio：stdout 走协议、stderr 走日志，一行一条消息', edge: 'HTTPS + JSON：POST /functions/v1/app/<tool>，浏览器直连', note: '信封不同，信件（lib 入参/结果）相同' },
  { dim: '鉴权', stdio: '无网络鉴权：宿主以本地子进程启动服务器，信任边界=本机进程权限', edge: '平台同源策略 + 公网边界校验（私网地址拒绝、100KB 体积上限、只读工具面）', note: 'sqlite_query 因此只在 stdio 宿主提供' },
  { dim: '生命周期', stdio: '宿主拉起长驻进程，initialize 握手一次，会话内复用', edge: '按请求冷启动/复用实例，无握手，每次调用独立', note: '看 health_ping 的 uptimeSec 直观感受差异' },
  { dim: '工具发现', stdio: 'tools/list 动态清单 + inputSchema 合同，模型自主选工具', edge: 'URL 路径即工具名，页面表单即 schema，人直接选', note: 'MCP 面向模型，edge 面向人' },
  { dim: '结果包装', stdio: 'result.content[0].text（JSON 字符串）+ isError', edge: '{ok, …业务字段} + HTTP 状态码', note: 'count vs chunkCount、leaderboard vs ranking：同一份 lib，两种薄壳' },
  { dim: '错误语义', stdio: '协议级 error{code,message} / 工具级 isError=true 两层', edge: '400/404/405 + {ok:false,error}', note: 'lib 抛出的同一个 Error，两个薄壳各自翻译' },
];

// ---------- 视野扇区门控：宿主决定可见性（隐喻：扇区照到的零件才进该宿主的可读取清单） ----------

export const SECTOR_WIDTH = 144; // 扇区角宽（度），边界含端点；15 零件 × 24° 间隔，一扇区最多照 7 件

/** 零件墙 15 件：8 工具 + 3 MCP 方法 + 3 capability + 1 edge HTTP 路由。caps 与宿主对照开关同源。 */
export function sectorParts(caps) {
  const c = Object.assign(defaultCaps(), caps || {});
  const parts = MCP_TOOL_ORDER.map((name, i) => {
    const edgeEntry = TOOL_ORDER.find((t) => TOOL_META[t].mcpName === name);
    return {
      id: name, label: name, kind: 'tool', angle: i * 24,
      hosts: name === 'sqlite_query' ? ['stdio'] : ['stdio', 'edge'],
      localOnly: name === 'sqlite_query',
      edgeTool: edgeEntry || null,
    };
  });
  [
    { id: 'initialize', label: 'initialize', angle: 192 },
    { id: 'tools/list', label: 'tools/list', angle: 216 },
    { id: 'tools/call', label: 'tools/call', angle: 240 },
  ].forEach((m) => parts.push(Object.assign({ kind: 'method', hosts: ['stdio'] }, m)));
  [
    { id: 'roots', label: 'roots', angle: 264, cap: 'roots' },
    { id: 'sampling', label: 'sampling', angle: 288, cap: 'sampling' },
    { id: 'tools.listChanged', label: 'tools.listChanged', angle: 312, cap: 'listChanged' },
  ].forEach((m) => parts.push(Object.assign({ kind: 'capability', hosts: ['stdio'], capOn: !!c[m.cap] }, m)));
  parts.push({ id: 'http_route', label: 'HTTP 路由 ×7', kind: 'http', angle: 336, hosts: ['edge'] });
  return parts;
}

/**
 * 扇区门控纯函数：host ∈ {'stdio','edge'}，angleDeg 为扇区中心角（任意实数，内部归一化）。
 * 点亮 = 扇区照到（角距 ≤ SECTOR_WIDTH/2，含边界，跨 0° 环绕）且该宿主真实可见：
 * - stdio：tools/list 的 7 个公网工具 + initialize/tools/list/tools/call + 按开关声明的 capability；
 * - edge：7 个 HTTP 路由工具 + HTTP 路由零件，无任何 MCP 握手/capability 零件；
 * - sqlite_query 本地专属，两个宿主任何角度都不点亮（与页面诚实标注一致）。
 * 返回 [{...part, inSector, lit, reason}]，reason 仅在未点亮时非空。
 */
export function sectorVisibility(host, angleDeg, parts) {
  const half = SECTOR_WIDTH / 2;
  const a = ((Number(angleDeg) % 360) + 360) % 360;
  return parts.map((p) => {
    const diff = ((p.angle - a + 540) % 360) - 180;
    const inSector = Math.abs(diff) <= half;
    const hostSees = p.hosts.indexOf(host) >= 0;
    const capOk = !p.cap || p.capOn === true;
    const lit = inSector && hostSees && capOk && !p.localOnly;
    let reason = '';
    if (!lit) {
      if (p.localOnly) reason = '本地专属：公网两个宿主都看不到，本机 stdio 跑 node dist/index.js 才可用';
      else if (!hostSees) reason = host === 'edge' ? '该宿主看不到：edge 无 MCP 握手与 capability 零件' : '该宿主看不到：stdio 没有 HTTP 路由零件';
      else if (!capOk) reason = '该宿主看不到：capability 未声明（去「宿主对照」打开开关）';
      else reason = '扇区未照到：转动滑杆让它进入视野';
    }
    return Object.assign({}, p, { inSector, lit, reason });
  });
}

// ---------- 引导课程（慧梯四模式简化：演示→练习→测验→复盘） ----------

export const COURSE = [
  {
    id: 'chunk', tool: 'text_chunk', title: '第 1 步 · 文本切块',
    goal: '理解 RAG 预处理：chunkSize 与 overlap 如何权衡精度与完整性。',
    demo: { text: 'RAG 的第一步是切块。块太小语义碎片化，块太大稀释相关性。滑动窗口加句末断点回退，是精度与完整性之间的折中。重叠保证相邻块信息不丢失。', chunkSize: 40, overlap: 8 },
    quiz: {
      q: '相邻块为什么要保留 overlap 重叠？',
      options: ['为了节省存储空间', '防止跨块边界的关键信息被切断后两块都拿不全', '让每块长度完全相等'],
      answer: 1,
      hint: '想想一句话恰好被切在两块交界处会发生什么。',
      review: '复盘：chunkSize 控制粒度，overlap 兜住边界语义；lib 优先句末断点回退。同一份 chunkText，MCP 薄壳包成 {chunks,chunkCount}，edge 薄壳包成 {ok,chunks,count}。',
    },
  },
  {
    id: 'jwt', tool: 'jwt_decode', title: '第 2 步 · JWT 验签',
    goal: '分清「解码」与「验签」：结构可读 ≠ 内容可信。',
    demo: { useSampleToken: true, secret: 'demo-secret' },
    quiz: {
      q: '只解码不验签的 JWT，payload 内容可以直接信任吗？',
      options: ['可以，base64 解码成功就说明合法', '不可以，任何人都能伪造 payload，必须验签才能谈信任', '可以，只要 exp 没过期'],
      answer: 1,
      hint: 'base64url 是编码不是加密，更不是签名。',
      review: '复盘：解码看结构（header/payload/expired），验签才校验 HMAC（常量时间比较防时序侧信道）。verified 字段只在传了 secret 时出现。',
    },
  },
  {
    id: 'tc3', tool: 'tc3_sign', title: '第 3 步 · TC3 签名',
    goal: '理解派生签名：密钥不上行，上行的是四层 HMAC 推导的终点。',
    demo: { secretId: 'AKID-demo-not-a-real-key', secretKey: 'demo-key-not-a-real-secret', timestamp: 1731888000, action: 'SendSms', payload: { PhoneNumberSet: ['+8613800000000'], TemplateId: '1234567' } },
    quiz: {
      q: 'TC3 签名里 secretKey 会出现在发出去的请求头里吗？',
      options: ['会，放在 Authorization 里', '不会，它只在本地参与 HMAC 派生，上行的是 Signature', '会，放在 X-TC-Timestamp 里'],
      answer: 1,
      hint: '看看 Authorization 的三段：Credential / SignedHeaders / Signature，哪一段是密钥本身？',
      review: '复盘：secretKey→日期→服务→请求四层派生，timestamp 防重放，payload 哈希进签名防篡改。固定 timestamp 可与官方测试向量逐字节对拍。',
    },
  },
];

export function checkQuiz(stepIndex, choice) {
  const step = COURSE[stepIndex];
  if (!step) return false;
  return choice === step.quiz.answer;
}