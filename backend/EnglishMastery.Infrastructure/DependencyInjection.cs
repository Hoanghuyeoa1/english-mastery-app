using EnglishMastery.Application.Auth;
using EnglishMastery.Application.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Infrastructure.Auth;
using EnglishMastery.Infrastructure.Data;
using EnglishMastery.Infrastructure.Health;
using EnglishMastery.Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EnglishMastery.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:DefaultConnection chưa được cấu hình. Vui lòng kiểm tra appsettings.Development.json hoặc biến môi trường.");
        }

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseSqlServer(connectionString, sqlServerOptions =>
            {
                sqlServerOptions.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                sqlServerOptions.EnableRetryOnFailure(
                    maxRetryCount: 3,
                    maxRetryDelay: TimeSpan.FromSeconds(5),
                    errorNumbersToAdd: null);
            });
        });

        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());
        services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();
        services.AddScoped<IDatabaseHealthCheckService, DatabaseHealthCheckService>();

        // Identity Configuration
        services.AddIdentityCore<AppUser>(options =>
        {
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequiredLength = 6;
            options.User.RequireUniqueEmail = true;
        })
        .AddErrorDescriber<VietnameseIdentityErrorDescriber>()
        .AddRoles<IdentityRole<Guid>>()
        .AddEntityFrameworkStores<AppDbContext>();

        // Auth Services
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IUserRoleService, UserRoleService>();
        services.AddScoped<IExternalLoginService, ExternalLoginService>();
        services.AddScoped<IAdminProvisioningService, AdminProvisioningService>();
        services.AddScoped<IAuthService, AuthService>();

        // Google OAuth / OIDC Services
        services.Configure<GoogleOAuthOptions>(configuration.GetSection(GoogleOAuthOptions.SectionName));
        services.AddSingleton<IOAuthStateManager, OAuthStateManager>();
        services.AddSingleton<HttpClient>();
        services.AddScoped<IGoogleTokenClient, GoogleTokenClient>();
        services.AddScoped<IGoogleAuthService, GoogleAuthService>();

        // Profile Services
        services.AddScoped<EnglishMastery.Application.Profiles.IProfileService, EnglishMastery.Infrastructure.Profiles.ProfileService>();

        // Sync Services
        services.AddScoped<EnglishMastery.Application.Sync.ISyncService, EnglishMastery.Infrastructure.Sync.SyncService>();

        // SRS and DailyLogs Services
        services.AddScoped<EnglishMastery.Application.Srs.ISrsService, EnglishMastery.Infrastructure.Srs.SrsService>();
        services.AddScoped<EnglishMastery.Application.DailyLogs.IDailyLogService, EnglishMastery.Infrastructure.DailyLogs.DailyLogService>();

        // Week & Leaderboard Services
        services.AddSingleton<IWeekService, WeekService>();
        services.AddScoped<EnglishMastery.Application.Leaderboard.ILeaderboardService, EnglishMastery.Infrastructure.Leaderboard.LeaderboardService>();

        // Finalization & Frame Reward Services
        services.AddScoped<EnglishMastery.Application.Finalization.IWeeklyFinalizationService, EnglishMastery.Infrastructure.Finalization.WeeklyFinalizationService>();
        services.AddScoped<EnglishMastery.Application.Finalization.IFrameRewardService, EnglishMastery.Infrastructure.Finalization.FrameRewardService>();

        return services;
    }
}
