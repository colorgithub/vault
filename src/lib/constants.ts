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

export const COLOR_STYLES: Record<
  MemoColor,
  { dot: string; card: string; ring: string }
> = {
  slate: {
    dot: "bg-slate-400",
    card: "bg-white dark:bg-slate-900",
    ring: "ring-slate-200 dark:ring-slate-800",
  },
  amber: {
    dot: "bg-amber-400",
    card: "bg-amber-50/70 dark:bg-amber-950/20",
    ring: "ring-amber-200 dark:ring-amber-900/50",
  },
  rose: {
    dot: "bg-rose-400",
    card: "bg-rose-50/70 dark:bg-rose-950/20",
    ring: "ring-rose-200 dark:ring-rose-900/50",
  },
  emerald: {
    dot: "bg-emerald-400",
    card: "bg-emerald-50/70 dark:bg-emerald-950/20",
    ring: "ring-emerald-200 dark:ring-emerald-900/50",
  },
  sky: {
    dot: "bg-sky-400",
    card: "bg-sky-50/70 dark:bg-sky-950/20",
    ring: "ring-sky-200 dark:ring-sky-900/50",
  },
  violet: {
    dot: "bg-violet-400",
    card: "bg-violet-50/70 dark:bg-violet-950/20",
    ring: "ring-violet-200 dark:ring-violet-900/50",
  },
  lime: {
    dot: "bg-lime-400",
    card: "bg-lime-50/70 dark:bg-lime-950/20",
    ring: "ring-lime-200 dark:ring-lime-900/50",
  },
};

export const MAX_MEMO_LENGTH = 100_000;
export const MAX_TITLE_LENGTH = 200;
