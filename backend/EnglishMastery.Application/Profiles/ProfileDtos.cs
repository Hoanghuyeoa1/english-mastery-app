namespace EnglishMastery.Application.Profiles;

public record UserProfileResponse(
    Guid Id,
    string Email,
    string DisplayName,
    string? AvatarUrl,
    string? AvatarSeed,
    int Level,
    int Xp,
    int Streak,
    string? EquippedFrame,
    bool HasLearnedNightOwl,
    string? TargetGoal,
    int TargetDailyNewWords,
    string? LastStudyDate,
    string FourSkillsScoresJson,
    DateTime LastActiveAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record PublicUserProfileResponse(
    Guid Id,
    string DisplayName,
    string? AvatarUrl,
    string? AvatarSeed,
    int Level,
    int Xp,
    int Streak,
    string? EquippedFrame,
    DateTime LastActiveAt
);

public record UpdateProfileRequest(
    string? DisplayName = null,
    string? AvatarUrl = null,
    string? AvatarSeed = null,
    string? EquippedFrame = null,
    string? TargetGoal = null,
    int? TargetDailyNewWords = null,
    string? LastStudyDate = null,
    bool? HasLearnedNightOwl = null,
    int? Xp = null,
    int? Level = null,
    int? Streak = null,
    string? FourSkillsScoresJson = null
);
