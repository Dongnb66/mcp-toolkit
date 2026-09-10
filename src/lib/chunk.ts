// lib/chunk.ts —— RAG 文本切块（纯函数版）
//
// 滑动窗口切块，支持 overlap（重叠），用于把长文档切成适合检索/嵌入的片段。
// 在「尽量按句末断点切割」与「保证块大小上限」之间折中：
//   - 先按硬上限 chunkSize 切，再在窗口尾部回退到最近的句子断点（。！？.!? 等）；
//   - overlap 保证相邻块之间信息不丢失。
//
// 延续 python-learning-agent 的 BM25/RAG 文本预处理经验：切块粒度直接影响召回。

export interface ChunkOptions {
  /** 每块最大字符数，默认 500 */
  chunkSize?: number;
  /** 相邻块重叠字符数，默认 50 */
  overlap?: number;
}

const SENTENCE_ENDERS = /[。！？!?；;\n]/;

/** 参数合法性校验，失败抛中文可读错误 */
function validate(opts: ChunkOptions): { chunkSize: number; overlap: number } {
  const chunkSize = opts.chunkSize ?? 500;
  const overlap = opts.overlap ?? 50;
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('chunkSize 必须是正整数');
  }
  if (!Number.isInteger(overlap) || overlap < 0) {
    throw new Error('overlap 必须是非负整数');
  }
  if (overlap >= chunkSize) {
    throw new Error('overlap 必须小于 chunkSize');
  }
  return { chunkSize, overlap };
}

/**
 * 在 [start, start+chunkSize] 窗口内，回退到最近的句末断点（若有），
 * 返回更自然的切割位置，否则返回硬上限位置。
 */
function findBreak(text: string, start: number, chunkSize: number): number {
  const end = Math.min(start + chunkSize, text.length);
  if (end >= text.length) return text.length;
  // 在窗口末尾 1/3 范围内找最近断点，避免块过短
  const lookback = Math.floor(chunkSize / 3);
  const from = Math.max(start, end - lookback);
  for (let i = end; i >= from; i--) {
    if (SENTENCE_ENDERS.test(text[i - 1] ?? '')) return i;
  }
  return end;
}

/**
 * 把文本切成若干块。返回字符串数组；空文本返回空数组。
 * 相邻块之间有 overlap 个字符重叠。
 */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const { chunkSize, overlap } = validate(opts);
  const t = text ?? '';
  if (t.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < t.length) {
    const end = findBreak(t, start, chunkSize);
    chunks.push(t.slice(start, end).trim());
    if (end >= t.length) break;
    start = end - overlap;
    if (start <= 0) start = Math.max(start, end - chunkSize + 1); // 防御：避免死循环
  }
  return chunks.filter((c) => c.length > 0);
}

/** 切块数量 */
export function countChunks(text: string, opts: ChunkOptions = {}): number {
  return chunkText(text, opts).length;
}
