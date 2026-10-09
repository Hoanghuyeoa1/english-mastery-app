namespace EnglishMastery.Application.Common;

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
    DateTime VietnamNow { get; }
    string CurrentVietnamWeekId { get; }
}
