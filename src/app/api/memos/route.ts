import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { ApiError, handler, ok, readJson, requireUser, str } from "@/lib/api";
import {
  DEFAULT_MEMO_LIMIT,
  isMemoColor,
  MAX_MEMO_LENGTH,
  MAX_MEMO_LIMIT,
  MAX_TITLE_LENGTH,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { memos } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function parseLimit(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MEMO_LIMIT;
  return Math.min(Math.floor(n), MAX_MEMO_LIMIT);
}

function parseOffset(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** 转义 ILIKE 的通配符，避免用户输入的 % 和 _ 被当作模式匹配 */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * 列出当前用户的备忘录。
 *
 * 额外返回 total / hasMore 供前端翻页。此前固定截断在 300 条且毫无提示，
 * 超出的备忘录在界面上完全不可达 —— 连「导出备份」也会一并漏掉。
 */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = parseLimit(url.searchParams.get("limit"));
  const offset = parseOffset(url.searchParams.get("offset"));

  const where = q
    ? and(
        eq(memos.userId, user.userId),
        sql`(${memos.title} ILIKE ${"%" + escapeLike(q) + "%"} ESCAPE '\\' OR ${memos.content} ILIKE ${"%" + escapeLike(q) + "%"} ESCAPE '\\')`,
      )
    : eq(memos.userId, user.userId);

  const rows = await db
    .select()
    .from(memos)
    .where(where)
    .orderBy(desc(memos.pinned), desc(memos.updatedAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memos)
    .where(where);
  const total = countRow?.count ?? rows.length;

  return ok({
    memos: rows,
    total,
    limit,
    offset,
    hasMore: offset + rows.length < total,
  });
});

/** 新建备忘录 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);

  const title = str(body.title).slice(0, MAX_TITLE_LENGTH);
  const content = str(body.content).slice(0, MAX_MEMO_LENGTH);
  const color = isMemoColor(body.color) ? body.color : "slate";

  if (!title.trim() && !content.trim())
    throw new ApiError("标题和内容不能同时为空");

  const now = new Date();
  const [row] = await db
    .insert(memos)
    .values({
      id: randomUUID(),
      userId: user.userId,
      title,
      content,
      color,
      pinned: body.pinned === true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return ok({ memo: row }, 201);
});
