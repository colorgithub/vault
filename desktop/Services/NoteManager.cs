using System.Windows;
using System.Windows.Threading;

using MemoVaultNote.Models;

namespace MemoVaultNote.Services;

/// <summary>
/// 便签窗口的管理者：拉数据、开/关窗口、分发更新。
///
/// 一条备忘录对应一个独立窗口，窗口位置按备忘录 id 记住 —— 这样「周三晚作业」
/// 永远出现在你上次放它的地方，哪怕中间被别的备忘录挤出列表又回来。
/// </summary>
public sealed class NoteManager
{
    /// <summary>没有任何备忘录时，用这个 key 显示一张占位便签。</summary>
    private const string EmptyKey = "__empty__";

    private readonly AppConfig _config;
    private readonly ApiClient _api = new();
    private readonly RealtimeClient _realtime = new();
    private readonly DispatcherTimer _timer = new();
    private readonly Dictionary<string, NoteWindow> _windows = new();
    private readonly HashSet<string> _hidden = new();
    private readonly CancellationTokenSource _lifetime = new();

    private List<Memo> _memos = new();
    private bool _loading;
    private string? _error;

    public NoteManager()
    {
        _config = AppConfig.Load();

        _timer.Tick += async (_, _) => await RefreshAsync();

        _realtime.Changed += () =>
            Application.Current.Dispatcher.Invoke(() => _ = RefreshAsync());
        _realtime.ConnectionChanged += connected =>
            Application.Current.Dispatcher.Invoke(() => UpdateLive(connected));
    }

    public AppConfig Config => _config;

    public bool RealtimeConnected => _realtime.IsConnected;

    public async void Start()
    {
        RestartTimer();
        _realtime.Start(_config.BaseUrl, _config.ApiKey);
        await RefreshAsync();
    }

    /* -------------------------------- 数据 -------------------------------- */

    public async Task RefreshAsync()
    {
        if (_loading) return;

        _loading = true;
        try
        {
            var data = await _api.FetchMemosAsync(_config.BaseUrl, _config.ApiKey, _lifetime.Token);
            _memos = data.Memos;
            _error = null;
        }
        catch (OperationCanceledException)
        {
            // 正在退出
        }
        catch (ApiException ex) when (ex.StatusCode == 401)
        {
            _error = "API 密钥无效或已被撤销，右键 → 设置 换一把。";
        }
        catch (ApiException ex)
        {
            _error = ex.Message;
        }
        catch (Exception ex)
        {
            _error = "连不上服务器：" + ex.Message;
        }
        finally
        {
            _loading = false;
            SyncWindows();
            foreach (var window in _windows.Values) window.ShowError(_error);
        }
    }

    /* -------------------------------- 窗口 -------------------------------- */

    private void SyncWindows()
    {
        var visible = _memos
            .Where(memo => !_hidden.Contains(memo.Id))
            .Take(Math.Clamp(_config.VisibleCount, 1, 10))
            .ToList();

        var targets = new List<(string Key, Memo? Memo)>();
        if (visible.Count == 0)
        {
            targets.Add((EmptyKey, null));
        }
        else
        {
            foreach (var memo in visible) targets.Add((memo.Id, memo));
        }

        // 不再需要的窗口先关掉（备忘录被删 / 掉出前 N 条 / 被隐藏）
        foreach (var key in _windows.Keys.ToList())
        {
            if (targets.Any(t => t.Key == key)) continue;
            _windows[key].CloseQuietly();
            _windows.Remove(key);
        }

        for (var i = 0; i < targets.Count; i++)
        {
            var (key, memo) = targets[i];

            if (_windows.TryGetValue(key, out var existing))
            {
                existing.SetMemo(memo);
                continue;
            }

            var window = new NoteWindow(this, key, memo, isPrimary: i == 0);
            PlaceWindow(window, key, i);
            _windows[key] = window;
            window.Show();
            window.UpdateLive(RealtimeConnected);
            window.ShowError(_error);
        }
    }

    private void PlaceWindow(NoteWindow window, string key, int slot)
    {
        var work = SystemParameters.WorkArea;

        if (_config.Positions.TryGetValue(key, out var saved))
        {
            window.Left = Math.Clamp(saved.Left, work.Left - 80, work.Right - 80);
            window.Top = Math.Clamp(saved.Top, work.Top, work.Bottom - 80);
            return;
        }

        // 第一次出现：从右上角往下排，用户拖过之后就以拖动位置为准
        var baseLeft = _config.Left ?? (work.Right - 404);
        var baseTop = _config.Top ?? (work.Top + 40);

        window.Left = Math.Clamp(baseLeft, work.Left, work.Right - 120);
        window.Top = Math.Clamp(baseTop + slot * 236, work.Top, work.Bottom - 120);
    }

    public void RememberPosition(string key, double left, double top)
    {
        if (double.IsNaN(left) || double.IsNaN(top)) return;
        _config.Positions[key] = new NotePosition { Left = left, Top = top };
    }

    public void HideNote(NoteWindow window)
    {
        // 只剩一张时不允许隐藏，否则应用会变成没有界面的幽灵进程
        if (_windows.Count <= 1) return;

        _hidden.Add(window.Key);
        SyncWindows();
    }

    public void ShowAll()
    {
        _hidden.Clear();
        SyncWindows();
    }

    public void UpdateLive(bool connected)
    {
        foreach (var window in _windows.Values) window.UpdateLive(connected);
    }

    /* -------------------------------- 配置 -------------------------------- */

    public void OpenSettings(Window owner)
    {
        var dialog = new SettingsWindow(_config.Clone()) { Owner = owner };
        if (dialog.ShowDialog() != true || dialog.Result is null) return;

        var updated = dialog.Result;
        _config.BaseUrl = updated.BaseUrl;
        _config.ApiKey = updated.ApiKey;
        _config.RefreshMinutes = updated.RefreshMinutes;
        _config.VisibleCount = updated.VisibleCount;
        _config.Topmost = updated.Topmost;
        _config.AutoStart = updated.AutoStart;
        _config.CardOpacity = updated.CardOpacity;
        _config.Normalize();
        _config.Save();

        AutoStart.Apply(_config.AutoStart);
        ApplyTopmost();
        RestartTimer();

        _realtime.Start(_config.BaseUrl, _config.ApiKey);

        SyncWindows();
        _ = RefreshAsync();
    }

    public void ApplyTopmost()
    {
        foreach (var window in _windows.Values) window.ApplyConfig();
    }

    private void RestartTimer()
    {
        _timer.Stop();
        _timer.Interval = TimeSpan.FromMinutes(_config.RefreshMinutes);
        _timer.Start();
    }

    /* -------------------------------- 退出 -------------------------------- */

    public void Quit()
    {
        try
        {
            _lifetime.Cancel();
            _realtime.Dispose();
            _config.Save();

            foreach (var window in _windows.Values.ToList())
            {
                // 正在关的那张已经在 Closed 里了，再 Close 一次会抛
                try
                {
                    if (window.IsLoaded) window.CloseQuietly();
                }
                catch
                {
                    /* 已关闭 */
                }
            }

            _windows.Clear();
            _api.Dispose();
        }
        finally
        {
            Application.Current.Shutdown();
        }
    }
}
