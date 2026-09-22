export const MEMO_COLORS = [
  "slate",
  "amber",
  "rose",
  "emerald",
  "sky",
  "violet",
  "lime",
] as const;

export type MemoColor = (typeof MEMO_COLORS)[number];

export function isMemoColor(value: unknown): value is MemoColor {
  return (
    typeof value === "string" &&
    (MEMO_COLORS as readonly string[]).includes(value)
  );
}

/**
 * 颜色只以一个小圆点呈现，不给卡片上底色，
 * 保持整体界面的克制。slate 表示「无标签」。
 */
export const COLOR_STYLES: Record<MemoColor, { dot: string }> = {
  slate: { dot: "bg-slate-300 dark:bg-slate-600" },
  amber: { dot: "bg-amber-400" },
  rose: { dot: "bg-rose-400" },
  emerald: { dot: "bg-emerald-400" },
  sky: { dot: "bg-sky-400" },
  violet: { dot: "bg-violet-400" },
  lime: { dot: "bg-lime-400" },
};

export const MAX_MEMO_LENGTH = 100_000;
export const MAX_TITLE_LENGTH = 200;

/**
 * 备忘录列表分页参数。
 *
 * 放在这里而不是路由文件里：Next.js 的 route.ts 只允许导出 HTTP 方法等固定名称，
 * 多导出一个常量会让生成的类型校验失败。
 */
export const DEFAULT_MEMO_LIMIT = 300;
export const MAX_MEMO_LIMIT = 500;
