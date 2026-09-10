import { describe, it, expect } from 'vitest';
import {
  addDays,
  diffDays,
  weekdayCn,
  isLeapYear,
  daysInMonth,
  parseDate,
  formatDate,
  dateCalc,
} from '../src/lib/date.js';

describe('addDays 加减天数', () => {
  it('正常：加一天、减一天、跨年', () => {
    expect(addDays('2024-01-01', 1)).toBe('2024-01-02');
    expect(addDays('2024-01-01', -1)).toBe('2023-12-31');
  });

  it('边界：闰年 2 月', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
  });

  it('非法：非整数天数抛错', () => {
    expect(() => addDays('2024-01-01', 1.5)).toThrow(/整数/);
  });
});

describe('diffDays 日期差', () => {
  it('正常：正负方向', () => {
    expect(diffDays('2024-01-01', '2024-01-10')).toBe(9);
    expect(diffDays('2024-01-10', '2024-01-01')).toBe(-9);
  });

  it('边界：同一天为 0', () => {
    expect(diffDays('2024-01-01', '2024-01-01')).toBe(0);
  });
});

describe('weekday / 闰年 / 当月天数', () => {
  it('正常', () => {
    expect(weekdayCn('2024-01-01')).toBe('周一');
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false); // 整百年非闰
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
  });
});

describe('parseDate / formatDate', () => {
  it('非法日期抛错', () => {
    expect(() => parseDate('2024-13-01')).toThrow();
    expect(() => parseDate('2024-02-30')).toThrow();
    expect(() => parseDate('abc')).toThrow();
  });

  it('正常往返', () => {
    expect(formatDate(parseDate('2024-05-06'))).toBe('2024-05-06');
  });
});

describe('dateCalc 分发入口', () => {
  it('正常', () => {
    expect(dateCalc('add_days', { date: '2024-01-01', days: 1 })).toBe('2024-01-02');
    expect(dateCalc('weekday', { date: '2024-01-01' })).toBe('周一');
    expect(dateCalc('today', {})).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('非法：缺少必填参数抛错', () => {
    expect(() => dateCalc('add_days', { days: 1 })).toThrow(/date/);
    expect(() => dateCalc('days_in_month', { year: 2024, month: 0 })).toThrow();
  });
});
