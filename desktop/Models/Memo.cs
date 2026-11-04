using System.Text.Json.Serialization;

namespace MemoVaultNote.Models;

/// <summary>与 /api/memos 返回结构对应（只取便签用得到的字段）。</summary>
public sealed class Memo
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("content")]
    public string Content { get; set; } = "";

    [JsonPropertyName("color")]
    public string Color { get; set; } = "slate";

    [JsonPropertyName("pinned")]
    public bool Pinned { get; set; }

    [JsonPropertyName("updatedAt")]
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class MemoListResponse
{
    [JsonPropertyName("memos")]
    public List<Memo> Memos { get; set; } = new();

    [JsonPropertyName("total")]
    public int Total { get; set; }
}

public sealed class ApiErrorResponse
{
    [JsonPropertyName("error")]
    public string? Error { get; set; }
}
