// lib/webpage.ts —— 网页 HTML → 纯文本抽取（核心纯函数可离线测试）
//
// 拆分两层：
//   - extractFromHtml(html)：纯函数，输入 HTML 字符串 → 抽取标题/标题层级/链接/正文，
//     无网络副作用，单测可喂任意 HTML 片段；
//   - fetchHtml(url)：唯一带 I/O 的环节，用内置 fetch 抓取，独立于抽取逻辑。

export interface ExtractedPage {
  title: string;
  headings: string[];
  links: string[];
  text: string;
  textLength: number;
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&lsquo;': "'",
  '&rsquo;': "'",
  '&middot;': '·',
  '&times;': '×',
};

/** HTML 实体解码（含数字实体） */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&[a-zA-Z]+;/g, (e) => HTML_ENTITIES[e] ?? e);
}

function stripTags(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ');
}

/** 从 HTML 抽取标题、标题层级、链接与正文（纯函数） */
export function extractFromHtml(html: string): ExtractedPage {
  const h = html ?? '';

  const titleMatch = /<title[\s\S]*?>([\s\S]*?)<\/title>/i.exec(h);
  const title = decodeEntities(stripTags(titleMatch?.[1] ?? '')).trim();

  const headings = [...h.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((m) => decodeEntities(stripTags(m[1])).trim())
    .filter(Boolean);

  const links = [...h.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((m) => m[1])
    .filter((u) => u && !u.toLowerCase().startsWith('javascript:'));

  const text = decodeEntities(stripTags(h)).replace(/\s+/g, ' ').trim();

  return { title, headings, links, text, textLength: text.length };
}

/** 抓取网页 HTML（唯一 I/O 环节，内置 fetch，带超时） */
export async function fetchHtml(url: string, timeoutMs = 10_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'mcp-toolkit/1.0' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`请求失败：HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`请求超时（${timeoutMs}ms）：${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
