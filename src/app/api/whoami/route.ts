import { handler, ok, fail, getReader } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * 用「会话 Cookie 或账号 API 密钥」换当前用户信息。
 *
 * 两个用途：
 * 1. WebSocket 服务器（server.mjs）拿它验证密钥并拿到 userId —— 鉴权逻辑只写在
 *    这里一处，WS 那条路径不必再碰数据库。
 * 2. 外部脚本自检：确认自己手里的密钥还有效。
 */
export const GET = handler(async (req: Request) => {
  const user = await getReader(req);
  if (!user) return fail("未授权：密钥无效或已被撤销", 401);

  return ok({
    user: { id: user.userId, email: user.email, name: user.name },
  });
});
