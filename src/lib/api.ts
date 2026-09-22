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

export interface HandlerOptions {
  /**
   * 是否在执行业务逻辑前确保表结构存在。默认 true。
   *
   * 纯会话类路由（登出、读取当前用户）不碰数据库，必须显式传 false：否则数据库一旦
   * 不可用，用户会连登出都做不到 —— 拿到 500 且 Cookie 未被清除，而 /login 又会因为
   * 会话仍然有效把人重新弹回 /vault。
   */
  requireDb?: boolean;
}

/**
 * 包裹路由处理器：自动建表 + 统一异常处理。
 *
 * 非 ApiError 一律返回通用文案，绝不把 err.message 回显给客户端 —— 驱动的报错里可能
 * 带着完整的数据库连接串（含密码）。
 */
export function handler<Ctx>(
  fn: (req: Request, ctx: Ctx) => Promise<Response>,
  options: HandlerOptions = {},
): (req: Request, ctx: Ctx) => Promise<Response> {
  const { requireDb = true } = options;

  return async (req, ctx) => {
    try {
      if (requireDb) await ensureSchema();
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.message, err.status);

      let path = "(unknown)";
      try {
        path = new URL(req.url).pathname;
      } catch {
        /* 保底：req.url 异常时仍要能打日志 */
      }
      console.error("[api]", req.method, path, err);

      // 唯一需要透传给用户的内部错误：没配置数据库时给出可操作的排查提示。
      if (err instanceof Error && err.message === "NO_DATABASE_URL") {
        const { found, hint } = diagnoseEnv();
        return fail(
          `服务端未检测到数据库连接串。${hint}（当前环境里与数据库相关的变量：${
            found.length ? found.join("、") : "一个都没有"
          }）`,
          500,
        );
      }

      return fail("服务器内部错误，请稍后重试", 500);
    }
  };
}

/** 取当前登录用户，未登录直接抛 401 */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiError("未登录或登录已过期", 401);
  return session;
}

/**
 * 读取 JSON 请求体，并保证它是一个对象。
 *
 * 只做 JSON.parse 是不够的：请求体为字面量 `null` 时 `req.json()` 会成功返回 null，
 * 随后 `body.email` 之类的属性访问会抛 TypeError，被 handler 兜成 500 并回显内部报错。
 */
export async function readJson<T extends object>(req: Request): Promise<T> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    throw new ApiError("请求体不是合法的 JSON", 400);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError("请求体必须是一个 JSON 对象", 400);
  }
  return parsed as T;
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * 读取一个可选的整数参数。
 *
 * 与 clamp 的区别在于：未提供时用 fallback，提供了但非法就报错。静默改写用户的输入
 * 会让前端以为设置生效了，实际存的是别的值。
 */
export function optionalInt(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    throw new ApiError(`${field}需为 ${min}-${max} 之间的整数`);
  }
  return n;
}
