namespace EnglishMastery.Application.Health;

public record DatabaseHealthInfo(
    string Status,
    bool CanConnect,
    string? Error = null
);

public record HealthCheckResponse(
    string Status,
    string Environment,
    DateTime ServerTimeUtc,
    DatabaseHealthInfo Database
);
