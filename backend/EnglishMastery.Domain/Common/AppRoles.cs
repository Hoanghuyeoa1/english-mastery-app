namespace EnglishMastery.Domain.Common;

public static class AppRoles
{
    public const string User = "USER";
    public const string Admin = "ADMIN";

    public static readonly Guid UserRoleId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid AdminRoleId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    public static readonly IReadOnlyList<string> AllRoles = new[] { User, Admin };
}

public static class AppPolicies
{
    public const string RequireUser = "RequireUser";
    public const string RequireAdmin = "RequireAdmin";
}
