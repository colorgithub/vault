"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  IconCheck,
  IconClose,
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
import {
  COLOR_STYLES,
  MAX_MEMO_LENGTH,
  MEMO_COLORS,
  type MemoColor,
} from "@/lib/constants";
import type { Memo } from "@/lib/types";

interface Draft {
  id: string;
  title: string;
  content: string;
  color: MemoColor;
  pinned: boolean;
}

/** 参与「是否需要保存」判断的字段集合 */
type MemoSnapshot = Pick<Draft, "title" | "content" | "color" | "pinned">;

type SaveStatus = "idle" | "saving" | "saved" | "error";

function sortMemos(list: Memo[]): Memo[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function MemoWorkspace({
  memos,
  setMemos,
  total,
  onLoadMore,
  loadingMore,
}: {
  memos: Memo[];
  setMemos: React.Dispatch<React.SetStateAction<Memo[]>>;
  /** 服务端总条数，用于提示还有多少条未加载 */
  total?: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState(false);
  const [html, setHtml] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);
  const memosRef = useRef(memos);
  memosRef.current = memos;

  /** 当前 draft 的实时引用，供事件回调与卸载清理读取（避免闭包过期） */
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;

  /** 最近一次成功写入服务端的内容（每个 memo 一份），用于避免重复写入 */
  const writtenRef = useRef<Map<string, MemoSnapshot>>(new Map());
  /** persist 的实时引用，供 selectMemo / 卸载清理调用 */
  const persistRef = useRef<(next: Draft) => Promise<void>>(async () => {});
  /** 已被删除的 memo id，避免对已删除记录继续发 PATCH */
  const deletedRef = useRef<Set<string>>(new Set());

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
      // 切走之前先把上一条未落盘的改动补存，否则 700ms 防抖会被 cleanup 取消，
      // 编辑内容静默丢失。
      const previous = draftRef.current;
      if (previous && previous.id !== memo.id) {
        void persistRef.current(previous);
      }
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

  /**
   * 每条备忘录一个「合并写入」队列。
   *
   * 之前的实现有两个互相纠缠的缺陷：
   *   1. 用「已确认落盘」的内容当比较基线。请求在途时基线是旧的，用户把内容改回
   *      原值就会被误判成「未变化」而跳过 —— 而服务端其实会先落盘中间那个值，
   *      结果最终内容永远写不进去。
   *   2. 允许同一 memo 的多个 PATCH 并发，响应乱序时旧内容会盖掉新内容。
   *
   * 这里改成：把「用户最新想要的内容」记在 desired 里，同一 memo 同时只跑一条写入
   * 循环；每次写完再回头看 desired 是否又变了，变了就继续写。既不会丢最终值，
   * 也不存在并发请求，乱序覆盖自然消失。
   */
  const desiredRef = useRef<Map<string, MemoSnapshot>>(new Map());
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());

  const sameSnapshot = (a: MemoSnapshot | undefined, b: MemoSnapshot) =>
    !!a &&
    a.title === b.title &&
    a.content === b.content &&
    a.color === b.color &&
    a.pinned === b.pinned;

  const persist = useCallback(async (next: Draft) => {
    if (deletedRef.current.has(next.id)) return;

    const snapshot: MemoSnapshot = {
      title: next.title,
      content: next.content,
      color: next.color,
      pinned: next.pinned,
    };
    desiredRef.current.set(next.id, snapshot);

    // 已有写入循环在跑：它会自己发现 desired 变了，这里直接返回
    const running = inflightRef.current.get(next.id);
    if (running) return running;

    const id = next.id;
    const loop = (async () => {
      let failed = false;
      for (;;) {
        const target = desiredRef.current.get(id);
        if (!target || deletedRef.current.has(id)) break;
        // 目标内容已经写过了，收工
        if (sameSnapshot(writtenRef.current.get(id), target)) break;

        setStatus("saving");
        try {
          const res = await apiFetch<{ memo: Memo }>(`/api/memos/${id}`, {
            method: "PATCH",
            json: target,
          });
          // 同一 memo 同时只有一条写入循环，响应不可能乱序，可以安全回写列表
          const saved = res.memo;
          setMemos((prev) =>
            sortMemos(prev.map((m) => (m.id === saved.id ? saved : m))),
          );
        } catch (err) {
          // 保存失败必须显示为失败，不能继续挂「已保存」的对勾。
          // 清掉 desired，让下一次编辑能重新发起写入（而不是被当成「已写过」）。
          failed = true;
          setStatus("error");
          toast(err instanceof Error ? err.message : "保存失败", "error");
          desiredRef.current.delete(id);
          break;
        }
        writtenRef.current.set(id, target);

        // 写入期间用户又改了内容，就继续下一轮；否则收工
        if (sameSnapshot(desiredRef.current.get(id), target)) {
          desiredRef.current.delete(id);
          break;
        }
      }
      inflightRef.current.delete(id);
      // 失败时保留错误状态，别让收尾逻辑把「保存失败」又盖成「已保存」
      if (!failed && !deletedRef.current.has(id)) setStatus("saved");
    })();

    inflightRef.current.set(id, loop);
    return loop;
  }, []);

  persistRef.current = persist;

  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => void persist(draft), 700);
    return () => clearTimeout(timer);
  }, [draft, persist]);

  /**
   * 卸载时把未落盘的改动补存一次。
   *
   * 这是「切到验证器标签页 → MemoWorkspace 被卸载 → 700ms 防抖被 clearTimeout」
   * 这条静默丢数据路径的兜底。卸载时 effect cleanup 拿不到最新的 draft，
   * 所以走 ref。
   */
  useEffect(() => {
    return () => {
      const pending = draftRef.current;
      if (pending) void persistRef.current(pending);
    };
  }, []);

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
      // 标记为已删除，避免在途 / 待触发的自动保存对着已删除的记录发 PATCH（会拿到 404）
      deletedRef.current.add(id);
      desiredRef.current.delete(id);
      writtenRef.current.delete(id);
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
  const remaining = (total ?? memos.length) - memos.length;
  const hasMore = remaining > 0;

  return (
    <div className="flex min-h-0 flex-1">
      {/* ------------------------------ 列表 ------------------------------ */}
      <section
        className={cn(
          "flex w-full min-w-0 flex-col border-r border-slate-200 lg:w-80 lg:shrink-0 dark:border-slate-800",
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
            <div className="flex flex-col items-center gap-2.5 px-6 py-16 text-center">
              <IconMemo className="size-5 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                还没有备忘录
              </p>
              <button
                type="button"
                onClick={createMemo}
                className="btn-outline mt-1"
              >
                新建一条
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
                        "w-full rounded-lg px-3 py-2.5 text-left transition",
                        active
                          ? "bg-slate-100 dark:bg-slate-800"
                          : "hover:bg-slate-50 dark:hover:bg-slate-900",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            COLOR_STYLES[color]?.dot ?? COLOR_STYLES.slate.dot,
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {memo.title.trim() || "无标题备忘"}
                        </span>
                        {memo.pinned && (
                          <IconPin className="size-3 shrink-0 text-slate-400 dark:text-slate-500" />
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                        {memo.content.trim() || "（暂无内容）"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-600">
                        {relativeTime(memo.updatedAt)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* 分页：超过单页上限时给出明确入口，而不是让多余的数据无声消失 */}
          {hasMore && onLoadMore && (
            <div className="px-1 pb-1 pt-3">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="btn-outline w-full py-2 text-xs"
              >
                {loadingMore
                  ? "加载中…"
                  : `加载更多（还有 ${Math.max(0, remaining)} 条）`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------ 编辑器 ----------------------------- */}
      <section
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          !selectedId && "hidden lg:flex",
        )}
      >
        {!draft ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div className="flex flex-col items-center gap-2.5">
              <IconPencil className="size-5 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-400 dark:text-slate-500">
                选择左侧的一条备忘录
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 工具栏 */}
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
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

              <span className="ml-1 hidden items-center gap-1.5 text-xs sm:inline-flex">
                {status === "saving" ? (
                  <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <span className="size-3 animate-spin rounded-full border-[1.5px] border-slate-300 border-t-slate-500 dark:border-slate-700 dark:border-t-slate-400" />
                    保存中
                  </span>
                ) : status === "error" ? (
                  <span className="flex items-center gap-1.5 text-rose-500">
                    <IconClose className="size-3.5" />
                    保存失败
                  </span>
                ) : status === "saved" ? (
                  <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <IconCheck className="size-3.5" />
                    已保存
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-300 dark:text-slate-600">
                    <IconPencil className="size-3.5" />
                    未修改
                  </span>
                )}
              </span>

              <div className="ml-auto flex items-center gap-0.5">
                {/* 颜色：只留小圆点，去掉容器底色 */}
                <div className="mr-1 hidden items-center gap-1.5 sm:flex">
                  {MEMO_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={`颜色：${c}`}
                      aria-label={`颜色：${c}`}
                      onClick={() => setDraft((d) => (d ? { ...d, color: c } : d))}
                      className={cn(
                        "size-3 rounded-full transition",
                        COLOR_STYLES[c].dot,
                        draft.color === c
                          ? "ring-1 ring-slate-400 ring-offset-1 ring-offset-white dark:ring-slate-500 dark:ring-offset-slate-950"
                          : "opacity-50 hover:opacity-100",
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
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      : "btn-ghost",
                  )}
                >
                  <IconPin className="size-4" />
                </button>

                <button
                  type="button"
                  title={preview ? "编辑" : "预览 Markdown"}
                  onClick={() => setPreview((v) => !v)}
                  className={cn(
                    "btn p-2",
                    preview
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      : "btn-ghost",
                  )}
                >
                  {preview ? (
                    <IconPencil className="size-4" />
                  ) : (
                    <IconEye className="size-4" />
                  )}
                </button>

                <button
                  type="button"
                  title="删除"
                  onClick={() => void deleteMemo(draft.id)}
                  className="btn-danger p-2"
                >
                  <IconTrash className="size-4" />
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
                    maxLength={MAX_MEMO_LENGTH}
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
