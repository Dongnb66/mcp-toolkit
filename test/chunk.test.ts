import { describe, it, expect } from 'vitest';
import { chunkText, countChunks } from '../src/lib/chunk.js';

describe('chunkText 文本切块', () => {
  it('正常：短文本不切', () => {
    expect(chunkText('hello world')).toEqual(['hello world']);
  });

  it('正常：长文本按 chunkSize 切块', () => {
    const text = 'a'.repeat(1000);
    const chunks = chunkText(text, { chunkSize: 500, overlap: 0 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].length).toBe(500);
    expect(chunks[1].length).toBe(500);
  });

  it('正常：overlap 生效，相邻块有重叠', () => {
    const text = 'a'.repeat(100);
    const chunks = chunkText(text, { chunkSize: 40, overlap: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1][0]).toBe('a');
  });

  it('正常：优先在句末断点切割', () => {
    const text = '第一句话。第二句话。第三句话。';
    const chunks = chunkText(text, { chunkSize: 10, overlap: 0 });
    expect(chunks.every((c) => c.endsWith('。'))).toBe(true);
  });

  it('边界：空文本返回空数组', () => {
    expect(chunkText('')).toEqual([]);
    expect(countChunks('')).toBe(0);
  });

  it('非法：参数越界抛错', () => {
    expect(() => chunkText('x', { chunkSize: 0 })).toThrow();
    expect(() => chunkText('x', { chunkSize: 10, overlap: 10 })).toThrow(/小于/);
    expect(() => chunkText('x', { overlap: -1 })).toThrow();
    expect(() => chunkText('x', { chunkSize: 1.5 })).toThrow(/整数/);
  });
});
