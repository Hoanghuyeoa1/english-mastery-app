using System.Data;
using System.Data.Common;
using EnglishMastery.Application.Auth;
using EnglishMastery.Domain.Exceptions;
using EnglishMastery.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;

namespace EnglishMastery.Infrastructure.Auth;

public class PublicAccountIdAllocator : IPublicAccountIdAllocator
{
    public const int MinId = 100000;
    public const int MaxId = 999999;

    private static int _inMemoryFallbackCounter = 100000;

    private readonly AppDbContext _dbContext;
    private readonly ILogger<PublicAccountIdAllocator> _logger;

    public PublicAccountIdAllocator(AppDbContext dbContext, ILogger<PublicAccountIdAllocator> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<int> AllocateNextIdAsync(CancellationToken cancellationToken = default)
    {
        // Kiểm tra nếu không phải SQL Server (ví dụ kiểm thử InMemory hoặc mock provider)
        if (!_dbContext.Database.IsSqlServer())
        {
            var inMemId = Interlocked.Increment(ref _inMemoryFallbackCounter) - 1;
            if (inMemId > MaxId)
            {
                throw new PublicAccountIdExhaustedException("Không gian mã học viên 6 chữ số (100000 - 999999) đã cạn kiệt trong in-memory fallback.");
            }
            return inMemId;
        }

        try
        {
            var connection = _dbContext.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
            }

            await using var command = connection.CreateCommand();

            // Đảm bảo gắn active transaction của DbContext nếu đang nằm trong transaction
            var currentTx = _dbContext.Database.CurrentTransaction;
            if (currentTx != null)
            {
                command.Transaction = currentTx.GetDbTransaction();
            }

            command.CommandText = "SELECT NEXT VALUE FOR PublicAccountIdSequence;";
            var result = await command.ExecuteScalarAsync(cancellationToken);

            if (result == null || result == DBNull.Value)
            {
                throw new InvalidOperationException("Không thể nhận giá trị từ Sequence PublicAccountIdSequence.");
            }

            var nextId = Convert.ToInt32(result);

            if (nextId < MinId || nextId > MaxId)
            {
                _logger.LogCritical("Mã học viên sinh ra từ Sequence ({NextId}) nằm ngoài phạm vi cho phép (100000 - 999999).", nextId);
                throw new PublicAccountIdExhaustedException($"Mã học viên {nextId} nằm ngoài phạm vi 6 chữ số hợp lệ (100000 - 999999).");
            }

            _logger.LogDebug("Đã cấp phát thành công PublicAccountId: {PublicAccountId}", nextId);
            return nextId;
        }
        catch (Microsoft.Data.SqlClient.SqlException sqlEx) when (sqlEx.Number == 11728)
        {
            _logger.LogError(sqlEx, "Sequence PublicAccountIdSequence đã chạm trần 999999 và không thể cycle.");
            throw new PublicAccountIdExhaustedException("Không gian mã học viên 6 chữ số (100000 - 999999) đã được cấp phát hết.", sqlEx);
        }
    }
}
