using System.Windows;
using MemoVaultNote.Services;

namespace MemoVaultNote;

public partial class SettingsWindow : Window
{
    private readonly ApiClient _api = new();

    /// <summary>保存后的配置；用户取消时为 null。</summary>
    public AppConfig? Result { get; private set; }

    public SettingsWindow(AppConfig config)
    {
        InitializeComponent();

        UrlBox.Text = config.BaseUrl;
        KeyBox.Text = config.ApiKey;
        IntervalBox.Text = config.RefreshMinutes.ToString();
        TopmostBox.IsChecked = config.Topmost;
        AutoStartBox.IsChecked = config.AutoStart;
        OpacitySlider.Value = config.CardOpacity;

        Closed += (_, _) => _api.Dispose();
    }

    /// <summary>把表单读成配置；有非法值时返回 null 并给出原因。</summary>
    private AppConfig? ReadForm(out string error)
    {
        error = "";

        var url = UrlBox.Text.Trim().TrimEnd('/');
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            error = "服务器地址需要是 http(s):// 开头的完整地址。";
            return null;
        }

        var key = KeyBox.Text.Trim();
        if (string.IsNullOrEmpty(key))
        {
            error = "API 密钥不能为空。";
            return null;
        }

        if (!int.TryParse(IntervalBox.Text.Trim(), out var minutes) || minutes < 1 || minutes > 1440)
        {
            error = "刷新间隔需要是 1 – 1440 之间的整数（分钟）。";
            return null;
        }

        return new AppConfig
        {
            BaseUrl = url,
            ApiKey = key,
            RefreshMinutes = minutes,
            Topmost = TopmostBox.IsChecked == true,
            AutoStart = AutoStartBox.IsChecked == true,
            CardOpacity = Math.Round(OpacitySlider.Value, 2),
        };
    }

    private async void Test_Click(object sender, RoutedEventArgs e)
    {
        if (ReadForm(out var error) is not { } config)
        {
            ShowResult(error, isError: true);
            return;
        }

        ShowResult("正在连接…", isError: false);
        try
        {
            var data = await _api.FetchMemosAsync(config.BaseUrl, config.ApiKey);
            ShowResult($"连接成功 · 共 {data.Total} 条备忘录", isError: false);
        }
        catch (ApiException ex)
        {
            ShowResult("连接失败：" + ex.Message, isError: true);
        }
        catch (Exception ex)
        {
            ShowResult("连接失败：" + ex.Message, isError: true);
        }
    }

    private void ShowResult(string message, bool isError)
    {
        TestBox.Visibility = Visibility.Visible;
        TestText.Text = message;
        TestText.Foreground = isError
            ? new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0xFB, 0x71, 0x85))
            : new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0x6E, 0xE7, 0xB7));
    }

    private void Save_Click(object sender, RoutedEventArgs e)
    {
        if (ReadForm(out var error) is not { } config)
        {
            ShowResult(error, isError: true);
            return;
        }

        Result = config;
        DialogResult = true;
    }

    private void Cancel_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
    }
}
