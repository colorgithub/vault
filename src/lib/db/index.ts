import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { BOOTSTRAP_SQL } from "./bootstrap-sql";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    "[memo-vault] 未检测到 DATABASE_URL 环境变量，数据库相关接口将不可用。",
  );
}

/**
 * serverless 环境下连接数很宝贵：
 * - max: 1        每个函数实例最多一条连接
 * - prepare: false 兼容 PgBouncer / Supabase / Neon 连接池模式
 * - idle_timeout   空闲后尽快释放
 */
const globalForDb = globalThis as unknown as {
  __memoVaultSql?: ReturnType<typeof postgres>;
  __memoVaultReady?: Promise<void>;
};

function createClient() {
  return postgres(connectionString as string, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
}

export const sql = globalForDb.__memoVaultSql ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__memoVaultSql = sql;
}

export const db = drizzle(sql, { schema });

/** 幂等建表，带缓存，失败时允许下次重试。 */
export function ensureSchema(): Promise<void> {
  if (!connectionString) {
    return Promise.reject(new Error("缺少 DATABASE_URL 环境变量"));
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
