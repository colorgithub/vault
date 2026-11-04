using System.Security.Cryptography;
using System.Text;

namespace MemoVaultNote.Services;

/// <summary>
/// 用 Windows DPAPI 加密本地保存的 API 密钥。
///
/// 密钥是只读凭据，但也不该以明文躺在 %APPDATA% 里 —— 备份工具、同步盘、
/// 误上传都可能把它带出去。DPAPI 绑定当前用户，拷到别的机器上也解不开。
/// </summary>
public static class SecretStore
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("MemoVaultNote.v1");
    private const string Prefix = "dpapi:";

    public static string Protect(string plain)
    {
        if (string.IsNullOrEmpty(plain)) return "";
        var bytes = Encoding.UTF8.GetBytes(plain);
        var encrypted = ProtectedData.Protect(bytes, Entropy, DataProtectionScope.CurrentUser);
        return Prefix + Convert.ToBase64String(encrypted);
    }

    /// <summary>解密失败（换了用户 / 文件被改）时返回空串，让用户重新填。</summary>
    public static string Unprotect(string? stored)
    {
        if (string.IsNullOrEmpty(stored) || !stored.StartsWith(Prefix, StringComparison.Ordinal))
        {
            return "";
        }

        try
        {
            var encrypted = Convert.FromBase64String(stored.Substring(Prefix.Length));
            var bytes = ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(bytes);
        }
        catch
        {
            return "";
        }
    }
}
