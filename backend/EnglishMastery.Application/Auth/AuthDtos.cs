using System.ComponentModel.DataAnnotations;

namespace EnglishMastery.Application.Auth;

public record RegisterRequest(
    [Required(ErrorMessage = "Email là bắt buộc.")]
    [EmailAddress(ErrorMessage = "Định dạng email không hợp lệ.")]
    string Email,

    [Required(ErrorMessage = "Mật khẩu là bắt buộc.")]
    [MinLength(6, ErrorMessage = "Mật khẩu phải có ít nhất 6 ký tự.")]
    string Password,

    [MaxLength(150, ErrorMessage = "Tên hiển thị không được vượt quá 150 ký tự.")]
    string? DisplayName
);

public record LoginRequest(
    [Required(ErrorMessage = "Email là bắt buộc.")]
    [EmailAddress(ErrorMessage = "Định dạng email không hợp lệ.")]
    string Email,

    [Required(ErrorMessage = "Mật khẩu là bắt buộc.")]
    string Password
);

public record RefreshTokenRequest(
    string? RefreshToken
);

public record UserDto(
    Guid Id,
    string Email,
    string DisplayName,
    IReadOnlyList<string>? Roles = null,
    int PublicAccountId = 0
);

public record AuthResponse(
    string AccessToken,
    string? RefreshToken,
    int ExpiresInSeconds,
    UserDto User
);

public record CurrentUserResponse(
    Guid Id,
    string Email,
    string DisplayName,
    int Level,
    int Xp,
    int Streak,
    string? EquippedFrame,
    DateTime CreatedAt,
    IReadOnlyList<string>? Roles = null,
    int PublicAccountId = 0
);

public record ExternalLoginInfoDto(
    string LoginProvider,
    string ProviderKey,
    string? ProviderDisplayName = null
);
