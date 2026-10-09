using EnglishMastery.Application.Health;
using EnglishMastery.Infrastructure.Health;
using Microsoft.AspNetCore.Mvc;

namespace EnglishMastery.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    private readonly IDatabaseHealthCheckService _dbHealthCheck;
    private readonly IHostEnvironment _environment;

    public HealthController(IDatabaseHealthCheckService dbHealthCheck, IHostEnvironment environment)
    {
        _dbHealthCheck = dbHealthCheck;
        _environment = environment;
    }

    [HttpGet]
    [HttpGet("/api/health")]
    [ProducesResponseType(typeof(HealthCheckResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(HealthCheckResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetHealth(CancellationToken cancellationToken)
    {
        var dbHealth = await _dbHealthCheck.CheckDatabaseHealthAsync(cancellationToken);
        var overallStatus = dbHealth.CanConnect ? "Healthy" : "Degraded";

        var response = new HealthCheckResponse(
            Status: overallStatus,
            Environment: _environment.EnvironmentName,
            ServerTimeUtc: DateTime.UtcNow,
            Database: dbHealth
        );

        if (!dbHealth.CanConnect)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, response);
        }

        return Ok(response);
    }
}
