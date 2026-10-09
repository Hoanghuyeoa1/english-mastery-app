using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Common;
using EnglishMastery.Domain.Entities;
using EnglishMastery.Domain.Exceptions;
using EnglishMastery.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Auth;

public class AuthService : IAuthService
{
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;
    private readonly AppDbContext _dbContext;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        UserManager<AppUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager,
        AppDbContext dbContext,
        IJwtTokenGenerator jwtTokenGenerator,
        IConfiguration configuration,
        ILogger<AuthService> logger)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _dbContext = dbContext;
        _jwtTokenGenerator = jwtTokenGenerator;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var existingUser = await _userManager.FindByEmailAsync(normalizedEmail);
        if (existingUser != null)
        {
            throw new ConflictException("Email này đã được sử dụng để đăng ký tài khoản.");
        }

        var displayName = !string.IsNullOrWhiteSpace(request.DisplayName)
            ? request.DisplayName.Trim()
            : normalizedEmail.Split('@')[0];

        if (displayName.Length > 150)
        {
            displayName = displayName.Substring(0, 150);
        }

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = normalizedEmail,
            Email = normalizedEmail,
            DisplayName = displayName,
            CreatedAt = DateTime.UtcNow
        };

        var strategy = _dbContext.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var result = await _userManager.CreateAsync(user, request.Password);
                if (!result.Succeeded)
                {
                    if (result.Errors.Any(e => e.Code.Contains("Duplicate", StringComparison.OrdinalIgnoreCase)))
                    {
                        throw new ConflictException("Email này đã được sử dụng để đăng ký tài khoản.");
                    }
                    var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                    throw new ValidationException(errors, errors);
                }

                // Gán vai trò mặc định USER (không bao giờ tự cấp ADMIN)
                if (!await _roleManager.RoleExistsAsync(AppRoles.User))
                {
                    await _roleManager.CreateAsync(new IdentityRole<Guid>
                    {
                        Id = AppRoles.UserRoleId,
                        Name = AppRoles.User,
                        NormalizedName = AppRoles.User.ToUpperInvariant()
                    });
                }

                var roleResult = await _userManager.AddToRoleAsync(user, AppRoles.User);
                if (!roleResult.Succeeded)
                {
                    var roleErrors = string.Join(", ", roleResult.Errors.Select(e => e.Description));
                    throw new ValidationException(roleErrors, roleErrors);
                }
                var userRoles = new[] { AppRoles.User };

                // Khởi tạo hồ sơ người dùng 1:1 tương ứng
                var profile = new UserProfile
                {
                    Id = user.Id,
                    DisplayName = displayName,
                    Level = 1,
                    Xp = 0,
                    Streak = 0,
                    CreatedAt = DateTime.UtcNow,
                    LastActiveAt = DateTime.UtcNow
                };

                var lbProfile = new LeaderboardProfile
                {
                    Id = user.Id,
                    DisplayName = displayName,
                    Level = 1,
                    TotalXp = 0,
                    WeeklyXp = 0,
                    Streak = 0,
                    CreatedAt = DateTime.UtcNow,
                    LastActiveAt = DateTime.UtcNow
                };

                _dbContext.UserProfiles.Add(profile);
                _dbContext.LeaderboardProfiles.Add(lbProfile);

                // Sinh cặp JWT Access Token và Refresh Token
                var accessToken = _jwtTokenGenerator.GenerateAccessToken(user, userRoles);
                var refreshToken = _jwtTokenGenerator.GenerateRefreshToken(user.Id, ipAddress);

                _dbContext.RefreshTokens.Add(refreshToken);
                await _dbContext.SaveChangesAsync(cancellationToken);

                await transaction.CommitAsync(cancellationToken);

                _logger.LogInformation("Đã đăng ký tài khoản người dùng mới thành công với UserId: {UserId}", user.Id);

                var expirationMinutes = int.TryParse(_configuration["Jwt:AccessTokenExpirationMinutes"], out var mins) ? mins : 60;
                return new AuthResponse(
                    AccessToken: accessToken,
                    RefreshToken: refreshToken.Token,
                    ExpiresInSeconds: expirationMinutes * 60,
                    User: new UserDto(user.Id, user.Email!, user.DisplayName, userRoles)
                );
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        if (user == null)
        {
            throw new UnauthorizedException("Email hoặc mật khẩu không chính xác.");
        }

        var isPasswordValid = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!isPasswordValid)
        {
            throw new UnauthorizedException("Email hoặc mật khẩu không chính xác.");
        }

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _jwtTokenGenerator.GenerateAccessToken(user, roles);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken(user.Id, ipAddress);

        _dbContext.RefreshTokens.Add(refreshToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Người dùng {UserId} đăng nhập thành công.", user.Id);

        var expirationMinutes = int.TryParse(_configuration["Jwt:AccessTokenExpirationMinutes"], out var mins) ? mins : 60;
        return new AuthResponse(
            AccessToken: accessToken,
            RefreshToken: refreshToken.Token,
            ExpiresInSeconds: expirationMinutes * 60,
            User: new UserDto(user.Id, user.Email!, user.DisplayName, roles.ToList())
        );
    }

    public async Task<AuthResponse> RefreshTokenAsync(string refreshTokenString, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshTokenString))
        {
            throw new UnauthorizedException("Refresh token không được để trống.");
        }

        var token = await _dbContext.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == refreshTokenString, cancellationToken);

        if (token == null || !token.IsActive || token.User == null)
        {
            throw new UnauthorizedException("Refresh token không hợp lệ hoặc đã hết hạn.");
        }

        var roles = await _userManager.GetRolesAsync(token.User);

        // Thu hồi token cũ (Rotation)
        token.RevokedAt = DateTime.UtcNow;

        // Sinh cặp token mới
        var newAccessToken = _jwtTokenGenerator.GenerateAccessToken(token.User, roles);
        var newRefreshToken = _jwtTokenGenerator.GenerateRefreshToken(token.UserId, ipAddress);
        token.ReplacedByToken = newRefreshToken.Token;

        _dbContext.RefreshTokens.Add(newRefreshToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var expirationMinutes = int.TryParse(_configuration["Jwt:AccessTokenExpirationMinutes"], out var mins) ? mins : 60;
        return new AuthResponse(
            AccessToken: newAccessToken,
            RefreshToken: newRefreshToken.Token,
            ExpiresInSeconds: expirationMinutes * 60,
            User: new UserDto(token.User.Id, token.User.Email!, token.User.DisplayName, roles.ToList())
        );
    }

    public async Task RevokeRefreshTokenAsync(string refreshTokenString, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshTokenString)) return;

        var token = await _dbContext.RefreshTokens
            .FirstOrDefaultAsync(r => r.Token == refreshTokenString, cancellationToken);

        if (token != null && token.IsActive)
        {
            token.RevokedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Đã thu hồi refresh token cho người dùng {UserId}.", token.UserId);
        }
    }

    public async Task<CurrentUserResponse> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin tài khoản người dùng.");
        }

        var profile = await _dbContext.UserProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == userId, cancellationToken);

        var roles = await _userManager.GetRolesAsync(user);

        return new CurrentUserResponse(
            Id: user.Id,
            Email: user.Email ?? string.Empty,
            DisplayName: user.DisplayName,
            Level: profile?.Level ?? 1,
            Xp: profile?.Xp ?? 0,
            Streak: profile?.Streak ?? 0,
            EquippedFrame: profile?.EquippedFrame,
            CreatedAt: user.CreatedAt,
            Roles: roles.ToList()
        );
    }

    public async Task<AuthResponse> CreateAuthResponseAsync(AppUser user, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _jwtTokenGenerator.GenerateAccessToken(user, roles);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken(user.Id, ipAddress);

        _dbContext.RefreshTokens.Add(refreshToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var expirationMinutes = int.TryParse(_configuration["Jwt:AccessTokenExpirationMinutes"], out var mins) ? mins : 60;
        return new AuthResponse(
            AccessToken: accessToken,
            RefreshToken: refreshToken.Token,
            ExpiresInSeconds: expirationMinutes * 60,
            User: new UserDto(user.Id, user.Email ?? string.Empty, user.DisplayName, roles.ToList())
        );
    }
}
