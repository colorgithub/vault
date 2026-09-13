import { NextResponse } from "next/server";

import { getSession, type SessionPayload } from "@/lib/auth";
import { diagnoseEnv, ensureSchema } from "@/lib/db";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** 统一 JSON 响应 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 包裹路由处理器：自动建表 + 统一异常处理。
 */
export function handler<Ctx>(
  fn: (req: Request, ctx: Ctx) => Promise<Response>,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      await ensureSchema();
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.message, err.status);
      const message = err instanceof Error ? err.message : "服务器内部错误";
      console.error("[api]", req.method, new URL(req.url).pathname, err);

      if (message === "NO_DATABASE_URL") {
        const { found, hint } = diagnoseEnv();
        return fail(
          `服务端未检测到数据库连接串。${hint}（当前环境里与数据库相关的变量：${
            found.length ? found.join("、") : "一个都没有"
          }）`,
          500,
        );
      }

      return fail(message, 500);
    }
  };
}

/** 取当前登录用户，未登录直接抛 401 */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiError("未登录或登录已过期", 401);
  return session;
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError("请求体不是合法的 JSON", 400);
  }
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
