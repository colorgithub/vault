/**
 * 站内回跳路径校验。
 *
 * 只接受以单个 `/` 开头的相对路径：
 * - `//evil.com` 会被浏览器当成协议相对 URL，必须拒绝
 * - `/\evil.com` 在部分浏览器里等价于 `//evil.com`
 * - 任何绝对 URL（http://、javascript: 等）一律拒绝
 *
 * 纯函数、无 Node 依赖，服务端与客户端都能导入。
 */
export function safeReturnPath(
  raw: string | null | undefined,
  fallback = "/vault",
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.startsWith("/\\")) return fallback;
  // 控制字符可能被用于绕过上面的判断
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
