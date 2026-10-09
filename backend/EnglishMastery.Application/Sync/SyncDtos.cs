using System.Text.Json;
using System.Text.Json.Serialization;
using EnglishMastery.Application.Profiles;

namespace EnglishMastery.Application.Sync;

public record SrsProgressItemDto(
    string WordId,
    int Interval,
    double EaseFactor,
    int Repetition,
    DateTime? NextReviewDate,
    DateTime? LastReviewedDate = null,
    string? Algorithm = "sm2",
    double? Stability = null,
    double? Difficulty = null,
    int? State = null,
    int? Lapses = null,
    int? Reps = null,
    bool? IsFavorite = false,
    List<string>? Sources = null
);

public record DailyLogDto(
    string Date,
    int WordsLearned,
    int XpEarned,
    int WordsReviewed = 0,
    int QuizzesCompleted = 0
);

public record SyncStateResponse(
    UserProfileResponse Profile,
    List<SrsProgressItemDto> SrsItems,
    List<DailyLogDto> DailyLogs,
    DateTime ServerTime
);

public record SyncUploadRequest(
    UpdateProfileRequest? Profile = null,
    List<SrsProgressItemDto>? SrsItems = null,
    List<DailyLogDto>? DailyLogs = null
);

public record SyncUploadResponse(
    bool Success,
    DateTime SyncedAt,
    int SrsItemsUpserted,
    int DailyLogsUpserted
);

public record IngestDomainEventRequest(
    string EventId,
    string EventType,
    string EntityType,
    string EntityId,
    string? DeviceId,
    string? IdempotencyKey,
    int SchemaVersion,
    DateTime? OccurredAt,
    JsonElement? Payload = null,
    string? UserId = null
);

public record IngestLearningEventsRequest(
    List<IngestDomainEventRequest> Events
);

public record IngestEventItemResultDto(
    [property: JsonPropertyName("event_id")] string EventId,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("message")] string? Message = null
);

public record IngestLearningEventsResponse(
    [property: JsonPropertyName("success")] bool Success,
    [property: JsonPropertyName("code")] string? Code = null,
    [property: JsonPropertyName("message")] string? Message = null,
    [property: JsonPropertyName("received_count")] int ReceivedCount = 0,
    [property: JsonPropertyName("applied_count")] int AppliedCount = 0,
    [property: JsonPropertyName("duplicate_count")] int DuplicateCount = 0,
    [property: JsonPropertyName("rejected_count")] int RejectedCount = 0,
    [property: JsonPropertyName("server_now")] string? ServerNow = null,
    [property: JsonPropertyName("results")] List<IngestEventItemResultDto>? Results = null
);

