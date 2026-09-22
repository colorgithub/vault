import { handler, ok } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 登出只操作会话 Cookie，不碰数据库。
 *
 * 必须显式关闭 requireDb：否则数据库不可用时登出会失败，Cookie 清不掉，
 * 用户被卡在「已登录但什么都做不了」的状态里，连退出的办法都没有。
 */
export const POST = handler(
  async () => {
    await clearSessionCookie();
    return ok({ success: true });
  },
  { requireDb: false },
);
