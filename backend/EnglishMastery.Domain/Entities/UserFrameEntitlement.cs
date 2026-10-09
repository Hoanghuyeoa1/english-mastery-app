using EnglishMastery.Domain.Common;

namespace EnglishMastery.Domain.Entities;

public class UserFrameEntitlement : BaseEntity
{
    public Guid UserId { get; set; }
    public string FrameId { get; set; } = string.Empty; // champion_frame, elite_frame, prestige_frame
    public string Source { get; set; } = "weekly_xp_podium";
    public string WeekId { get; set; } = string.Empty;
    public int TimesWon { get; set; } = 1;
    public DateTime UnlockedAt { get; set; } = DateTime.UtcNow;
}
