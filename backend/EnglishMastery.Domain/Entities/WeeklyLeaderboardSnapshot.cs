using EnglishMastery.Domain.Common;

namespace EnglishMastery.Domain.Entities;

public class WeeklyLeaderboardSnapshot : BaseEntity
{
    public string WeekId { get; set; } = string.Empty;
    public string Category { get; set; } = "weekly_xp";
    public int Rank { get; set; } = 1;
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public int Level { get; set; } = 1;
    public decimal Score { get; set; }
    public decimal SecondaryScore { get; set; } = 0;
    public string? FrameAwarded { get; set; }
    public DateTime FinalizedAt { get; set; } = DateTime.UtcNow;
}
