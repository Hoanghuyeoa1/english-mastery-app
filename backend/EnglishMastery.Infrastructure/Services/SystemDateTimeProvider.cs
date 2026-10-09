using System.Globalization;
using EnglishMastery.Application.Common;

namespace EnglishMastery.Infrastructure.Services;

public class SystemDateTimeProvider : IDateTimeProvider
{
    private static readonly TimeZoneInfo VietnamTimeZone = GetVietnamTimeZone();

    public DateTime UtcNow => DateTime.UtcNow;

    public DateTime VietnamNow => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, VietnamTimeZone);

    public string CurrentVietnamWeekId => GetIsoWeekId(VietnamNow);

    private static TimeZoneInfo GetVietnamTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
        }
        catch
        {
            return TimeZoneInfo.CreateCustomTimeZone("VietnamStandardTime", TimeSpan.FromHours(7), "Vietnam Standard Time", "ICT");
        }
    }

    public static string GetIsoWeekId(DateTime localDateTime)
    {
        int weekNumber = ISOWeek.GetWeekOfYear(localDateTime);
        int year = ISOWeek.GetYear(localDateTime);
        return $"{year}-W{weekNumber:D2}";
    }
}
