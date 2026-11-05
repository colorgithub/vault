using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using MemoVaultNote.Models;
using MemoVaultNote.Services;

namespace MemoVaultNote;

/// <summary>一张便签 = 一个独立窗口，对应一条备忘录。</summary>
public partial class NoteWindow : Window
{
    private static readonly Color CardColor = Color.FromRgb(0x13, 0x15, 0x1C);

    private readonly NoteManager _manager;
    private bool _quiet;

    public NoteWindow(NoteManager manager, string key, Memo? memo, bool isPrimary)
    {
        InitializeComponent();

        _manager = manager;
        Key = key;
        IsPrimary = isPrimary;
        ShowInTaskbar = isPrimary;

        ApplyConfig();
        SetMemo(memo);

        LocationChanged += OnMoved;
        Closed += OnClosed;
    }

    /// <summary>窗口对应的键：备忘录 id，或空状态占位符。</summary>
    public string Key { get; }

    /// <summary>第一张窗口负责显示全局错误信息，避免每张卡片都重复一行报错。</summary>
    public bool IsPrimary { get; }

    public void SetMemo(Memo? memo)
    {
        _memo = memo;
        Title = string.IsNullOrWhiteSpace(memo?.Title) ? "MemoVault 便签" : memo!.Title;
        Render();
    }

    private Memo? _memo;

    public void ApplyConfig()
    {
        Topmost = _manager.Config.Topmost;
        MenuTopmost.IsChecked = _manager.Config.Topmost;

        var alpha = (byte)Math.Round(255 * _manager.Config.CardOpacity);
        Root.Background = Freeze(new SolidColorBrush(
            Color.FromArgb(alpha, CardColor.R, CardColor.G, CardColor.B)));
    }

    public void UpdateLive(bool connected)
    {
        LiveDot.Fill = Freeze(new SolidColorBrush(
            connected ? Color.FromRgb(0x6E, 0xE7, 0xB7) : Color.FromRgb(0x6B, 0x73, 0x85)));
        LiveDot.ToolTip = connected
            ? "实时同步已连接：改动会立即出现在这里"
            : "轮询模式：按设定间隔刷新（服务器不支持 WebSocket 时如此）";
    }

    public void ShowError(string? message)
    {
        if (!IsPrimary || string.IsNullOrEmpty(message))
        {
            ErrorText.Visibility = Visibility.Collapsed;
            return;
        }

        ErrorText.Text = message;
        ErrorText.Visibility = Visibility.Visible;
    }

    /// <summary>程序主动关窗（不再触发「退出应用」）。</summary>
    public void CloseQuietly()
    {
        _quiet = true;
        Close();
    }

    private void Render()
    {
        var memo = _memo;

        if (memo is null)
        {
            var configured =
                !string.IsNullOrWhiteSpace(_manager.Config.ApiKey) &&
                !string.IsNullOrWhiteSpace(_manager.Config.BaseUrl);

            TitleText.Text = configured ? "还没有备忘录" : "先配置一下";
            BodyText.Text = configured
                ? "在 MemoVault 里写下第一条，这里会按设定间隔自动同步。"
                : "右键 → 设置，填入服务器地址和账号 API 密钥（网页端侧栏「API 密钥」里生成）。";
            ColorDot.Fill = Freeze(new SolidColorBrush(Color.FromRgb(0x94, 0xA3, 0xB8)));
            MetaText.Text = "";
            return;
        }

        TitleText.Text = string.IsNullOrWhiteSpace(memo.Title) ? "无标题" : memo.Title;
        BodyText.Text = string.IsNullOrWhiteSpace(memo.Content) ? "（这条备忘录没有正文）" : memo.Content;
        ColorDot.Fill = Freeze(new SolidColorBrush(ColorOf(memo.Color)));
        MetaText.Text = memo.UpdatedAt.ToLocalTime().ToString("HH:mm");
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

    private void OnMoved(object? sender, EventArgs e)
    {
        _manager.RememberPosition(Key, Left, Top);
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        if (!_quiet) _manager.Quit();
    }

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

    private async void Refresh_Click(object sender, RoutedEventArgs e) => await _manager.RefreshAsync();

    private void Settings_Click(object sender, RoutedEventArgs e) => _manager.OpenSettings(this);

    private void Hide_Click(object sender, RoutedEventArgs e) => _manager.HideNote(this);

    private void ShowAll_Click(object sender, RoutedEventArgs e) => _manager.ShowAll();

    private void Topmost_Click(object sender, RoutedEventArgs e)
    {
        _manager.Config.Topmost = MenuTopmost.IsChecked == true;
        _manager.ApplyTopmost();
    }

    private void Exit_Click(object sender, RoutedEventArgs e) => _manager.Quit();
}
