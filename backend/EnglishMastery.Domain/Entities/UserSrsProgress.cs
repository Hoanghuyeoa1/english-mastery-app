using EnglishMastery.Domain.Common;

namespace EnglishMastery.Domain.Entities;

public class UserSrsProgress : BaseEntity
{
    public Guid UserId { get; set; }
    public string WordId { get; set; } = string.Empty;
    public string Algorithm { get; set; } = "sm2"; // "sm2" | "fsrs"
    public int Interval { get; set; } = 0;
    public double EaseFactor { get; set; } = 2.5;
    public int Repetition { get; set; } = 0;
    public DateTime NextReviewDate { get; set; } = DateTime.UtcNow;
    public DateTime? LastReviewedDate { get; set; }

    // FSRS 4.5 specific memory fields (NULL for SM-2: "FSRS != SM-2. Không fake FSRS fields cho SM-2.")
    public double? Stability { get; set; }
    public double? Difficulty { get; set; }
    public int? State { get; set; } // 0: New, 1: Learning, 2: Review, 3: Relearning
    public int? Lapses { get; set; }
    public int? Reps { get; set; }

    // Provenance & User Metadata
    public bool IsFavorite { get; set; } = false;
    public string? SourcesJson { get; set; }
}
