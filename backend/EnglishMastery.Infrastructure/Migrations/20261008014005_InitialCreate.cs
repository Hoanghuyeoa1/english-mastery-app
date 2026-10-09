using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnglishMastery.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DailyLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    WordsLearned = table.Column<int>(type: "int", nullable: false),
                    XpEarned = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LeaderboardProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    AvatarUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AvatarSeed = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Level = table.Column<int>(type: "int", nullable: false),
                    TotalXp = table.Column<int>(type: "int", nullable: false),
                    WeeklyXp = table.Column<int>(type: "int", nullable: false),
                    Streak = table.Column<int>(type: "int", nullable: false),
                    EquippedFrame = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    LastActiveAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaderboardProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LearningSyncEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SchemaVersion = table.Column<int>(type: "int", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeviceId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ProcessingStatus = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ProcessingDetailsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LearningSyncEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserFrameEntitlements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FrameId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    WeekId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TimesWon = table.Column<int>(type: "int", nullable: false),
                    UnlockedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserFrameEntitlements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    AvatarUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AvatarSeed = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Level = table.Column<int>(type: "int", nullable: false),
                    Xp = table.Column<int>(type: "int", nullable: false),
                    Streak = table.Column<int>(type: "int", nullable: false),
                    EquippedFrame = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    HasLearnedNightOwl = table.Column<bool>(type: "bit", nullable: false),
                    FourSkillsScoresJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LastActiveAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserSrsProgresses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WordId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Interval = table.Column<int>(type: "int", nullable: false),
                    EaseFactor = table.Column<double>(type: "float", nullable: false),
                    Repetition = table.Column<int>(type: "int", nullable: false),
                    NextReviewDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSrsProgresses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WeeklyFinalizations",
                columns: table => new
                {
                    WeekId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    WeekStart = table.Column<DateTime>(type: "datetime2", nullable: false),
                    WeekEnd = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FinalizedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TotalParticipants = table.Column<int>(type: "int", nullable: false),
                    IsFinalized = table.Column<bool>(type: "bit", nullable: false),
                    MetadataJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeeklyFinalizations", x => x.WeekId);
                });

            migrationBuilder.CreateTable(
                name: "WeeklyLeaderboardSnapshots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WeekId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Rank = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    AvatarUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Level = table.Column<int>(type: "int", nullable: false),
                    Score = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    SecondaryScore = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    FrameAwarded = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FinalizedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeeklyLeaderboardSnapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WeeklyLearningMetrics",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WeekId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    WeeklyXp = table.Column<int>(type: "int", nullable: false),
                    VocabMastered = table.Column<int>(type: "int", nullable: false),
                    ReviewConsistency = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    ActiveMinutes = table.Column<int>(type: "int", nullable: false),
                    PronunciationGain = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    ToeicGain = table.Column<int>(type: "int", nullable: true),
                    SupportingEvidenceJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeeklyLearningMetrics", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DailyLogs_UserId_Date",
                table: "DailyLogs",
                columns: new[] { "UserId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeaderboardProfiles_Streak",
                table: "LeaderboardProfiles",
                column: "Streak");

            migrationBuilder.CreateIndex(
                name: "IX_LeaderboardProfiles_TotalXp",
                table: "LeaderboardProfiles",
                column: "TotalXp");

            migrationBuilder.CreateIndex(
                name: "IX_LeaderboardProfiles_WeeklyXp",
                table: "LeaderboardProfiles",
                column: "WeeklyXp");

            migrationBuilder.CreateIndex(
                name: "IX_LearningSyncEvents_UserId_EventId",
                table: "LearningSyncEvents",
                columns: new[] { "UserId", "EventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LearningSyncEvents_UserId_IdempotencyKey",
                table: "LearningSyncEvents",
                columns: new[] { "UserId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LearningSyncEvents_UserId_ReceivedAt",
                table: "LearningSyncEvents",
                columns: new[] { "UserId", "ReceivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserFrameEntitlements_UserId_FrameId",
                table: "UserFrameEntitlements",
                columns: new[] { "UserId", "FrameId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSrsProgresses_UserId_NextReviewDate",
                table: "UserSrsProgresses",
                columns: new[] { "UserId", "NextReviewDate" });

            migrationBuilder.CreateIndex(
                name: "IX_UserSrsProgresses_UserId_WordId",
                table: "UserSrsProgresses",
                columns: new[] { "UserId", "WordId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WeeklyLeaderboardSnapshots_WeekId_Category_Rank",
                table: "WeeklyLeaderboardSnapshots",
                columns: new[] { "WeekId", "Category", "Rank" });

            migrationBuilder.CreateIndex(
                name: "IX_WeeklyLearningMetrics_UserId_WeekId",
                table: "WeeklyLearningMetrics",
                columns: new[] { "UserId", "WeekId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WeeklyLearningMetrics_WeekId_WeeklyXp",
                table: "WeeklyLearningMetrics",
                columns: new[] { "WeekId", "WeeklyXp" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyLogs");

            migrationBuilder.DropTable(
                name: "LeaderboardProfiles");

            migrationBuilder.DropTable(
                name: "LearningSyncEvents");

            migrationBuilder.DropTable(
                name: "UserFrameEntitlements");

            migrationBuilder.DropTable(
                name: "UserProfiles");

            migrationBuilder.DropTable(
                name: "UserSrsProgresses");

            migrationBuilder.DropTable(
                name: "WeeklyFinalizations");

            migrationBuilder.DropTable(
                name: "WeeklyLeaderboardSnapshots");

            migrationBuilder.DropTable(
                name: "WeeklyLearningMetrics");
        }
    }
}
