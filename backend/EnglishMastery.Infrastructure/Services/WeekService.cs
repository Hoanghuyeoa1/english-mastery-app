using System.Globalization;
using EnglishMastery.Application.Common;

namespace EnglishMastery.Infrastructure.Services;

public class WeekService : IWeekService
{
    private static readonly TimeZoneInfo VietnamTimeZone = ResolveVietnamTimeZone();

    private static TimeZoneInfo ResolveVietnamTimeZone()
    {
        try
        {
            if (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out var tzWin))
                return tzWin;
            if (TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var tzIana))
                return tzIana;
        }
        catch
        {
            // Fallback to custom UTC+7
        }

        return TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "SE Asia Standard Time", "SE Asia Standard Time");
    }

    public DateTime GetAuthoritativeServerNow() => DateTime.UtcNow;

    public DateTime GetVietnamNow()
    {
        var utcNow = GetAuthoritativeServerNow();
        return TimeZoneInfo.ConvertTimeFromUtc(utcNow, VietnamTimeZone);
    }

    public string GetCurrentVietnamWeekId() => GetVietnamWeekId(GetAuthoritativeServerNow());

    public string GetVietnamWeekId(DateTime utcDate)
    {
        var vnTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcDate, DateTimeKind.Utc), VietnamTimeZone);
        int year = ISOWeek.GetYear(vnTime);
        int week = ISOWeek.GetWeekOfYear(vnTime);
        return $"{year}-W{week:D2}";
    }

    public (DateTime WeekStartUtc, DateTime WeekEndUtc) GetVietnamWeekBounds(DateTime? utcDate = null)
    {
        var targetUtc = utcDate ?? GetAuthoritativeServerNow();
        var vnTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(targetUtc, DateTimeKind.Utc), VietnamTimeZone);

        // Monday 00:00:00 VN local time
        int dayOfWeek = ((int)vnTime.DayOfWeek + 6) % 7; // 0 for Monday, 6 for Sunday
        var mondayVn = new DateTime(vnTime.Year, vnTime.Month, vnTime.Day, 0, 0, 0, DateTimeKind.Unspecified).AddDays(-dayOfWeek);
        var nextMondayVn = mondayVn.AddDays(7);

        var weekStartUtc = TimeZoneInfo.ConvertTimeToUtc(mondayVn, VietnamTimeZone);
        var weekEndUtc = TimeZoneInfo.ConvertTimeToUtc(nextMondayVn, VietnamTimeZone);

        return (weekStartUtc, weekEndUtc);
    }

    public DateTime GetNextVietnamWeekReset(DateTime? utcDate = null)
    {
        var (_, weekEndUtc) = GetVietnamWeekBounds(utcDate);
        return weekEndUtc;
    }

    public string GetPreviousVietnamWeekId(DateTime? utcDate = null)
    {
        var target = (utcDate ?? GetAuthoritativeServerNow()).AddDays(-7);
        return GetVietnamWeekId(target);
    }

    public (DateTime WeekStartUtc, DateTime WeekEndUtc) GetWeekRangeById(string weekId)
    {
        if (string.IsNullOrWhiteSpace(weekId))
        {
            throw new ArgumentException("WeekId không được để trống.", nameof(weekId));
        }

        var parts = weekId.Trim().Split("-W");
        if (parts.Length != 2 || !int.TryParse(parts[0], out var year) || !int.TryParse(parts[1], out var week))
        {
            throw new ArgumentException($"Định dạng weekId không hợp lệ: '{weekId}'. Kỳ vọng chuẩn ISO (ví dụ: '2026-W41').", nameof(weekId));
        }

        var mondayDate = ISOWeek.ToDateTime(year, week, DayOfWeek.Monday);
        var mondayVn = new DateTime(mondayDate.Year, mondayDate.Month, mondayDate.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var weekStartUtc = TimeZoneInfo.ConvertTimeToUtc(mondayVn, VietnamTimeZone);
        var weekEndUtc = weekStartUtc.AddDays(7);

        return (weekStartUtc, weekEndUtc);
    }
}
