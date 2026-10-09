namespace EnglishMastery.Application.Common;

public interface IWeekService
{
    DateTime GetAuthoritativeServerNow();
    DateTime GetVietnamNow();
    string GetCurrentVietnamWeekId();
    string GetVietnamWeekId(DateTime utcDate);
    (DateTime WeekStartUtc, DateTime WeekEndUtc) GetVietnamWeekBounds(DateTime? utcDate = null);
    DateTime GetNextVietnamWeekReset(DateTime? utcDate = null);
    string GetPreviousVietnamWeekId(DateTime? utcDate = null);
    (DateTime WeekStartUtc, DateTime WeekEndUtc) GetWeekRangeById(string weekId);
}
