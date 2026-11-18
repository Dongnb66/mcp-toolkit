// 公网 playground 构建：lib 源码原样拷贝（仅 .js→.ts 扩展名改写，edge 要求显式扩展名），
// handler/index 的 lib 导入路径从仓库相对路径改写为包内 ./lib/。
// 输出目录必须是当前会话工作区内（Sites prepare 的 projectRoot 边界）。
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
if (!out) throw new Error("用法: node scripts/build-playground.mjs <输出目录>");

const LIBS = ["chunk", "date", "health", "hotspot", "jwt", "tc3", "webpage"];

fs.mkdirSync(path.join(out, "web"), { recursive: true });
fs.mkdirSync(path.join(out, "functions", "lib"), { recursive: true });

// 前端纯函数层（trace/零件/对照报文构造）内联进 index.html：
// 去掉 ESM export 前缀后作为经典脚本注入，产物保持单文件，vitest 直接测源文件。
const MARKER = "<!--__PROTOCOL_INLINE__-->";
let html = fs.readFileSync(path.join(root, "playground", "web", "index.html"), "utf8");
if (!html.includes(MARKER)) throw new Error("index.html 缺少 protocol 内联标记");
const proto = fs.readFileSync(path.join(root, "playground", "web", "protocol.js"), "utf8");
const protoClassic = proto.replace(/^export /gm, "");
if (/^export /m.test(protoClassic)) throw new Error("protocol.js export 剥离失败");
if (protoClassic.includes("</script")) throw new Error("protocol.js 含 </script，无法内联");
html = html.replace(MARKER, () => "<script>\n" + protoClassic + "\n</script>");
if (html.includes(MARKER)) throw new Error("protocol 内联失败");
// 内联脚本语法闸门：任何一段编译失败都不允许产出
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  new vm.Script(m[1]);
}
fs.writeFileSync(path.join(out, "web", "index.html"), html);

for (const name of LIBS) {
  let src = fs.readFileSync(path.join(root, "src", "lib", name + ".ts"), "utf8");
  src = src.replace(/from '\.\/([^']+)\.js'/g, "from './$1.ts'");
  fs.writeFileSync(path.join(out, "functions", "lib", name + ".ts"), src);
}

for (const name of ["handler", "index", "node-globals"]) {
  let src = fs.readFileSync(path.join(root, "playground", "functions", name + ".ts"), "utf8");
  src = src.split("../../src/lib/").join("./lib/");
  src = src.replace(/from '\.\/([^']+)\.js'/g, "from './$1.ts'");
  src = src.replace(/import '\.\/([^']+)\.js'/g, "import './$1.ts'");
  fs.writeFileSync(path.join(out, "functions", name + ".ts"), src);
}

const handlerOut = fs.readFileSync(path.join(out, "functions", "handler.ts"), "utf8");
if (handlerOut.includes("../../src/lib/")) throw new Error("handler lib 路径改写失败");
const indexOut = fs.readFileSync(path.join(out, "functions", "index.ts"), "utf8");
if (/\.js'/.test(indexOut)) throw new Error("index 仍有 .js 导入，edge bundle 会失败");

// 公网禁字面量扫描（仅 web 产物；演示密钥必须连字符格式）
const webOut = fs.readFileSync(path.join(out, "web", "index.html"), "utf8");
for (const bad of ["pt-online-schema-change", "127.0.0.1", "localhost", "杨运栋"]) {
  if (webOut.includes(bad)) throw new Error("web 产物含禁字面量：" + bad);
}
if (/AKID[A-Za-z0-9]{32}/.test(webOut)) throw new Error("web 产物含真实形态 AKID 密钥");
console.log("playground 已生成：" + out + "（7 工具进 edge，sqlite 本地专属；protocol.js 已内联）");