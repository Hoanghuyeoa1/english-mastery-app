namespace EnglishMastery.Application.Finalization;

public record FinalizeWeekRequest(
    string? WeekId = null,
    int TopLimit = 3
);

public record FinalizeWeekResponse(
    bool Success,
    string Code,
    string Message,
    string? WeekId = null,
    DateTime? WeekStart = null,
    DateTime? WeekEnd = null,
    DateTime? FinalizedAt = null,
    int? TotalParticipants = null,
    bool IsIdempotent = false,
    DateTime? ServerNow = null,
    List<WeeklyLeaderboardSnapshotDto>? SnapshotsCreated = null
);

public record WeeklyLeaderboardSnapshotDto(
    Guid? Id,
    string WeekId,
    string Category,
    Guid UserId,
    string DisplayName,
    string? AvatarUrl,
    int Level,
    int Rank,
    decimal Score,
    decimal SecondaryScore,
    string? FrameAwarded,
    DateTime FinalizedAt
);

public record WeeklyFinalizationRecordDto(
    string WeekId,
    DateTime WeekStart,
    DateTime WeekEnd,
    DateTime FinalizedAt,
    int TotalParticipants,
    bool IsFinalized,
    string? MetadataJson
);

public record UserFrameEntitlementDto(
    Guid Id,
    Guid UserId,
    string FrameId,
    string Source,
    string WeekId,
    int TimesWon,
    DateTime UnlockedAt
);

public record EquipFrameRequest(
    string? FrameId
);

public record EquipFrameResponse(
    bool Success,
    string Code,
    string Message,
    string? EquippedFrame = null
);

public record PendingCeremonyDto(
    string WeekId,
    int Rank,
    string FrameId,
    decimal Score,
    string DisplayName,
    DateTime FinalizedAt
);

public record PendingCeremonyResponse(
    bool HasPending,
    PendingCeremonyDto? Ceremony
);
