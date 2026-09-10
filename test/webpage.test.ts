import { describe, it, expect } from 'vitest';
import { extractFromHtml, decodeEntities } from '../src/lib/webpage.js';

describe('extractFromHtml 网页抽取', () => {
  it('正常：抽取标题/标题层级/链接/正文', () => {
    const html = `<html><head><title>测试页面</title></head><body>
      <h1>主标题</h1><h2>副标题</h2>
      <p>这是一段正文</p>
      <a href="https://example.com/a">链接A</a>
      <a href="javascript:void(0)">无效链接</a>
      <script>var x=1;</script>
      <style>body{color:red}</style>
    </body></html>`;
    const r = extractFromHtml(html);
    expect(r.title).toBe('测试页面');
    expect(r.headings).toEqual(['主标题', '副标题']);
    expect(r.links).toEqual(['https://example.com/a']);
    expect(r.text).toContain('这是一段正文');
    expect(r.text).not.toContain('var x');
    expect(r.text).not.toContain('color:red');
  });

  it('边界：空输入不报错', () => {
    const r = extractFromHtml('');
    expect(r.title).toBe('');
    expect(r.textLength).toBe(0);
    expect(r.links).toEqual([]);
  });

  it('正常：正文压缩连续空白', () => {
    const r = extractFromHtml('<p>  多个   空格  </p>');
    expect(r.text).toBe('多个 空格');
  });
});

describe('decodeEntities 实体解码', () => {
  it('正常：命名实体与数字实体', () => {
    expect(decodeEntities('a&amp;b&lt;c&gt;d')).toBe('a&b<c>d');
    expect(decodeEntities('&#65;&#x42;')).toBe('AB');
  });

  it('边界：未知实体原样保留', () => {
    expect(decodeEntities('&unknown;')).toBe('&unknown;');
  });
});
