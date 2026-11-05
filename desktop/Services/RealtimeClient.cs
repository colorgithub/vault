using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace MemoVaultNote.Services;

/// <summary>
/// WebSocket 实时通道。
///
/// 连上后服务端会在备忘录有变化时推送 <c>{"type":"memos.changed"}</c>，
/// 客户端收到后重新拉一次列表即可 —— 不把内容塞进推送，避免两套状态。
///
/// 断线由这里自己重连（1s → 30s 指数退避）；连不上也不影响主流程，
/// 窗口里的定时轮询会继续兜底（Vercel 部署时本来就没有 WS）。
/// </summary>
public sealed class RealtimeClient : IDisposable
{
    private static readonly TimeSpan[] Backoff =
    {
        TimeSpan.FromSeconds(1),
        TimeSpan.FromSeconds(2),
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(10),
        TimeSpan.FromSeconds(30),
    };

    private CancellationTokenSource? _cts;
    private Task? _loop;

    /// <summary>服务端推来「有变化」。</summary>
    public event Action? Changed;

    /// <summary>连接状态变化（真 = 已连上，走实时；假 = 退回轮询）。</summary>
    public event Action<bool>? ConnectionChanged;

    public bool IsConnected { get; private set; }

    public void Start(string baseUrl, string apiKey)
    {
        Stop();
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(apiKey))
        {
            return;
        }

        if (!TryBuildUri(baseUrl, out var uri))
        {
            return;
        }

        _cts = new CancellationTokenSource();
        var token = _cts.Token;
        var key = apiKey.Trim();

        _loop = Task.Run(() => RunAsync(uri, key, token), token);
    }

    public void Stop()
    {
        try
        {
            _cts?.Cancel();
        }
        catch
        {
            /* ignore */
        }

        _cts?.Dispose();
        _cts = null;
        _loop = null;
        SetConnected(false);
    }

    private async Task RunAsync(Uri uri, string apiKey, CancellationToken token)
    {
        var attempt = 0;

        while (!token.IsCancellationRequested)
        {
            using var socket = new ClientWebSocket();
            socket.Options.SetRequestHeader("Authorization", "Bearer " + apiKey);
            socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(25);

            try
            {
                await socket.ConnectAsync(uri, token).ConfigureAwait(false);
                attempt = 0;
                SetConnected(true);
                await ReceiveLoopAsync(socket, token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch
            {
                // 连接失败 / 中途断开，走下面的退避
            }
            finally
            {
                SetConnected(false);
            }

            if (token.IsCancellationRequested) break;

            var delay = Backoff[Math.Min(attempt, Backoff.Length - 1)];
            attempt++;
            try
            {
                await Task.Delay(delay, token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task ReceiveLoopAsync(ClientWebSocket socket, CancellationToken token)
    {
        var buffer = new byte[4 * 1024];
        var message = new StringBuilder();

        while (socket.State == WebSocketState.Open && !token.IsCancellationRequested)
        {
            var result = await socket
                .ReceiveAsync(new ArraySegment<byte>(buffer), token)
                .ConfigureAwait(false);

            if (result.MessageType == WebSocketMessageType.Close)
            {
                try
                {
                    await socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, token)
                        .ConfigureAwait(false);
                }
                catch
                {
                    /* 已断开 */
                }
                return;
            }

            message.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
            if (!result.EndOfMessage) continue;

            var payload = message.ToString();
            message.Clear();

            if (payload.Contains("\"memos.changed\"", StringComparison.Ordinal))
            {
                Changed?.Invoke();
            }
        }
    }

    private void SetConnected(bool value)
    {
        if (IsConnected == value) return;
        IsConnected = value;
        ConnectionChanged?.Invoke(value);
    }

    /// <summary>http(s)://host → ws(s)://host/api/ws</summary>
    private static bool TryBuildUri(string baseUrl, out Uri uri)
    {
        uri = null!;
        var trimmed = baseUrl.Trim().TrimEnd('/');
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var baseUri)) return false;

        var scheme = baseUri.Scheme switch
        {
            "https" => "wss",
            "http" => "ws",
            _ => null,
        };
        if (scheme is null) return false;

        uri = new Uri($"{scheme}://{baseUri.Authority}/api/ws");
        return true;
    }

    public void Dispose() => Stop();
}
