import { redirect } from "next/navigation";

import { AuthShell } from "@/components/AuthShell";
import { getSession } from "@/lib/auth";
import {
  buildErrorRedirect,
  findClient,
  isRegisteredRedirectUri,
  normalizeScope,
  OAUTH_CODE_TTL_SECONDS,
} from "@/lib/oauth";

export const metadata = { title: "授权登录" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(sp: SearchParams, key: string): string | null {
  const value = sp[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function Unrecoverable({ title, detail }: { title: string; detail: string }) {
  return (
    <AuthShell title={title} subtitle="请求无法继续，请回到应用重新发起登录">
      <p className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
        {detail}
      </p>
    </AuthShell>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const clientId = one(sp, "client_id");
  const redirectUri = one(sp, "redirect_uri");
  const state = one(sp, "state");

  // 1. 客户端必须已注册
  const client = findClient(clientId);
  if (!client) {
    return (
      <Unrecoverable
        title="未知的应用"
        detail={`client_id「${clientId ?? "(缺失)"}」没有在本站注册。`}
      />
    );
  }

  // 2. redirect_uri 必须与注册值完全一致，否则一律不重定向
  //    （否则就成了开放重定向，攻击者可以把授权码骗到自己的域名）
  if (!redirectUri || !isRegisteredRedirectUri(client, redirectUri)) {
    return (
      <Unrecoverable
        title="回调地址不匹配"
        detail={`redirect_uri「${redirectUri ?? "(缺失)"}」不在 ${client.name} 的登记列表中。`}
      />
    );
  }

  // 3. 以下错误可以安全地回传给已登记的 redirect_uri
  const responseType = one(sp, "response_type");
  if (responseType !== "code") {
    redirect(
      buildErrorRedirect(
        redirectUri,
        "unsupported_response_type",
        "只支持 authorization code 模式",
        state,
      ),
    );
  }

  const scope = normalizeScope(one(sp, "scope"), client);
  if (!scope) {
    redirect(
      buildErrorRedirect(redirectUri, "invalid_scope", "请求了不支持的权限范围", state),
    );
  }

  // 4. PKCE 强制 S256
  const codeChallenge = one(sp, "code_challenge");
  const codeChallengeMethod = one(sp, "code_challenge_method") ?? "S256";
  if (!codeChallenge) {
    redirect(
      buildErrorRedirect(redirectUri, "invalid_request", "缺少 code_challenge（必须使用 PKCE）", state),
    );
  }
  if (codeChallengeMethod !== "S256") {
    redirect(
      buildErrorRedirect(redirectUri, "invalid_request", "code_challenge_method 必须为 S256", state),
    );
  }

  // 5. 未登录则先去登录，登录后回到本页
  const session = await getSession();
  if (!session) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (typeof value === "string") params.set(key, value);
      else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
    }
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${params.toString()}`)}`);
  }

  const hidden = {
    client_id: client.clientId,
    redirect_uri: redirectUri,
    scope,
    state: state ?? "",
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  };

  return (
    <AuthShell
      title={`授权 ${client.name}`}
      subtitle={`以 ${session.name || session.email} 的身份继续`}
    >
      <div className="mb-6 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {client.name} 将获得
        </p>
        <ul className="mt-2.5 space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <span className="size-1 rounded-full bg-slate-400" aria-hidden />
            你的邮箱地址
          </li>
          <li className="flex items-center gap-2">
            <span className="size-1 rounded-full bg-slate-400" aria-hidden />
            你的昵称
          </li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          不会授予对备忘录和验证码的任何访问权限。
        </p>
      </div>

      <form action="/api/oauth/authorize" method="post" className="space-y-2.5">
        {Object.entries(hidden).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button type="submit" name="decision" value="approve" className="btn-primary w-full py-2.5">
          允许并继续
        </button>
        <button
          type="submit"
          name="decision"
          value="deny"
          className="w-full rounded-lg px-3 py-2.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
        >
          拒绝
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        授权码将在 {OAUTH_CODE_TTL_SECONDS} 秒后失效，且只能使用一次。
      </p>
    </AuthShell>
  );
}
