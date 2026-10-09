namespace EnglishMastery.Application.Sync;

public interface ISyncService
{
    Task<SyncStateResponse> GetSyncStateAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<SyncUploadResponse> ProcessSyncAsync(Guid userId, SyncUploadRequest request, CancellationToken cancellationToken = default);
    Task<IngestLearningEventsResponse> IngestEventsAsync(Guid userId, List<IngestDomainEventRequest> events, CancellationToken cancellationToken = default);
}

