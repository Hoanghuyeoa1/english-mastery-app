using EnglishMastery.Domain.Common;

namespace EnglishMastery.Domain.Entities;

public class LearningSyncEvent : BaseEntity
{
    public Guid UserId { get; set; }
    public string EventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public int SchemaVersion { get; set; } = 1;
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public string DeviceId { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public string ProcessingStatus { get; set; } = "applied";
    public string ProcessingDetailsJson { get; set; } = "{}";
}
