namespace EnglishMastery.Application.Auth;

public interface IPublicAccountIdAllocator
{
    Task<int> AllocateNextIdAsync(CancellationToken cancellationToken = default);
}
