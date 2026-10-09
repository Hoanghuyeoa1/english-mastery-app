using EnglishMastery.Domain.Common;

namespace EnglishMastery.Domain.Entities;

public class DailyLog : BaseEntity
{
    public Guid UserId { get; set; }
    public string Date { get; set; } = string.Empty; // YYYY-MM-DD
    public int WordsLearned { get; set; } = 0;
    public int WordsReviewed { get; set; } = 0;
    public int QuizzesCompleted { get; set; } = 0;
    public int XpEarned { get; set; } = 0;
}
