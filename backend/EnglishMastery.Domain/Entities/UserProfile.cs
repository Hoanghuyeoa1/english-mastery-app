using EnglishMastery.Domain.Common;

namespace EnglishMastery.Domain.Entities;

public class UserProfile : BaseEntity
{
    public int PublicAccountId { get; set; }
    public string DisplayName { get; set; } = "Học viên ẩn danh";
    public string? AvatarUrl { get; set; }
    public string? AvatarSeed { get; set; }
    public int Level { get; set; } = 1;
    public int Xp { get; set; } = 0;
    public int Streak { get; set; } = 0;
    public string? EquippedFrame { get; set; }
    public bool HasLearnedNightOwl { get; set; } = false;
    public string? TargetGoal { get; set; }
    public int TargetDailyNewWords { get; set; } = 15;
    public string? LastStudyDate { get; set; }
    public string FourSkillsScoresJson { get; set; } = "{}";
    public DateTime LastActiveAt { get; set; } = DateTime.UtcNow;
}
