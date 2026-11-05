/**
 * 实时推送的「广播口」。
 *
 * 真正的 WebSocket 服务器在 server.mjs 里，它把 hub 挂到 globalThis 上；
 * 这里只做一件事：写操作完成后通知同一用户的连接。
 *
 * 注意：Vercel 上不存在 server.mjs，globalThis 上没有 hub —— 此时静默跳过，
 * 客户端靠轮询兜底，功能不受影响。
 */
export interface RealtimeHub {
  broadcast(userId: string, payload: unknown): void;
}

declare global {
  // eslint-disable-next-line no-var
  var __memoVaultRealtime: RealtimeHub | undefined;
}

/** 备忘录有变化（新建 / 修改 / 删除）时调用。 */
export function notifyMemosChanged(userId: string): void {
  const hub = globalThis.__memoVaultRealtime;
  if (!hub) return;

  try {
    hub.broadcast(userId, { type: "memos.changed", at: Date.now() });
  } catch {
    // 推送失败绝不能影响已经成功落库的写操作
  }
}
