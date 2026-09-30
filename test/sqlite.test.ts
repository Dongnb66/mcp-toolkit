import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { querySqlite, SQLITE_ROOT_ENV } from '../src/lib/sqlite.js';

// 与 src/lib/sqlite.ts 同理：node:sqlite 不在 builtinModules 清单，用 createRequire 加载
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite') as {
  DatabaseSync: typeof import('node:sqlite').DatabaseSync;
};

let dir: string;
let dbPath: string;
const prevRoot = process.env[SQLITE_ROOT_ENV];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mcp-toolkit-'));
  // dbPath 边界：把临时目录设为唯一允许的根，否则临时路径会被越界检查拦下
  process.env[SQLITE_ROOT_ENV] = dir;
  dbPath = join(dir, 'test.db');
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT)');
  db.exec("INSERT INTO users(name) VALUES ('alice'), ('bob')");
  db.close();
});

afterAll(() => {
  if (prevRoot === undefined) delete process.env[SQLITE_ROOT_ENV];
  else process.env[SQLITE_ROOT_ENV] = prevRoot;
  rmSync(dir, { recursive: true, force: true });
});

describe('querySqlite 只读查询', () => {
  it('正常：SELECT 返回列与行', () => {
    const r = querySqlite(dbPath, 'SELECT * FROM users ORDER BY id');
    expect(r.columns).toEqual(['id', 'name']);
    expect(r.rowCount).toBe(2);
    expect(r.rows[0]).toEqual({ id: 1, name: 'alice' });
  });

  it('正常：带位置参数查询', () => {
    const r = querySqlite(dbPath, 'SELECT name FROM users WHERE id = ?', [2]);
    expect(r.rows).toEqual([{ name: 'bob' }]);
  });

  it('边界：无匹配返回空结果', () => {
    const r = querySqlite(dbPath, 'SELECT * FROM users WHERE id = 999');
    expect(r.rowCount).toBe(0);
    expect(r.columns).toEqual([]);
  });

  it('非法：拒绝写操作', () => {
    expect(() => querySqlite(dbPath, 'DELETE FROM users')).toThrow(/只读/);
    expect(() => querySqlite(dbPath, "INSERT INTO users(name) VALUES ('c')")).toThrow(/只读/);
    expect(() => querySqlite(dbPath, "UPDATE users SET name = 'x'")).toThrow(/只读/);
  });

  it('非法：不存在的数据库抛错', () => {
    expect(() => querySqlite(join(dir, 'nope.db'), 'SELECT 1')).toThrow();
  });

  it('非法：绝对路径越界被拒（本机任意 sqlite 不可读）', () => {
    expect(() => querySqlite(join(tmpdir(), 'outside.db'), 'SELECT 1')).toThrow(/越界/);
    expect(() => querySqlite('/etc/hosts', 'SELECT 1')).toThrow(/越界|不存在/);
  });

  it('非法：用 .. 向上穿越被拒', () => {
    const escape = join(dir, '..', '..', 'escape.db');
    expect(() => querySqlite(escape, 'SELECT 1')).toThrow(/越界|不存在/);
  });
});
