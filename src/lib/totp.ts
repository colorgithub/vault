/**
 * 纯 Web Crypto 实现的 TOTP（RFC 6238），服务端与浏览器通用。
 * 不依赖任何第三方库，避免打包体积与 node:crypto 兼容问题。
 */

export type TotpAlgorithm = "SHA1" | "SHA256" | "SHA512";

export interface TotpParams {
  secret: string;
  algorithm?: string;
  digits?: number;
  period?: number;
}

export const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const DEFAULT_PERIOD = 30;
export const DEFAULT_DIGITS = 6;

/* ------------------------------- Base32 ---------------------------------- */

export function normalizeBase32(secret: string): string {
  return secret.replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
}

export function isValidBase32(secret: string): boolean {
  const clean = normalizeBase32(secret);
  return clean.length >= 8 && /^[A-Z2-7]+$/.test(clean);
}

export function base32Decode(secret: string): Uint8Array {
  const clean = normalizeBase32(secret);
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.floor((clean.length * 5) / 8));
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`密钥包含无效的 Base32 字符：${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return output;
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** 生成一个新的随机 Base32 密钥（默认 20 字节 = 160 bit，与 Google 一致） */
export function generateSecret(bytes = 20): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(bytes)));
}

/* --------------------------------- 工具 ---------------------------------- */

export function normalizeAlgorithm(input?: string): TotpAlgorithm {
  const value = (input ?? "").toUpperCase().replace(/[-_]/g, "");
  if (value === "SHA256") return "SHA256";
  if (value === "SHA512") return "SHA512";
  return "SHA1";
}

function webCryptoHash(algorithm: TotpAlgorithm): string {
  switch (algorithm) {
    case "SHA256":
      return "SHA-256";
    case "SHA512":
      return "SHA-512";
    default:
      return "SHA-1";
  }
}

export function clampDigits(digits?: number): number {
  const value = Number(digits);
  if (!Number.isFinite(value) || value < 4 || value > 10) return DEFAULT_DIGITS;
  return Math.floor(value);
}

export function clampPeriod(period?: number): number {
  const value = Number(period);
  if (!Number.isFinite(value) || value < 5 || value > 300) return DEFAULT_PERIOD;
  return Math.floor(value);
}

/* --------------------------------- TOTP ---------------------------------- */

/** 计算指定时间点的 TOTP 验证码 */
export async function generateTotp(
  params: TotpParams,
  timestampMs: number = Date.now(),
): Promise<string> {
  const digits = clampDigits(params.digits);
  const period = clampPeriod(params.period);
  const algorithm = normalizeAlgorithm(params.algorithm);
  const counter = Math.floor(timestampMs / 1000 / period);

  const keyBytes = base32Decode(params.secret);
  const message = new Uint8Array(8);
  let rest = counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = rest % 256;
    rest = Math.floor(rest / 256);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "HMAC", hash: webCryptoHash(algorithm) },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, message as unknown as BufferSource),
  );

  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

/** 距离下一次刷新还剩多少毫秒 */
export function totpRemainingMs(
  period: number = DEFAULT_PERIOD,
  timestampMs: number = Date.now(),
): number {
  const safePeriod = clampPeriod(period);
  const elapsed = (timestampMs / 1000) % safePeriod;
  return (safePeriod - elapsed) * 1000;
}

/** 形如 123 456 的易读分组 */
export function formatCode(code: string): string {
  if (code.length === 6 || code.length === 8) {
    const half = code.length / 2;
    return `${code.slice(0, half)} ${code.slice(half)}`;
  }
  return code;
}

/* --------------------------- otpauth:// 解析 ----------------------------- */

export interface ParsedOtpAccount {
  issuer: string;
  accountName: string;
  secret: string;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
}

function decodeBase64Bytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  if (typeof atob === "function") {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(padded, "base64"));
}

function parseOtpauthUrl(raw: string): ParsedOtpAccount | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const type = url.hostname.toLowerCase();
  if (type !== "totp" && type !== "hotp") return null;

  const params = url.searchParams;
  const secret = normalizeBase32(params.get("secret") ?? "");
  if (!isValidBase32(secret)) return null;

  const label = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  let issuer = params.get("issuer")?.trim() ?? "";
  let accountName = label;
  const sep = label.indexOf(":");
  if (sep !== -1) {
    if (!issuer) issuer = label.slice(0, sep).trim();
    accountName = label.slice(sep + 1).trim();
  }

  return {
    issuer,
    accountName: accountName || issuer || "未命名账户",
    secret,
    algorithm: normalizeAlgorithm(params.get("algorithm") ?? "SHA1"),
    digits: clampDigits(Number(params.get("digits") ?? DEFAULT_DIGITS)),
    period: clampPeriod(Number(params.get("period") ?? DEFAULT_PERIOD)),
  };
}

/* ------------------- Google Authenticator 迁移二维码 --------------------- */

interface ProtoField {
  field: number;
  wire: number;
  value: number | Uint8Array;
}

function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let result = 0;
  let shift = 0;
  for (;;) {
    if (pos >= buf.length) throw new Error("protobuf 数据越界");
    const byte = buf[pos++];
    result += (byte & 0x7f) * 2 ** shift;
    shift += 7;
    if ((byte & 0x80) === 0) break;
    if (shift > 63) throw new Error("protobuf varint 过长");
  }
  return [result, pos];
}

function readProto(buf: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let pos = 0;
  while (pos < buf.length) {
    let key: number;
    [key, pos] = readVarint(buf, pos);
    const field = key >> 3;
    const wire = key & 7;
    if (wire === 0) {
      let value: number;
      [value, pos] = readVarint(buf, pos);
      fields.push({ field, wire, value });
    } else if (wire === 2) {
      let len: number;
      [len, pos] = readVarint(buf, pos);
      if (pos + len > buf.length) throw new Error("protobuf 长度越界");
      fields.push({ field, wire, value: buf.subarray(pos, pos + len) });
      pos += len;
    } else if (wire === 5) {
      pos += 4;
    } else if (wire === 1) {
      pos += 8;
    } else {
      throw new Error(`不支持的 protobuf wire 类型：${wire}`);
    }
  }
  return fields;
}

const MIGRATION_ALGORITHM: Record<number, TotpAlgorithm> = {
  1: "SHA1",
  2: "SHA256",
  3: "SHA512",
};

const MIGRATION_DIGITS: Record<number, number> = { 1: 6, 2: 8 };

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** 解析 Google Authenticator 的 otpauth-migration:// 导出二维码 */
function parseMigrationUri(raw: string): ParsedOtpAccount[] {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [];
  }
  if (url.hostname.toLowerCase() !== "offline") return [];
  const data = url.searchParams.get("data");
  if (!data) return [];

  let root: ProtoField[];
  try {
    root = readProto(decodeBase64Bytes(data));
  } catch {
    return [];
  }

  const results: ParsedOtpAccount[] = [];
  for (const field of root) {
    if (field.field !== 1 || field.wire !== 2) continue;
    let secret = "";
    let name = "";
    let issuer = "";
    let algorithm: TotpAlgorithm = "SHA1";
    let digits = 6;
    let period = 30;
    try {
      for (const sub of readProto(field.value as Uint8Array)) {
        if (sub.wire === 2) {
          const text = decodeText(sub.value as Uint8Array);
          if (sub.field === 1) secret = normalizeBase32(base32Encode(sub.value as Uint8Array));
          else if (sub.field === 2) name = text;
          else if (sub.field === 3) issuer = text;
        } else if (sub.wire === 0) {
          const num = Number(sub.value);
          if (sub.field === 4) algorithm = MIGRATION_ALGORITHM[num] ?? "SHA1";
          else if (sub.field === 5) digits = MIGRATION_DIGITS[num] ?? 6;
        }
      }
    } catch {
      continue;
    }
    if (!isValidBase32(secret)) continue;
    // 迁移载荷里 period 字段缺失，TOTP 一律按 30 秒处理
    period = 30;
    results.push({
      issuer: issuer || "",
      accountName: name || issuer || "未命名账户",
      secret,
      algorithm,
      digits,
      period,
    });
  }
  return results;
}

/**
 * 通用入口：支持 otpauth://totp、otpauth://hotp(按 totp 处理) 与
 * otpauth-migration://offline 批量导出。
 */
export function parseOtpUri(raw: string): ParsedOtpAccount[] {
  const text = raw.trim();
  if (!text) return [];
  if (text.toLowerCase().startsWith("otpauth-migration://")) {
    return parseMigrationUri(text);
  }
  if (text.toLowerCase().startsWith("otpauth://")) {
    const parsed = parseOtpauthUrl(text);
    return parsed ? [parsed] : [];
  }
  // 也允许用户直接粘贴一串 Base32 密钥
  if (isValidBase32(text)) {
    return [
      {
        issuer: "",
        accountName: "未命名账户",
        secret: normalizeBase32(text),
        algorithm: "SHA1",
        digits: 6,
        period: 30,
      },
    ];
  }
  return [];
}

export function buildOtpauthUri(account: {
  issuer: string;
  accountName: string;
  secret: string;
  algorithm?: string;
  digits?: number;
  period?: number;
}): string {
  const label = encodeURIComponent(
    account.issuer
      ? `${account.issuer}:${account.accountName}`
      : account.accountName,
  );
  const params = new URLSearchParams({
    secret: normalizeBase32(account.secret),
    issuer: account.issuer,
    algorithm: normalizeAlgorithm(account.algorithm),
    digits: String(clampDigits(account.digits)),
    period: String(clampPeriod(account.period)),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
