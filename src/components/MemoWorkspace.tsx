"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  IconCheck,
  IconEye,
  IconMemo,
  IconPencil,
  IconPin,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@/components/Icons";
import { toast } from "@/components/Toast";
import { apiFetch, cn, relativeTime } from "@/lib/client";
import { COLOR_STYLES, MEMO_COLORS, type MemoColor } from "@/lib/constants";
import type { Memo } from "@/lib/types";

interface Draft {
  id: string;
  title: string;
  content: string;
  color: MemoColor;
  pinned: boolean;
}

function sortMemos(list: Memo[]): Memo[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function MemoWorkspace({
  memos,
  setMemos,
}: {
  memos: Memo[];
  setMemos: React.Dispatch<React.SetStateAction<Memo[]>>;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState(false);
  const [html, setHtml] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);
  const memosRef = useRef(memos);
  memosRef.current = memos;

  /* ------------------------------ 过滤 ------------------------------ */
  // 正在编辑的内容直接覆盖到列表上，这样打字时左侧标题/摘要会实时跟着变，
  // 而不是等自动保存回来后才有反馈。
  const displayMemos = useMemo(() => {
    if (!draft) return memos;
    return memos.map((m) =>
      m.id === draft.id
        ? {
            ...m,
            title: draft.title,
            content: draft.content,
            color: draft.color,
            pinned: draft.pinned,
          }
        : m,
    );
  }, [memos, draft]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return displayMemos;
    return displayMemos.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q),
    );
  }, [displayMemos, query]);

  /* --------------------------- 选中备忘录 --------------------------- */
  const selectMemo = useCallback(
    (memo: Memo) => {
      setPreview(false);
      setSelectedId(memo.id);
      setDraft({
        id: memo.id,
        title: memo.title,
        content: memo.content,
        color: (memo.color as MemoColor) ?? "slate",
        pinned: memo.pinned,
      });
      setStatus("idle");
    },
    [],
  );

  useEffect(() => {
    if (selectedId || memos.length === 0) return;
    // 宽屏时默认打开第一条
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      selectMemo(memos[0]);
    }
  }, [memos, selectedId, selectMemo]);

  /* ----------------------------- 自动保存 ---------------------------- */
  const persist = useCallback(
    async (next: Draft) => {
      const original = memosRef.current.find((m) => m.id === next.id);
      if (!original) return;
      const unchanged =
        original.title === next.title &&
        original.content === next.content &&
        original.color === next.color &&
        original.pinned === next.pinned;
      if (unchanged) {
        setStatus("saved");
        return;
      }

      setStatus("saving");
      try {
        const res = await apiFetch<{ memo: Memo }>(`/api/memos/${next.id}`, {
          method: "PATCH",
          json: {
            title: next.title,
            content: next.content,
            color: next.color,
            pinned: next.pinned,
          },
        });
        const saved = res.memo;
        setMemos((prev) =>
          sortMemos(prev.map((m) => (m.id === saved.id ? saved : m))),
        );
        setStatus("saved");
      } catch (err) {
        setStatus("idle");
        toast(err instanceof Error ? err.message : "保存失败", "error");
      }
    },
    [setMemos],
  );

  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => void persist(draft), 700);
    return () => clearTimeout(timer);
  }, [draft, persist]);

  // 离开页面前尽量把未落盘的内容存下
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && draft) void persist(draft);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [draft, persist]);

  /* ----------------------------- 增删操作 ---------------------------- */
  async function createMemo() {
    setCreating(true);
    try {
      const res = await apiFetch<{ memo: Memo }>("/api/memos", {
        method: "POST",
        json: { title: "无标题备忘", content: "" },
      });
      setMemos((prev) => sortMemos([res.memo, ...prev]));
      selectMemo(res.memo);
      setQuery("");
      requestAnimationFrame(() => {
        titleRef.current?.focus();
        titleRef.current?.select();
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "新建失败", "error");
    } finally {
      setCreating(false);
    }
  }

  async function deleteMemo(id: string) {
    if (!window.confirm("确定要删除这条备忘录吗？该操作不可撤销。")) return;
    try {
      await apiFetch(`/api/memos/${id}`, { method: "DELETE" });
      setMemos((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setDraft(null);
      }
      toast("已删除");
    } catch (err) {
      toast(err instanceof Error ? err.message : "删除失败", "error");
    }
  }

  /* --------------------------- Markdown 预览 -------------------------- */
  useEffect(() => {
    if (!preview || !draft) {
      setHtml("");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [markedMod, purifyMod] = await Promise.all([
          import("marked"),
          import("dompurify"),
        ]);
        const raw = await markedMod.marked.parse(draft.content);
        const clean = purifyMod.default.sanitize(raw);
        if (alive) setHtml(clean);
      } catch {
        if (alive) setHtml("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [preview, draft]);

  const isEmpty = memos.length === 0;

  return (
    <div className="flex min-h-0 flex-1">
      {/* ------------------------------ 列表 ------------------------------ */}
      <section
        className={cn(
          "flex w-full min-w-0 flex-col border-r border-slate-200 bg-white lg:w-[22rem] lg:shrink-0 dark:border-slate-800 dark:bg-slate-900",
          selectedId && "hidden lg:flex",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
          <div className="relative flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="field py-2 pl-9 text-sm"
              placeholder="搜索备忘录…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={createMemo}
            disabled={creating}
            className="btn-primary shrink-0 px-3 py-2"
            title="新建备忘录"
          >
            <IconPlus className="size-[18px]" />
          </button>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2.5">
          {isEmpty ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-950/50 dark:text-brand-300">
                <IconMemo className="size-7" />
              </span>
              <p className="text-sm font-medium">还没有备忘录</p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                点右上角的 + 写点什么吧，
                <br />
                内容会自动保存。
              </p>
              <button type="button" onClick={createMemo} className="btn-primary mt-1">
                <IconPlus className="size-4" />
                新建备忘录
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              没有匹配「{query}」的内容
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((memo) => {
                const color = (memo.color as MemoColor) ?? "slate";
                const active = memo.id === selectedId;
                return (
                  <li key={memo.id}>
                    <button
                      type="button"
                      onClick={() => selectMemo(memo)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition",
                        active
                          ? "border-brand-200 bg-brand-50/70 ring-1 ring-brand-200 dark:border-brand-800 dark:bg-brand-950/40 dark:ring-brand-900"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            COLOR_STYLES[color]?.dot ?? COLOR_STYLES.slate.dot,
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {memo.title.trim() || "无标题备忘"}
                        </span>
                        {memo.pinned && (
                          <IconPin className="size-3.5 shrink-0 text-amber-500" />
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {memo.content.trim() || "（暂无内容）"}
                      </p>
                      <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                        {relativeTime(memo.updatedAt)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ------------------------------ 编辑器 ----------------------------- */}
      <section
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50/60 dark:bg-slate-950/40",
          !selectedId && "hidden lg:flex",
        )}
      >
        {!draft ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <span className="grid size-16 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <IconPencil className="size-7" />
              </span>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                选择左侧的一条备忘录开始编辑
              </p>
              <p className="text-xs text-slate-400">
                或者点击「+」新建一条
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 工具栏 */}
            <div className="glass flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
              <button
                type="button"
                className="btn-ghost px-2.5 py-2 lg:hidden"
                onClick={() => {
                  if (draft) void persist(draft);
                  setSelectedId(null);
                  setDraft(null);
                }}
              >
                ← 返回
              </button>

              <span
                className={cn(
                  "ml-1 hidden items-center gap-1.5 text-xs font-medium sm:inline-flex",
                  status === "saving"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {status === "saving" ? (
                  <>
                    <span className="size-3 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
                    保存中…
                  </>
                ) : (
                  <>
                    <IconCheck className="size-3.5" />
                    已自动保存
                  </>
                )}
              </span>

              <div className="ml-auto flex items-center gap-1.5">
                {/* 颜色 */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 px-2 py-1.5 dark:bg-slate-800/70">
                  {MEMO_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={`颜色：${c}`}
                      aria-label={`颜色：${c}`}
                      onClick={() => setDraft((d) => (d ? { ...d, color: c } : d))}
                      className={cn(
                        "size-4 rounded-full transition",
                        COLOR_STYLES[c].dot,
                        draft.color === c
                          ? "scale-110 ring-2 ring-slate-400 ring-offset-1 ring-offset-slate-100 dark:ring-slate-500 dark:ring-offset-slate-800"
                          : "opacity-60 hover:opacity-100",
                      )}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  title={draft.pinned ? "取消置顶" : "置顶"}
                  onClick={() =>
                    setDraft((d) => (d ? { ...d, pinned: !d.pinned } : d))
                  }
                  className={cn(
                    "btn p-2",
                    draft.pinned
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                      : "btn-ghost",
                  )}
                >
                  <IconPin className="size-[18px]" />
                </button>

                <button
                  type="button"
                  title={preview ? "编辑" : "预览 Markdown"}
                  onClick={() => setPreview((v) => !v)}
                  className={cn("btn p-2", preview ? "btn-primary" : "btn-ghost")}
                >
                  {preview ? (
                    <IconPencil className="size-[18px]" />
                  ) : (
                    <IconEye className="size-[18px]" />
                  )}
                </button>

                <button
                  type="button"
                  title="删除"
                  onClick={() => void deleteMemo(draft.id)}
                  className="btn-danger p-2"
                >
                  <IconTrash className="size-[18px]" />
                </button>
              </div>
            </div>

            {/* 编辑区 */}
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
                <input
                  ref={titleRef}
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, title: e.target.value } : d))
                  }
                  placeholder="标题"
                  maxLength={200}
                  className="w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
                <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  创建于 {new Date(
                    memos.find((m) => m.id === draft.id)?.createdAt ?? Date.now(),
                  ).toLocaleString("zh-CN")}
                  {" · "}
                  {draft.content.length} 字符
                </p>

                <div className="my-5 h-px bg-slate-200 dark:bg-slate-800" />

                {preview ? (
                  <article
                    className="prose-memo space-y-3 text-[15px] leading-7"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ) : (
                  <textarea
                    value={draft.content}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, content: e.target.value } : d))
                    }
                    placeholder={"开始记录…\n\n支持 Markdown 语法，点右上角眼睛图标可预览。"}
                    className="min-h-[52vh] w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-7 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    spellCheck={false}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
