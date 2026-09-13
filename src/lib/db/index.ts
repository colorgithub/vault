import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { BOOTSTRAP_SQL } from "./bootstrap-sql";
import * as schema from "./schema";

/**
 * 解析数据库连接串。
 *
 * 之所以要做兜底链：在 Vercel 上「创建 / 连接数据库」有若干种方式，
 * 不同集成注入的环境变量名不一样：
 *
 *   - Vercel Marketplace 的 Neon 原生集成 → DATABASE_URL（默认，可自定义前缀）
 *   - 老版 Vercel Postgres 模板         → POSTGRES_URL 等 POSTGRES_* 系列
 *   - Prisma Postgres 集成              → POSTGRES_PRISMA_URL
 *   - 手动连接                          → DATABASE_URL 或零散的 PG* 变量
 *
 * 只要用户是按 Vercel 面板提示建的库，无论落在哪个命名上都能连上。
 */
const EXPLICIT_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL",
] as const;

function resolveConnection(): { url: string; key: string } | null {
  for (const key of EXPLICIT_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return { url: value, key };
  }

  // 自定义前缀（例如多数据库时的 PRIMARY_DATABASE_URL）
  const prefixed = Object.keys(process.env)
    .filter(
      (key) =>
        /_DATABASE_URL$/.test(key) &&
        !key.endsWith("_UNPOOLED") &&
        process.env[key]?.trim(),
    )
    .sort();
  if (prefixed.length > 0) {
    const key = prefixed[0];
    return { url: (process.env[key] as string).trim(), key };
  }

  // 最后尝试用零散的 PG* 变量拼装
  const host = process.env.PGHOST?.trim() ?? process.env.PGHOST_UNPOOLED?.trim();
  const user = process.env.PGUSER?.trim();
  const password = process.env.PGPASSWORD?.trim();
  const database = process.env.PGDATABASE?.trim();
  if (host && user && password && database) {
    const port = process.env.PGPORT?.trim() || "5432";
    return {
      url: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
        password,
      )}@${host}:${port}/${database}?sslmode=require`,
      key: "PGHOST/PGUSER/PGPASSWORD/PGDATABASE",
    };
  }

  return null;
}

const resolved = resolveConnection();
export const connectionSource = resolved?.key ?? null;
const connectionString = resolved?.url;

/** 列出环境里所有看起来和数据库有关的变量名，方便部署失败时排查 */
export function diagnoseEnv(): { found: string[]; hint: string } {
  const found = Object.keys(process.env)
    .filter((key) => /(DATABASE|POSTGRES|PGHOST|PGUSER|NEON)/.test(key))
    .sort();
  const hint =
    "在 Vercel 项目里打开 Storage（或 Integrations）→ 选中你的数据库 → Connect Project，" +
    "勾选 Production / Preview / Development 后重新部署。" +
    "连接成功后 Vercel 会自动注入 DATABASE_URL，无需手动填写。";
  return { found, hint };
}

/* -------------------------------------------------------------------------- */
/*                                  连接池                                     */
/* -------------------------------------------------------------------------- */

/**
 * serverless 环境下连接数很宝贵：
 * - max: 1          每个函数实例最多一条连接
 * - prepare: false  兼容 PgBouncer 连接池（Neon / Supabase / Vercel 集成都走它）
 * - idle_timeout    空闲后尽快释放
 */
const globalForDb = globalThis as unknown as {
  __memoVaultSql?: ReturnType<typeof postgres>;
  __memoVaultReady?: Promise<void>;
};

function createClient(url: string) {
  return postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
}

export const sql = globalForDb.__memoVaultSql ?? createClient(connectionString ?? "");
if (process.env.NODE_ENV !== "production") {
  globalForDb.__memoVaultSql = sql;
}

export const db = drizzle(sql, { schema });

/** 幂等建表，带缓存，失败时允许下次重试。 */
export function ensureSchema(): Promise<void> {
  if (!connectionString) {
    return Promise.reject(new Error("NO_DATABASE_URL"));
  }
  if (!globalForDb.__memoVaultReady) {
    globalForDb.__memoVaultReady = (async () => {
      // PG 13+ 自带 gen_random_uuid()；更老的版本需要 pgcrypto。
      try {
        await sql.unsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
      } catch {
        /* 权限不足也没关系，主键由应用层生成 uuid */
      }
      await sql.unsafe(BOOTSTRAP_SQL);
    })().catch((err) => {
      globalForDb.__memoVaultReady = undefined;
      throw err;
    });
  }
  return globalForDb.__memoVaultReady;
}

export { schema };
