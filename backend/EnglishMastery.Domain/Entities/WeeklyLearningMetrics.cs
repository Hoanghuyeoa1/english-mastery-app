using EnglishMastery.Domain.Common;

namespace EnglishMastery.Domain.Entities;

public class WeeklyLearningMetrics : BaseEntity
{
    public Guid UserId { get; set; }
    public string WeekId { get; set; } = string.Empty; // e.g. 2026-W41
    public int WeeklyXp { get; set; } = 0;
    public int VocabMastered { get; set; } = 0;
    public decimal? ReviewConsistency { get; set; }
    public int ActiveMinutes { get; set; } = 0;
    public decimal? PronunciationGain { get; set; }
    public int? ToeicGain { get; set; }
    public string SupportingEvidenceJson { get; set; } = "{}";
}
