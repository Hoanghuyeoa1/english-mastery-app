using EnglishMastery.Application.Profiles;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Profiles;

public class ProfileService : IProfileService
{
    private static readonly HashSet<string> ValidTargetGoals = new(StringComparer.OrdinalIgnoreCase)
    {
        "ielts", "toeic", "tech", "business", "daily"
    };

    private readonly AppDbContext _dbContext;
    private readonly UserManager<AppUser> _userManager;
    private readonly ILogger<ProfileService> _logger;

    public ProfileService(
        AppDbContext dbContext,
        UserManager<AppUser> userManager,
        ILogger<ProfileService> logger)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _logger = logger;
    }

    public async Task<UserProfileResponse> GetCurrentProfileAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin người dùng.");
        }

        var profile = await _dbContext.UserProfiles
            .FirstOrDefaultAsync(p => p.Id == userId, cancellationToken);

        if (profile == null)
        {
            // Self-healing: Tạo profile mặc định nếu chưa tồn tại
            profile = new UserProfile
            {
                Id = user.Id,
                DisplayName = user.DisplayName,
                Level = 1,
                Xp = 0,
                Streak = 0,
                TargetDailyNewWords = 15,
                CreatedAt = DateTime.UtcNow,
                LastActiveAt = DateTime.UtcNow
            };
            _dbContext.UserProfiles.Add(profile);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return MapToResponse(profile, user.Email ?? string.Empty);
    }

    public async Task<UserProfileResponse> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        ValidateUpdateRequest(request);

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin người dùng.");
        }

        var profile = await _dbContext.UserProfiles
            .FirstOrDefaultAsync(p => p.Id == userId, cancellationToken);

        if (profile == null)
        {
            profile = new UserProfile
            {
                Id = user.Id,
                DisplayName = user.DisplayName,
                Level = 1,
                Xp = 0,
                Streak = 0,
                TargetDailyNewWords = 15,
                CreatedAt = DateTime.UtcNow,
                LastActiveAt = DateTime.UtcNow
            };
            _dbContext.UserProfiles.Add(profile);
        }

        var lbProfile = await _dbContext.LeaderboardProfiles
            .FirstOrDefaultAsync(p => p.Id == userId, cancellationToken);

        // 1. DisplayName
        if (request.DisplayName != null)
        {
            var cleanName = request.DisplayName.Trim();
            profile.DisplayName = cleanName;
            user.DisplayName = cleanName;
            await _userManager.UpdateAsync(user);
            if (lbProfile != null) lbProfile.DisplayName = cleanName;
        }

        // 2. AvatarUrl
        if (request.AvatarUrl != null)
        {
            profile.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
            if (lbProfile != null) lbProfile.AvatarUrl = profile.AvatarUrl;
        }

        // 3. AvatarSeed
        if (request.AvatarSeed != null)
        {
            profile.AvatarSeed = string.IsNullOrWhiteSpace(request.AvatarSeed) ? null : request.AvatarSeed.Trim();
            if (lbProfile != null) lbProfile.AvatarSeed = profile.AvatarSeed;
        }

        // 4. EquippedFrame
        if (request.EquippedFrame != null)
        {
            profile.EquippedFrame = string.IsNullOrWhiteSpace(request.EquippedFrame) ? null : request.EquippedFrame.Trim();
            if (lbProfile != null) lbProfile.EquippedFrame = profile.EquippedFrame;
        }

        // 5. TargetGoal
        if (request.TargetGoal != null)
        {
            profile.TargetGoal = string.IsNullOrWhiteSpace(request.TargetGoal) ? null : request.TargetGoal.Trim().ToLowerInvariant();
        }

        // 6. TargetDailyNewWords
        if (request.TargetDailyNewWords.HasValue)
        {
            profile.TargetDailyNewWords = request.TargetDailyNewWords.Value;
        }

        // 7. LastStudyDate
        if (request.LastStudyDate != null)
        {
            profile.LastStudyDate = string.IsNullOrWhiteSpace(request.LastStudyDate) ? null : request.LastStudyDate.Trim();
        }

        // 8. HasLearnedNightOwl
        if (request.HasLearnedNightOwl.HasValue)
        {
            profile.HasLearnedNightOwl = request.HasLearnedNightOwl.Value || profile.HasLearnedNightOwl;
        }

        // 9. Xp (Monotonic preservation)
        if (request.Xp.HasValue)
        {
            profile.Xp = Math.Max(profile.Xp, request.Xp.Value);
            if (lbProfile != null) lbProfile.TotalXp = Math.Max(lbProfile.TotalXp, request.Xp.Value);
        }

        // 10. Level (Monotonic preservation)
        if (request.Level.HasValue)
        {
            profile.Level = Math.Max(profile.Level, request.Level.Value);
            if (lbProfile != null) lbProfile.Level = Math.Max(lbProfile.Level, request.Level.Value);
        }

        // 11. Streak (Monotonic preservation)
        if (request.Streak.HasValue)
        {
            profile.Streak = Math.Max(profile.Streak, request.Streak.Value);
            if (lbProfile != null) lbProfile.Streak = Math.Max(lbProfile.Streak, request.Streak.Value);
        }

        // 12. FourSkillsScoresJson
        if (request.FourSkillsScoresJson != null)
        {
            profile.FourSkillsScoresJson = request.FourSkillsScoresJson;
        }

        profile.UpdatedAt = DateTime.UtcNow;
        profile.LastActiveAt = DateTime.UtcNow;
        if (lbProfile != null)
        {
            lbProfile.UpdatedAt = DateTime.UtcNow;
            lbProfile.LastActiveAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Đã cập nhật hồ sơ người dùng thành công cho UserId: {UserId}", userId);

        return MapToResponse(profile, user.Email ?? string.Empty);
    }

    public async Task<PublicUserProfileResponse> GetPublicProfileAsync(Guid targetUserId, CancellationToken cancellationToken = default)
    {
        var profile = await _dbContext.UserProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == targetUserId, cancellationToken);

        if (profile == null)
        {
            var user = await _userManager.FindByIdAsync(targetUserId.ToString());
            if (user == null)
            {
                throw new NotFoundException("Không tìm thấy hồ sơ người học tương ứng.");
            }

            return new PublicUserProfileResponse(
                Id: user.Id,
                DisplayName: user.DisplayName,
                AvatarUrl: null,
                AvatarSeed: null,
                Level: 1,
                Xp: 0,
                Streak: 0,
                EquippedFrame: null,
                LastActiveAt: user.CreatedAt
            );
        }

        return new PublicUserProfileResponse(
            Id: profile.Id,
            DisplayName: profile.DisplayName,
            AvatarUrl: profile.AvatarUrl,
            AvatarSeed: profile.AvatarSeed,
            Level: profile.Level,
            Xp: profile.Xp,
            Streak: profile.Streak,
            EquippedFrame: profile.EquippedFrame,
            LastActiveAt: profile.LastActiveAt
        );
    }

    public async Task<IEnumerable<PublicUserProfileResponse>> GetAllProfilesAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.UserProfiles
            .AsNoTracking()
            .OrderByDescending(p => p.LastActiveAt)
            .Take(100)
            .Select(p => new PublicUserProfileResponse(
                p.Id,
                p.DisplayName,
                p.AvatarUrl,
                p.AvatarSeed,
                p.Level,
                p.Xp,
                p.Streak,
                p.EquippedFrame,
                p.LastActiveAt
            ))
            .ToListAsync(cancellationToken);
    }

    private static void ValidateUpdateRequest(UpdateProfileRequest request)
    {
        if (request.DisplayName != null)
        {
            if (string.IsNullOrWhiteSpace(request.DisplayName))
            {
                throw new ValidationException("Tên hiển thị không được để trống.");
            }
            if (request.DisplayName.Trim().Length > 100)
            {
                throw new ValidationException("Tên hiển thị không được vượt quá 100 ký tự.");
            }
        }

        if (!string.IsNullOrWhiteSpace(request.AvatarUrl))
        {
            var avatar = request.AvatarUrl.Trim();
            if (avatar.Length > 500)
            {
                throw new ValidationException("Đường dẫn Avatar không được vượt quá 500 ký tự.");
            }

            var isHttp = Uri.TryCreate(avatar, UriKind.Absolute, out var uri) &&
                         (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
            var isDataUrl = avatar.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase);
            var isRelative = avatar.StartsWith('/');

            if (!isHttp && !isDataUrl && !isRelative)
            {
                throw new ValidationException("Đường dẫn Avatar không hợp lệ. Phải là HTTP/HTTPS URL, relative path hoặc data URL.");
            }
        }

        if (request.AvatarSeed != null && request.AvatarSeed.Length > 100)
        {
            throw new ValidationException("Avatar seed không được vượt quá 100 ký tự.");
        }

        if (request.EquippedFrame != null && request.EquippedFrame.Length > 100)
        {
            throw new ValidationException("Mã khung avatar không được vượt quá 100 ký tự.");
        }

        if (!string.IsNullOrWhiteSpace(request.TargetGoal))
        {
            var goal = request.TargetGoal.Trim().ToLowerInvariant();
            if (!ValidTargetGoals.Contains(goal))
            {
                throw new ValidationException($"Mục tiêu học tập không hợp lệ. Cho phép: {string.Join(", ", ValidTargetGoals)}.");
            }
        }

        if (request.TargetDailyNewWords.HasValue)
        {
            if (request.TargetDailyNewWords.Value < 1 || request.TargetDailyNewWords.Value > 100)
            {
                throw new ValidationException("Mục tiêu số từ mới mỗi ngày phải từ 1 đến 100 từ.");
            }
        }

        if (request.LastStudyDate != null && request.LastStudyDate.Length > 20)
        {
            throw new ValidationException("Ngày học gần nhất không được vượt quá 20 ký tự.");
        }

        if (request.FourSkillsScoresJson != null && request.FourSkillsScoresJson.Length > 50000)
        {
            throw new ValidationException("Dữ liệu điểm 4 kỹ năng vượt quá giới hạn cho phép.");
        }

        if (request.Xp.HasValue && request.Xp.Value < 0)
        {
            throw new ValidationException("Điểm kinh nghiệm (XP) không thể là số âm.");
        }

        if (request.Level.HasValue && request.Level.Value < 1)
        {
            throw new ValidationException("Cấp độ (Level) phải lớn hơn hoặc bằng 1.");
        }

        if (request.Streak.HasValue && request.Streak.Value < 0)
        {
            throw new ValidationException("Chuỗi ngày Streak không thể là số âm.");
        }
    }

    private static UserProfileResponse MapToResponse(UserProfile p, string email)
    {
        return new UserProfileResponse(
            Id: p.Id,
            Email: email,
            DisplayName: p.DisplayName,
            AvatarUrl: p.AvatarUrl,
            AvatarSeed: p.AvatarSeed,
            Level: p.Level,
            Xp: p.Xp,
            Streak: p.Streak,
            EquippedFrame: p.EquippedFrame,
            HasLearnedNightOwl: p.HasLearnedNightOwl,
            TargetGoal: p.TargetGoal,
            TargetDailyNewWords: p.TargetDailyNewWords,
            LastStudyDate: p.LastStudyDate,
            FourSkillsScoresJson: p.FourSkillsScoresJson,
            LastActiveAt: p.LastActiveAt,
            CreatedAt: p.CreatedAt,
            UpdatedAt: p.UpdatedAt
        );
    }
}
