-- ============================================================================
-- SCRIPT: cleanup_verified_dev_demo_data.sql
-- MỤC TIÊU: Dọn dẹp dữ liệu test/demo đã xác minh trên SQL Server EnglishMasteryDev
-- AN TOÀN:
-- 1. Kiểm tra chính xác DB_NAME() = 'EnglishMasteryDev' (chặn nhầm database)
-- 2. Chỉ xóa các bản ghi thuộc về tài khoản test đã xác minh (@test.com, @example.com)
--    và các bản ghi finalization/snapshots sinh ra trong quá trình test
-- 3. Sử dụng TRANSACTION có kiểm tra lỗi (XACT_ABORT ON)
-- 4. BẢO TỒN 100%: __EFMigrationsHistory, Identity Schema, Roles, Constraints, Indexes
-- ============================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;

USE EnglishMasteryDev;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;

-- 1. Bảo vệ cơ sở dữ liệu (Safety Guard: Database Name)
IF (DB_NAME() <> N'EnglishMasteryDev')
BEGIN
    RAISERROR(N'LỖI BẢO MẬT: Script chỉ được phép chạy trên database EnglishMasteryDev!', 16, 1);
    RETURN;
END;

BEGIN TRANSACTION;

-- 2. Tạo bảng tạm chứa danh sách User Id của tài khoản test đã xác minh
CREATE TABLE #TestUserIds (
    UserId uniqueidentifier PRIMARY KEY,
    Email nvarchar(256)
);

INSERT INTO #TestUserIds (UserId, Email)
SELECT CAST(Id AS uniqueidentifier), Email
FROM dbo.AspNetUsers
WHERE Email LIKE '%@test.com' 
   OR Email LIKE '%@example.com';

DECLARE @TestUserCount int = (SELECT COUNT(*) FROM #TestUserIds);
PRINT N'[BẢO VỆ] Đã xác định ' + CAST(@TestUserCount AS nvarchar(20)) + N' tài khoản test/demo để dọn dẹp.';

-- 3. Xóa theo thứ tự ràng buộc phụ thuộc (FK dependency order)

-- 3.1. RefreshTokens (FK to AspNetUsers)
DELETE rt
FROM dbo.RefreshTokens rt
INNER JOIN #TestUserIds tu ON rt.UserId = tu.UserId;
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ RefreshTokens.';

-- 3.2. AspNetUserRoles, Claims, Logins, Tokens (nếu có)
DELETE ur FROM dbo.AspNetUserRoles ur INNER JOIN #TestUserIds tu ON ur.UserId = tu.UserId;
DELETE uc FROM dbo.AspNetUserClaims uc INNER JOIN #TestUserIds tu ON uc.UserId = tu.UserId;
DELETE ul FROM dbo.AspNetUserLogins ul INNER JOIN #TestUserIds tu ON ul.UserId = tu.UserId;
DELETE ut FROM dbo.AspNetUserTokens ut INNER JOIN #TestUserIds tu ON ut.UserId = tu.UserId;

-- 3.3. WeeklyLeaderboardSnapshots (Snapshots phụ thuộc UserId hoặc các tuần test)
DELETE s
FROM dbo.WeeklyLeaderboardSnapshots s
WHERE s.UserId IN (SELECT UserId FROM #TestUserIds)
   OR s.WeekId NOT LIKE '2026-W%';
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ WeeklyLeaderboardSnapshots.';

-- 3.4. WeeklyLearningMetrics
DELETE w
FROM dbo.WeeklyLearningMetrics w
WHERE w.UserId IN (SELECT UserId FROM #TestUserIds)
   OR w.WeekId NOT LIKE '2026-W%';
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ WeeklyLearningMetrics.';

-- 3.5. WeeklyFinalizations (Toàn bộ các bản ghi finalization từ test)
DELETE FROM dbo.WeeklyFinalizations
WHERE WeekId NOT LIKE '2026-W%' 
   OR TotalParticipants <= 6;
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ WeeklyFinalizations.';

-- 3.6. UserFrameEntitlements
DELETE f
FROM dbo.UserFrameEntitlements f
WHERE f.UserId IN (SELECT UserId FROM #TestUserIds);
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ UserFrameEntitlements.';

-- 3.7. DailyLogs
DELETE d
FROM dbo.DailyLogs d
WHERE d.UserId IN (SELECT UserId FROM #TestUserIds);
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ DailyLogs.';

-- 3.8. UserSrsProgresses
DELETE p
FROM dbo.UserSrsProgresses p
WHERE p.UserId IN (SELECT UserId FROM #TestUserIds);
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ UserSrsProgresses.';

-- 3.9. LearningSyncEvents
DELETE e
FROM dbo.LearningSyncEvents e
WHERE e.UserId IN (SELECT UserId FROM #TestUserIds);
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ LearningSyncEvents.';

-- 3.10. LeaderboardProfiles
DELETE lp
FROM dbo.LeaderboardProfiles lp
WHERE lp.Id IN (SELECT UserId FROM #TestUserIds);
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ LeaderboardProfiles.';

-- 3.11. UserProfiles
DELETE up
FROM dbo.UserProfiles up
WHERE up.Id IN (SELECT UserId FROM #TestUserIds);
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ UserProfiles.';

-- 3.12. AspNetUsers
DELETE u
FROM dbo.AspNetUsers u
WHERE u.Id IN (SELECT CAST(UserId AS nvarchar(450)) FROM #TestUserIds);
PRINT N'[DỌN DẸP] Đã xóa ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' dòng từ AspNetUsers.';

DROP TABLE #TestUserIds;

-- 4. Kiểm tra an toàn: Đảm bảo __EFMigrationsHistory không bị chạm đến
DECLARE @MigrationHistoryCount int = (SELECT COUNT(*) FROM dbo.__EFMigrationsHistory);
IF @MigrationHistoryCount < 4
BEGIN
    RAISERROR(N'CẢNH BÁO: __EFMigrationsHistory bị ảnh hưởng! Đang ROLLBACK transaction...', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;

PRINT N'[THÀNH CÔNG] Dọn dẹp hoàn tất. Đang COMMIT transaction...';
COMMIT TRANSACTION;
GO
