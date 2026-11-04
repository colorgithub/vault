using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using MemoVaultNote.Models;

namespace MemoVaultNote.Services;

public sealed class ApiException : Exception
{
    public int? StatusCode { get; }

    public ApiException(string message, int? statusCode = null) : base(message)
    {
        StatusCode = statusCode;
    }
}

/// <summary>只读客户端：拿账号 API 密钥调 /api/memos。</summary>
public sealed class ApiClient : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _http = new()
    {
        Timeout = TimeSpan.FromSeconds(20),
    };

    public async Task<MemoListResponse> FetchMemosAsync(
        string baseUrl,
        string apiKey,
        CancellationToken cancellationToken = default)
    {
        var uri = BuildUri(baseUrl);

        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey.Trim());
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await _http
            .SendAsync(request, HttpCompletionOption.ResponseContentRead, cancellationToken)
            .ConfigureAwait(false);

        var body = await response.Content
            .ReadAsStringAsync(cancellationToken)
            .ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
        {
            var message = TryReadError(body)
                          ?? (response.StatusCode == HttpStatusCode.Unauthorized
                              ? "API 密钥无效或已被撤销"
                              : $"服务器返回 HTTP {(int)response.StatusCode}");
            throw new ApiException(message, (int)response.StatusCode);
        }

        var data = JsonSerializer.Deserialize<MemoListResponse>(body, JsonOptions);
        return data ?? new MemoListResponse();
    }

    private static Uri BuildUri(string baseUrl)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new ApiException("还没有填写服务器地址");
        }

        var trimmed = baseUrl.Trim().TrimEnd('/');
        if (!Uri.TryCreate(trimmed + "/api/memos?limit=100", UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new ApiException("服务器地址需要是 http(s):// 开头的完整地址");
        }

        return uri;
    }

    private static string? TryReadError(string body)
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<ApiErrorResponse>(body, JsonOptions);
            return string.IsNullOrWhiteSpace(parsed?.Error) ? null : parsed!.Error;
        }
        catch
        {
            return null;
        }
    }

    public void Dispose() => _http.Dispose();
}
