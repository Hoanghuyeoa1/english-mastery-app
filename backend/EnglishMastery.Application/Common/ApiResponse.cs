namespace EnglishMastery.Application.Common;

public record ApiResponse<T>(
    bool Success,
    T? Data = default,
    string? Message = null
);

public record ErrorResponse(
    string Code,
    string Message,
    string? Details = null
);
