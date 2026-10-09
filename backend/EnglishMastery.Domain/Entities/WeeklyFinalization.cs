namespace EnglishMastery.Domain.Entities;

public class WeeklyFinalization
{
    public string WeekId { get; set; } = string.Empty; // PK, e.g. 2026-W41
    public DateTime WeekStart { get; set; }
    public DateTime WeekEnd { get; set; }
    public DateTime FinalizedAt { get; set; } = DateTime.UtcNow;
    public int TotalParticipants { get; set; } = 0;
    public bool IsFinalized { get; set; } = true;
    public string MetadataJson { get; set; } = "{}";
}
