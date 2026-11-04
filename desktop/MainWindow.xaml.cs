using System.Threading;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using MemoVaultNote.Models;
using MemoVaultNote.Services;

namespace MemoVaultNote;

public partial class MainWindow : Window
{
    private static readonly Color CardColor = Color.FromRgb(0x13, 0x15, 0x1C);

    private readonly AppConfig _config = AppConfig.Load();
    private readonly ApiClient _api = new();
    private readonly DispatcherTimer _timer = new();
    private readonly CancellationTokenSource _lifetime = new();

    private List<Memo> _memos = new();
    private int _index;
    private DateTime? _lastSync;
    private bool _loading;

    public MainWindow()
    {
        InitializeComponent();

        _timer.Tick += async (_, _) => await RefreshAsync();
        Loaded += OnLoaded;
        Closed += OnClosed;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        RestorePosition();
        ApplyConfig();
        RestartTimer();
        await RefreshAsync();
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        _lifetime.Cancel();
        _config.Left = Left;
        _config.Top = Top;
        _config.Save();
        _api.Dispose();
    }

    /* ------------------------------- 配置与外观 ------------------------------ */

    private void ApplyConfig()
    {
        Topmost = _config.Topmost;
        MenuTopmost.IsChecked = _config.Topmost;

        // 只让背景半透明，文字保持不透明，长文才不会糊
        var alpha = (byte)Math.Round(255 * _config.CardOpacity);
        Root.Background = Freeze(new SolidColorBrush(
            Color.FromArgb(alpha, CardColor.R, CardColor.G, CardColor.B)));
    }

    private void RestorePosition()
    {
        var work = SystemParameters.WorkArea;

        if (_config.Left is not { } left || _config.Top is not { } top)
        {
            Left = work.Right - Width - 24;
            Top = work.Top + 40;
            return;
        }

        Left = Math.Clamp(left, work.Left - 80, work.Right - 80);
        Top = Math.Clamp(top, work.Top, work.Bottom - 80);
    }

    private void RestartTimer()
    {
        _timer.Stop();
        _timer.Interval = TimeSpan.FromMinutes(_config.RefreshMinutes);
        _timer.Start();
    }

    /* --------------------------------- 数据 --------------------------------- */

    private async Task RefreshAsync()
    {
        if (_loading) return;

        _loading = true;
        RefreshButton.IsEnabled = false;
        try
        {
            var data = await _api.FetchMemosAsync(_config.BaseUrl, _config.ApiKey, _lifetime.Token);
            _memos = data.Memos;
            if (_index >= _memos.Count) _index = 0;
            _lastSync = DateTime.Now;
            ErrorText.Visibility = Visibility.Collapsed;
        }
        catch (OperationCanceledException)
        {
            // 窗口正在关闭
        }
        catch (ApiException ex) when (ex.StatusCode == 401)
        {
            ShowError("API 密钥无效或已被撤销，去设置里换一把。");
        }
        catch (ApiException ex)
        {
            ShowError(ex.Message);
        }
        catch (Exception ex)
        {
            ShowError("连不上服务器：" + ex.Message);
        }
        finally
        {
            _loading = false;
            RefreshButton.IsEnabled = true;
            Render();
        }
    }

    private void Render()
    {
        var configured =
            !string.IsNullOrWhiteSpace(_config.ApiKey) &&
            !string.IsNullOrWhiteSpace(_config.BaseUrl);

        var memo = _index >= 0 && _index < _memos.Count ? _memos[_index] : null;

        if (memo == null)
        {
            TitleText.Text = configured ? "还没有备忘录" : "先配置一下";
            BodyText.Text = configured
                ? "在 MemoVault 里写下第一条，这里会按设定间隔自动同步。"
                : "点右上角齿轮，填入服务器地址和账号 API 密钥（网页端侧栏「API 密钥」里生成）。";
            ColorDot.Fill = Freeze(new SolidColorBrush(Color.FromRgb(0x94, 0xA3, 0xB8)));
            MetaText.Text = _lastSync.HasValue ? _lastSync.Value.ToString("HH:mm") + " 更新" : "未同步";
            CountText.Text = "";
            PrevButton.Visibility = Visibility.Collapsed;
            NextButton.Visibility = Visibility.Collapsed;
            return;
        }

        TitleText.Text = string.IsNullOrWhiteSpace(memo.Title) ? "无标题" : memo.Title;
        BodyText.Text = string.IsNullOrWhiteSpace(memo.Content)
            ? "（这条备忘录没有正文）"
            : memo.Content;

        ColorDot.Fill = Freeze(new SolidColorBrush(ColorOf(memo.Color)));
        MetaText.Text = _lastSync.HasValue ? _lastSync.Value.ToString("HH:mm") + " 更新" : "";

        var multiple = _memos.Count > 1;
        CountText.Text = multiple ? $"{_index + 1}/{_memos.Count}" : "";
        PrevButton.Visibility = multiple ? Visibility.Visible : Visibility.Collapsed;
        NextButton.Visibility = multiple ? Visibility.Visible : Visibility.Collapsed;
    }

    private void ShowError(string message)
    {
        ErrorText.Text = message;
        ErrorText.Visibility = Visibility.Visible;
    }

    private static Color ColorOf(string? color) => color switch
    {
        "amber" => Color.FromRgb(0xFB, 0xBF, 0x24),
        "rose" => Color.FromRgb(0xFB, 0x71, 0x85),
        "emerald" => Color.FromRgb(0x34, 0xD3, 0x99),
        "sky" => Color.FromRgb(0x38, 0xBD, 0xF8),
        "violet" => Color.FromRgb(0xA7, 0x8B, 0xFA),
        "lime" => Color.FromRgb(0xA3, 0xE6, 0x35),
        _ => Color.FromRgb(0x94, 0xA3, 0xB8),
    };

    private static SolidColorBrush Freeze(SolidColorBrush brush)
    {
        brush.Freeze();
        return brush;
    }

    /* --------------------------------- 交互 --------------------------------- */

    private void Root_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton != MouseButton.Left) return;

        try
        {
            DragMove();
        }
        catch (InvalidOperationException)
        {
            // 鼠标已经抬起，忽略
        }
    }

    private async void Refresh_Click(object sender, RoutedEventArgs e) => await RefreshAsync();

    private async void Settings_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new SettingsWindow(_config.Clone()) { Owner = this };
        if (dialog.ShowDialog() != true || dialog.Result is null) return;

        var updated = dialog.Result;
        _config.BaseUrl = updated.BaseUrl;
        _config.ApiKey = updated.ApiKey;
        _config.RefreshMinutes = updated.RefreshMinutes;
        _config.Topmost = updated.Topmost;
        _config.AutoStart = updated.AutoStart;
        _config.CardOpacity = updated.CardOpacity;
        _config.Normalize();
        _config.Save();

        AutoStart.Apply(_config.AutoStart);
        ApplyConfig();
        RestartTimer();

        _memos.Clear();
        _index = 0;
        await RefreshAsync();
    }

    private void Topmost_Click(object sender, RoutedEventArgs e)
    {
        _config.Topmost = MenuTopmost.IsChecked == true;
        Topmost = _config.Topmost;
        _config.Save();
    }

    private void Prev_Click(object sender, RoutedEventArgs e)
    {
        if (_memos.Count == 0) return;
        _index = (_index - 1 + _memos.Count) % _memos.Count;
        Render();
    }

    private void Next_Click(object sender, RoutedEventArgs e)
    {
        if (_memos.Count == 0) return;
        _index = (_index + 1) % _memos.Count;
        Render();
    }

    private void Exit_Click(object sender, RoutedEventArgs e) => Close();
}
