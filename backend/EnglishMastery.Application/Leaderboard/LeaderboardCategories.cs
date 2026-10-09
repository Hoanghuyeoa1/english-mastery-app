namespace EnglishMastery.Application.Leaderboard;

public static class LeaderboardCategories
{
    public const string WeeklyXp = "weekly_xp";
    public const string VocabMastered = "vocab_mastered";
    public const string ReviewConsistency = "review_consistency";
    public const string ActiveMinutes = "active_minutes";
    public const string PronunciationGain = "pronunciation_gain";
    public const string ToeicGain = "toeic_gain";
    public const string Streak = "streak";

    public static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
    {
        WeeklyXp,
        VocabMastered,
        ReviewConsistency,
        ActiveMinutes,
        PronunciationGain,
        ToeicGain,
        Streak
    };

    public static bool IsValid(string category) => All.Contains(category);
}
