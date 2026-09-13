import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { ApiError, handler, ok, readJson, requireUser, str } from "@/lib/api";
import { isMemoColor, MAX_MEMO_LENGTH, MAX_TITLE_LENGTH } from "@/lib/constants";
import { db } from "@/lib/db";
import { memos } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function parseLimit(value: string | null, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), 500);
}

/** 转义 ILIKE 的通配符，避免用户输入的 % 和 _ 被当作模式匹配 */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** 列出当前用户的备忘录 */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = parseLimit(url.searchParams.get("limit"), 300);

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
    .limit(limit);

  return ok({ memos: rows });
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
