using EnglishMastery.Domain.Common;

namespace EnglishMastery.Domain.Entities;

public class LeaderboardProfile : BaseEntity
{
    public string DisplayName { get; set; } = "Học viên ẩn danh";
    public string? AvatarUrl { get; set; }
    public string? AvatarSeed { get; set; }
    public int Level { get; set; } = 1;
    public int TotalXp { get; set; } = 0;
    public int WeeklyXp { get; set; } = 0;
    public int Streak { get; set; } = 0;
    public string? EquippedFrame { get; set; }
    public DateTime LastActiveAt { get; set; } = DateTime.UtcNow;
}
