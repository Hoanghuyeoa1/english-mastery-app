using System.Security.Claims;
using EnglishMastery.Application.Sync;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnglishMastery.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SyncController : ControllerBase
{
    private readonly ISyncService _syncService;
    private readonly ILogger<SyncController> _logger;

    public SyncController(ISyncService syncService, ILogger<SyncController> logger)
    {
        _syncService = syncService;
        _logger = logger;
    }

    /// <summary>
    /// Lấy toàn bộ snapshot dữ liệu học tập trên Cloud của người dùng hiện tại
    /// (Hồ sơ, tiến trình SRS, nhật ký học tập hàng ngày, server time)
    /// </summary>
    [HttpGet("state")]
    public async Task<ActionResult<SyncStateResponse>> GetSyncState(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        var state = await _syncService.GetSyncStateAsync(userId.Value, cancellationToken);
        return Ok(state);
    }

    /// <summary>
    /// Tải lên và hợp nhất (upsert) snapshot tiến trình học tập từ thiết bị lên Cloud
    /// Thực hiện trong một transaction nguyên tử và đảm bảo Completed Always Wins
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SyncUploadResponse>> UploadSync(
        [FromBody] SyncUploadRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        var response = await _syncService.ProcessSyncAsync(userId.Value, request, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Gửi lô sự kiện học tập (Domain Events) từ Local Outbox lên Cloud
    /// Thực hiện thẩm định envelope, idempotency enforcement và domain projections
    /// </summary>
    [HttpPost("events")]
    public async Task<ActionResult<IngestLearningEventsResponse>> IngestEvents(
        [FromBody] System.Text.Json.JsonElement body,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { code = "UNAUTHORIZED", message = "Phiên đăng nhập không hợp lệ." });
        }

        List<IngestDomainEventRequest>? eventsList = null;
        var jsonOptions = new System.Text.Json.JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        if (body.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            eventsList = System.Text.Json.JsonSerializer.Deserialize<List<IngestDomainEventRequest>>(body.GetRawText(), jsonOptions);
        }
        else if (body.ValueKind == System.Text.Json.JsonValueKind.Object)
        {
            if (body.TryGetProperty("events", out var eventsProp) && eventsProp.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                eventsList = System.Text.Json.JsonSerializer.Deserialize<List<IngestDomainEventRequest>>(eventsProp.GetRawText(), jsonOptions);
            }
            else
            {
                var single = System.Text.Json.JsonSerializer.Deserialize<IngestDomainEventRequest>(body.GetRawText(), jsonOptions);
                if (single != null && !string.IsNullOrEmpty(single.EventId))
                {
                    eventsList = new List<IngestDomainEventRequest> { single };
                }
            }
        }

        var response = await _syncService.IngestEventsAsync(userId.Value, eventsList ?? new List<IngestDomainEventRequest>(), cancellationToken);
        return Ok(response);
    }


    private Guid? GetCurrentUserId()
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                         User.FindFirstValue("sub");

        if (Guid.TryParse(claimValue, out var guid))
        {
            return guid;
        }

        return null;
    }
}
