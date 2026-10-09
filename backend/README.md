# English Mastery Backend (ASP.NET Core & SQL Server)

Canonical production backend for English Mastery App, replacing Supabase with a high-performance, strongly-typed ASP.NET Core Web API, Entity Framework Core, SQL Server, and SignalR realtime engine.

---

## 1. Prerequisites

- **.NET SDK**: .NET 10.0 (or .NET 9.0+) SDK installed (`dotnet --version`)
- **SQL Server**:
  - Local SQL Server instance (e.g. `localhost`, `localhost\SQLEXPRESS`, or Docker container `mcr.microsoft.com/mssql/server:2022-latest`)
  - SQL Server Authentication or Windows Integrated Security
- **Node.js**: Node.js 20+ and npm 10+ (for client application)

---

## 2. SQL Server Setup

1. **Verify or start SQL Server instance**:
   ```powershell
   # If using local SQL Express:
   Get-Service -Name "MSSQL*"
   ```
2. **Database Initialization**:
   By default, the application connects to database `EnglishMasteryDb`.
   Connection string configuration default:
   ```text
   Server=localhost;Database=EnglishMasteryDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True
   ```

---

## 3. Configuration & User Secrets

Sensitive configuration (JWT Secret, Admin API Key, SQL Connection Strings) can be configured via `appsettings.json`, environment variables, or .NET User Secrets.

### User Secrets (Development):
```bash
cd backend/EnglishMastery.Api
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Database=EnglishMasteryDb;Trusted_Connection=True;TrustServerCertificate=True"
dotnet user-secrets set "Jwt:SecretKey" "EnglishMasterySuperSecretKeyForDevelopmentAndTestingOnly1234567890!"
dotnet user-secrets set "Security:AdminApiKey" "dev-finalization-secret-key"
```

### Environment Variables:
| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `ConnectionStrings__DefaultConnection` | `Server=localhost;Database=EnglishMasteryDb;...` | SQL Server database connection string |
| `Jwt__SecretKey` | `EnglishMasterySuperSecretKey...` | 256-bit HMAC secret key for JWT signing |
| `Jwt__Issuer` | `EnglishMasteryApi` | JWT Token Issuer |
| `Jwt__Audience` | `EnglishMasteryApp` | JWT Token Audience |
| `Jwt__AccessTokenExpiryMinutes` | `60` | Access Token lifetime in minutes |
| `Jwt__RefreshTokenExpiryDays` | `30` | Refresh Token lifetime in days |
| `Security__AdminApiKey` | `dev-finalization-secret-key` | Secret key for weekly finalization cron/admin API |

---

## 4. Entity Framework Core Migrations

Apply migrations to create or update the SQL Server schema:

```powershell
# From repository root:
dotnet ef database update --project backend/EnglishMastery.Infrastructure --startup-project backend/EnglishMastery.Api

# Or create a new migration if modifying domain entities:
dotnet ef migrations add <MigrationName> --project backend/EnglishMastery.Infrastructure --startup-project backend/EnglishMastery.Api
```

---

## 5. Running the Backend

```powershell
cd backend/EnglishMastery.Api
dotnet run
```
Backend API will start at:
- HTTP: `http://localhost:5000`
- Swagger UI (Development): `http://localhost:5000/swagger`
- SignalR Realtime Hub: `http://localhost:5000/hubs/leaderboard`

---

## 6. Running the Frontend

```powershell
# From repository root:
npm install
npm run dev
```
Frontend Vite development server runs at `http://localhost:5173`.
Ensure `.env` contains:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 7. Testing & Test Database

The backend test suite (`EnglishMastery.Tests`) utilizes ASP.NET Core `WebApplicationFactory<Program>` with an isolated SQL Server test database (`EnglishMasteryDb_Tests`):

```powershell
# Run backend test suite:
dotnet test backend/EnglishMastery.Tests/EnglishMastery.Tests.csproj

# Run frontend API cutover test suites:
npx vitest run src/services/api/__tests__/
```

---

## 8. Subsystems & Endpoints

| Domain | Controller / Route | Description |
| :--- | :--- | :--- |
| **Auth** | `/api/auth/*` | Register, Login, Refresh, Logout, Session check |
| **Profiles** | `/api/profiles/*` | User profile retrieval, sync, and frame equipping |
| **Cloud Sync** | `/api/sync/*` | Local-First snapshot download, state sync, and upload |
| **Event Sync** | `/api/sync/events` | Granular event-based idempotent sync endpoint |
| **Leaderboard** | `/api/leaderboard/*` | 7-category rankings, server time, user rank, score sync |
| **Finalization** | `/api/leaderboard/finalization/*` | Canonical Vietnam Sunday weekly rollover & snapshots |
| **Frame Rewards**| `/api/frames/*` | Podium avatar frame entitlements and inventory |
| **Realtime** | `/hubs/leaderboard` | SignalR WebSocket hub for instantaneous leaderboard updates |
