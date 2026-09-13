import { ok } from "@/lib/api";
import { connectionSource, diagnoseEnv, ensureSchema, sql as client } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 部署自检端点。
 * 访问 /api/health 可以确认数据库是否连通、连接串来自哪个环境变量。
 * 只输出变量名，绝不输出连接串内容。
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await ensureSchema();
    const rows = await client`select 1 as ok`;
    return ok({
      status: "ok",
      database: {
        connected: true,
        envVar: connectionSource,
        latencyMs: Date.now() - startedAt,
        rows: rows.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const { found, hint } = diagnoseEnv();
    return ok(
      {
        status: "error",
        database: {
          connected: false,
          envVar: connectionSource,
          error: err instanceof Error ? err.message : "未知错误",
          hint,
          relatedEnvVars: found,
        },
        timestamp: new Date().toISOString(),
      },
      503,
    );
  }
}
