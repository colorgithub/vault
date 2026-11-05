/**
 * 自定义服务器：Next.js + WebSocket。
 *
 * 为什么需要它：App Router 的 Route Handler 拿不到原始 socket，做不了协议升级；
 * 而 Vercel 的 Serverless 也不支持长连接。所以：
 *
 *   - 自托管（node server.mjs / Docker / 自己的 VPS）→ 走 WebSocket，改动秒级推送
 *   - Vercel 部署 → 没有 /api/ws，客户端自动退回轮询（功能不受影响）
 *
 * 鉴权：客户端连上来时带 `Authorization: Bearer <账号 API 密钥>`（浏览器也可用
 * `?key=`）。服务器不直接读库，而是拿这个密钥去问自己的 /api/whoami —— 鉴权逻辑
 * 只有一处，不会出现两边不一致。
 */

import { createServer } from "node:http";

import next from "next";
import { WebSocketServer } from "ws";

const dev = process.argv.includes("--dev");
const hostname = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
await app.prepare();

const handle = app.getRequestHandler();
const handleUpgrade = app.getUpgradeHandler();

/** userId -> Set<WebSocket> */
const clients = new Map();

const wss = new WebSocketServer({ noServer: true });

function register(userId, ws) {
  let set = clients.get(userId);
  if (!set) {
    set = new Set();
    clients.set(userId, set);
  }
  set.add(ws);
}

function unregister(userId, ws) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) clients.delete(userId);
}

/**
 * 供 Next 的 Route Handler 调用（同一个进程，通过 globalThis 共享）。
 * 部署在 Vercel 时这里没有挂载，`?.` 会安全地变成空操作。
 */
globalThis.__memoVaultRealtime = {
  broadcast(userId, payload) {
    const set = clients.get(userId);
    if (!set || set.size === 0) return;
    const data = JSON.stringify(payload);
    for (const ws of set) {
      if (ws.readyState === ws.OPEN) ws.send(data);
    }
  },
};

function reject(socket, status, message) {
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** 问自己的 HTTP 接口，顺带把用户信息拿回来。 */
async function verifyKey(key) {
  const res = await fetch(`http://127.0.0.1:${port}/api/whoami`, {
    headers: { authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.user?.id ? body.user : null;
}

await app.prepare();

const server = createServer((req, res) => handle(req, res));

server.on("upgrade", async (req, socket, head) => {
  let pathname = "/";
  try {
    pathname = new URL(req.url ?? "/", `http://${req.headers.host}`).pathname;
  } catch {
    /* 解析不了就按非 WS 处理 */
  }

  // Next 自己的热更新通道交给它处理，别抢
  if (pathname !== "/api/ws") {
    handleUpgrade(req, socket, head);
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const key = bearerToken(req) ?? url.searchParams.get("key");
  if (!key) {
    reject(socket, 401, "Unauthorized");
    return;
  }

  let user = null;
  try {
    user = await verifyKey(key);
  } catch (err) {
    console.error("[ws] 鉴权请求失败", err);
  }
  if (!user) {
    reject(socket, 401, "Unauthorized");
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.userId = user.id;
    ws.isAlive = true;
    register(user.id, ws);

    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("close", () => unregister(user.id, ws));
    ws.on("error", () => unregister(user.id, ws));

    ws.send(JSON.stringify({ type: "ready", at: Date.now() }));
  });
});

// 30 秒心跳：干净的连接回 pong，没回的直接掐掉，避免半开连接占着
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* 已断开 */
    }
  }
}, 30_000);

wss.on("close", () => clearInterval(heartbeat));

server.listen(port, hostname, () => {
  console.log(
    `> MemoVault ready on http://${hostname}:${port} (${dev ? "dev" : "production"}) · ws://…/api/ws`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.close(1001, "server shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
