// lib/date.ts —— 日期计算（纯函数版）
//
// 全部按 UTC 午夜解析 YYYY-MM-DD，规避夏令时/时区导致的跨日误差。
// 非法输入抛中文可读错误，便于 MCP 工具直接把错误透传回给调用方。

export type DateOp = 'add_days' | 'diff_days' | 'weekday' | 'days_in_month' | 'is_leap_year' | 'today';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 严格解析 YYYY-MM-DD，返回 UTC 午夜 Date；非法日期抛错 */
export function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) throw new Error(`日期格式必须为 YYYY-MM-DD，收到：${s}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new Error(`非法日期：${s}`);
  }
  return d;
}

/** 格式化为 YYYY-MM-DD */
export function formatDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}-` +
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getUTCDate()).padStart(2, '0')}`
  );
}

/** 日期加天数（可为负） */
export function addDays(dateStr: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error('days 必须是整数');
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

/** 两个日期相差天数（to - from） */
export function diffDays(from: string, to: string): number {
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** 返回中文星期几 */
export function weekdayCn(dateStr: string): string {
  return WEEKDAYS[parseDate(dateStr).getUTCDay()];
}

export function isLeapYear(year: number): boolean {
  if (!Number.isInteger(year)) throw new Error('year 必须是整数');
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year)) throw new Error('year 必须是整数');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('month 必须在 1-12 之间');
  // 下月第 0 天 = 本月最后一天
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function today(): string {
  return formatDate(new Date());
}

function requireArg(args: Record<string, unknown>, key: string, op: string): string {
  const v = args[key];
  if (v === undefined || v === null || v === '') throw new Error(`${op} 需要 ${key} 参数`);
  return String(v);
}

/** 统一分发入口，供 MCP 工具薄壳调用 */
export function dateCalc(op: DateOp, args: Record<string, unknown>): unknown {
  switch (op) {
    case 'add_days':
      return addDays(requireArg(args, 'date', op), Number(requireArg(args, 'days', op)));
    case 'diff_days':
      return diffDays(requireArg(args, 'from', op), requireArg(args, 'to', op));
    case 'weekday':
      return weekdayCn(requireArg(args, 'date', op));
    case 'days_in_month':
      return daysInMonth(Number(requireArg(args, 'year', op)), Number(requireArg(args, 'month', op)));
    case 'is_leap_year':
      return isLeapYear(Number(requireArg(args, 'year', op)));
    case 'today':
      return today();
    default:
      throw new Error(`未知操作：${op}`);
  }
}
