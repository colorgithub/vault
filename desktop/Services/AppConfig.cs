using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MemoVaultNote.Services;

/// <summary>本地配置，存放在 %APPDATA%\MemoVaultNote\config.json。</summary>
public sealed class AppConfig
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
    };

    public string BaseUrl { get; set; } = "https://vault-indol-xi.vercel.app";

    /// <summary>DPAPI 加密后的密钥；真正的明文只在内存里。</summary>
    public string ApiKeyProtected { get; set; } = "";

    /// <summary>多少分钟拉一次。1–1440。</summary>
    public int RefreshMinutes { get; set; } = 10;

    /// <summary>同时显示几张便签。1–10。</summary>
    public int VisibleCount { get; set; } = 3;

    /// <summary>每条备忘录对应窗口的位置（按备忘录 id 记住）。</summary>
    public Dictionary<string, NotePosition> Positions { get; set; } = new();

    public bool Topmost { get; set; } = true;

    public bool AutoStart { get; set; }

    /// <summary>卡片不透明度 0.5–1.0（只影响背景，文字始终不透明）。</summary>
    public double CardOpacity { get; set; } = 0.9;

    /// <summary>窗口位置；null 表示还没挪过，按默认位置摆放。</summary>
    public double? Left { get; set; }

    public double? Top { get; set; }

    [JsonIgnore]
    public string ApiKey { get; set; } = "";

    public static string ConfigDirectory =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "MemoVaultNote");

    public static string ConfigPath => Path.Combine(ConfigDirectory, "config.json");

    public static AppConfig Load()
    {
        try
        {
            if (!File.Exists(ConfigPath)) return new AppConfig();

            var config = JsonSerializer.Deserialize<AppConfig>(File.ReadAllText(ConfigPath), JsonOptions)
                         ?? new AppConfig();
            config.ApiKey = SecretStore.Unprotect(config.ApiKeyProtected);
            config.Normalize();
            return config;
        }
        catch
        {
            // 配置损坏时回到默认值，而不是启动即崩
            return new AppConfig();
        }
    }

    public AppConfig Clone()
    {
        var clone = (AppConfig)MemberwiseClone();
        // 字典是引用类型，必须复制，否则设置面板会改到正在使用的对象
        clone.Positions = new Dictionary<string, NotePosition>(Positions);
        return clone;
    }

    public void Normalize()
    {
        BaseUrl = string.IsNullOrWhiteSpace(BaseUrl)
            ? "https://vault-indol-xi.vercel.app"
            : BaseUrl.Trim();

        RefreshMinutes = Math.Clamp(RefreshMinutes, 1, 1440);
        VisibleCount = Math.Clamp(VisibleCount, 1, 10);
        CardOpacity = Math.Clamp(CardOpacity, 0.5, 1.0);
    }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(ConfigDirectory);
            ApiKeyProtected = SecretStore.Protect(ApiKey);
            File.WriteAllText(ConfigPath, JsonSerializer.Serialize(this, JsonOptions));
        }
        catch
        {
            // 没权限写配置时保持运行，用户下次还会看到旧值
        }
    }
}
