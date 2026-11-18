// 公网 playground 构建：lib 源码原样拷贝（仅 .js→.ts 扩展名改写，edge 要求显式扩展名），
// handler/index 的 lib 导入路径从仓库相对路径改写为包内 ./lib/。
// 输出目录必须是当前会话工作区内（Sites prepare 的 projectRoot 边界）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
if (!out) throw new Error("用法: node scripts/build-playground.mjs <输出目录>");

const LIBS = ["chunk", "date", "health", "hotspot", "jwt", "tc3", "webpage"];

fs.mkdirSync(path.join(out, "web"), { recursive: true });
fs.mkdirSync(path.join(out, "functions", "lib"), { recursive: true });

fs.copyFileSync(path.join(root, "playground", "web", "index.html"), path.join(out, "web", "index.html"));

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
console.log("playground 已生成：" + out + "（7 工具进 edge，sqlite 本地专属）");