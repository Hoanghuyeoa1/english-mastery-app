# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [1.6.0] - 2026-10-09 — CANONICAL ACCESS STATE, WELCOME GATE & DATA ISOLATION (Phases 1 — 8)

### Fixed, Hardened & Runtime Verified — Welcome Bypass Root Cause, Guest Lifecycle & Zero-Loss Multi-Identity Isolation

- **Root Cause Thực Tế Được Khắc Phục Triệt Để**:
  - **Lỗ hổng Logic Bypass cũ:** File `App.tsx` phiên bản trước chứa điều kiện `if (hasLocalData || onboardingCompleted) return <Dashboard />`. Dữ liệu học tập cũ trong localStorage (`english_mastery_storage_v2`) từ các phiên học trước khiến ứng dụng tự động mở Dashboard mà không qua Welcome gate dù chưa đăng nhập.
  - **Khóa Cache PWA Service Worker:** `vite-plugin-pwa` precache `index.html` với `registerType: 'prompt'`. Thiếu cấu hình `vercel.json` dẫn đến việc trình duyệt người dùng tiếp tục phục vụ bundle cũ từ cache vô thời hạn khi truy cập Vercel.

- **Chi Tiết Triển Khai Toàn Diện Theo 8 Giai Đoạn (Phases 1 — 8)**:
  - **Phase 1 — Root Cause Audit & Regression Suite:** Xác định 2 rễ nguyên nhân gốc rễ, thiết lập ranh giới bất biến giữa dữ liệu học tập và danh tính người dùng. Xây dựng bộ test [WelcomeBypassPhase1Regression.test.tsx](src/components/__tests__/WelcomeBypassPhase1Regression.test.tsx) (**8/8 tests PASS**).
  - **Phase 2 — Canonical Access State & Welcome Gate:** Thiết lập FSM 5 trạng thái (`initializing`, `auth_unavailable`, `welcome`, `guest`, `authenticated`) trong `App.tsx`. Gỡ bỏ triệt để mọi logic bypass ngầm dựa trên XP, Streak, hoặc cờ `onboardingCompleted`. Xây dựng bộ test [Phase2CanonicalAccessGate.test.tsx](src/components/__tests__/Phase2CanonicalAccessGate.test.tsx) (**11/11 tests PASS**).
  - **Phase 3 — Explicit Guest Session Lifecycle:** Quản lý vòng đời Guest độc lập qua `sessionStorage` (`guestSessionStorage.ts`). Chế độ Khách chỉ kích hoạt khi người dùng click chủ động "Tiếp tục học mà không cần tài khoản". Không tự cấp Khách lúc mount, reload hay khi backend offline. Xây dựng [Phase3GuestLifecycle.test.tsx](src/components/__tests__/Phase3GuestLifecycle.test.tsx) (**12/12 tests PASS**).
  - **Phase 4 — Verified Backend Auth Session:** Trạng thái xác thực chỉ được cấp sau khi ASP.NET Core xác thực thành công qua `/api/auth/me`. Xử lý refresh token xoay vòng và RFC 7807 validation details. Khóa generation guards chống stale response. Xây dựng [Phase4VerifiedAuthSession.test.tsx](src/components/__tests__/Phase4VerifiedAuthSession.test.tsx) (**11/11 tests PASS**).
  - **Phase 5 — Legacy Data Preservation & Non-Destructive Slotting:** Quản lý khe lưu trữ độc lập qua `dataOwnershipManager.ts`: `emh_guest_slot`, `emh_user_slot_<userId>`, và `emh_legacy_unassigned_backup`. Tuyệt đối không xóa `localStorage`, không tự gộp dữ liệu giữa các danh tính. Xây dựng [Phase5LegacyDataPreservation.test.tsx](src/components/__tests__/Phase5LegacyDataPreservation.test.tsx) (**12/12 tests PASS**).
  - **Phase 6 — Identity Isolation & Account Switching:** Cách ly hoàn toàn dữ liệu giữa Khách, Tài khoản A và Tài khoản B. Hủy private in-flight requests, dọn cache, và thu hồi quyền quản trị ADMIN lập tức khi logout. Xây dựng [Phase6IdentityIsolation.test.tsx](src/components/__tests__/Phase6IdentityIsolation.test.tsx) (**13/13 tests PASS**).
  - **Phase 7 — Vercel, Unified & PWA Consistency:** Thiết lập cấu hình chuẩn `vercel.json` bảo toàn route `/api/(.*)` và cấu hình `Cache-Control: no-cache, no-store, must-revalidate` cho `/index.html` và `/sw.js`. Kích hoạt `cleanupOutdatedCaches: true` trong Workbox. Xây dựng [Phase7VercelUnifiedPwaConsistency.test.tsx](src/components/__tests__/Phase7VercelUnifiedPwaConsistency.test.tsx) (**11/11 tests PASS**).
  - **Phase 8 — Final E2E Verification & Release Quality Gate:** Xây dựng bộ test tích hợp tổng hợp [Phase8FinalVerificationE2E.test.tsx](src/components/__tests__/Phase8FinalVerificationE2E.test.tsx) (**10/10 tests PASS**).

- **Chất Lượng & Kết Quả Kiểm Thử (Quality Gates)**:
  - `npx tsc -b`: **0 errors** (Strict TypeScript type-safety).
  - `npm run lint` (`oxlint`): **0 errors** trên 565 files.
  - `npm run build` (`tsc -b && vite build`): Biên dịch thành công trong 1.64s, PWA precache 30 entries (11.7MB).
  - `dotnet test`: **210/210 backend tests PASS (100%)**.
  - Vitest Regression Suites (Phases 1 — 8): **88/88 frontend tests PASS (100%)**.

- **Trạng Thái Vận Hành & Giới Hạn Còn Tồn Tại**:
  - **Local Development (`localhost:5173` / `localhost:5000`):** 100% HEALTHY & VERIFIED.
  - **Vercel Remote Deployment:** `PRODUCTION NOT VERIFIED (REMOTE HOSTING)` do Vercel là môi trường Frontend-Only, chưa được cấu hình URL Backend ASP.NET Core công khai trên Cloud.
  - **Google OAuth 2.0:** Logic PKCE, Popup Child Relay và Unit tests 100% PASS; Luồng Live E2E đánh dấu **BLOCKED** chờ cập nhật Production Client ID & Secret từ Google Cloud Console.

## [1.5.0] - 2026-10-09 — DUAL-MODE UNIFIED HOSTING & RELEASE GATE (Phases 1 — 8)

### Added, Hardened & Runtime Verified — Dual-Mode Architecture, Single-Origin Unified Hosting & Release Gate

- **Kiến Trúc Hai Chế Độ Vận Hành (Dual Hosting Modes Architecture)**:
  - **DEV MODE (`npm run dev`):** Trình điều phối `scripts/dev.mjs` khởi động đồng thời Vite Frontend (`http://localhost:5173`) và ASP.NET Core 10 Backend (`http://localhost:5000`). Hỗ trợ HMR, thăm dò sức khỏe SQL Server qua `/api/health`, và dọn dẹp sạch sẽ toàn bộ cây tiến trình (`taskkill /F /T /PID`) khi nhấn Ctrl+C, bảo đảm không orphan process.
  - **UNIFIED MODE (`npm run start:unified`):** Trình điều phối `scripts/start-unified.mjs` tự động biên dịch React Production bundle bằng Vite, đồng bộ tài nguyên vào `backend/EnglishMastery.Api/wwwroot`, và khởi chạy máy chủ duy nhất trên cổng 5000. Máy chủ ASP.NET Core phục vụ đồng thời:
    - React SPA tại root `/` và các client routes (`/dashboard`, `/leaderboard`, `/admin`, `/toeic`).
    - REST API tại `/api/*`.
    - SignalR Realtime Leaderboard Hub tại `/hubs/leaderboard`.
    - Web Manifest chuẩn PWA tại `/manifest.webmanifest` (`application/manifest+json`).
    - Service Worker tại `/sw.js` (`no-cache, no-store, must-revalidate`).
    - Cổng 5173 hoàn toàn không chạy, loại bỏ hoàn toàn chi phí CORS trên cùng một browser origin.

- **Chi Tiết Triển Khai Theo 8 Giai Đoạn (Phases 1 — 8)**:
  - **Phase 1 — Dual-Mode Architecture & Origin Specification:** Xác lập rõ ranh giới hai browser origin `localhost:5173` và `localhost:5000`. Thiết kế kiến trúc chuyển tiếp không phá vỡ logic nghiệp vụ hiện có.
  - **Phase 2 — React Build & Static Asset Pipeline:** Cấu hình đường dẫn xuất bundle Vite vào `dist/` và đồng bộ an toàn sang `backend/EnglishMastery.Api/wwwroot`. Kiểm tra chặt chẽ tính toàn vẹn của `index.html` và hash assets.
  - **Phase 3 — ASP.NET Core Static File Hosting & Single-Origin Routing:**
    - Cấu hình `FileExtensionContentTypeProvider` bổ sung MIME type `application/manifest+json` cho file `.webmanifest`.
    - Thiết lập header `Cache-Control: public, max-age=31536000, immutable` cho toàn bộ tài nguyên băm `/assets/*`.
    - Thiết lập `Cache-Control: no-cache, no-store, must-revalidate` cho `/index.html`, `/sw.js`, `/manifest.webmanifest`.
    - Cấu hình `MapFallback` thông minh: Phục vụ `index.html` cho client routes, đồng thời cách ly tuyệt đối các route `/api/*`, `/hubs/*`, `/health` và missing static assets, trả về mã HTTP 404 JSON (NOT_FOUND) hoặc 404 chuẩn, không bị SPA fallback nuốt lỗi.
  - **Phase 4 — Local Development Orchestration:**
    - Xây dựng `scripts/dev.mjs` và `scripts/start-unified.mjs` với khả năng phát hiện va chạm cổng mạng, kiểm tra an toàn không tự ý kill tiến trình bên ngoài.
    - Quản lý vòng đời tiến trình trên Windows qua `taskkill /F /T /PID`, triệt tiêu hoàn toàn nguy cơ rò rỉ tiến trình chạy ngầm.
  - **Phase 5 — Authentication & RBAC Cross-Mode Integration:**
    - Khảo sát và hỗ trợ luồng xác thực kép: Email/Password và Google OAuth 2.0 PKCE.
    - Mở rộng danh sách `AllowedReturnUrls` trong backend cho phép cả `http://localhost:5173` và `http://localhost:5000`.
    - Đảm bảo Google OAuth callback (`/api/auth/google/callback`) chuyển hướng an toàn, phân tách tham số query tường minh không dùng dấu ngoặc đơn gây lỗi router.
    - Bảo vệ nghiêm ngặt RBAC: Quyền mặc định khi đăng ký luôn là `USER`, route quản trị `/api/admin/*` trả về 401 Unauthorized cho Guest và 403 Forbidden cho `USER`.
  - **Phase 6 — SignalR & Leaderboard Dual-Mode Integration:**
    - Hàm giải quyết URL `getSignalRHubUrl()` hỗ trợ linh hoạt: Dev Mode trỏ về `http://localhost:5000/hubs/leaderboard`, Unified Mode trỏ về relative `/hubs/leaderboard`.
    - Xác minh toàn diện 7 hạng mục Leaderboard (`weekly_xp`, `vocab_mastered`, `review_consistency`, `active_minutes`, `pronunciation_gain`, `toeic_gain`, `streak`).
    - Bảo toàn chính sách chốt tuần lúc 00:00:00 Thứ Hai (Asia/Ho_Chi_Minh — UTC+7), server-authoritative rankings, và giới hạn phân trang cứng `pageSize <= 50`.
  - **Phase 7 — PWA & Local-First Origin Migration Safety:**
    - Bổ sung `navigateFallbackDenylist: [/^\/api/, /^\/hubs/, /^\/health/, /^\/swagger/]` trong cấu hình Workbox của `vite.config.ts`, ngăn chặn Service Worker can thiệp vào các API call hoặc SignalR handshake.
    - Bổ sung chỉ dẫn di chuyển dữ liệu Local-First trong `src/components/BackupModal.tsx`, hướng dẫn người dùng xuất (Export) bản sao lưu từ `localhost:5173` và nhập (Import) an toàn vào `localhost:5000` với 100% độ trung thực dữ liệu và bảo mật tuyệt đối (không chứa JWT hay mật khẩu).
  - **Phase 8 — Dual-Mode Final E2E & Release Gate:**
    - Xây dựng bộ test tích hợp backend mới: `backend/EnglishMastery.Tests/Phase8DualModeReleaseGateTests.cs` (7/7 tests PASS).
    - Xây dựng kịch bản kiểm chứng E2E chạy thực tế: `scripts/verify-phase8-dualmode-e2e.mjs` kiểm tra tuần tự cả hai chế độ `npm run dev` và `npm run start:unified`.
    - Kết quả nghiệm thu: **24 PASS, 0 FAIL, 1 BLOCKED** (Google Cloud Console credentials thực tế chờ người quản trị cấu hình).

- **Kết Quả Quality Gates Toàn Diện**:
  - `dotnet build`: 0 Warnings, 0 Errors.
  - `dotnet test` (Tất cả suites Phases 5 — 8): **26/26 tests PASS (100%)**.
  - `npm run lint` (`oxlint`): **0 Errors** trên 555 files.
  - `npm run build` (`tsc -b && vite build`): Biên dịch thành công, Workbox precache 30 entries (11.7MB assets).
  - Khảo sát cổng mạng sau khi kết thúc: Cổng 5173 và 5000 được giải phóng 100%, 0 orphan processes.

## [1.4.2] - 2026-10-09 — ONE-COMMAND STARTUP, STREAK ENGINE & SINGLE-SCROLL LANDING REPAIR (Phases 1 — 6)

### Fixed, Hardened & Runtime Verified — Developer Orchestration, Streak Policy & Landing Page Layout

- **Root Causes Identified (Nguyên nhân gốc rễ đã xác minh)**:
  1. *Bug 1 — Dev Startup Orchestration:* Trước đây quy trình phát triển yêu cầu mở thủ công 2 terminal riêng biệt (`npm run backend` và `npm run dev`), không có cơ chế thăm dò kiểm tra SQL Server tự động và dễ để lại tiến trình nền mồ côi (orphan dotnet/node processes) khi đóng terminal trên Windows.
  2. *Bug 2 — Streak Tracking Discrepancy (XP: 150, Heatmap: 1 ngày, Streak: 0):*
     - Điểm 150 XP và ô Heatmap lịch sử được tạo ra từ các phần thưởng thụ động không đủ điều kiện (Rương mở ngày +100 XP, Nhiệm vụ +50 XP), hoặc ngày học thực tế đã diễn ra từ $\ge 2$ ngày trước (chuỗi đã đứt hợp lệ).
     - Ranh giới ngày học trước đó bị phụ thuộc vào `toISOString().split('T')[0]` (múi giờ UTC) gây lệch ngày trước 07:00 sáng tại Việt Nam (Asia/Ho_Chi_Minh — UTC+7).
     - Cơ chế Store Rehydration của Zustand thiếu bước đối soát chuỗi (reconciliation) từ bằng chứng học tập thực tế (`dailyHistory`, `recentReviewEvents`), dẫn đến việc người học có ngày học thật nhưng giá trị `profile.streak` vẫn bị ghim ở mức 0.
  3. *Bug 3 — Welcome/Auth Double Scrollbar:*
     - Vùng container gốc của `WelcomeView.tsx` khai báo `overflow-x-hidden`. Theo quy chuẩn CSS Overflow Module Level 3, khi `overflow-x: hidden` kết hợp với `overflow-y: visible` (mặc định), trình duyệt bắt buộc phải chuyển `overflow-y` thành `auto`.
     - Các hiệu ứng phát sáng nền ambient glow sử dụng margin âm (`-mb-32`) nhô ra ngoài đáy container đúng 128px, biến `WelcomeView` thành một Active Scroll Container phụ với thanh cuộn dọc thứ hai chạy song song với thanh cuộn chính của `<html>`/`<body>`.

- **Phần Mềm & Kiến Trúc Đã Triển Khai (Implemented Solutions)**:
  - **One-Command Dev Orchestrator (`scripts/dev.mjs`):** Điều phối đồng thời Vite (cổng 5173), ASP.NET Core 10 (cổng 5000), thăm dò sẵn sàng SQL Server `EnglishMasteryDev` qua `/api/health`, gắn cờ phân biệt log màu, và dọn dẹp cây tiến trình con an toàn khi nhận `SIGINT` (Ctrl+C). Cung cấp lệnh độc lập `npm run frontend`, `npm run backend`, `npm run check:services`.
  - **Vietnam Timezone Engine (`src/utils/dateUtils.ts`):** Chuẩn hóa ngày học và tính khoảng cách lịch chính xác theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7), không phụ thuộc vào đồng hồ hệ thống client hay giờ UTC.
  - **Streak Engine & Safe Historical Reconciliation (`src/services/streakReconciliationService.ts`):**
    - Bộ lọc Qualifying Activity nghiêm ngặt: Chỉ công nhận ngày học khi `wordsReviewed > 0 || newWordsLearned > 0 || quizzesCompleted > 0 || pronunciationsMastered > 0` hoặc có sự kiện ôn tập SRS thực tế. Loại trừ hoàn toàn điểm XP thụ động từ Rương ngày và Nhiệm vụ.
    - Chính sách Giữ Chuỗi (Streak Hold Policy): Người học ôn tập hôm qua được bảo toàn chuỗi đến 23:59:59 của ngày hôm nay.
    - Bảo toàn kỷ lục đơn điệu: `reconciledLongestStreak = Math.max(existingLongest, existingStreak, maxHistoricalStreak)`, không bao giờ làm giảm kỷ lục trọn đời.
    - Tự động đối soát khi khởi động (`src/store/storeRehydration.ts`): Phục hồi chuỗi hợp lệ tự động, bảo đảm tính idempotent, không sinh thêm XP và không làm sai lệch FSRS/SM-2 intervals.
  - **Single Scroll Architecture (`src/components/welcome/WelcomeView.tsx` & `index.html`):**
    - Gỡ bỏ `overflow-x-hidden` khỏi root container `WelcomeView`, đưa về trạng thái `overflow: visible` chuẩn tắc.
    - Đóng gói toàn bộ các hiệu ứng phát sáng ambient glow (`-mb-32`, `-mr-16`) vào wrapper cách ly `absolute inset-0 overflow-hidden pointer-events-none`.
    - Bổ sung `overflow-x-hidden` cấp độ viewport trên `<html>` và `<body>` trong `index.html` để chặn giật ngang mà không tạo scroll context cục bộ.

- **Kết Quả Kiểm Thử Thực Tế (Runtime & Quality Gates Verification)**:
  - **Kiểm Thử Trực Tiếp Bằng Trình Duyệt Microsoft Edge (Headless CDP):** Khảo sát toàn diện qua 5 kích thước viewport (1920×1080, 1366×768, 1280×720, 768×1024, 390×844, 320×568) và 3 mức tỷ lệ Zoom (125%, 150%, 200%): Xác nhận 100% chỉ có đúng 1 thanh cuộn dọc cửa sổ chính, 0 scroll container phụ, 0 thanh cuộn ngang (`scrollWidth === clientWidth`). Toàn bộ 13 phần tử bàn phím nhận focus chuẩn xác.
  - **Backend Test Suite (.NET 10 xUnit):** Toàn bộ **184/184 tests PASS (100%)** trong `backend/EnglishMastery.Tests/EnglishMastery.Tests.csproj`.
  - **Targeted E2E Suites (Vitest):** Toàn bộ **48/48 tests PASS (100%)** qua 5 file test trọng tâm (`streakPolicyAndReproduction`, `historicalStreakReconciliation`, `xpReloadRegressionAudit`, `WelcomeScrollbarFixPhase5`, `WelcomeAuthE2EPhase7`).
  - **Quality Gates:** `npx tsc -b` (0 compile errors), `npm run lint` (0 errors), `npm run build` (Production PWA bundle biên dịch thành công, Service Worker precache 30 entries sẵn sàng).

- **Hạn Chế Ghi Nhận Trung Thực (Limitations)**:
  - Do môi trường máy chủ không có gói Playwright/Puppeteer cài đặt sẵn trong `devDependencies`, quá trình kiểm thử trình duyệt thực tế được thực hiện trực tiếp thông qua Chrome DevTools Protocol (CDP) kết nối tới Microsoft Edge Headless cục bộ.

## [1.4.1] - 2026-10-09 — ACCOUNT REGISTRATION PIPELINE RESTORATION & E2E VERIFICATION (Phases 1 — 5)

### Fixed, Hardened & Runtime Verified — End-to-End Registration, ASP.NET Core & SQL Server Pipeline

- **Root Causes Identified (Nguyên nhân gốc rễ đã xác minh)**:
  - *Primary Cause (Nguyên nhân cốt lõi):* Tiến trình Backend ASP.NET Core không chạy trên cổng 5000 tại thời điểm người dùng thực hiện thao tác; chỉ có máy chủ Frontend Vite lắng nghe trên cổng 5173. Trình duyệt nhận lỗi TCP Connection Refused (`TypeError: Failed to fetch`), được phân loại chính xác thành "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng."
  - *Secondary Hazard (Nguy cơ hạ tầng):* File cấu hình cơ sở `backend/EnglishMastery.Api/appsettings.json` bị để trống chuỗi kết nối `DefaultConnection` và `Jwt:SecretKey`. Khi khởi chạy bằng `dotnet run` mà không truyền cờ `--launch-profile http`, ASP.NET Core mặc định chạy dưới môi trường `Production` và crash ngay lập tức lúc boot với lỗi `InvalidOperationException: Connection string 'DefaultConnection' not found`.
  - *Auxiliary Resilience Gaps (Lỗ hổng xử lý lỗi phụ trợ):*
    - Khi người dùng hủy request hoặc chuyển đổi giao diện trong lúc gửi form, `AbortSignal` của trình duyệt không được gắn kết đầy đủ với `AbortController` nội bộ của `httpClient.ts`, dẫn đến lỗi kết nối mạng giả mạo.
    - Thiếu ánh xạ lỗi SQL Unique Constraint (lỗi 2601/2627) sang HTTP 409 Conflict trong trường hợp Identity không phát hiện trước race condition.
    - DTO `RegisterRequest` thiếu thuộc tính `[MaxLength(150)]` cho `DisplayName`, dẫn đến nguy cơ lệch chuẩn dữ liệu với cơ sở dữ liệu.

- **Phase 1 — Diagnostic & Runtime Process Audit**:
  - Khảo sát toàn diện trạng thái hệ thống: Xác minh cổng 5000 không có tiến trình nào lắng nghe; Vite hoạt động bình thường trên cổng 5173 (`PID 37280`).
  - Phân tích luồng frontend: `AuthForm.tsx` $\rightarrow$ `signUpWithEmail` trong `cloudSyncService.ts` $\rightarrow$ `authApi.register` trong `authApi.ts` $\rightarrow$ `httpClient.ts` $\rightarrow$ `POST http://localhost:5000/api/auth/register`.
  - Kiểm tra SQL Server `MSSQLSERVER` trên `localhost:1433`: Cơ sở dữ liệu `EnglishMasteryDev` và migration schemas hoàn toàn sẵn sàng và khỏe mạnh.

- **Phase 2 — Infrastructure & Backend Configuration Repair**:
  - Cập nhật `backend/EnglishMastery.Api/appsettings.json` với chuỗi kết nối phát triển dự phòng `Server=localhost;Database=EnglishMasteryDev;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true` và khóa ký JWT mặc định.
  - Cập nhật `GoogleAuthService.cs` và `GoogleTokenClient.cs`: Ngăn chặn crash startup khi thiếu Google credentials bằng cách ném `ValidationException` có cấu trúc (`google_not_configured`, HTTP 400) khi được gọi thay vì gây lỗi 500 sập toàn bộ dịch vụ xác thực.

- **Phase 3 — Backend Registration Pipeline Repair**:
  - Bổ sung `[MaxLength(150)]` cho thuộc tính `DisplayName` trong `RegisterRequest` (`AuthDtos.cs`).
  - Cập nhật `AuthService.cs`: Giới hạn an toàn độ dài DisplayName, chuẩn hóa email, và ánh xạ mã lỗi Identity `DuplicateUserName` / `DuplicateEmail` thành `ConflictException` (HTTP 409).
  - Cập nhật `GlobalExceptionHandlerMiddleware.cs`: Bắt ngoại lệ `DbUpdateException` với mã lỗi SQL Server 2601/2627 (Unique Index Violation) và chuyển đổi thành HTTP 409 Conflict thay vì 500 Server Error.
  - Bổ sung 6 kịch bản kiểm thử tự động trong `backend/EnglishMastery.Tests/AuthTests.cs` (kiểm tra email trùng lặp, DisplayName 150 ký tự, v.v.) — toàn bộ 37/37 tests trong suite đạt PASS.

- **Phase 4 — Frontend Auth UX & Error Classification Repair**:
  - Nối kết `AbortSignal` của caller với timeout controller trong `src/services/api/httpClient.ts`.
  - Phân loại hủy thao tác từ phía người dùng thành mã HTTP 499 (`CLIENT_CLOSED_REQUEST`) trong `src/components/auth/classifyAuthError.ts`, giữ trạng thái form trung tính (`idle`), không phát sinh thông báo lỗi mạng giả mạo.
  - Bổ sung chỉ dẫn chẩn đoán môi trường phát triển: Khi phát hiện `TypeError: Failed to fetch`, gợi ý `(Mẹo phát triển: Bạn đã chạy 'npm run backend' trên cổng 5000 chưa?)`.
  - Khóa chuyển tab Đăng nhập / Đăng ký trong lúc request đang gửi (`isSubmittingRef`) trong `src/components/auth/AuthForm.tsx` và kiểm tra độ dài DisplayName $\le 150$ ký tự ngay tại client.

- **Phase 5 — Real E2E Runtime Verification & Quality Gates**:
  - Khởi động backend ASP.NET Core trên cổng 5000 và kết nối SQL Server `EnglishMasteryDev`.
  - **Kiểm thử thực tế với tài khoản test duy nhất (`real_e2e_24685a3b@englishmastery.test`):**
    - `POST /api/auth/register` $\rightarrow$ HTTP 200 OK, trả về `accessToken`, `refreshToken`, và thông tin user.
    - Truy vấn trực tiếp SQL Server: Bản ghi tồn tại trong `AspNetUsers`, `AspNetUserRoles` với Role `USER` (Id: `2`), `UserProfiles` và `LeaderboardProfiles`.
    - `POST /api/auth/login` với email/password vừa tạo $\rightarrow$ HTTP 200 OK.
    - `GET /api/auth/me` với JWT token $\rightarrow$ HTTP 200 OK, role `USER`.
    - Dọn dẹp sạch sẽ tài khoản test khỏi SQL Server sau kiểm thử.
  - **Kiểm thử các trường hợp biên và tiêu cực (Negative Cases) trên backend thật:**
    - Email không hợp lệ (`invalid-email`) $\rightarrow$ HTTP 400 Bad Request.
    - Mật khẩu thiếu số (`NoDigitPassword`) $\rightarrow$ HTTP 400 Bad Request.
    - Mật khẩu quá ngắn (`123`) $\rightarrow$ HTTP 400 Bad Request.
    - Body rỗng $\rightarrow$ HTTP 400 Bad Request.
    - DisplayName vượt quá 150 ký tự $\rightarrow$ HTTP 400 Bad Request.
    - Email trùng lặp $\rightarrow$ HTTP 409 Conflict.
  - **Kết quả Quality Gates:**
    - `dotnet build backend/EnglishMastery.slnx` $\rightarrow$ 0 Errors, 0 Warnings.
    - `dotnet test` (Targeted suites: Auth, RBAC, Google OAuth) $\rightarrow$ **51/51 PASS (100%)**.
    - `npx tsc --noEmit` $\rightarrow$ 0 Errors.
    - `npm run lint` $\rightarrow$ 0 Errors (598 non-blocking warnings trên codebase cũ).
    - `npm run build` $\rightarrow$ Production build thành công, PWA Service Worker tạo mới đạt chuẩn.
    - Frontend targeted test suites (`AuthRegistrationPhase3`, `Phase8GoogleAuthFrontend`, `WelcomeAuthE2EPhase7`, `adminAuth`) $\rightarrow$ **30/30 PASS (100%)**.
  - **Hạn Chế Môi Trường (Limitations):** Môi trường không có trình duyệt headless (Playwright/Puppeteer) cài đặt trong `node_modules`; do đó kiểm thử tương tác nhấp chuột trực tiếp trên trình duyệt thật được ghi nhận trung thực là `NOT VERIFIED (NO HEADLESS RUNNER)`, trong khi toàn bộ kiểm thử tích hợp giao diện Happy-DOM và pipeline HTTP/SQL thật đạt 100% PASS.

## [1.4.0] - 2026-10-09 — GOOGLE AUTHENTICATION & RBAC SECURITY ARCHITECTURE (Phases 1 — 9)

### Added, Secured & Verified — Google OAuth, Database RBAC, Safe Admin Provisioning & Legacy Removal

- **Phase 1 — Auth, Admin & Database Architecture Audit**:
  - Khảo sát toàn diện hệ thống tài khoản, luồng JWT, chính sách phân quyền ASP.NET Core và SQL Server.
  - Lập danh mục phân quyền Admin (Admin Permission Inventory): Quản lý từ vựng đám mây, tra cứu hồ sơ người dùng, reset dữ liệu toàn hệ thống và theo từng người dùng.
  - Xác định các vị trí còn tồn tại điều kiện Admin hardcode theo email và vạch lộ trình thay thế bằng RBAC chính tắc.

- **Phase 2 — Role & External Login Data Model**:
  - Thiết lập mô hình phân quyền chuẩn trong `AppUser`: Phân tách rạch ròi vai trò `USER` và `ADMIN`. Mặc định người dùng mới tạo luôn là `USER`.
  - Bổ sung thực thể `ExternalLogin` với ràng buộc toàn vẹn `(Provider, ProviderSubject)` Unique Index, liên kết khóa ngoại với `AppUser`.
  - Tạo và thực thi EF Core migration cập nhật cấu trúc cơ sở dữ liệu `EnglishMasteryDev`.

- **Phase 3 — Backend RBAC & JWT Role Security**:
  - Centralized Authorization: Backend là nguồn xác thực quyền duy nhất. Bảo vệ toàn bộ Admin API endpoints bằng `[Authorize(Roles = "ADMIN")]`.
  - Cấp JWT role claim đáng tin cậy dựa trên bảng dữ liệu `AppUser.Roles`, không tin cậy request hay email profile.
  - Triển khai `SecurityStamp` và cơ chế thu hồi phiên (Session Revocation): Khi quyền ADMIN bị gỡ bỏ, token cũ bị từ chối ngay lập tức.
  - Ngăn chặn hoàn toàn hành vi tự thăng quyền (Self-promotion) và request sửa đổi role trái phép.

- **Phase 4 — Secure Admin Provisioning & Role Management**:
  - Xây dựng tiện ích quản trị máy chủ `scripts/admin-tool.ps1` và command backend `UserRoleManagerService`.
  - Cung cấp các lệnh: `list`, `get`, `grant`, `revoke` với cơ chế kiểm tra UserId, tránh nhầm lẫn tài khoản.
  - Tích hợp Last-Admin Protection: Từ chối thu hồi Admin cuối cùng trừ khi có cờ tường minh `--force`.
  - Hỗ trợ quy trình First Admin Bootstrap an toàn khi database chưa có bất kỳ Admin nào, không cần auto-seed.

- **Phase 5 — Legacy Admin Hardcode Removal & Safe Cleanup**:
  - Quét sạch toàn bộ logic `email == target → ADMIN` trên cả frontend và backend.
  - Đảm bảo việc khởi động lại backend không tự tạo lại Admin cũ, đăng ký lại email cũ không tự nhận quyền ADMIN.
  - Trạng thái tài khoản phát triển cũ: Đã được gỡ bỏ khỏi cơ chế cấp quyền tự động; toàn bộ test hồi quy Phase 5 xác minh độc lập không còn đặc quyền.

- **Phase 6 — Google OAuth/OIDC Backend Integration**:
  - Triển khai Authorization Code Flow kết hợp PKCE (`code_challenge` / `code_verifier`), `state` CSRF token và `nonce` OIDC replay prevention.
  - Zero Token in URL: Backend chuyển hướng về frontend với mã vé trao đổi một lần (`oauth_exchange_code`); frontend đổi vé qua API `/api/auth/google/exchange` trong body HTTP.
  - Xác thực chữ ký token nguồn Google (Issuer `accounts.google.com`, Audience Client ID, Expiration, Subject ID).
  - Khử độc URL trả về (`AllowedReturnUrls`) chống tấn công Open Redirect.

- **Phase 7 — Google Account Lifecycle & Secure Linking**:
  - Hỗ trợ trọn vẹn First Google Login: Tự động khởi tạo `AppUser`, `UserProfile`, `ExternalLogin` với role mặc định `USER` trong một transaction nguyên tử.
  - Returning Google Login: Nhận diện chính xác `(Provider, ProviderSubject)` cũ, không nhân đôi tài khoản hay profile.
  - Phòng chống chiếm đoạt tài khoản (Account Collision Protection): Khi email Google trùng với tài khoản mật khẩu có sẵn, backend từ chối auto-merge và yêu cầu xác thực mật khẩu hiện tại trước khi liên kết (`link-with-credentials`).
  - Cho phép người dùng đã đăng nhập liên kết hoặc hủy liên kết Google ID (bảo vệ tài khoản chỉ có Google không thể unlink nếu chưa đặt mật khẩu).

- **Phase 8 — Google Login UI & Role-Aware Frontend**:
  - Tích hợp nút *"Tiếp tục với Google"* vào [`AuthForm.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/auth/AuthForm.tsx), dùng chung cho cả Welcome Page và Modal, không sinh duplicate UI.
  - Trải nghiệm Popup mượt mà kèm fallback redirect khi popup bị chặn, bắt chính xác sự kiện đóng popup.
  - Thẻ giao diện liên kết mật khẩu tiếng Việt khi gặp trùng email (`collision-linking-card`).
  - Giao diện Role-Aware: USER và Guest không thấy tab `Quản Trị 🛡️`; ADMIN thấy tab Quản Trị nổi bật.
  - Trục xuất tức thì khỏi màn hình Admin nếu quyền ADMIN bị thu hồi từ backend.
  - Cách ly tuyệt đối dữ liệu và dọn dẹp hàng đợi bằng chứng khi chuyển đổi giữa các tài khoản.

- **Phase 9 — Final Verification & Quality Gates**:
  - Xác minh toàn bộ 15 kịch bản frontend tự động trong [`Phase8GoogleAuthFrontend.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/Phase8GoogleAuthFrontend.test.tsx) (**15/15 PASS**).
  - Xác minh bộ test RBAC frontend [`adminAuth.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/utils/__tests__/adminAuth.test.ts) (**4/4 PASS**).
  - Xác minh toàn bộ test backend xUnit trong `EnglishMastery.Tests.csproj` (**178/178 PASS**).
  - Vượt qua 100% Quality Gates: `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run build` (Production bundle thành công), `dotnet build` (0 errors, 0 warnings).
  - Cập nhật tài liệu hướng dẫn Google Cloud Console, RBAC và Administrative Tooling vào `README.md`.

## [1.3.0] - 2026-10-08 — WELCOME & AUTHENTICATION LANDING PAGE + INITIAL ROUTING LIFECYCLE (Phases 1 — 7)

### Added & Hardened — Welcome Landing, Reusable Auth, Guest Mode & Initial Routing

- **Phase 1 — Audit & Architecture Matrix**:
  - Đánh giá toàn diện kiến trúc khởi động, trạng thái auth lifecycle và luồng Onboarding cũ (`App.tsx`, `OnboardingModal.tsx`, `AuthSyncModal.tsx`, `cloudSyncService.ts`).
  - Thiết lập ma trận quyết định Single Routing Authority: Phân tách rõ ràng giữa trạng thái đang khởi tạo (`isAuthInitialized = false`), người dùng mới (`!user && !isGuestMode`), khách quay lại (`isGuestMode && profile.isOnboarded`), người dùng đã xác thực (`user`), và người dùng đăng xuất (`isLoggedOut = true`).
  - Đảm bảo triệt tiêu hiện tượng OnboardingModal tự động bật đè lên màn hình chào mừng đối với khách truy cập lần đầu.

- **Phase 2 — Reusable Auth Forms & Real API Client Integration**:
  - Tách và chuẩn hóa [`AuthForm.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/auth/AuthForm.tsx) thành component xác thực tái sử dụng độc lập, dùng chung giữa Welcome Page và Navbar Auth Modal ([`AuthSyncModal.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/AuthSyncModal.tsx)).
  - Xây dựng bộ phân loại lỗi chuẩn hóa [`classifyAuthError.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/auth/classifyAuthError.ts) quản lý 8 trạng thái vòng đời request, phân loại mã lỗi HTTP (400, 401, 403, 409, 429, 500, 503, 0/Network Timeout) với thông báo tiếng Việt chính xác.
  - Hỗ trợ đầy đủ toggle ẩn/hiện mật khẩu, xác nhận mật khẩu (Confirm Password), khóa chống click đúp (Double-submit lock via `isSubmittingRef`).

- **Phase 3 — Premium Welcome Landing Page Design**:
  - Xây dựng [`WelcomeView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/welcome/WelcomeView.tsx) theo phong cách Modern EdTech Dark Glassmorphism, kế thừa trọn vẹn tokens Tailwind CSS, Lucide icons và PWA assets sẵn có.
  - Thiết kế Desktop Split-Screen cân đối: Panel trái (55%) giới thiệu thương hiệu, hero headline, thẻ minh họa FSRS thuật toán lặp lại ngắt quãng, bậc thang 6 cấp độ CEFR (A1–C2), và 4 số liệu sản phẩm có thật (10.381 từ vựng, 96 bài Four Skills, luyện thi TOEIC chuẩn ETS, 7 danh mục bảng xếp hạng). Panel phải (45%) tích hợp Card Đăng nhập / Tạo tài khoản nổi bật cùng nút CTA Học với chế độ Khách.

- **Phase 4 — Single Routing Authority & Auth Session Lifecycle**:
  - Tái cấu trúc [`App.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/App.tsx) thành Single Routing Authority: Hiển thị màn hình chờ trung tính trong lúc `initCloudSync()` kiểm tra phiên JWT qua `/api/auth/me` hoặc `/api/auth/refresh`.
  - Nếu phiên hợp lệ $\rightarrow$ vào thẳng Dashboard ứng dụng (không bắt người dùng đăng nhập lại, không nhấp nháy Welcome screen).
  - Nếu là khách truy cập mới hoặc người dùng vừa đăng xuất $\rightarrow$ hiển thị Welcome Landing Page.
  - Loại bỏ hoàn toàn lỗi xóa nhầm toàn bộ store local khi đăng xuất: Sửa `signOutCloud()` và unauthorized handler chỉ xóa token xác thực, bảo toàn 100% dữ liệu học tập cục bộ.

- **Phase 5 — Guest Mode, Onboarding & Local-First Safety**:
  - Tích hợp CTA *"Tiếp tục học mà không cần tài khoản"* với mô tả minh bạch: *"Bạn vẫn có thể học và lưu tiến trình ngay trên thiết bị này"*.
  - Khách truy cập mới bấm Guest $\rightarrow$ chỉ mở [`OnboardingModal.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/OnboardingModal.tsx) để lưu tên và mục tiêu cục bộ; tuyệt đối không tạo JWT giả, không tạo tài khoản ảo trên SQL Server, không gửi learning events lên đám mây.
  - Khách cũ quay lại (`isGuestMode = true` và đã có profile) $\rightarrow$ tự động bỏ qua Welcome và Onboarding, vào thẳng Dashboard.
  - Bảo vệ tuyệt đối tính bất biến Local-First: `srsProgressMap`, `mistakeBank`, từ vựng cá nhân, điểm số TOEIC không bao giờ bị reset.

- **Phase 6 — Welcome UX, Accessibility (WCAG AA) & Security Hardening**:
  - Liên kết ngữ nghĩa form tường minh qua React `useId`: `htmlFor` và `id` khớp 100% trên tất cả trường Email, Mật khẩu, Tên hiển thị, Xác nhận mật khẩu.
  - Chuẩn hóa ARIA Tabs (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`, `aria-labelledby`) cho thanh chuyển đổi Đăng nhập / Tạo tài khoản.
  - Trường lỗi gắn `aria-invalid="true"`, `aria-describedby` trỏ tới thông báo có `role="alert"`. Banner cảnh báo trang bị `role="alert"` và `aria-live="assertive"`.
  - Nút ẩn/hiện mật khẩu có `aria-label`, `aria-pressed`, hỗ trợ đầy đủ bàn phím (`Tab` + `Enter`/`Space`).
  - Thêm Skip-to-content link: *"Chuyển đến phần Đăng nhập"*, chuẩn hóa touch targets $\ge 44$px (`min-h-[44px]`, `min-h-[48px]`, `min-h-[52px]`).
  - Bổ sung `isMountedRef` triệt tiêu cảnh báo cập nhật state sau khi component unmount trong lúc request API đang gửi.
  - Giữ lại email đã nhập khi chuyển đổi qua lại giữa tab Đăng nhập và Tạo tài khoản.

- **Phase 7 — Welcome/Auth Final E2E & Release Verification**:
  - Xây dựng bộ test suite tích hợp tự động [`WelcomeAuthE2EPhase7.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/WelcomeAuthE2EPhase7.test.tsx) kiểm chứng toàn diện ma trận truy cập (First visit, Guest transition, Returning auth, Returning guest, Sign out preservation, Offline mode).
  - Kiểm chứng trực tiếp trên runtime thật ASP.NET Core Web API + SQL Server qua [`scripts/verify_e2e_release_gate.mjs`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/scripts/verify_e2e_release_gate.mjs): **20/20 kịch bản kiểm thử tích hợp thực tế đạt PASS (100%)**.
  - Kiểm chứng Backend xUnit suite: **123/123 tests PASS (bao gồm 14/14 AuthTests)**.
  - Toàn bộ 7 bộ test suites frontend đạt **65/65 tests PASS (100%)**.
  - Vượt qua 100% Quality Gates: `npx tsc -b` (0 errors), `npx oxlint` (0 warnings, 0 errors), `npm run build` (Production bundle thành công, PWA Service Worker tạo mới đạt chuẩn).

## [1.2.0] - 2026-10-08 — AUTH & LEADERBOARD SYSTEM RESTORATION & RESILIENCE (Phases 1 — 8)

### Fixed & Hardened — End-to-End Auth Registration & Leaderboard Pipeline
- **Phase 1 — Root Cause Diagnosis & Architectural Audit**:
  - Phát hiện nguyên nhân cốt lõi gây lỗi đăng ký: Bất đồng bộ chính sách mật khẩu giữa Frontend và ASP.NET Identity, thiếu model validation mapper chi tiết, nuốt lỗi generic `Đã có lỗi xảy ra`.
  - Phát hiện nguyên nhân lỗi "Mất kết nối máy chủ" trên Leaderboard: Giao diện nhầm lẫn sự cố SignalR WebSocket đứt quãng với lỗi sập REST API toàn phần; nút "Thử lại" không kích hoạt re-fetch REST tại chỗ; thiếu phân biệt giữa bảng xếp hạng rỗng (`SUCCESS_EMPTY`) và lỗi máy chủ (`SERVER_ERROR`).
- **Phase 2 — API Client, CORS & SQL Server Connectivity Hardening**:
  - Chuẩn hóa cấu hình CORS trong `Program.cs` cho phép credentials và các origin development hợp lệ (`http://localhost:5173`, `http://localhost:3000`).
  - Thêm middleware kiểm tra sức khỏe cơ sở dữ liệu (`/health`) xác nhận kết nối trực tiếp tới SQL Server `localhost / EnglishMasteryDev`.
  - Củng cố HTTP client frontend [`httpClient.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/api/httpClient.ts) với chuẩn hóa `ApiError`, abort controller, và retry logic an toàn.
- **Phase 3 — End-to-End Registration & Identity Persistence**:
  - Cập nhật [`AuthSyncModal.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/AuthSyncModal.tsx) bổ sung double-submit locking, visual loading spinner, và trích xuất thông báo lỗi chi tiết (email trùng, mật khẩu yếu, định dạng không hợp lệ).
  - Tích hợp chuẩn ASP.NET Core Identity: Băm mật khẩu BCrypt/Identity v3, tự động khởi tạo đồng thời `AppUser`, `UserProfile`, và `LeaderboardProfile` trong một giao dịch cơ sở dữ liệu duy nhất.
  - Bảo vệ nguyên vẹn tiến trình học Local-First: Đăng ký thành công không làm mất dữ liệu FSRS/SM-2 cục bộ.
- **Phase 4 — 7-Category Leaderboard REST API & SQL Pipeline**:
  - Rà soát và bảo đảm cả 7 danh mục xếp hạng (`weekly_xp`, `vocab_mastered`, `review_consistency`, `active_minutes`, `pronunciation_gain`, `toeic_gain`, `streak`) truy vấn dữ liệu thực tế từ SQL Server.
  - Tối ưu hóa tie-breaking determinism theo `(Score DESC, LastActiveAt ASC, UserId ASC)`.
  - Xử lý bảng xếp hạng rỗng trả về HTTP 200 với mảng rỗng `entries: []`, `totalCount: 0`, loại bỏ hoàn toàn các lỗi `NullReferenceException` và fake ranks.
  - Phân lập rõ ràng giữa truy cập công khai (Guest) và bảo vệ (Authenticated User rank).
- **Phase 5 — Leaderboard Frontend, Granular Status & In-Place Retry UX**:
  - Cập nhật [`LeaderboardView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/LeaderboardView.tsx) với 6 trạng thái UI tường minh: `LOADING`, `SUCCESS_WITH_DATA`, `SUCCESS_EMPTY`, `NETWORK_ERROR`, `SERVER_ERROR`, `INELIGIBLE`.
  - Nút "Thử lại" (Retry) thực thi gọi lại REST API tại chỗ, phục hồi dữ liệu ngay lập tức mà không yêu cầu reload trang web hay khởi động lại trình duyệt.
  - Current-user sticky row hiển thị chính xác vị trí thực của người dùng hoặc thông báo điều kiện tham gia mà không gán rank 1 ảo.
- **Phase 6 — SignalR Realtime Resilience & REST Isolation**:
  - Hiện thực hóa kiến trúc tách bạch: **REST = Nguồn đọc dữ liệu chính tắc; SignalR = Tín hiệu thông báo refresh**.
  - Khi SignalR mất kết nối, Leaderboard REST vẫn hoạt động hoàn hảo, hiển thị huy hiệu `Trực tuyến (HTTP)` thay vì báo mất kết nối toàn bộ hệ thống.
  - Quản lý vòng đời kết nối đơn (single logical connection), tự động hủy listeners khi unmount hoặc chuyển đổi tài khoản (account switching).
  - Tích hợp debounce sự kiện 1500ms và cơ chế chống đói (starvation protection) tối đa 5000ms.
- **Phase 7 — Local Development Startup Reliability**:
  - Bổ sung công cụ kiểm tra môi trường tiền khởi chạy [`scripts/check-services.mjs`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/scripts/check-services.mjs) và lệnh `npm run check:services`.
  - Kiểm tra tính sẵn sàng của SQL Server (`EnglishMasteryDev`), backend ASP.NET Core (Port 5000), và frontend Vite (Port 5173).
  - Cập nhật tài liệu hướng dẫn khởi chạy 3 service độc lập, tránh hiểu nhầm giữa frontend chạy và backend chạy.
- **Phase 8 — End-to-End Verification & Quality Gate Release**:
  - Xây dựng bộ kịch bản kiểm thử E2E tự động [`scripts/verify_e2e_release_gate.mjs`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/scripts/verify_e2e_release_gate.mjs), vượt qua **20/20 kịch bản kiểm thử tích hợp (100% PASS)**:
    - Kiểm tra Health endpoint và kết nối SQL Server.
    - Đăng ký tài khoản mới, tạo JWT token và xác minh bản ghi thực trong bảng `AspNetUsers`.
    - Từ chối email trùng lặp (HTTP 409 Conflict).
    - Từ chối mật khẩu không đạt chuẩn (HTTP 400 Bad Request).
    - Đăng nhập tài khoản thành công (HTTP 200 OK + JWT Access Token).
    - Từ chối mật khẩu sai (HTTP 401 Unauthorized).
    - Đọc hồ sơ người dùng hiện tại `/api/auth/me` với Bearer token.
    - Đăng xuất `/api/auth/logout`.
    - Truy vấn thành công cả 7 danh mục xếp hạng với cấu trúc DTO chính xác.
    - Học viên chưa có điểm nhận kết quả `found: false, entry: null` (không nhận rank ảo).
    - Khách (Guest) bị chặn khi truy vấn private rank (HTTP 401).
    - SignalR WebSocket negotiation thành công.
    - Dọn dẹp an toàn người dùng test khỏi `EnglishMasteryDev`.
  - Vượt qua 100% các cổng chất lượng (Quality Gates):
    - `npx tsc -b`: 0 errors.
    - `npm run lint`: 0 errors.
    - Frontend Unit Tests: 13/13 passed.
    - Backend Integration Tests: 123/123 passed.
    - `npm run build`: Production build thành công trong 2.26s.
  - Đảm bảo 0 tiến trình nền bị bỏ quên (Clean Process Lifecycle).

### Added & Changed — REMOVE CLOUD SYNC + ELIMINATE ALL FAKE DATA (Phases 1 — 10)
- **Phase 1 — Full Cloud Sync & Fake Data Source Audit**:
  - Rà soát toàn bộ repository, phát hiện và lập danh mục toàn bộ cơ chế đồng bộ thủ công, background timers, mock fallback arrays, và các nguồn tự sinh dữ liệu giả trong cả frontend và backend.
- **Phase 2 — Disable Automatic Demo Seeding & Fake Backend Generation**:
  - Vô hiệu hóa vĩnh viễn `DevLeaderboardSeeder` trong backend startup.
  - Loại bỏ hoàn toàn logic tự sinh tài khoản demo (`Learner One`, `Learner Two`, `VIP Learner`) và điểm số/streak nhân tạo trong EF Core và `Program.cs`.
  - Đảm bảo quá trình khởi động lại máy chủ (backend restart) duy trì cơ sở dữ liệu sạch, không tái sinh dữ liệu rác.
- **Phase 3 — Remove Runtime Mock Data & Fake UI Fallbacks**:
  - Loại bỏ toàn bộ mảng dữ liệu giả lập (mock array) trong Leaderboard UI và các service liên quan.
  - Khi không có dữ liệu hoặc API rỗng/lỗi, giao diện hiển thị trạng thái rỗng trung thực ("Chưa có người học nào trong tuần này" và `totalCount = 0`).
  - Phân định rõ ràng: người học chưa đủ điều kiện (`not eligible`) hiển thị trạng thái chưa xếp hạng (`--`), tuyệt đối không ép về điểm 0 hoặc rank 1 ảo.
- **Phase 4 — Verified SQL Server Development Data Cleanup**:
  - Thực thi dọn dẹp an toàn toàn bộ các bản ghi demo/test trong database SQL Server `localhost / EnglishMasteryDev`.
  - Kiểm tra và xóa sạch dữ liệu phụ thuộc qua các bảng `AspNetUsers`, `UserProfiles`, `LeaderboardProfiles`, `WeeklyLearningMetrics`, `UserSrsProgresses`, `DailyLogs`, `UserFrameEntitlements`, `RefreshTokens`.
  - Giữ nguyên 100% lịch sử migration (`__EFMigrationsHistory` với 4 migrations chính tắc).
- **Phase 5 — Preserve Real Backend Leaderboard & Trusted Learning Evidence**:
  - Tách biệt dứt khoát giữa trách nhiệm Personal Cloud Sync (đã xóa) và Online Leaderboard (giữ lại và củng cố).
  - Bảo đảm cả 7 danh mục xếp hạng (`weekly_xp`, `vocab_mastered`, `review_consistency`, `active_minutes`, `pronunciation_gain`, `toeic_gain`, `streak`) lấy số liệu và tính toán thứ hạng trực tiếp từ máy chủ ASP.NET Core & SQL Server.
- **Phase 6 — Minimal Authenticated Learning Evidence Transport**:
  - Hiện thực hóa module vận chuyển bằng chứng học tập tối giản [`learningEvidenceTransport.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/learningEvidenceTransport.ts).
  - Chỉ gửi các snapshot điểm số và chỉ số tổng hợp tuần qua `/api/leaderboard/sync-score` và `/api/leaderboard/sync-metrics`.
  - Tuyệt đối không phục hồi hay duy trì full-state sync cho `UserSrsProgresses` hay `DailyLogs`.
- **Phase 7 — Remove Manual Sync Cloud UI & Preserve Authentication UX**:
  - Xóa bỏ nút `[Sync Cloud]` trên thanh điều hướng `Navbar.tsx`.
  - Thay thế nút CTA `[Đăng nhập & Sync Cloud]` trên `LeaderboardView.tsx` bằng CTA chuẩn xác thực: `[Đăng nhập để tham gia bảng xếp hạng]`.
  - Chuẩn hóa Card Trạng thái Cục Bộ, phản ánh trung thực trạng thái của Guest mà không tạo cảm giác lỗi hay ép buộc đồng bộ.
- **Phase 8 — Remove Orphan Cloud Sync Services & Supabase Runtime Residue**:
  - Gỡ bỏ các background sync timer (`syncRetryTimer`), backoff retry queue, và event listeners ngầm trên `online` reconnect và `visibilitychange` tab switch.
  - Định tuyến lại các hàm facade (`signInWithEmail`, `signUpWithEmail`, `flushPendingCloudSync`, `hasPendingCloudSync`) sang `learningEvidenceTransport`.
  - Xác nhận **0** lời gọi API và **0** dependency runtime tới Supabase; chuyển `supabaseClient.ts` thành test-only stub.
- **Phase 9 — Real Data, Empty State & Local-First Regression**:
  - Kiểm thử và xác minh toàn diện các kịch bản thực tế:
    - Empty Database: 0 người dùng $\rightarrow$ Empty Leaderboard (không mock users, không fake rank).
    - Backend Restart: Không auto-seed tài khoản demo hay fake XP/streak.
    - Frontend Reload: Không tải fallback giả, bảo toàn 100% tiến trình học tập cục bộ.
    - Real Learning: Điểm XP và trạng thái FSRS/SM-2 cập nhật theo hành động học thật; tài khoản đăng nhập gửi bằng chứng hợp lệ lên máy chủ.
    - Offline Resilience: Mất mạng vẫn học bình thường, không rollback, tự động lưu hàng đợi offline và flush an toàn khi có mạng trở lại.
    - Auth UX: Phân lập tuyệt đối giữa Guest, Đăng nhập, Đăng xuất, và Đổi tài khoản (Account Switching); dọn dẹp hàng đợi bằng chứng cũ để chống nhiễm chéo dữ liệu.
- **Phase 10 — Final Verification & Release Gate**:
  - Vượt qua toàn bộ các cổng chất lượng (Quality Gates):
    - `npx tsc -b`: **0 errors**.
    - `npm run lint` (oxlint): **0 errors** trên 521 source files.
    - `npm run build`: Production bundle Vite hoàn tất thành công trong 2.50s (30 precache SW entries).
    - `dotnet build`: **0 warnings, 0 errors**.
    - `dotnet test`: **110/110 integration tests passed** (0 failures).
    - Vitest Frontend Suite: **168/168 tests passed** (0 failures).
  - Hoàn thiện tài liệu `README.md` và `CHANGELOG.md` đồng bộ 100% với kiến trúc triển khai thực tế.

### Added
- **Full Backend Migration: Supabase to ASP.NET Core 10 & SQL Server (Phases 1 — 16)**:
  - **Phase 1 — 11 — Clean Architecture Backend & Subsystem Migration**:
    - Thiết kế và hiện thực hóa kiến trúc Backend chuẩn Clean Architecture gồm 4 tầng dự án: `EnglishMastery.Domain`, `EnglishMastery.Application`, `EnglishMastery.Infrastructure`, và `EnglishMastery.Api` (ASP.NET Core 10 Web API + Entity Framework Core 10 + Microsoft SQL Server 2022).
    - Thay thế toàn bộ 11 trách nhiệm runtime của Supabase bằng ASP.NET Core:
      1. **Authentication**: JWT Bearer token xác thực chuẩn RFC 7519, mã hóa mật khẩu BCrypt, Refresh Token xoay vòng an toàn (`/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`).
      2. **User Profiles**: Quản lý thông tin học viên, khung avatar vinh danh, điểm Four Skills (`/api/profiles/me`).
      3. **Cloud Sync**: Hòa giải đồng bộ Local-First snapshot hai chiều, tôn trọng tuyệt đối luật "Highest Streak Wins" và "Completed Always Wins" (`/api/sync/pull`, `/api/sync/push`).
      4. **SRS Cloud Progress**: Đồng bộ hóa lũy đẳng tiến độ thẻ ghi nhớ FSRS-4.5 / SM-2 (`/api/sync/srs`).
      5. **Daily Logs**: Lưu trữ nhật ký học tập ngày, chống trùng lặp dữ liệu (`/api/sync/daily-logs`).
      6. **7-Category Leaderboard**: Tính toán và phân trang bảng xếp hạng trên SQL Server theo 7 danh mục học tập (`weekly_xp`, `streak`, `vocab_mastered`, `review_consistency`, `active_minutes`, `pronunciation_gain`, `toeic_gain`), xử lý rào chắn điều kiện tham gia (`is_eligible`) và hòa giải điểm số đồng hạng (`/api/leaderboard/rankings/{category}`).
      7. **Current User Rank**: Tra cứu vị trí thứ hạng của học viên hiện tại với độ phức tạp tối ưu, hiển thị sticky row và phân biệt rõ trạng thái chưa đủ điều kiện thay vì hiển thị điểm 0 ảo (`/api/leaderboard/me/{category}`).
      8. **Realtime**: SignalR WebSocket Hub (`/hubs/leaderboard`) thay thế hoàn toàn Supabase Realtime `postgres_changes`. Hỗ trợ reconnect tự động, debounce cập nhật và broadcast thời gian thực.
      9. **Weekly Finalization**: Chốt bảng xếp hạng tuần theo chu kỳ ISO 8601 Việt Nam (`Asia/Ho_Chi_Minh` UTC+7) vào nửa đêm Chủ Nhật sang Thứ Hai, thực thi trong SQL transaction an toàn và lũy đẳng (`/api/leaderboard/finalize`).
      10. **Leaderboard Snapshots**: Lưu trữ ảnh chụp lịch sử bảng xếp hạng tuần và bục vinh danh (podium) (`/api/leaderboard/snapshots/{weekId}`).
      11. **Frame Rewards**: Tự động mở khóa và trao thưởng khung đại diện danh dự cho top 3 hàng tuần (`/api/frames/claim`).
  - **Phase 12 — Event Sync Compatibility Boundary & Single Sync Engine**:
    - Audit toàn diện kiến trúc đồng bộ thực tế; duy trì cơ chế Snapshot Sync đã hoàn thiện ở Phase 7 thay vì triển khai Event Sourcing phức tạp không cần thiết; ngăn chặn triệt để nguy cơ xuất hiện hai sync engines song song.
    - Bảo toàn tính chất Local-First: Outbox / lỗi mạng tuyệt đối không rollback trạng thái Zustand cục bộ.
  - **Phase 13 — Backend Integration, Security & Multi-Device Hardening**:
    - Kiểm thử bảo mật đa người dùng: Ngăn chặn triệt để User A can thiệp profile, upload dữ liệu sync, hoặc nhận thưởng frame của User B; vô hiệu hóa JWT giả mạo hoặc hết hạn.
    - Xử lý kịch bản đa thiết bị (Multi-Device): Thiết bị A học offline, thiết bị B online, thiết bị A kết nối lại; bảo vệ toàn vẹn dữ liệu, không double XP, không mất streak.
    - Tối ưu hóa truy vấn SQL Server không N+1, sử dụng projection DTO, đánh index đúng mục đích và phân trang phía máy chủ.
  - **Phase 14 — Final Runtime Cutover Audit Before Supabase Removal**:
    - Quét toàn bộ repository và chứng minh 0 references Supabase còn tồn tại trong application runtime.
    - Bảo tồn toàn vẹn dữ liệu tĩnh: 10.381 từ vựng (`vocab10000.json`, `vocab5000.json`, `vocab1000.json`), Four Skills, và TOEIC datasets được giữ nguyên 100% tại client assets.
    - Rà soát bảo mật frontend: Tuyệt đối không chứa SQL driver, thông tin đăng nhập database hay chuỗi kết nối; frontend chỉ giao tiếp duy nhất qua `VITE_API_BASE_URL`.
  - **Phase 15 — Supabase Runtime Removal & Cleanup**:
    - Gỡ bỏ hoàn toàn package `@supabase/supabase-js`, client initialization, runtime services và các biến môi trường `VITE_SUPABASE_*`.
    - Phân loại và lưu trữ 31 file test kiểm thử RPC PostgreSQL cũ vào thư mục `archive/legacy_supabase_tests/` nằm ngoài `src/`.
  - **Phase 16 — Full Backend Migration Release Gate**:
    - Vượt qua toàn bộ cổng chất lượng Frontend:
      - `npm test`: **189/189 test files passed, 2,798/2,798 tests passed** (0 failures, 0 skipped).
      - `npx tsc -b`: **0 errors, 0 warnings**.
      - `npm run lint` (oxlint): **0 errors** trên 513 source files.
      - `npm run build`: Production bundle Vite biên dịch thành công trong 4.44s với 30 Service Worker precache entries.
    - Vượt qua toàn bộ cổng chất lượng Backend:
      - `dotnet build`: **0 warnings, 0 errors**.
      - `dotnet test`: **95/95 tests passed** trên toàn bộ các bộ kiểm thử unit, integration, security và Phase 7 verification.
    - Bảo toàn 100% tính nguyên vẹn của toàn bộ hệ thống Local-First: FSRS-4.5, SM-2, Flashcard, Mistake Bank, Four Skills, TOEIC, Quiz, Pronunciation, AI Tutor, Today Learning Plan, Learning Journey, CEFR Certification, Continuity, Personalized Insights, và Next Best Action.
- **Phase 7 — SQL Server / EF Core / Server-Side Replacement Verification**:
  - Xác minh kết nối chính thức tới `localhost / EnglishMasteryDev` bằng Windows Authentication (`ORIGINAL_LOGIN(): HuyHoangNg\hoang`), không fallback sang LocalDB/SQLite.
  - Hiện thực hóa `WeeklyFinalizationBackgroundService` (`IHostedService`) chốt tuần tự động Asia/Ho_Chi_Minh GMT+7 và đăng ký vào DI container `Program.cs`.
- **Phase 8 — UI / Config / Package / Test Residue Audit**:
  - **Cloud UI Audit**: Chuẩn hóa toàn bộ nhãn/tooltip/tiêu đề giao diện (App footer, Navbar, AuthSyncModal, AdminView), thay thế từ khóa Supabase bằng "Cloud" / "Kho từ vựng hệ thống". Xác minh toàn bộ các nút bấm và handlers gọi trực tiếp ASP.NET Core API.
  - **Config & Package Audit**: Xác nhận loại bỏ hoàn toàn package `@supabase/supabase-js`, không còn biến môi trường `VITE_SUPABASE_*` trong `.env` hay `.env.example`, không có rò rỉ credential/secret trong repository.
  - **Test Residue & Fixture Guard**: Bảo tồn `supabaseClient.ts` như một test-only stub nhằm duy trì các kiểm thử âm tính (cutover negative assertions xác nhận 0 lượt gọi Supabase) và tương thích backward tests.
  - **Obsolete Code Cleanup**: Xóa bỏ script mồ côi không consumers `scripts/seed_direct.cjs`.
  - **Documentation Alignment**: Cập nhật `README.md` đồng bộ kiến trúc thực tế ASP.NET Core 10 Web API, Entity Framework Core 10, SQL Server 2025 và SignalR Hub.
- **Phase 9 — Real Runtime Verification: Frontend → ASP.NET → SQL Server**:
  - Khởi chạy và kiểm chứng live ASP.NET Core API server tại `http://localhost:5000` và Frontend Vite dev server tại `http://localhost:5173`.
  - Thực thi toàn diện kịch bản 12 luồng nghiệp vụ runtime thực tế (`scripts/verify_real_runtime_phase9.mjs`): Register, Login, Auth Me, Sync Cloud State, Learning Action, Sync Progress/SRS/DailyLogs/Leaderboard XP, 7 Leaderboard categories, Current-User sticky rank, Weekly snapshots, Pending ceremony, SignalR Hub handshake & real-time broadcast event delivery, Offline resilience, Logout, và Security ownership enforcement (29/29 tests PASS).
  - Kiểm toán lưu lượng mạng thực tế của trình duyệt qua Chrome DevTools Protocol (CDP) (`scripts/verify_browser_network.mjs`): Xác nhận 276 requests thực tế với **0 request tới Supabase**, 100% cloud requests định tuyến tới ASP.NET Core API.
- **Phase 10 — Safe Supabase Runtime Removal & Residue Cleanup**:
  - Tiến hành quét toàn bộ 12 search terms chuẩn tắc (`supabase`, `Supabase`, `SUPABASE`, `@supabase/supabase-js`, `createClient`, `supabase.auth`, `supabase.from`, `supabase.rpc`, `supabase.channel`, `postgres_changes`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`).
  - Xác nhận **ACTIVE SUPABASE RUNTIME DEPENDENCIES = 0** trên toàn bộ cây mã nguồn application runtime.
  - Phân loại toàn bộ các reference còn lại: hoàn toàn nằm trong các test cutover negative assertion guards (`expect(supabaseRpcSpy).not.toHaveBeenCalled()`), mock test stub (`src/lib/supabaseClient.ts`), tài liệu lịch sử chuyển đổi (`CHANGELOG.md`, `README.md`), hoặc SQL dump/data generator scripts offline.
  - Bảo toàn 100% kho từ điển nội bộ 10.381 từ Oxford/CEFR, dữ liệu Four Skills, TOEIC, SafeStorage, LocalOutbox và tiến trình học tập của người dùng.
- **Phase 11 — Full Regression, Final Supabase Residue Verification & Documentation**:
  - **Full Quality Gates Passed**:
    - Frontend: `npm test` (**189/189 test files passed, 2,801/2,801 tests passed**), `npx tsc -b` (0 errors), `npm run lint` (0 errors), `npm run build` (Production build succeeded in 2.67s, 30 precached SW entries).
    - Backend: `dotnet test` (**95/95 tests passed**, 0 failures, 0 skipped), `dotnet build` (0 warnings, 0 errors).
  - **Final Supabase Residue Scan**:
    - Active Runtime Dependencies: **0** (không có import `@supabase/supabase-js`, client call, hay logic runtime nào).
    - Active Configuration: **0** (không còn `VITE_SUPABASE_*`).
    - Test Regression Guards & Stubs: 78 (negative cutover assertion tests và typed mock stub `supabaseClient.ts`).
    - Historical References: 80 (Changelog, archive tests, static dictionary seeds & SQL dumps).
    - Legacy Docs: 5.
  - **Zero Regression Verification**:
    - Xác minh toàn bộ các luồng: Authentication, Local Learning, Cloud Sync, XP, SRS, Daily Logs, 7 Leaderboards, Current rank, SignalR, Profile, Frames, Weekly results, Offline/reconnect, Logout/account switching.
    - Không xảy ra double XP, duplicate reviews, sai lệch weekly reset, hoặc stale activity resurrection.
  - **Single Canonical Backend**:
    - Frontend $\rightarrow$ ASP.NET Core API $\rightarrow$ Microsoft SQL Server (`EnglishMasteryDev` on `localhost`) là backend runtime duy nhất.
  - **Tuyên bố chính thức**: **SUPABASE MIGRATION COMPLETE**.

### Fixed
- **Flashcard Session Semantics & Auto-TTS Lifecycle Hardening (Phases 1 — 7)**:
  - **Session CTA & Title Semantic Fix (`flashcardQueueService.ts`, `FlashcardDeck.tsx`)**:
    - Phân định rõ ràng ngữ nghĩa tiêu đề và nút CTA dựa trên thành phần thực tế trong hàng đợi thay vì nhãn chung chung:
      - `NEW` (0 due + N new): "Phiên Học Thẻ Từ Mới" / "Bắt đầu học từ mới".
      - `REVIEW` (N due + 0 new): "Phiên Ôn Tập Thẻ Đến Hạn" / "Bắt đầu ôn tập".
      - `MIXED` (due > 0 + new > 0): "Phiên Học Hôm Nay" / "Bắt đầu phiên học".
      - `RESUME`: "Tiếp tục phiên học", tuyệt đối không dùng từ "Bắt đầu".
      - `EMPTY` (0 due + 0 new): Vô hiệu hóa nút bắt đầu (`canStart: false`), không tạo session rác, không trigger phát âm undefined.
  - **Card-Before-Auto-TTS Presentation Lifecycle (`FlashcardPresentationBoundary.tsx`)**:
    - Loại bỏ hoàn toàn arbitrary `setTimeout` guessing; chuyển giao toàn bộ luồng phát âm tự động sang component ranh giới trình chiếu `FlashcardPresentationBoundary`.
    - Đảm bảo thẻ từ hiện tại được render và gắn vào DOM trước khi Web Speech API (`speakWord`) được kích hoạt: Card Rendered in DOM $\rightarrow$ Presentation Ready $\rightarrow$ Auto-TTS.
  - **TTS Duplicate & Speech Cancellation Hardening**:
    - Triệt tiêu hoàn toàn hiện tượng duplicate speech trong React 18 StrictMode thông qua `lastPronouncedCardIdRef` tracking theo từng chu kỳ trình chiếu thẻ.
    - Hủy phát âm thẻ cũ (`cancelSpeech()`) ngay khi chuyển thẻ, đổi tab, restart hoặc unmount phiên học; không đọc lấn âm thanh sang thẻ tiếp theo.
    - Tôn trọng tuyệt đối cài đặt: khi `autoPlayAudio === false`, thẻ hiển thị hoàn toàn im lặng nhưng nút phát âm thủ công vẫn hoạt động chuẩn xác.
  - **Bảo toàn bất biến SRS & Quality Gate**:
    - Không can thiệp hay làm biến đổi thuật toán FSRS-4.5 / SM-2, due date, ease factor, stability, difficulty, review logs, Mistake Bank hay XP.
    - Vượt qua 54/54 targeted tests trên 5 test suites (`FlashcardSessionHardeningPhase6.test.tsx`, `FlashcardAutoTTSPhase4.test.tsx`, `FlashcardResumePhase4.test.tsx`, `FlashcardDeckPhase5.test.tsx`, `flashcardSessionSemantics.test.ts`), `npx tsc -b` (0 errors), `npm run lint` (0 errors) và `npm run build` (1.78s production bundle).
- **Local Leaderboard Identity & Cloud Auth Flow Hardening (Phases 1 — 10)**:
  - **Phase 1 — Deep Root Cause Audit & Failure Attribution**:
    - Phân tích toàn diện luồng danh tính Guest vs Authenticated giữa Navbar, Cloud Sync và Leaderboard.
    - Tìm ra nguyên nhân gốc rễ: Hàng sticky row và vị trí học viên trực tuyến trước đây so khớp theo tên hiển thị (`row.displayName === localUsername` hoặc `row.username === ...`) thay vì định danh `user_id` xác thực từ Supabase Auth; khiến người dùng chưa đăng nhập (Guest) có trùng username bị gán nhầm vào tài khoản Cloud có 0 điểm hoặc thứ hạng sai.
  - **Phase 2 — Canonical Leaderboard Identity State Model (`leaderboardIdentityService.ts`)**:
    - Thiết lập mô hình trạng thái danh tính dẫn xuất (derived state) gồm 3 trạng thái phân định rạch ròi mà không sinh hệ thống auth thứ hai:
      1. `local_only`: Người dùng chưa đăng nhập; hiển thị dữ liệu cục bộ trên thiết bị, không ánh xạ thứ hạng online.
      2. `authenticated_syncing`: Đã xác thực `user_id`; đang dung hòa dữ liệu local và cloud; hàng online chưa chốt thứ hạng cuối.
      3. `authenticated_synced`: Đã có `user_id` chính tắc; đồng bộ hoàn tất; ánh xạ hàng online chính xác 100% theo `user_id`.
  - **Phase 3 — Local Leaderboard Metric Preview Adapter (`localLeaderboardPreviewAdapter.ts`)**:
    - Xây dựng adapter đọc dữ liệu thuần túy `deriveCurrentUserLeaderboardPreview` cho cả 7 danh mục học tập (`weekly_xp`, `streak`, `vocab_mastered`, `review_consistency`, `active_minutes`, `pronunciation_gain`, `toeic_gain`).
    - Tuyệt đối không làm biến đổi (mutate) store, không tự động trao XP, không sinh thứ hạng online giả tạo, và phân biệt rõ trạng thái chưa đủ điều kiện (`insufficient_evidence`) thay vì hiển thị điểm 0 ảo.
  - **Phase 4 — Guest Leaderboard UX Hardening (`LeaderboardView.tsx`)**:
    - Bảo đảm chế độ Guest vẫn xem trọn vẹn Bảng Xếp Hạng công khai (top users, podium, phân trang) mà không bị chặn màn hình.
    - Thay thế hàng sticky người dùng online bằng Card Xem Trước Cục Bộ ("Bạn đang dùng chế độ cục bộ", "Điểm trên thiết bị", "Trạng thái: Chưa tham gia bảng xếp hạng", nút kêu gọi hành động "Đăng nhập & Sync Cloud").
  - **Phase 5 — Leaderboard Sync Cloud CTA & Authentication Transition**:
    - Tái sử dụng 100% modal và luồng xác thực đám mây từ Navbar (`onOpenSyncModal`), không dựng form đăng nhập thứ hai.
    - Chuyển tiếp mượt mà ngay sau khi đăng nhập thành công: tự động kích hoạt reconciliation, đồng bộ chỉ số học tập, và tải lại Bảng Xếp Hạng mà không cần người dùng nhấn F5 hay dùng `setTimeout` chờ đợi.
  - **Phase 6 — First Login Local-to-Cloud Reconciliation (`cloudDataMerger.ts`)**:
    - Thiết lập rào chắn dung hòa dữ liệu an toàn khi đăng nhập lần đầu hoặc đăng nhập vào tài khoản có snapshot cũ trên Cloud.
    - Bảo vệ toàn bộ tiến trình học tập local (XP tuần, chuỗi streak, từ vựng mastered, lịch sử ngày) trước snapshot 0 cũ từ xa.
    - Căn chỉnh tuần làm việc Việt Nam (`Asia/Ho_Chi_Minh` UTC+7): XP của tuần trước không bị đẩy nhầm vào tuần hiện tại.
  - **Phase 7 — Authenticated Current-User Row & Sticky Rank Identity Fix**:
    - Triệt tiêu hoàn toàn mọi logic so khớp theo username/displayName/avatar; nhận diện hàng người dùng hiện tại 100% dựa vào `row.userId === authUser.id`.
    - Bảo đảm RPC `get_my_leaderboard_rank` chỉ gọi khi đã xác thực `user_id`; phân giải hàng sticky nhất quán giữa danh sách hiển thị và RPC độc lập.
  - **Phase 8 — Auth Transition Race & Cache Hardening (`leaderboardService.ts`)**:
    - Xóa bỏ tình trạng rò rỉ dữ liệu khi đổi tài khoản (Account A $\rightarrow$ Logout $\rightarrow$ Account B): vô hiệu hóa có chọn lọc cache thứ hạng và hàng sticky của tài khoản cũ mà không xóa mất cache bảng xếp hạng công khai.
    - Loại bỏ hiện tượng race condition giữa Auth, Sync và Fetch khi đăng nhập.
  - **Phase 9 — Offline / Sync Failure / Reconnect Hardening**:
    - Chế độ Guest Offline: giữ nguyên điểm số local, thông báo trạng thái offline và vô hiệu hóa nút CTA mạng an toàn.
    - Chế độ Authenticated Offline: giữ nguyên điểm local, thông báo "Điểm online sẽ cập nhật khi có mạng", không rollback dữ liệu.
    - Xử lý lỗi đồng bộ: hiển thị thẻ thông báo lỗi kèm nút `[Thử lại]` gọi thẳng vào luồng sync chuẩn tắc `performFullSync({ isRetry: true })`.
    - Tự động đồng bộ và tải lại Bảng Xếp Hạng ngay khi có kết nối mạng trở lại (`online` event).
  - **Phase 10 — Local Leaderboard Identity Final Validation & Release Gate**:
    - Hoàn thành bộ kiểm thử xác thực E2E 14 kịch bản trọng yếu (`leaderboardFinalValidationPhase10.test.ts`).
    - Vượt qua toàn bộ Quality Gate với **89/89 tests passed** trên 10 test suites, 0 lỗi TypeScript composite (`tsc -b`), 0 lỗi linter (`oxlint`), và build production bundle Vite thành công (2.37s).
- **End-to-End 7-Category Leaderboard Pipeline Repair & Comprehensive Synchronization (Phases 1 — 12)**:
  - **Phase 1 — Deep Architectural Audit & Failure-Mode Attribution**:
    - Phân tích toàn diện luồng dữ liệu 7 hạng mục Leaderboard (`weekly_xp`, `streak`, `vocab_mastered`, `review_consistency`, `active_minutes`, `pronunciation_gain`, `toeic_gain`).
    - Xác định nguyên nhân gốc rễ: 5 chỉ số chất lượng học tập được tính toán thuần túy tại local (`leaderboardLearningMetrics.ts`) nhưng hoàn toàn không có hàm ghi xuống bảng `weekly_learning_metrics`; `weekly_xp` bị nuốt lỗi (error swallowing) khi gặp trục trặc mạng và có nguy cơ bị cloud 0 đè đè khi login/reconnect; `streak` thiếu cơ chế monotonic merge đa thiết bị và căn chỉnh múi giờ `Asia/Ho_Chi_Minh`; bảng cơ sở dữ liệu thiếu ràng buộc `UNIQUE(user_id, week_id)` và chính sách RLS ghi của người dùng đã xác thực.
  - **Phase 2 — Comprehensive Pipeline Test Harness**:
    - Xây dựng mạng lưới kiểm thử an toàn toàn diện (Characterization & Pipeline Tests) trên cả 7 hạng mục trước khi sửa đổi mã nguồn, bảo đảm các observable contracts từ domain state đến cloud synchronization.
  - **Phase 3 — Fix Weekly XP Leaderboard Pipeline End-to-End (`weeklyXpPipelinePhase3.test.ts`)**:
    - Rà soát mọi điểm cộng XP để bảo đảm commit local state trước khi kích hoạt sync.
    - Triệt tiêu hoàn toàn nuốt lỗi trong `syncUserScoreToLeaderboard`, phân loại và trả về kết quả đồng bộ có cấu trúc.
    - Thiết lập rào chắn Monotonic Merge bảo vệ XP local hợp lệ trước snapshot 0 cũ từ đám mây khi đăng nhập lại.
    - Giữ vững hạn ngạch chống spam XP (500 XP/ngày cho flashcard, 15 game/ngày/loại cho quiz) và khóa tuần ISO Việt Nam (`Asia/Ho_Chi_Minh`).
  - **Phase 4 — Fix Streak Leaderboard Pipeline (`streakPipelinePhase4.test.ts`)**:
    - Tái sử dụng động cơ streak chuẩn (`profile.streak`), không sinh động cơ thứ hai.
    - Đồng bộ streak chuẩn xác vào `leaderboard_profiles.streak` theo ranh giới ngày `Asia/Ho_Chi_Minh` (UTC+7).
    - Ngăn chặn triệt để duplicate daily logs làm tăng ảo streak; thuật toán hòa giải đa thiết bị bảo vệ chuỗi liên tục lớn nhất ("highest valid streak wins").
  - **Phase 5 — Shared Quality-Metric Derivation & Cloud Synchronization Foundation (`qualityMetricPipelinePhase5.test.ts`)**:
    - Xây dựng hàm dùng chung duy nhất `syncWeeklyLearningMetrics` trong `leaderboardService.ts` cho cả 5 chỉ số chất lượng.
    - Trích xuất dữ liệu tươi mới từ Zustand store trước mỗi lần sync qua `deriveLeaderboardLearningMetrics(...)`.
    - Tích hợp bộ đệm Debounce (`LEADERBOARD_METRICS_SYNC_DEBOUNCE_MS = 3000ms`), gom gộp yêu cầu (request coalescing), và exponential backoff.
    - Bảo toàn tính chất Local-First: sự cố mạng hoặc RLS tuyệt đối không rollback trạng thái học tập local.
  - **Phase 6 — Vocabulary Mastery & Review Consistency Leaderboard Metrics (`vocabAndConsistencyPipelinePhase6.test.ts`)**:
    - Kết nối bằng chứng SRS vào tầng đồng bộ đám mây:
      - `vocab_mastered`: Đánh giá nghiêm ngặt FSRS-4.5 (state 2, stability $\ge 21.0$, reps $\ge 2$) và SM-2 (reps $\ge 5$ hoặc interval $\ge 21$ ngày); khử trùng lặp biến thể từ theo Canonical Lemma (`run`/`running`/`runs` $\rightarrow$ `run`).
      - `review_consistency`: Tỷ lệ thẻ đến hạn hoàn thành so với dự kiến; xử lý trung tính ngày không có thẻ đến hạn; giới hạn quá tải ($\le 60$ thẻ/ngày); loại trừ thẻ ôn tập tăng cường khỏi tử số.
  - **Phase 7 — Active Learning Minutes Leaderboard Pipeline (`activeLearningMinutesPipelinePhase7.test.ts`)**:
    - Kết nối thời gian tích lũy từ `activeLearningTimeService` vào trường `weekly_learning_metrics.active_minutes`.
    - Bảo toàn bộ lắng nghe focus/blur, ngắt tự động sau 60s không tương tác, giới hạn phân đoạn 1800s, và danh sách module whitelist (loại trừ Dashboard/settings).
    - Tự động kích hoạt sync khi hoàn thành phiên học hoặc commit phân đoạn mà không gây nghẽn mạng.
  - **Phase 8 — Eligibility-Based Metrics: Pronunciation Gain & TOEIC Gain (`eligibilityMetricsPipelinePhase8.test.ts`)**:
    - `pronunciation_gain`: Rào chắn điều kiện nghiêm ngặt $\ge 10$ lượt nói trên $\ge 2$ ngày khác nhau từ Web Speech API thật (`isTrusted === true`). Khi chưa đủ điều kiện, trường `is_eligible` là `false` và UI hiển thị "Chưa xếp hạng" (tuyệt đối không hiển thị 0% hay điểm ảo).
    - `toeic_gain`: Rào chắn điều kiện $\ge 2$ bài thi đầy đủ thời lượng $\ge 60$s, giãn cách giữa hai lần thi $\ge 48$h. Khi chưa đủ điều kiện, UI hiển thị "Chưa xếp hạng" (không hiển thị điểm 0).
  - **Phase 9 — Leaderboard Read Path & Realtime Consistency (`leaderboardReadPathPhase9.test.ts`)**:
    - Đồng bộ hóa toàn diện giữa PostgreSQL RPC `get_leaderboard_category_rankings` và TypeScript domain models (`user_id`, `username`, `avatar_url`, `score`, `rank`, `secondary_score`, `is_eligible`).
    - Duy trì đọc tương thích ngược 100% cho `weekly_xp` và `streak` từ `leaderboard_profiles`.
    - Hỗ trợ RPC `get_my_leaderboard_rank` cho cả 7 hạng mục, duy trì hàng sticky hiển thị vị trí học viên $O(1)$.
    - Tích hợp `flushPendingCloudSync` đẩy ngay các thay đổi local đang hoãn khi người dùng mở màn hình Bảng Xếp Hạng.
  - **Phase 10 — Supabase Schema, RPC & RLS Repair (`supabaseSchemaAndRlsPhase10.test.ts`)**:
    - Biên soạn script SQL di chuyển hoàn chỉnh, có tính chất lũy đẳng (idempotent) và không phá hủy dữ liệu (non-destructive): `scripts/setup_complete_leaderboard_pipeline_repair.sql`.
    - Bổ sung ràng buộc duy nhất `CONSTRAINT uq_user_week_metrics UNIQUE (user_id, week_id)` trên bảng `weekly_learning_metrics`.
    - Bổ sung các cột thiếu trong bảng `public.profiles`: `four_skills_scores` và `equipped_frame`.
    - Cấu hình chính sách RLS chuẩn mực: cho phép đọc công khai (`FOR SELECT USING (true)`) và cho phép người dùng đã xác thực cập nhật hàng của chính mình (`FOR INSERT/UPDATE USING (auth.uid() = user_id)`).
    - Bổ sung bộ ghi log đồng bộ khử thông tin nhạy cảm (`logLeaderboardSyncError`), phân loại rõ các mã lỗi (`RLS`, `SCHEMA`, `RPC`, `AUTH`, `NETWORK`, `VALIDATION`) và che giấu toàn bộ API key/token.
  - **Phase 11 — Leaderboard Reconciliation & Real-World Edge Cases (`leaderboardReconciliationPhase11.test.ts`)**:
    - Tự động backfill dữ liệu từ bằng chứng học tập có sẵn tại local khi khởi động/reconnect (người dùng không cần thực hiện thêm hành động học tập mới).
    - Bảo toàn bất biến Local-First: offline commit ngay vào local store; tự động đẩy lên cloud khi có kết nối trở lại.
    - Xử lý xung đột đa thiết bị: hòa giải đơn điệu bảo vệ dữ liệu mới hơn, loại bỏ trùng lặp nhật ký ngày.
  - **Phase 12 — Final 7-Category Leaderboard Validation & Release**:
    - Kiểm chứng toàn bộ 7 pipeline hạng mục hoạt động trơn tru end-to-end.
    - Vượt qua toàn bộ Quality Gate khắt khe:
      - `npx tsc -b`: 0 lỗi biên dịch composite TypeScript.
      - `npm run lint`: 0 lỗi linter.
      - `npm run build`: Đóng gói production bundle thành công trong 2.07s với 30 Service Worker precache entries (11.8MB).
      - Kiểm thử: **138/138 tests passed trên toàn bộ 9 test suites của pipeline Leaderboard**.



### Refactored
- **Modular Store & Flashcard Architecture Initiative (Phases 1 — 8)**:
  - **Phase 1 — Repository-Wide Large-File Audit & Refactor Priority Map**:
    - Quét toàn bộ 247 source files trong kho mã nguồn, phân loại chính xác các candidate P0/P1/P2/P3 dựa trên ranh giới ngữ nghĩa và trách nhiệm.
    - Xác định 2 candidate ưu tiên cao nhất: P0 Candidate #1 `src/store/useAppStore.ts` (3,662 dòng, 7 responsibilities bị dồn nén) và P1 Candidate #4 `src/components/FlashcardDeck.tsx` (3,111 dòng, trộn lẫn logic hàng đợi phiên học, bộ lọc thẻ, phím tắt và render view).
    - Phân loại rõ các file lớn hợp lý P3 không refactor: `fourSkillsData.ts` (3,391 dòng), `toeicQuestionsData.ts` (3,091 dòng), `FourSkillsView.tsx` (2,752 dòng).
  - **Phase 2 — Characterization Tests & Safety Net**:
    - Xây dựng bộ test an toàn đặc trưng `src/store/__tests__/useAppStore.characterization.test.ts` (14 targeted tests) bảo vệ observable contracts: state initialization, telemetry tracking, FSRS/SM-2 card updates, four-skills evidence scoring, backup serialization, anti-spam guards.
  - **Phase 3 — P0 Modular Refactor: `useAppStore.ts`**:
    - Tách nhỏ monolith 3,662 dòng thành composition root tinh gọn **169 dòng** (giảm **95.4%** kích thước).
    - Tạo 7 domain slices độc lập trong `src/store/slices/`: `createTelemetrySlice.ts`, `createSrsSlice.ts`, `createFourSkillsSlice.ts`, `createProfileSlice.ts`, `createMistakeSlice.ts`, `createVocabularySlice.ts`, `createContinuitySlice.ts`.
    - Trích xuất hạ tầng lưu trữ và dữ liệu phụ trợ: `safeStorage.ts`, `storeRehydration.ts`, `backupDataService.ts`, `cloudDataMerger.ts`, `vocabularyComposer.ts`, `fourSkillsSanitizers.ts`, `initialDefaults.ts`.
    - Bảo toàn 100% public contracts, persistent schema `english_mastery_storage_v2`, và cơ chế re-export backward-compatible.
  - **Phase 4 — P1 Modular Refactor: `FlashcardDeck.tsx`**:
    - Tách component 3,111 dòng thành **2,205 dòng** (giảm **29.1%**), bảo tồn trọn vẹn UX/UI, animation, và các audio hooks.
    - Trích xuất service nghiệp vụ hàng đợi phiên học thuần túy: `src/services/flashcardQueueService.ts` (343 dòng).
    - Trích xuất các UI components phân đoạn và hook: `src/components/flashcard/FlashcardSessionHeader.tsx`, `FlashcardSessionSummary.tsx`, `FlashcardFilterTabs.tsx`, `src/hooks/useFlashcardKeyboardShortcuts.ts`.
  - **Phase 5 — Dependency Graph, Initialization Order & Singleton Hardening**:
    - Quét và triệt tiêu toàn bộ 21 circular dependencies xuống **0 cycles** bằng script xác thực tự động `scripts/audit_dependency_graph.mjs`.
    - Đảm bảo hướng phụ thuộc sạch Clean Architecture: `types/data` $\rightarrow$ `services` $\rightarrow$ `store` $\rightarrow$ `hooks` $\rightarrow$ `components`.
    - Xác nhận tính duy nhất (singleton) của 4 tài nguyên toàn cục: Supabase Client, SafeStorage fallback wrapper, LocalOutbox persistent queue, Web Speech TTS / SpeechSynthesis.
  - **Phase 6 — Cross-Feature Behavior Preservation & Persistence Safety**:
    - Chạy kiểm thử hồi quy 9 phân hệ chức năng: Flashcard (FSRS/SM-2), Four Skills, CEFR Checkpoint, TOEIC, AI Tutor, Learning Continuity, Today Plan, Next Best Action, Cloud Sync Outbox.
    - Xác nhận không có sai lệch trong thuật toán FSRS-4.5/SM-2, không mất dữ liệu persistence, và không phá vỡ logic merge đám mây.
  - **Phase 7 — Performance Validation & Post-Refactor Repository Re-Scan**:
    - Đánh giá hiệu năng in-memory: Trie prefix index khởi tạo dưới 50ms, tra cứu O(1) < 5ms, bộ nhớ đệm `_cachedUnifiedCards` hoạt động chính xác.
    - Quét lại toàn bộ kho mã nguồn: Xác nhận không phát sinh God File mới, không có giant utility/types nào bị phình to bất thường.
  - **Phase 8 — Final Quality Gate & Certification**:
    - `npx tsc -b`: 0 lỗi biên dịch TypeScript composite.
    - `npm run lint`: 0 lỗi linting (oxlint).
    - `npm test`: 181/181 test suites passed, 2,818/2,818 tests passed (100% Pass Rate).
    - `npm run build`: Production bundle biên dịch thành công trong 3.17s với PWA Service Worker precache.

### Added
- **CEFR Mastery & 4-Skill Checkpoint Certification Engine (Phases 1 — 14)**:
  - **Phase 1 — Discovery & Alignment**: Phân tách triệt để 3 trục ngữ nghĩa: `Completion` (tiến độ bài học) $\neq$ `Competency` (năng lực kỹ năng) $\neq$ `Certification` (chứng chỉ đạt chuẩn CEFR). Ngăn chặn dứt điểm hiện tượng hoàn thành 100% bài học tự động kích hoạt chứng chỉ.
  - **Phase 2 — Central Policy & Readiness**: Thiết lập `CENTRAL_CERTIFICATION_POLICY` làm nguồn chân lý duy nhất (SSOT); quy định sàn điểm tối thiểu từng kỹ năng (A1: 50, A2: 55, B1: 55, B2: 60, C1: 65, C2: 70) và điểm tổng (A1: 65, A2: 70, B1: 75, B2: 75, C1: 80, C2: 85); hàm thuần túy `evaluateLevelReadiness` tính toán độ sẵn sàng dựa trên tỷ lệ tiếp cận bài học ($\ge 20\%$) và độ tin cậy năng lực mà không gây đột biến trạng thái store; bảo toàn quyền Tự do khám phá (Free Exploration).
  - **Phase 3 — Lifecycle & Resumable Session**: Thiết kế máy trạng thái phiên thi 5 giai đoạn (`intro` $\rightarrow$ `listening` $\rightarrow$ `reading` $\rightarrow$ `speaking` $\rightarrow$ `writing` $\rightarrow$ `result`); tích hợp `ResumableActivity` (`type: 'checkpoint'`); thực thi nguyên tắc "Completed Always Wins" và tự động dọn dẹp các phiên thi dở dang quá hạn 24 giờ.
  - **Phase 4 — Checkpoint Experience Modal**: Xây dựng modal khảo thí toàn diện `CEFRCheckpointSessionModal.tsx` với thanh tiến trình `ProgressHeader` trung thực theo từng section; tuân thủ chuẩn trợ năng WCAG 2.1 AA (`role="dialog"`, `aria-modal="true"`); kiểm soát layout ổn định (Zero Layout Shift).
  - **Phase 5 — Listening Checkpoint**: Động cơ chấm điểm nghe tất định dựa trên bài nộp thực tế; tự động lưu vết từ vựng làm sai vào Mistake Bank với cơ chế khử trùng lặp; bảo vệ chống double-submit và reload/resume an toàn.
  - **Phase 6 — Reading Checkpoint**: Thiết lập chế độ khảo thí Assessment Mode vô hiệu hóa hoàn toàn từ điển tra cứu popover, gợi ý đáp án và giải thích chi tiết; chỉ tính điểm dựa trên độ hiểu bài thực tế.
  - **Phase 7 — Speaking Checkpoint & Trusted Speech**: Tích hợp Web Speech API với ranh giới tin cậy nghiêm ngặt: mọi trường hợp trình duyệt không hỗ trợ, từ chối cấp quyền mic, hoặc lỗi nhận diện đều trả về `insufficient_evidence` với điểm `null` (tuyệt đối không dùng điểm giả lập 85% hay fake confidence); mic safety bảo đảm không bao giờ tự động bật mic khi mở modal hoặc khôi phục phiên thi.
  - **Phase 8 — Writing Checkpoint & Trusted AI Boundary**: Tích hợp dịch vụ chấm luận Gemini với cơ chế kiểm tra tính xác thực khắt khe: chỉ chấp nhận kết quả hợp lệ, được tin cậy (`isTrusted === true`) và không phải là fallback giả lập (`!isFallback`); khi mất mạng hoặc dùng mock engine, phần thi trả về `insufficient_evidence` / `pending`, lưu trữ bản nháp an toàn tại local và cho phép thử lại khi có kết nối, không tạo điểm chứng chỉ ảo.
  - **Phase 9 — Evaluation Engine, Immutable Evidence & Retake Policy**: Hoàn thiện engine đánh giá trung tâm bắt buộc đủ 4 kỹ năng và rào chắn sàn điểm (không cho điểm Nghe bù điểm Nói); lưu trữ chứng chỉ bất biến `PersistedLevelCertification`; áp dụng quy tắc Finalize Once (mỗi attemptId chỉ finalize đúng 1 lần) chống duplicate chứng chỉ, XP và replay tampering; thiết lập bộ đếm thời gian giãn cách thi lại tất định (A1: 0h, A2: 12h, B1: 24h, B2: 24h, C1: 48h, C2: 48h).
  - **Phase 10 — Reinforcement Loop & Routing**: Tự động bóc tách kỹ năng yếu dưới sàn điểm kèm bằng chứng cụ thể khi không đạt (`Needs Reinforcement`); định tuyến thông minh sang bài luyện tập tương ứng; tích hợp liền mạch với `TodayLearningPlan`, `nextActionResolver`, và `PersonalizedInsights`.
  - **Phase 11 — Learning Journey UI & History**: Nâng cấp bản đồ học tập `LearningJourneyProgressionMap.tsx` hiển thị song song tiến độ bài học và huy hiệu chứng chỉ CEFR; modal lịch sử thi `CEFRCertificationHistoryModal.tsx`; phân tách rạch ròi giữa `currentlyLearningLevel` và `highestCertifiedLevel`; hiển thị trạng thái trung tính ("Chưa bắt đầu") cho người dùng mới, không bao giờ hiển thị "A1 Failed" hay điểm 0.
  - **Phase 12 — Durability, Backup & Cloud Merge**: Giới hạn lưu trữ tối giản `safeStorage` (tối đa 50 lượt thi gần nhất); đảm bảo tương thích ngược 100% với tài khoản/bản backup cũ; tích hợp đồng bộ trường `four_skills_scores` trên Supabase; thuật toán hòa giải đám mây đơn điệu (Monotonic Cloud Merge) bảo vệ chứng chỉ hợp lệ khi đồng bộ đa thiết bị ("Completed Always Wins").
  - **Phase 13 — Offline, Security, Performance & Hardening**: Chốt chặn chống giả mạo DevTools trong `saveLevelCertification`; bộ nhớ đệm `cachedDefaultLessonGroups` loại bỏ nút thắt lặp dữ liệu tĩnh 96 bài học khi render bản đồ; ma trận kiểm thử khả năng chịu lỗi ngoại tuyến (Offline Matrix).
  - **Phase 14 — Quality Gate & Production Verification**: Toàn bộ hệ thống vượt qua Quality Gate hoàn hảo: 190/190 test suites passed, 2,947/2,947 tests passed (100% Pass Rate); 0 lỗi TypeScript composite (`npx tsc -b`); 0 lỗi linter (`npm run lint`); đóng gói production bundle thành công trong 2.33s với 30 mục Service Worker precache 11.78MB (`npm run build`).
- **Hybrid Domain Event Sync & Local Outbox Engine (Phases 1 — 11)**:
  - **Audit Kiến Trúc Hiện Trạng & Ranh Giới Hybrid (Phase 1)**:
    - *Ranh Giới Kiến Trúc Hybrid*: Duy trì Local-First Zustand store và periodic snapshot sync làm nền tảng fallback/safety net; xây dựng tầng Event Sync độc lập để hấp thụ các đột biến học tập tức thời (granular learning mutations).
    - *Zero-Duplicate Infrastructure*: Tuyệt đối không tạo connectivity listener thứ hai, retry loop thứ hai hay worker background song song; hợp nhất 100% việc đẩy event vào `cloudSyncService.ts` hiện có.
  - **Domain Event Contract & Local Outbox Foundation (Phase 2)**:
    - *Type-Safe Domain Event Contract (`types/learningEvents.ts`)*: Discriminated union định nghĩa chặt chẽ 4 domain events (`review_card`, `learn_word`, `complete_quiz`, `mistake_created`) với canonical entity ID, schema version, occurredAt, deviceId, idempotencyKey, và typed payload tối thiểu; loại bỏ hoàn toàn `any` / `Record<string, unknown>`.
    - *Event Identity Helpers (`eventIdentityService.ts`)*: Cung cấp `generateEventId`, `generateIdempotencyKey` deterministic sha256/hash-like, và `getStableDeviceId` an toàn qua localStorage.
    - *Persistent Local Outbox (`localOutboxService.ts`)*: Quản lý hàng đợi outbox bền vững offline-safe, hỗ trợ bounded queueing, FIFO ordering, granular lease handling (`markSending`, `markAcknowledged`, `markFailed`, `recoverExpiredLeases`), và chính sách tự động dọn dẹp vệ sinh (hygiene trimming).
  - **Supabase Backend RPC & Idempotent Event Ingestion (Phase 3)**:
    - *Bảng Lưu Trữ & Audit Log (`scripts/setup_event_sync.sql`)*: Bảng `learning_sync_events` với RLS nghiêm ngặt (`auth.uid() = user_id`), ngăn chặn triệt để spoofing user ID, đánh chỉ mục tối ưu trên `(user_id, idempotency_key)` và `(user_id, occurred_at)`.
    - *PostgreSQL RPC `ingest_learning_events`*: Hấp thụ batch events với kích thước bounded batch, xác thực quyền máy chủ, kiểm tra `schema_version = 1`, validate kích thước/cấu trúc payload, và trả về granular ACK array (`eventId`, `status: 'applied' | 'duplicate' | 'rejected' | 'failed'`).
  - **Kết Nối Local Outbox Qua Coordinator Hiện Có (Phase 4)**:
    - *Bounded Batch Flush (`cloudEventSyncService.ts` & `cloudSyncService.ts`)*: Flush tối đa 20 events mỗi nhịp sync, tích hợp trực tiếp vào coordinator duy nhất của hệ thống (`isSyncInProgress`, `hasPendingSyncRequest`).
    - *Granular ACK & Partial Success*: Chỉ xóa các event được máy chủ ACK (`applied` hoặc `duplicate`); giữ lại các lỗi retryable (`failed`) để thử lại ở nhịp sau; drop các invalid events (`rejected`).
    - *Bất Biến Local-First*: Sự cố mạng hoặc HTTP failure tuyệt đối không làm rollback trạng thái học tập cục bộ của người dùng.
  - **Migrate Domain 1: `review_card` (Phase 5)**:
    - *Nguyên Tử & Chống Ghi Đè (`reviewCardEventService.ts`)*: Ghi nhận review event chỉ SAU KHI local FSRS/SM-2 store đã commit thành công. Bảo vệ bằng atomic lock `isReviewingRef` và `processedReviewEventKeys`.
    - *FSRS/SM-2 Invariant*: Tái sử dụng trọn vẹn thuật toán FSRS/SM-2 hiện có; an toàn tuyệt đối chống double-click, duplicate review và out-of-order review.
  - **Migrate Domain 2: `learn_word` (Phase 6)**:
    - *Bảo Toàn Canonical Lemma (`learnWordEventService.ts`)*: Thao tác thêm/học từ vựng Dictionary emit event mang canonical normalized word.
    - *Thêm Từ Idempotent*: Đảm bảo thao tác thêm từ trên nhiều thiết bị hoặc retry event trong điều kiện mạng chập chờn không bao giờ sinh ra thẻ flashcard trùng lặp trong kho từ vựng.
  - **Migrate Domain 3: `complete_quiz` (Phase 7)**:
    - *Chống Replay & Chống Gian Lận Điểm (`completeQuizEventService.ts`)*: Mỗi lượt hoàn thành Quiz gắn liền với `sessionId` và `completedAt` duy nhất.
    - *Nguyên Tắc Server-Authoritative*: 1 Quiz Session $\to$ tối đa 1 lượt ghi nhận và 1 lần cộng XP; chặn đứng nguy cơ replay farming qua `processedXpKeys` và `completedQuizSessionIds`.
  - **Migrate Domain 4: `mistake_created` (Phase 8)**:
    - *Mistake Bank Single Source of Truth (`mistakeCreatedEventService.ts`)*: Tái sử dụng `adaptiveMistakeService`, vận chuyển bằng chứng lỗi thật (source, context, timestamp, trigger entity).
    - *Deduplication Chuẩn Xác*: Phân biệt rành mạch giữa event replay và một lần mắc lỗi thật mới của người học; bảo đảm không tạo Mistake Bank thứ hai.
  - **Đa Thiết Bị & Khôi Phục Snapshot Lai (Phase 9)**:
    - *Phân Loại Chính Sách Merge Theo Domain*: Commutative domain (`learn_word`, `mistake_created`) hợp nhất không mất dữ liệu; Entity-conflicting domain (`review_card`, `complete_quiz`) áp dụng chính sách Completed-Always-Wins và FSRS state convergence dựa trên mỏ neo thời gian.
    - *An Toàn Lệch Đồng Hồ*: Hoàn toàn không phụ thuộc vào `Date.now()` thiết bị; tái sử dụng server time anchor đã thiết lập từ Phase 1.
  - **Gia Cố Chống Tấn Công, Lỗi & Kiểm Thử Toàn Diện (Phase 10 & 11)**:
    - *Failure Matrix & Security Hardening*: Chặn đứng tấn công replay, payload tampering, schema version mismatch, auth token expiration, outbox storage overflow.
    - *Quality Gate Tuyệt Đối*: Vượt qua toàn bộ 175/175 test suites (2,711/2,711 tests passed, 100% Pass Rate), `npx tsc -b` 0 lỗi, `npm run lint` 0 lỗi, `npm run build` xuất xưởng production bundle sạch sẽ.
- **TOEIC Listening Engine & Group-Based Architecture (Phases 1 — 8)**:
  - **Audit Kiến Trúc Hiện Trạng & Chốt Thiết Kế Kỹ Thuật (Phase 1)**:
    - *Audit Nguồn Audio*: Xác định rõ hiện trạng kho đề TOEIC hỗn hợp giữa recorded MP3 audio (có URL) và Web Speech API (TTS script). Chấm dứt việc ngụy tạo TTS thành recorded audio; phân định rõ contract nguồn nghe.
    - *Kiến trúc Group vs Question*: Tách bạch dữ liệu âm thanh khỏi từng câu hỏi riêng lẻ. Chuyển đổi mô hình Part 3/4 từ per-question audio sang 1 group $\to$ 1 audioGroupId $\to$ N questions.
    - *Tái sử dụng Primitives*: Kế thừa transcript timeline, seek bar và speech service từ Four Skills Listening mà không import nguyên view hay phá vỡ ranh giới module.
  - **Chuẩn Hóa Data Model Hướng Nhóm & Validation (Phase 2)**:
    - *Type-Safe Domain Model (`toeicListening.ts`)*: Định nghĩa các interface chuẩn `NormalizedToeicListeningGroup`, `ToeicListeningQuestion`, `ToeicListeningAudioSource`, `ToeicListeningTranscript`, loại bỏ 100% `any`.
    - *Normalizer Chống Duplicate (`toeicListeningNormalizer.ts`)*: Chuẩn hóa toàn bộ câu hỏi Part 1–4 về cấu trúc group; câu hỏi chỉ giữ tham chiếu `groupId` và `audioGroupId`, không nhân bản audioScript hay metadata.
    - *Bộ Xác Thực Dữ Liệu (`toeicListeningValidator.ts`)*: Kiểm chứng tính toàn vẹn của dataset: Part 1 phải có ảnh và 4 lựa chọn; Part 2 phải có 3 lựa chọn; Part 3/4 mỗi group phải có 2–3 câu hỏi; bắt buộc khớp audioGroupId.
  - **Shared TOEIC Listening Engine Độc Lập (`toeicListeningEngine.ts` - Phase 3)**:
    - *Decoupled Playback State Machine*: Quản lý trạng thái (`idle`, `loading`, `ready`, `playing`, `paused`, `ended`, `error`), tách rời khỏi React render cycle và Zustand global store; ngăn chặn re-render toàn bộ assessment view mỗi nhịp `timeupdate`.
    - *Audio/TTS Lifecycle Thống Nhất*: Quản lý đồng nhất cả `HTMLAudioElement` và `window.speechSynthesis`. Tự động cleanup audio element, cancel TTS utterance, hủy timer và event listener khi đổi group hoặc unmount.
    - *Event Bus Cục Bộ*: Cung cấp subscribe callback cho audio bar và progress slider mà không làm xáo trộn app-level state.
  - **Tích Hợp Giao Diện Part 1 & Part 2 (`ToeicPart1View.tsx`, `ToeicPart2View.tsx` - Phase 4)**:
    - *Part 1 Photographs*: Hiển thị ảnh kèm thanh audio bar; `alt` text chuẩn trợ năng không leak nội dung đáp án đúng; Mock Mode tuân thủ pure listening, Practice Mode hỗ trợ xem transcript và giải thích chi tiết sau khi trả lời.
    - *Part 2 Question-Response*: Mock Mode chỉ hiển thị các nút chọn A, B, C; ẩn hoàn toàn text câu hỏi và text lựa chọn trước khi nộp bài để đảm bảo đúng thể thức thi nghe thuần túy; hỗ trợ transcript trong Practice Mode sau khi chọn đáp án.
  - **Tích Hợp Audio Hướng Nhóm Cho Part 3 & Part 4 (`ToeicListeningGroupView.tsx` - Phase 5)**:
    - *One Group — One Audio — Multiple Questions*: Phát một audio duy nhất cho toàn bộ nhóm hội thoại (Part 3) hoặc bài nói (Part 4); chuyển đổi câu hỏi Q1 $\leftrightarrow$ Q2 $\leftrightarrow$ Q3 trong cùng nhóm tuyệt đối KHÔNG restart hay reload audio.
    - *Bộ Điều Hướng Nhóm Con (Child Question Navigator)*: Cho phép thí sinh duyệt nhanh giữa các câu hỏi trong cùng conversation/talk mà vẫn duy trì liên tục dòng phát âm thanh; chỉ dừng/chuyển bài khi chuyển hẳn sang nhóm mới.
  - **Siết Chặt Chính Sách Practice / Mock & An Toàn Khôi Phục Snapshot (Phase 6)**:
    - *Central Listening Policy (`DEFAULT_LISTENING_POLICIES`)*: Tập trung hóa toàn bộ luật thi vào `ToeicListeningPolicy`; loại bỏ phân nhánh rải rác `if (mode === 'mock')`.
    - *Bảo Mật DOM Tuyệt Đối (No DOM Leakage)*: Ở chế độ Mock, transcript và đáp án đúng hoàn toàn không được render vào DOM (không dùng CSS `display: none` hay `opacity: 0` để che giấu); vô hiệu hóa seek, replay, speed changer theo đúng chuẩn ETS.
    - *Snapshot Continuity Safety*: Adapter `toeicListeningSnapshotAdapter.ts` chỉ lưu con trỏ trạng thái nhẹ (`currentGroupId`, `hasPlayed`, `playCount`, `currentTimeMs`); tuyệt đối không tuần tự hóa đối tượng DOM/Audio/TTS; khôi phục bài thi ở trạng thái tạm dừng an toàn.
  - **Gia Cố Trợ Năng, Bàn Phím, Mobile & Khả Năng Chịu Lỗi (Phase 7)**:
    - *Trợ Năng Toàn Diện (WCAG 2.1 AA)*: Thêm `aria-label`, `aria-live`, `role="region"` trên toàn bộ cụm điều khiển âm thanh; thông báo trạng thái tải và lỗi rõ ràng cho screen reader.
    - *Kiểm Soát Bàn Phím Chặt Chẽ*: Phím Space/K (Play/Pause), Phím 1-4 (Chọn đáp án); chặn triệt để phím mũi tên tua (ArrowLeft/ArrowRight) trong Mock Mode, triệt tiêu mọi cửa sau (bypass).
    - *Giao Diện Responsive & Tối Ưu Mobile*: Đảm bảo touch target $\ge 44\text{px}$, bố cục ảnh Part 1 co giãn mượt mà, phân trang câu hỏi Part 3/4 dạng tab cuộn ngang không gây layout shift (Zero CLS).
    - *Chịu Lỗi Trình Duyệt & Fallback Ngoại Tuyến*: Xử lý êm xuôi lỗi mất kết nối file audio CDN, lỗi Web Speech API không được hỗ trợ hoặc bị chặn bởi chính sách bảo mật trình duyệt; hiển thị thông báo lỗi thân thiện mà không crash ứng dụng.
  - **Quality Gate Xuất Xưởng & Tích Hợp Toàn Diện (Phase 8)**:
    - *Bảo Toàn Chất Lượng 100%*: Đạt **166/166 test files passed, 2,588/2,588 tests passed (100% Pass Rate)**.
    - *Không Lỗi Biên Dịch & Quy Chuẩn*: `npx tsc -b` sạch 0 lỗi trên toàn bộ project references; `npm run lint` đạt 0 lỗi; `npm run build` tạo bundle tối ưu thành công.
- **Server Time, Realtime Scalability & Offline Cloud Sync Recovery Hardening (Phases 1 — 4)**:
  - **Server Time Authority & Anti-Tampering Hardening (Phase 1)**:
    - *PostgreSQL Server Time Authority*: Thiết lập mỏ neo thời gian máy chủ `setServerTimeAnchor` kết hợp đồng hồ monotonic `performance.now()`, bảo đảm toàn bộ mốc thời gian chốt tuần, tuần hiện tại (`YYYY-Www`), và countdown hoàn toàn độc lập với đồng hồ thiết bị người dùng.
    - *Clock-Skew & Tampering Protection*: Triển khai `detectDeviceClockDrift` tự động phát hiện khi người dùng chỉnh sửa đồng hồ thiết bị (+1 ngày, -1 ngày, đổi timezone) để tái đồng bộ anchor chuẩn từ RPC `get_leaderboard_server_time`.
    - *Canonical Vietnam Week Identity*: Khóa chặt ranh giới tuần theo `Asia/Ho_Chi_Minh` (Thứ Hai 00:00:00 VN = Chủ Nhật 17:00:00 UTC). Rào chắn server-authoritative `isWeekFinalizable` và RPC `finalize_weekly_leaderboard` từ chối chốt tuần sớm hoặc nhận thưởng trái phép.
  - **Realtime Scalability & Backend Pagination Hardening (Phase 2)**:
    - *Singleton Realtime Subscription*: Hợp nhất toàn bộ ứng dụng về đúng 1 logical channel WebSocket `public:leaderboard_profiles`, tự động dọn dẹp (cleanup) kênh và timer khi unmount, loại bỏ rò rỉ kết nối và duplicate subscriptions.
    - *Debounce & Starvation Protection*: Gom các đợt phát sự kiện dồn dập (burst events) với bộ đệm `REALTIME_DEBOUNCE_WAIT_MS = 1500ms`, tích hợp `REALTIME_MAX_WAIT_MS = 5000ms` bắt buộc giải tỏa 1 bounded refresh sau 5s nếu sự kiện kéo dài liên tục.
    - *Backend Pagination & Hard Limit 50*: Enforce chặt chẽ cận trên `1 <= effective_limit <= 50` và `offset >= 0` ngay từ tầng xử lý; client gửi `p_limit = 100000` hay số âm vẫn được giới hạn chuẩn xác; loại bỏ triệt để client-side full table fetch.
    - *Lightweight Current-User Rank & Sticky Row*: Tích hợp RPC `get_my_leaderboard_rank` truy vấn thứ hạng cá nhân O(1), duy trì hàng sticky hiển thị vị trí học viên bất kể đang xem trang nào; làm mới đúng trang hiện tại khi có realtime update mà không reset về trang 1.
  - **Local-First Offline Persistence & Automatic Cloud Sync Recovery (Phase 3)**:
    - *Local-First Invariant*: Mọi hành động học tập (SRS review, ghi bẫy lỗi Mistake Bank, tiến độ Four Skills, thời gian học chủ động) được commit tức thì vào Zustand store và persist qua `safeStorage` (quota guard 1.5MB); mất mạng không bao giờ làm rollback tiến độ.
    - *Single Global Connectivity Listener*: Di chuyển toàn bộ lắng nghe `online`, `offline`, `visibilitychange` về một hàm trung tâm `initCloudSync` tại app root; loại bỏ các listener trùng lặp trong `usePWA.ts`.
    - *Sync Coordinator & Request Coalescing*: Quản lý khóa chống tái nhập (`isSyncInProgress`) và cờ chờ (`hasPendingSyncRequest`); gom nhiều trigger dồn dập (online + login + window focus) thành 1 lần sync hiện tại + 1 lần follow-up sync sau đó.
    - *Bounded Exponential Retry*: Giới hạn tối đa 3 lần thử lại (`MAX_SYNC_RETRY_ATTEMPTS = 3`) với delay tăng theo cấp số nhân (~1.5s, ~3s, ~6s có jitter ngẫu nhiên); hàm `isNetworkOrUnreachableError` phân loại chính xác lỗi kết nối; tự động hủy retry timer ngay khi thiết bị mất mạng lại.
    - *Race Condition Protection*: Hàm `mergeCloudData` sử dụng `set((state) => ...)` đọc fresh store state tại thời điểm commit, bảo đảm việc học tập trong lúc request sync đang bay không bị snapshot cũ từ đám mây ghi đè.
    - *Truthful Connectivity UI*: Cập nhật `PWANotificationBanner.tsx` phản ánh chính xác 4 trạng thái: Ngoại tuyến (`offline`), Đang đồng bộ (`syncing`), Đã đồng bộ (`synced`), Lỗi đồng bộ (`error` kèm nút "Thử lại").
    - *Gemini API Key Zero-Leak*: Tuyệt đối không gửi `geminiApiKey` lên Supabase payload và bảo toàn key local trước các payload rỗng từ cloud.
  - **Cross-System Integration, Edge Cases, Regression & Release (Phase 4)**:
    - *Sunday Rollover Reconnect*: Kiểm chứng kịch bản Chủ Nhật 23:50 VN học offline $\to$ Thứ Hai 00:20 VN online; nhận diện tuần mới `2026-W42`, gán nhãn stale cho cache tuần cũ, tải bảng xếp hạng tuần mới và hòa giải tiến độ an toàn không duplicate.
    - *Sleep/Wake Coalescing*: Đóng nắp laptop khi ngủ và mở lại kích hoạt cùng lúc `online`, `focus`, `visibilitychange` được gom gọn thành bounded operations an toàn.
    - *Realtime Page Retention*: Xem trang > 1 khi mất mạng và reconnect giữ nguyên trang đang xem, làm mới dữ liệu và sticky user rank chuẩn xác.
    - *Integration Test Suite*: Bổ sung 13 test case tích hợp toàn diện trong `crossSystemIntegrationPhase4.test.ts`.
    - *Full Quality Gate*: Toàn bộ **160/160 test files passed, 2,502/2,502 tests passed (100% Pass Rate)**. `tsc -b`, `lint`, và `build` hoàn tất xuất sắc với 0 lỗi.
- **Leaderboard v2 & Multi-Dimensional Learning Quality Engine (Phases 1 — 6)**:
  - **PHASE 1 — Comprehensive Audit, Security Boundary & Multi-Metric Architecture**:
    - Audited full leaderboard lifecycle (`LeaderboardView.tsx`, `leaderboardService.ts`, `weeklyFinalizationService.ts`, `frameRewardService.ts`, `useAppStore.ts`).
    - Established server-authoritative boundary: client never writes ranks, scores, or tier snapshots; all calculations derived from trusted evidence or server RPCs.
    - Preserved Asia/Ho_Chi_Minh (UTC+7) ISO calendar week boundary (`YYYY-Www`) across all client and backend operations.
  - **PHASE 2 — Vocabulary Mastery & Review Consistency Engine (`leaderboardLearningMetrics.ts`)**:
    - **Vocabulary Mastery**: Pure evaluation via `isFsrsCardMastered` (FSRS state 2, stability $\ge 21.0$, reps $\ge 2$) and `isSm2CardMastered` (reps $\ge 5$ or interval $\ge 21$ days with study history).
    - **Canonical Lemma Deduplication**: `getCanonicalLemmaKey` eliminates multi-form farming (e.g., `run`, `running`, `runs` collapse to single lemma `run`).
    - **Review Consistency**: Normalized ratio of completed scheduled reviews vs expected due reviews (`deriveReviewConsistency`). Zero-due days treated neutrally to prevent free 100% or unfair penalties. Heavy backlog protection ($\ge 40$ cards due capped at 60 cards/day). Non-due reinforcement reviews excluded from numerator.
  - **PHASE 3 — Active Learning Time, Improvement Metrics & XP Anti-Spam (`activeLearningTimeService.ts`, `xpAntiSpamService.ts`)**:
    - **Active Learning Time**: Focus/blur and `visibilitychange` listeners, 60s idle timeout (`INACTIVITY_TIMEOUT_MS = 60_000`), maximum continuous chunk cap (`MAX_CONTINUOUS_CHUNK_SECONDS = 1800`). Module whitelist: Flashcard, Four Skills, TOEIC, Quiz, Pronunciation, AI Tutor (Dashboard/settings excluded).
    - **Pronunciation Improvement**: Chronological baseline vs recent windowing over trusted Web Speech API attempts. Strict eligibility guards: $\ge 10$ total attempts across $\ge 2$ distinct calendar days; returns `isEligible: false` (`gainScore: null`) if threshold not met.
    - **TOEIC Gain**: First mock exam vs latest mock exam comparison. Strict eligibility guards: $\ge 2$ valid full exams, duration $\ge 60$s, $\ge 48$h interval between repeated exams to eliminate spam replay.
    - **XP Anti-Spam & Rate Limiting**: `evaluateXpAward` caps flashcard reviews at 500 XP/day, quiz games at 15 sessions/day/game-type, with cooldown enforcement and idempotency checks.
  - **PHASE 4 — Server-Authoritative Multi-Metric Leaderboard Backend (`setup_multi_metric_leaderboard.sql`, `leaderboardService.ts`)**:
    - **Database Migration**: Created `weekly_learning_metrics` table with `UNIQUE(user_id, week_id)`, strict foreign keys, and performant indexes (`idx_wlm_rankings_composite`, `idx_wlm_vocab_mastered`, etc.).
    - **Security & RLS**: Strict Row-Level Security ensuring users can only read all weekly metrics (`FOR SELECT USING (true)`) and update their own rows (`FOR INSERT/UPDATE USING (auth.uid() = user_id)`). Server-side RPC `finalize_weekly_leaderboard_v2` strictly restricted to `service_role`.
    - **SQL RPC `get_leaderboard_category_rankings`**: Server-side ranking derivation with deterministic tie-breaking (`score DESC, secondary_score DESC, updated_at ASC, user_id ASC`) and bounded pagination (`p_limit`, default 50). Ineligible users cleanly excluded from ranking (`rank: NULL, score: NULL`).
    - **Dual Synchronization Flow**: `fetchLeaderboardWithStatus` maintains 100% backward compatibility for legacy categories (`weekly_xp`, `streak`) via `leaderboard_profiles`, while routing learning categories (`vocab_mastered`, `review_consistency`, `active_minutes`, `pronunciation_gain`, `toeic_gain`) strictly through `get_leaderboard_category_rankings`.
  - **PHASE 5 — Multi-Category Leaderboard UI & User Experience (`LeaderboardView.tsx`)**:
    - Segmented category tabs for 7 validated dimensions: XP, Từ vựng, Chăm chỉ ôn tập, Thời gian học, Phát âm, TOEIC Gain, Chuỗi ngày.
    - Keyboard-navigable accessible tabs with ARIA roles and descriptions.
    - Dynamic unit formatting (`+X điểm`, `X phút`, `X%`, `X từ`).
    - Graceful non-ranked representation for ineligible learners (`Chưa xếp hạng`, `--` with actionable guidance hints, never fake `#--` or fabricated zero scores).
    - Realtime multi-channel subscription for live rank updates.
  - **PHASE 6 — End-to-End Security, Abuse-Resistance, Fairness & Release Regression**:
    - **Release Audit Test Suite (`leaderboardReleaseAuditPhase6.test.ts`)**: 18/18 comprehensive tests verifying all 12 abuse scenarios, fairness normalizations, eligibility enforcement, server authority, and zero-mutation state invariants.
    - **Full Repository Quality Gate**: **156/156 test files passed, 2,442/2,442 unit and integration tests passed (100% Pass Rate)**. Zero test skips, zero suppressed errors.
    - `npx tsc -b` passes with 0 errors; `npm run lint` passes with 0 errors; production build (`npm run build`) builds cleanly in 2.12s.
- **Micro-Interaction & Motion Design System (Phases 1 — 3)**:
  - **PHASE 1 — Motion Foundation, Guidelines & Accessible Primitives (`motionTokens.ts`, `motionVariants.ts`, `confettiPolicy.ts`)**:
    - **Tập Lệnh Token Tương Tác Chuẩn Hóa**:
      - `BUTTON_TACTILE_CLASS`: Hiệu ứng xúc giác phản hồi nhẹ nhàng khi nhấn (`active:scale-[0.98] transition-all duration-150 ease-out`), hỗ trợ `motion-reduce:transform-none motion-reduce:transition-none`.
      - `CARD_INTERACTIVE_CLASS`: Hiệu ứng hover nhấc nhẹ và tactile press (`hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] transition-all duration-200 ease-out`).
      - `FOCUS_VISIBLE_RING_CLASS`: Viền focus trợ năng WAI-ARIA (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`).
      - `REDUCED_MOTION_SAFE_CLASS`: Ngắt triệt để animation cho người dùng nhạy cảm chuyển động.
    - **Chính Sách Lễ Hội & Kiểm Soát Confetti Đa Tầng (`confettiPolicy.ts`)**:
      - Cung cấp hàm trung tâm `triggerCelebration(tier, customOpts)` thay thế 100% các lệnh gọi trực tiếp `canvas-confetti`.
      - *Phân tầng nghiêm ngặt (Strict 3-Tier Policy)*:
        - `micro`: Triệt tiêu hoàn toàn hạt pháo giấy (spam suppression) khi lưu từ, chọn đáp án trắc nghiệm hoặc chấm từng câu phát âm.
        - `completion`: Pháo giấy tập trung, kiểm soát thời lượng (35-50 hạt, 1.2s-1.8s) khi hoàn thành trọn vẹn phiên học SRS, nộp bài thi TOEIC, hoặc vượt qua vòng Quiz.
        - `milestone`: Đại lễ hội 80-120 hạt hai đợt khi kết thúc chu kỳ bảng xếp hạng tuần (Ceremony), hoàn thành cấp độ CEFR hoặc đạt mốc chuỗi học tập lớn.
      - Tôn trọng thuộc tính hệ thống `prefers-reduced-motion` (trả về `false` ngay lập tức, không sinh DOM canvas).
  - **PHASE 2 — Triển Khai Micro-Interaction Cho Core Learning UX (`Dashboard`, `Today Hub`, `Flashcards`, `Four Skills`)**:
    - **Xúc Giác Tức Thì Trên Toàn Bộ Tác Vụ Cốt Lõi**:
      - Áp dụng các token tactile và focus ring trên toàn bộ CTA của Dashboard, Today Learning Hub (`TodayLearningPlanWidget.tsx`), Continue Learning (`ContinueLearningSection.tsx`), Flashcard SRS (`FlashcardDeck.tsx`), và Four Skills (`FourSkillsView.tsx`, `LearningJourneyProgressionMap.tsx`).
      - Phản hồi giao diện tức thì khi nhấn, không trì hoãn logic nghiệp vụ và không chèn callback animation làm chậm chu trình xử lý state.
    - **Bảo Toàn Invariant Học Tập**:
      - Giữ nguyên vẹn thuật toán FSRS-4.5 / SM-2, khóa đánh giá nguyên tử `isReviewingRef`, và hiệu ứng lật thẻ 3D.
  - **PHASE 3 — Hoàn Thiện Các Phân Hệ Còn Lại, Trợ Năng Modal & Quality Gate Toàn Diện**:
    - **Chuẩn Hóa Micro-Interaction Phân Hệ Nâng Cao**:
      - *AI Tutor (`AITutorView.tsx`)*: Nút gửi tactile (`tutor-send-btn`), nút micro và prompt chips trang bị phản hồi xúc giác; trạng thái `aria-busy={isLoading}` minh bạch; modal tổng kết phiên đạt chuẩn W3C Dialog Accessibility có phím tắt `Escape`; bảo toàn trọn vẹn bộ nhớ ngữ cảnh và ngân sách prompt 2500 ký tự.
      - *Khảo Thí TOEIC (`ToeicAssessmentView.tsx`)*: Tùy chọn đáp án tactile mượt mà, nút nộp bài `aria-busy={isSubmitting}`, hiệu ứng mở bảng điểm; kích hoạt pháo giấy hoàn tất qua `triggerCelebration('completion')`; loại trừ tuyệt đối pháo giấy và hoạt họa phân tâm trong suốt thời gian đồng hồ đếm ngược bài thi; bảo toàn nguyên vẹn tính toán thời gian và điểm số ETS.
      - *Đấu Trường Quiz (`QuizArena.tsx`)*: Nút chọn đáp án tactile với khóa chống double-submit (`disabled={!!selectedQuizAnswer}`); phân luồng pháo giấy câu trả lời thường qua `triggerCelebration('micro')` (bị chính sách triệt tiêu); kích hoạt pháo giấy chúc mừng khi hoàn thành vòng chơi qua `triggerCelebration('completion')`.
      - *Đấu Trường Phát Âm (`PronunciationArena.tsx`, `VoicePronunciationModal.tsx`)*: Nút thu âm tactile với trạng thái `aria-busy={isRecording}`, vòng xung nhịp tôn trọng `motion-reduce:animate-none`; modal chuẩn W3C có phím tắt `Escape`; giữ nguyên cơ chế nhận diện giọng nói Web Speech API chân thực, không bao giờ dùng điểm giả 85%.
      - *Siêu Từ Điển (`DictionaryView.tsx`, `DictionaryQuickActions.tsx`)*: Cả 7 nút hành động nhanh (Quick Actions) được trang bị xúc giác và viền focus rõ nét; thanh trạng thái lưu từ có thuộc tính `role="status"` và `aria-live="polite"`.
      - *Thanh Điều Hướng (`Navbar.tsx`, `App.tsx`)*: Các nút tab, avatar dropdown, mobile drawer, cloud sync và leaderboard trigger đạt chuẩn tactile; chuyển đổi view bọc lớp hoạt họa mờ dần mượt mà (`animate-fadeIn motion-reduce:animate-none`).
    - **Trợ Năng Toàn Bộ Cửa Sổ Modal (W3C Modal Dialog Accessibility)**:
      - Nâng cấp 100% các modal (`ProfileModal`, `DailySettingsModal`, `BackupModal`, `GeminiKeyModal`, `SRSAnalyticsModal`, `BulkImportModal`, `OnboardingModal`, `ReviewModal`, `TextQuizModal`, v.v.) với `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, lắng nghe phím `Escape` tự động đóng, và ngắt hoạt họa khi có `motion-reduce`.
    - **Triệt Tiêu 100% Import Pháo Giấy Trực Tiếp (Zero Raw Confetti Imports)**:
      - Thay thế toàn bộ các import trực tiếp `canvas-confetti` trên 12 tệp thành phần bằng `triggerCelebration` từ `confettiPolicy.ts`.
    - **Bảo Vệ Hồi Quy & Quality Gate 100% Pass**:
      - Bổ sung bộ test kiểm chuẩn: `Phase3MotionHardening.test.tsx` (10/10 passed), `CoreLearningUXMotionPhase2.test.tsx` (14/14 passed), `motionTokens.test.ts` (7/7 passed), `confettiPolicy.test.ts` (3/3 passed).
      - Toàn bộ test suite repository đạt **151/151 test files passed, 2,342/2,342 tests passed (100% Pass Rate)**.
      - `npx tsc -b` đạt 0 lỗi; `npm run lint` đạt 0 lỗi; `npm run build` thành công xuất sắc (1.96s).
- **Four Skills Learning Journey A1 → C2 & Progression Map (Phases 1 — 3)**:
  - **PHASE 1 — Audit Kiến Trúc & Xây Dựng Learning Journey Derivation Engine (`learningJourneyService.ts`)**:
    - **Pure Derivation Layer**: Xây dựng hàm thuần túy `deriveFourSkillsLearningJourney` và selector `deriveFourSkillsLearningJourneyFromStore` chuyển hóa trực tiếp Single Source of Truth (SSOT) từ Zustand store (`completedListeningLessonIds`, `fourSkillsCompletionProgress`, `resumeActivities`) thành cấu trúc phân tầng `FourSkillsLearningJourney`.
    - **Bảo Toàn Invariants Tuyệt Đối**:
      - Zero Store Mutation: Không lưu trữ hay mutate bất kỳ trường dữ liệu persistent nào trong Zustand; không ghi đè tiến độ học tập.
      - Dynamic Totals: Đếm tổng số bài tự động từ datasets chuẩn (96 bài học qua 6 bậc CEFR A1 → C2: 24 Nghe, 24 Đọc, 24 Nói, 24 Viết), không hard-code mẫu số `16 bài/cấp độ`.
      - Quyền Tự Chủ Học Tập (Free Exploration): Tất cả các cấp độ đều ở trạng thái `available` hoặc `in_progress`, tuyệt đối không khóa cứng (`locked`) ngăn cản người học khám phá.
      - Zero Fake Mastery: Giữ nguyên trạng thái `completed` (100% bài học) và `in_progress`; vô hiệu hóa trạng thái `mastered` do chưa đủ bằng chứng mastery độc lập theo cấp độ.
      - Completion ≠ Competency: Tách biệt rõ ràng tiến độ bài học và năng lực từ vựng cốt lõi (`skillsCompetencyService`).
    - **Quy Tắc Tất Định Xác Định Cấp Độ & Bài Học Kế Tiếp**:
      - `currentLevel`: Ưu tiên cấp độ của bài học đang làm dở gần nhất (`lastActiveAt`), sau đó đến cấp độ đang học (`in_progress`) có CEFR thấp nhất, hoặc cấp độ chưa hoàn thành đầu tiên.
      - `nextRecommendedLesson`: Ưu tiên bài học đang làm dở; nếu không có, tự động chọn bài học chưa hoàn thành đầu tiên trong kỹ năng có tiến độ thấp nhất của cấp độ hiện tại để đảm bảo phát triển đồng đều 4 kỹ năng.
  - **PHASE 2 — Trực Quan Hóa Lộ Trình & Tích Hợp UI Four Skills (`LearningJourneyProgressionMap.tsx`, `FourSkillsView.tsx`)**:
    - **Bản Đồ Tiến Trình 6 Bậc CEFR (A1 → C2)**:
      - Thiết kế responsive hiển thị 6 milestone A1–C2 với tên gọi song ngữ (Khởi đầu/Beginner, Sơ cấp/Elementary, Trung cấp/Intermediate, Trung cấp cao/Upper Intermediate, Cao cấp/Advanced, Thành thạo/Proficiency).
      - Thanh tiến độ chuẩn trợ năng WAI-ARIA (`role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`).
      - Mini-counters phân tách 4 kỹ năng theo icons nhận diện (🎧 Nghe, 📖 Đọc, 🗣️ Nói, ✍️ Viết) hiển thị tỉ lệ hoàn thành thực tế.
    - **Thẻ Điểm Nhấn Hành Trình (Hero Current Journey Banner)**:
      - Xử lý người dùng mới (`isNewUser: true`): Trình bày thông điệp chào đón thân thiện, định hướng lộ trình A1 cơ bản và CTA [Bắt đầu hành trình] mở ngay bài học đầu tiên `listen_a1_1`.
      - Tích hợp phiên học dở dang: Ưu tiên hiển thị thẻ "Bài học dở dang" ("Đang học dở: [Tên bài học]") kèm phần trăm tiến độ checkpoint và nút [Tiếp tục bài học] điều hướng chuẩn xác.
      - Gợi ý bài học tiếp theo: Hiển thị bài học kế tiếp được đề xuất kèm CTA [Học tiếp bài này].
      - Nhận định cá nhân hóa nhẹ nhàng: Tích hợp 1 dòng gợi ý năng lực thông minh từ `deriveSkillGapInsights` (Phase 2 Insights) mà không làm xáo trộn Kế hoạch Ngày.
    - **Chi Tiết Cấp Độ Mở Rộng (Collapsible Level Detail)**:
      - Cho phép bung mở danh sách toàn bộ bài học của cấp độ được chọn phân theo 4 kỹ năng.
      - Hiển thị trực quan trạng thái từng bài (Đã hoàn thành, Đang dở, Bắt đầu) và hỗ trợ click mở trực tiếp phiên học mà không phá vỡ vòng đời component.
  - **PHASE 3 — Gia Cố Hệ Thống, Kiểm Toán Edge Cases & Toàn Diện Quality Gate**:
    - **Loại Bỏ Hoạt Động Dở Dang Lỗi Thời (Stale Resume Activity Guard)**:
      - Bổ sung cơ chế lọc loại trừ các hoạt động trong `resumeActivities` đã được đánh dấu hoàn thành trong `completionSets[skill]`, ngăn ngừa hoàn toàn hiện tượng hiển thị trạng thái "Đang dở" giả mạo.
    - **Xử Lý Xung Đột Tiêu Đề Bài Học (Title String Collision Fix)**:
      - Chuẩn hóa tiền tố `Đang học dở: ${activeResumeLesson.title}` trên banner tránh xung đột truy vấn DOM với danh mục bài học bên dưới trong các bài test hồi quy tích hợp.
    - **Tiêu Chuẩn Tiếp Cận & Khả Năng Đáp Ứng (Accessibility & Responsive)**:
      - Đảm bảo toàn bộ touch targets đạt chuẩn tối thiểu `min-h-[44px]`.
      - Hỗ trợ đầy đủ phím bấm (Tab, Enter, Space), `focus-visible:ring-2`, nhãn mô tả `aria-label`, và `motion-reduce:transition-none`.
    - **Bảo Vệ Hồi Quy & Quality Gate 100% Pass**:
      - Bổ sung bộ test hồi quy toàn diện cho derivation engine và giao diện lộ trình: `learningJourneyService.test.ts` (27/27 passed), `LearningJourneyProgressionMap.test.tsx` (16/16 passed).
      - Toàn bộ test suite repository đạt **144/144 test files passed, 2,296/2,296 tests passed (100% Pass Rate)**.
      - `npx tsc -b` đạt 0 lỗi; `npm run lint` đạt 0 lỗi; `npm run build` thành công xuất sắc.
- **Personalized Learning Insights Engine & Cross-Module UI Integration (Phases 1 — 3)**:
  - **PHASE 1 — Audit Dữ Liệu Thực Tế & Chốt Kiến Trúc Nền Tảng Type-Safe (`personalizedInsightService.ts`, `useAppStore.ts`)**:
    - **Audit Nguồn Dữ Liệu Thực Tế**: Khảo sát chi tiết Single Source of Truth (SSOT) của toàn bộ các phân hệ học tập hiện hữu:
      - *Mistake Bank*: Bẫy lỗi chưa giải quyết (`!item.resolved && item.mistakeCount >= 2`), lịch sử nhầm lẫn giữa các cặp từ (`lastUserAnswer`, `confusedWith`).
      - *FSRS Memory State*: Trạng thái trí nhớ FSRS chuẩn xác (`stability`, `difficulty`, `retrievability < 0.70`), bảo toàn cách ly tuyệt đối với SM-2 (không bao giờ gán hay giả mạo retrievability cho thẻ SM-2).
      - *Leech Words*: Tái sử dụng thuật toán tính toán của `leechDetector` (`isLeech`, `score >= 60`, `reasons`).
      - *Weak Collocations*: Bằng chứng cụm từ yếu dựa trên `mistakeBank` hoặc lỗi sai thực tế (`isWeak: true`), phân biệt với cụm từ thông dụng.
      - *Four Skills Competency*: Hồ sơ năng lực 4 kỹ năng (`skillsCompetencyService`), phân biệt rõ ràng giữa lỗ hổng năng lực thực sự (`confidence !== 'low'` kèm điểm < 60%) và trường hợp thiếu dữ liệu kiểm thử (`totalAttempts < 3`).
      - *Contextual Usage Gap*: Đọc nhiều (`readingEncounters >= 4`) nhưng chưa từng dùng trong bài viết (`writingUsages === 0`).
      - *Positive Progress*: Bằng chứng tiến bộ có cơ sở đối sánh (bẫy lỗi đã giải quyết, điểm năng lực tăng, củng cố thẻ ghi nhớ).
    - **Bảo Toàn Bất Biến Hệ Thống (Invariant Preservation)**:
      - Personalized Insight Layer chỉ được: `derive → explain → route`. Tuyệt đối không `mutate`, `schedule`, `complete` hay `invent` trạng thái học tập.
      - Giữ vững toàn vẹn FSRS/SM-2 semantic isolation, `lapses !== againCount`, Mistake Bank evidence-only, Learning Dictionary SSOT, Today Learning Plan derived orchestration, và AI Tutor trusted telemetry (`isTrusted === true`).
    - **Thiết Kế Hợp Đồng Type-Safe (Insight Contract)**:
      - Xây dựng discriminated union chuẩn mực `PersonalizedInsight` với các loại: `confusion`, `forgetting_risk`, `leech`, `weak_collocation`, `skill_gap`, `usage_gap`, `mistake_pattern`, `positive_progress`.
      - Mỗi insight sở hữu: `id` tất định ổn định, `type`, `priority`, `confidence` (`high` | `medium` | `low`), `title`, `message`, `evidenceBullets`, `targetWords`, `targetSkill`, và `action` định tuyến có thể thực thi.
  - **PHASE 2 — Động Cơ Rút Trích & Xếp Hạng Thông Minh (Insight Derivation Engine)**:
    - **Bộ Trích Xuất Chuyên Biệt (Insight Generators)**:
      - `deriveConfusionInsights`: Rút trích cặp từ nhầm lẫn trực tiếp từ tương tác thực tế trong Mistake Bank (`wordConfusionService`), loại bỏ suy diễn ngữ nghĩa thuần túy.
      - `deriveForgettingRiskInsights`: Rút trích từ FSRS cards có retrievability suy giảm dưới ngưỡng an toàn, lọc bỏ thẻ SM-2 và xử lý NaN/Infinity/Invalid date.
      - `deriveLeechInsights`: Tích hợp trực tiếp `detectLeechWords`, cảnh báo các từ vựng học đi học lại nhiều lần nhưng liên tục bị quên.
      - `deriveWeakCollocationInsights`: Nhận diện các cụm từ gắn liền với bẫy lỗi đang hoạt động.
      - `deriveSkillGapInsights`: Phân tích năng lực 4 kỹ năng, phân tách rạch ròi giữa kỹ năng cần tập trung cải thiện và kỹ năng cần làm thêm bài để thu thập đủ mẫu đánh giá.
      - `deriveUsageGapInsights`: Đề xuất chuyển hóa từ vựng thụ động (chỉ gặp khi Đọc) sang chủ động (thực hành Viết).
      - `derivePositiveProgressInsights`: Ghi nhận tiến bộ tích cực trung thực khi người dùng giải quyết thành công các lỗi sai lặp lại.
    - **Ngôn Ngữ Thích Ứng Theo Bằng Chứng (Evidence-Aware Language)**:
      - Câu chữ tự nhiên, phản ánh đúng độ tin cậy (`confidence`): Khẳng định chắc chắn khi có bằng chứng mạnh, gợi ý mềm dẻo khi có dấu hiệu sơ bộ, và im lặng (không tạo insight) khi dữ liệu không đủ độ tin cậy.
    - **Xếp Hạng & Loại Bỏ Trùng Lặp Tất Định (Deterministic Ranking & Deduplication)**:
      - Pipeline chuẩn: `Generate → Validate → Score → Deduplicate → Stable Sort → Top N (2–4 insights)`.
      - Ngăn ngừa áp đảo giao diện, đảm bảo insights hiển thị luôn có giá trị hành động cao nhất và giải thích được nguyên nhân.
  - **PHASE 3 — Tích Hợp UI Toàn Diện, Gia Cố & Nghiệm Thu Hệ Thống (Cross-Module UI Integration & Hardening)**:
    - **Tích Hợp Bảng Điều Khiển (Dashboard / Today Hub)**:
      - Bổ sung phân vùng `PersonalizedInsightsSection` ("Gợi Ý & Nhận Định Học Tập") đặt giữa `TodayLearningPlanWidget` và tiến độ ngày `PROGRESS TODAY`.
      - Tôn trọng phân cấp thị giác hiện tại, không lấn át Kế Hoạch Học Tập Hôm Nay.
      - Xử lý người dùng mới (New User): Trả về `null` sạch sẽ (zero empty cards, zero synthetic insight).
      - Định tuyến hành động thông minh: Tái sử dụng trực tiếp các route và action hiện hữu (`startAdaptivePractice`, `onNavigate`, `setActiveFourSkill`), không tạo recommendation state phụ hay mutate Today Plan.
    - **Tích Hợp Siêu Từ Điển (Learning Dictionary)**:
      - Bổ sung `WordPersonalizedInsightBanner` hiển thị ngay phía trên chi tiết phân tích học tập (`YourLearningSection`) trong `DictionaryView`.
      - Chỉ tính toán cho từ vựng đang được chọn (Selected Word Only), tuyệt đối không quét toàn bộ 10.381 từ trong từ điển.
      - Liệt kê các bằng chứng thực tế: thẻ Leech, nhầm lẫn với từ khác, cụm từ yếu liên quan, nguy cơ quên FSRS (bảo toàn không fake cho SM-2), hoặc lời khen tích cực khi đã làm chủ từ vựng.
    - **Tích Hợp Đột Phá 4 Kỹ Năng (Four Skills)**:
      - Tích hợp dải gợi ý thích ứng `four-skills-insight-strip` vào `FourSkillsAdaptiveSummary`.
      - Hiển thị nhận định kỹ năng cần ưu tiên hoặc gợi ý làm thêm bài để củng cố mẫu đánh giá; cung cấp nút CTA điều hướng trực tiếp sang kỹ năng mục tiêu mà không bao giờ khóa bài hay can thiệp điểm số CEFR.
    - **Tích Hợp Gia Sư AI (AI Tutor)**:
      - Bổ sung khối nhận định phản hồi `tutor-personalized-insight` ngay dưới "Today's Focus" trong `AITutorView`, làm rõ lý do tại sao AI Tutor chọn các mục tiêu đàm thoại này dựa trên bẫy lỗi và nguy cơ quên thực tế.
    - **Bộ Kiểm Thử UI Tự Động & Hồi Quy Toàn Diện**:
      - Tạo mới suite [`PersonalizedInsightsUI.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/PersonalizedInsightsUI.test.tsx) với **14/14 tests pass 100%**.
      - Toàn bộ hệ thống kiểm thử: **142/142 test files passed, 2,253/2,253 tests passed (100% Pass Rate)**.
      - Biên dịch TypeScript (`tsc -b`) và đóng gói Vite hoàn thành với **0 errors**.
      - Linter (`oxlint`) hoàn thành với **0 errors** (373 warnings).
- **Shared Session Experience Foundation & Multi-Skill Rollout (Phases 1 — 10)**:
  - **PHASE 10 — Final Regression, Documentation & Release Gate (`types/toeic.ts`, `types/index.ts`, `adaptiveSessionBuilder.ts`, `todayLearningPlanService.ts`, `nextActionResolver.ts`, `FourSkillsView.tsx`, `FlashcardDeck.tsx`, `PronunciationArena.tsx`, `QuizArena.tsx`, `ToeicAssessmentView.tsx`, Quality Gate Pipeline)**:
    - **Kiểm định kiến trúc toàn diện (End-to-End Architecture Audit)**:
      - Xác nhận không phát sinh persistent session store song song hay dư thừa. Toàn bộ session state đều bắt nguồn từ Single Source of Truth hiện có và tự động giải phóng khi phiên học hoàn tất.
      - Tuyệt đối không trùng lặp progress state; không tạo recommendation engine thứ hai (hoàn toàn pure deterministic derivation qua `nextActionResolver`).
      - Không sử dụng `any` để né type safety; giải quyết triệt để sự khác biệt kiểu dữ liệu giữa DOM/Node (`ReturnType<typeof setTimeout>`) và mở rộng tường minh union `PracticeModuleId` chứa `'toeic'` và `'tutor'`.
    - **Ma trận 9 Module Đánh giá Nghiệm thu Thực tế**:
      - *Flashcard*: Before (Intro), During (Header + MicroFeedback), After (Summary), Next Action (Today Hub / Hard Cards).
      - *Reading*: Before (Intro), During (Header + MicroFeedback), After (Summary), Next Action (Next Lesson / Missed Questions / Today Hub).
      - *Listening*: Before (Intro), During (Header + MicroFeedback), After (Summary), Next Action (Next Lesson / Missed Questions / Today Hub).
      - *Speaking*: Before (Intro), During (Header + MicroFeedback), After (Summary), Next Action (Next Prompt / Mispronounced Words / Today Hub). Mic-safe (chỉ bật sau explicit user action).
      - *Writing*: Before (Intro), During (Header + Stage Pipeline `Drafting` → `Submitted` → `Evaluated`), After (Summary + AI CEFR Feedback), Next Action (Collocations / Next Prompt / Today Hub). Không áp đặt % giả tạo.
      - *TOEIC*: Before (Intro + Resume Banner), During (Header `answered / total` + Paused Timer + Double Submit Guard), After (ETS Score Summary), Next Action (Weak Part / Flashcard SRS / Today Hub). Zero streak, ETS strictness.
      - *Quiz Arena*: Before (Intro), During (Header with `timed_countdown` hoặc `discrete_items`), After (Victory Modal), Next Action (Today Hub / Replay / Mistakes). Streak/combo ephemeral.
      - *Pronunciation Arena*: Before (Intro), During (Header with `discrete_items` hoặc `unbounded`), After (Summary), Next Action (Today Hub / Word Practice). Không fake 85%, không auto-start mic.
      - *AI Tutor*: Before (Intro / Scenarios), During (Header with `open_turns`), After (Explicit Completion Summary), Next Action (Today Hub / Mistake Review). Không fake 100%, không fake percentage.
    - **Bảo toàn Bất biến Hệ thống Cốt lõi (Core System Invariants)**:
      - Thuật toán FSRS-4.5 / SM-2 bảo toàn tuyệt đối, zero double review, due date và lapse counts không bị can thiệp.
      - Flashcard atomic rating lock ngăn chặn race conditions.
      - TOEIC timer và scoring logic tuân thủ nghiêm ngặt ETS semantics.
      - Four Skills persistence quản lý tập trung qua `fourSkillsCompletionProgress`.
      - AI Tutor telemetry duy trì cờ `isTrusted === true`.
      - Mistake Bank và XP idempotency bảo toàn hoàn hảo.
    - **Quality Gate Xuất xưởng Tuyệt đối (100% Pass Rate)**:
      - `npm run lint` (`oxlint`): **0 errors** (373 warnings).
      - `npx tsc -b`: **0 errors** (Graph tham chiếu TypeScript sạch hoàn toàn).
      - `npm run build`: **0 errors** (Vite build thành công trong 1.80s, 2453 modules, 30 precache entries).
      - `npm test` (`vitest run`): **140/140 files passed, 2,218/2,218 tests passed (100% Pass Rate)**.
  - **PHASE 9 — UX Consistency, Accessibility, Mobile, Performance & Edge Cases Hardening (`SessionProgressHeader.tsx`, `SessionIntro.tsx`, `NextActionPanel.tsx`, `SessionMicroFeedback.tsx`, `SessionCompleteSummary.tsx`, `FourSkillsView.tsx`, `SessionHardeningPhase9.test.tsx`)**:
    - **Chuẩn hóa thị giác & Tiến độ chân thực (Truthful Progress & Sanity Invariants)**:
      - Rà soát toàn diện `SessionProgressHeader`: áp dụng cơ chế xác thực `Number.isFinite(metric.progressPercent)` và giới hạn nghiêm ngặt `Math.min(100, Math.max(0, Math.round(metric.progressPercent)))`. Loại bỏ hoàn toàn các trường hợp lỗi `NaN`, `Infinity`, số âm hoặc vượt quá 100%.
      - Giữ nguyên semantics đặc thù từng phân hệ: không ép phần trăm ảo cho Writing (`stage_pipeline`), AI Tutor (`open_turns`) hay Pronunciation/Speed Match (`unbounded` / `timed_countdown`).
    - **Khả năng tiếp cận theo chuẩn WCAG (Accessibility Compliance)**:
      - Đảm bảo đầy đủ thuộc tính A11y trên các thành phần dùng chung: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuetext`, `aria-label="Tiến độ phiên học"`.
      - Khối đếm ngược trang bị `role="timer"` với nhãn thời gian chi tiết theo chuẩn đọc màn hình.
      - Thành phần giới thiệu phiên học và tổng kết hỗ trợ `role="region"` (`aria-label`), nhóm hành động tiếp theo hỗ trợ `role="group"` (`aria-label="Hành động tiếp theo"`).
      - Vi phản hồi tương tác `SessionMicroFeedback` trang bị `role="status"`, `aria-live="polite"`, `aria-atomic="true"`.
      - Tất cả các nút tương tác đều hỗ trợ vòng viền tiêu điểm rõ ràng khi điều hướng bàn phím (`focus-visible:ring-2 focus-visible:ring-emerald-400 / rose-400`).
    - **Tôn trọng cấu hình giảm hoạt họa (`prefers-reduced-motion`)**:
      - Bổ sung quy tắc `motion-reduce:animate-none` và `motion-reduce:transition-none` trên tất cả hiệu ứng chuyển động: hiệu ứng thanh tiến độ, nhấp nháy cảnh báo thời gian, vi phản hồi transient badge và hiệu ứng nạp tổng kết phiên, đảm bảo không gây giật lag hay khó chịu thị giác cho người dùng nhạy cảm.
    - **Công thái học di động & Vùng chạm cảm ứng (Mobile Viewport & Touch Ergonomics)**:
      - Chuẩn hóa chiều cao vùng chạm cảm ứng tối thiểu đạt chuẩn 44px (`min-h-[44px]`) cho tất cả các nút CTA chính và phụ trong `SessionIntro` và `NextActionPanel`.
      - Các nút thao tác nhỏ gọn (Pause, Exit) đạt tối thiểu 36px trên di động và 40px trên màn hình lớn.
      - Khoảng đệm responsive (`p-5 sm:p-8 md:p-10`) và lớp ngắt dòng `break-words` trên tiêu đề tránh tràn màn hình (zero CLS, zero horizontal overflow).
    - **Khử triệt để Race Condition & Tranh chấp ghi đồng thời (Edge Cases Hardening)**:
      - *Writing Studio AI Grading Lock*: Bổ sung chốt chặn nguyên tử `if (isGrading) return;` ngay đầu hàm `handleGradeWithAI` trong [`FourSkillsView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/FourSkillsView.tsx), ngăn chặn hoàn toàn việc click đúp liên tục gây gọi trùng API Gemini hoặc ghi nhận telemetry thừa.
      - *Writing Autosave Race Guard*: Khử xung đột giữa debounce autosave (600ms) và submit nộp bài: bổ sung điều kiện `if (isGrading || gradingResult) return;`, ngăn chặn bản nháp ghi đè lên bài luận đang chấm hoặc đã hoàn thành.
    - **Tương thích ngược dữ liệu Persistence cũ (Legacy Backward Compatibility)**:
      - Xác thực hàm `validateResumeActivity` trong [`learningContinuityService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/learningContinuityService.ts) xử lý an toàn tuyệt đối các bản ghi lịch sử thiếu trường tùy chọn (`subtitle`, `draft`, `customTopic`, `progressPercent`) mà không gây crash ứng dụng.
    - **Hệ thống kiểm thử tự động chuyên biệt**:
      - Tạo mới suite [`SessionHardeningPhase9.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/SessionHardeningPhase9.test.tsx) (**15/15 tests pass 100%**).
  - **PHASE 8 — Unified Next Best Action + Today Hub + Continue Learning Loop (`nextActionResolver.ts`, `FourSkillsView.tsx`, `useAppStore.ts`, `NextActionLoopPhase8.test.tsx`, `nextActionResolver.test.ts`)**:
    - **Khép kín vòng trải nghiệm học tập nhất quán**:
      - Hoàn thiện luồng học tập: `SESSION COMPLETE → SUMMARY → NEXT BEST ACTION → TODAY HUB / NEXT SESSION` trên tất cả 9 module học tập mà không xây dựng recommendation engine thứ hai (hoàn toàn pure orchestration & deterministic derivation dựa trên dữ liệu hiện có).
    - **Giới hạn số lượng hành động (Action Limits Invariant)**:
      - Mỗi Session Complete Summary hiển thị tối đa đúng 1 primary action và 1 optional secondary action. Tuyệt đối không tạo danh sách gợi ý dàn trải gây quá tải nhận thức.
    - **Hệ thống phân cấp ưu tiên 4 tầng tất định (Deterministic 4-Level Priority Hierarchy)**:
      - *Priority 1 (Bẫy lỗi vừa phát hiện có bằng chứng tin cậy)*:
        - Writing: Nhận diện collocations / lỗi ngữ pháp thực tế từ bài luận (`!isFallback`) -> route sang ôn cụm từ Flashcard hoặc Sổ Tay Bẫy Lỗi.
        - Pronunciation: Điểm nhận diện giọng nói < 75% với Web Speech hợp lệ -> route luyện lại từ chưa chuẩn.
        - Reading & Listening: Có câu trắc nghiệm trả lời sai -> route xem giải thích chi tiết câu sai.
        - Flashcard: Có từ đánh giá Hard/Forgot trong phiên -> route ôn lại thẻ khó vừa gặp.
        - TOEIC: Điểm Part < 70% -> route luyện bổ trợ Part yếu nhất.
        - AI Tutor: Có phát hiện bẫy lỗi trong hội thoại -> route rà soát bẫy lỗi.
        - Bằng chứng không tin cậy (AI fallback, microphone denied/unsupported, điểm ảo): Tuyệt đối không bịa đặt weakness, tự động rơi xuống Priority 2/3/4.
      - *Priority 2 (Curriculum Continuation)*:
        - Tiếp tục bài học kế tiếp trong lộ trình bài đọc (`READING_LESSONS`), bài nghe (`LISTENING_LESSONS`), chủ đề nói (`SPEAKING_PROMPTS`), hoặc đề viết (`WRITING_PROMPTS`).
      - *Priority 3 (Nhiệm vụ tiếp theo trong Today Learning Plan)*:
        - Tự động lấy nhiệm vụ chưa hoàn thành kế tiếp trong kế hoạch học tập ngày (`TodayLearningPlan.items`).
      - *Priority 4 (Fallback về Today Learning Hub)*:
        - Quay về Today Hub (`dashboard`) với nhãn chuẩn hóa "Tiếp tục Kế Hoạch Hôm Nay" (`data-testid="next-action-next-action-today-hub"`).
    - **Bảo toàn bất biến "Completed Always Wins"**:
      - Khi một phiên học hoàn thành (`completeResumeActivity`), nó được đánh dấu `completed: true` và ngay lập tức bị gỡ khỏi `ContinueLearningSection`.
      - Bảo vệ cấp độ store (`useAppStore.ts`): Cả `upsertResumeActivity` và `updateResumeCheckpoint` đều chủ động chặn đứng mọi nỗ lực ghi đè với `completed: false` hoặc checkpoint chưa hoàn tất từ background sync, cache cũ hoặc stale persistence.
      - Hợp nhất Cloud / Local (`mergeResumeActivities`): Quy tắc `localAct.completed || remoteAct.completed` bảo đảm activity một khi đã hoàn tất thì không bao giờ bị "hồi sinh" (zero resurrection).
    - **Cập nhật Live Today Hub (Zero Reload & Zero Double XP)**:
      - Khi quay lại Today Hub, `TodayLearningPlan` được tính toán phản ứng (reactive `useMemo`) ngay tức thì dựa trên store state; tiến độ tăng, item hoàn tất được cập nhật mà không cần tải lại trang.
      - Bảo vệ chống double completion, double review, và duplicate XP.
    - **Kiểm thử tự động hoàn chỉnh**:
      - Suite mới [`NextActionLoopPhase8.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/NextActionLoopPhase8.test.tsx) (**9/9 tests pass 100%**).
      - Suite resolver [`nextActionResolver.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/nextActionResolver.test.ts) (**12/12 tests pass 100%**).
      - Toàn bộ suite hồi quy Session Experience (Phase 4, 5, 6, 7, 8) đạt **66/66 tests pass 100%**.
  - **PHASE 7 — Quiz + Pronunciation + AI Tutor Session Experience (`QuizArena.tsx`, `PronunciationArena.tsx`, `AITutorView.tsx`, `sessionExperienceAdapter.ts`, `types/sessionExperience.ts`, `QuizPronunciationTutorPhase7.test.tsx`)**:
    - **Module-Specific UX Priority & Semantic Invariant**:
      - Ba module có đặc thù semantics khác nhau hoàn toàn: Quiz Arcade (game/item/time), Pronunciation Arena (speech/accuracy/open-ended), AI Tutor (open-ended conversation turns). Tuyệt đối không ép đồng nhất vào progress bar giả tạo.
    - **Quiz Arena (`QuizArena.tsx`)**:
      - *Before & During*: Hiển thị `timed_countdown` cho Speed Match (60s countdown) hoặc `discrete_items` khi được kích hoạt với danh sách câu hỏi theo kế hoạch từ Today Hub (`totalPlannedItems > 0`), và `unbounded` khi chơi tự do.
      - *Streak & Combo Ephemeral*: Combo/streak được quản lý nội bộ trong component (`matchCombo`, `streakCount`), hoàn toàn ephemeral và không bao giờ ghi đè vào `profile.streak`.
      - *Victory Modal & NextActionPanel*: Summary sử dụng dữ liệu ván đấu thật; tích hợp `NextActionPanel` với nút quay lại Kế Hoạch Hôm Nay (`data-testid="next-action-next-action-today-hub"`), chơi ván mới, hoặc mở Sổ Tay Bẫy Lỗi; bảo vệ chống double completion và duplicate XP bằng `hasCompletedSessionRef.current`.
    - **Pronunciation Arena (`PronunciationArena.tsx`)**:
      - *Tiến độ chân thực*: Sử dụng `discrete_items` với tiến độ `completed / total` khi mở từ Today Hub hoặc Adaptive Practice với danh sách từ mục tiêu (`itemIds`), và `unbounded` (`completedCount đã hoàn thành`) khi luyện mở; không bao giờ bịa đặt `% tiến độ` hay progress bar khi luyện tập mở.
      - *Bằng chứng nhận diện giọng nói & Graceful Fallback*: Điểm số và micro-feedback chỉ hiển thị khi có bằng chứng nhận diện giọng nói hợp lệ từ Web Speech API. Xử lý trung thực, zero crash khi trình duyệt không hỗ trợ hoặc bị từ chối quyền microphone (không fake score / 85%).
      - *Bảo vệ tài nguyên Microphone*: Microphone không bao giờ tự động kích hoạt khi mount hoặc resume; không lưu trữ MediaStream, microphone handle, hay SpeechRecognition instance vào persistence.
      - *NextActionPanel*: Tích hợp thanh điều hướng kế tiếp với nút quay về Kế Hoạch Hôm Nay và ôn luyện từ vựng.
    - **AI Tutor (`AITutorView.tsx`)**:
      - *Open-ended Conversation Semantics*: Sử dụng metric `open_turns` (`turnCount: userTurns`, `lastInteractionSummary`) trong `SessionProgressHeader`; tuyệt đối không hiển thị thanh tiến độ `%` hay giả lập tổng số lượt hội thoại.
      - *Before & Resume*: Hiển thị scenario, vai trò, CEFR, và trọng tâm luyện tập; khôi phục phiên dở dang trung thực từ `tutorSessionStorage` và Continuity Engine mà không gửi lại tin nhắn, không tính lại XP, và không ghi nhận lại bẫy lỗi cũ.
      - *Phân biệt Telemetry Đáng Tin Cậy*: Phản hồi AI fallback hoặc không được chứng thực (`isTrusted !== true` hoặc `isFallback === true`) không bao giờ được ghi vào Sổ Tay Bẫy Lỗi hoặc SRS.
      - *Explicit Completion & Summary*: Bổ sung nút "🏁 Kết Thúc Phiên" trong header và modal Tổng Kết Phiên Gia Sư AI với chỉ số thật (lượt thoại, CEFR, trọng tâm đã luyện), tích hợp `NextActionPanel` và tự động đánh dấu hoàn thành activity trong Continuity (`completeResumeActivity`).
    - **Kiểm thử tự động**:
      - Tạo mới suite [`QuizPronunciationTutorPhase7.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/QuizPronunciationTutorPhase7.test.tsx) với **15/15 tests pass 100%**.
      - Toàn bộ suite hồi quy Session Experience (9 files kiểm thử, 99 automated tests) đạt tỷ lệ vượt qua **99/99 tests pass 100%**.
  - **PHASE 6 — TOEIC Session Experience (`ToeicAssessmentView.tsx`, `sessionExperienceAdapter.ts`, `ToeicSessionPhase6.test.tsx`)**:
    - **Before Session UX với `SessionIntro`**:
      - Hiển thị metadata chân thực từ cấu hình bài thi và dữ liệu câu hỏi thực tế: Tên bài thi (Full Mock, Diagnostic, Mini Test), Parts/sections thực tế (Part 1-7), tổng số câu hỏi thực tế (ví dụ 10 câu practice, 100 câu mini, 200 câu full mock), thời gian giới hạn bài thi thật (ví dụ 45 phút listening, 75 phút reading, 120 phút full mock).
      - Ưu tiên kế hoạch học tập từ Today Learning Hub (`planTitle`, `planObjective`, `estimatedMinutes`) khi mở từ Today Hub (`activePracticeConfig`), không tạo thêm nguồn duration/progress thứ hai.
      - Tái sử dụng banner khôi phục bài thi dở dang (`toeic-resume-banner`) bên trong `SessionIntro`, hỗ trợ Tiếp tục (`btn-resume-toeic`) và Huỷ bài (`btn-discard-toeic`) an toàn.
    - **During Session UX với `SessionProgressHeader` & Invariants Khảo Thí**:
      - Tiến độ đếm câu hỏi dựa trên số câu thực tế đã trả lời (`answeredCount / totalQuestions`, `counterFormat: 'answered'`), không dựa trên `currentIndex`.
      - Tuyệt đối không áp dụng chuỗi đúng (zero streak / combo) trong chế độ khảo thí TOEIC để bảo toàn tính nghiêm túc chuẩn mực ETS.
      - Giữ nguyên 100% cơ chế đếm giờ: countdown timer, tính toán elapsed time trung thực, bảo toàn trạng thái paused khi resume, cảnh báo tự động nộp bài khi hết giờ, không phát sinh thời gian âm hay NaN.
      - Hỗ trợ nút Tạm dừng (chỉ khi `experienceConfig.canPause === true` trong chế độ luyện tập) và nút "Nộp Bài" nguyên tử.
    - **Resume & Continuity Semantics**:
      - Khôi phục chính xác toàn bộ snapshot từ sessionStorage / continuity: giữ nguyên mảng đáp án đã chọn (`answers`), vị trí câu hỏi, section hiện tại và thời gian làm bài đã trôi qua.
      - Áp dụng quy tắc huỷ phiên quá hạn (> 24 giờ).
      - Khi nộp bài hoàn tất, giải phóng toàn bộ dữ liệu tạm trong sessionStorage và hoàn tất activity trong Continuity Engine (`completeResumeActivity`), chống tái diễn stale card.
    - **After Session & NextActionPanel Routing**:
      - Báo cáo kết quả bài thi tích hợp [`NextActionPanel.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/session/NextActionPanel.tsx) với 3 hành động rõ ràng:
        1. Quay về Today Learning Hub (`data-testid="next-action-next-action-today-hub"`, `navigateToTab('dashboard')`).
        2. Lưu từ vựng quan trọng vào Flashcard SRS (`data-testid="next-action-save-vocab-srs"`).
        3. Làm bài thi mới (`data-testid="next-action-new-exam"`).
      - Chống nộp bài trùng lặp (Double Submit Prevention) với khóa nguyên tử `isSubmittingRef.current`, bảo đảm điểm thi, XP và lịch sử khảo thí chỉ được ghi nhận đúng một lần.
    - **Kiểm thử tự động**:
      - Bộ kiểm thử mới [`ToeicSessionPhase6.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/ToeicSessionPhase6.test.tsx) đạt **11/11 tests pass 100%**.
      - Toàn bộ suite hồi quy Continuity & Session Experience đạt **84/84 tests pass 100%**.
  - **PHASE 5 — Speaking & Writing Session Experience (`FourSkillsView.tsx`, `SessionProgressHeader.tsx`, `types/sessionExperience.ts`)**:
    - **Before Session UX với `SessionIntro`**:
      - Hiển thị metadata chân thực từ dataset thật: CEFR level, tiêu đề prompt / bài viết, số prompt lượt nói, số từ mục tiêu / gợi ý ý tưởng.
      - Ưu tiên thông tin từ Today Learning Hub (`planTitle`, `planObjective`, `estimatedMinutes`) khi mở từ Today Hub, không tạo nguồn duration/progress thứ hai.
      - Resume an toàn: Khôi phục bản nháp bài viết hoặc vị trí lượt nói dở dang; hiển thị banner tiếp tục trung thực mà không gây trùng lặp DOM header.
    - **Speaking Session Experience & Mic Invariants**:
      - Tiến độ đếm câu thoại trực quan theo số lượt đã hoàn thành (`answered / total`, `counterFormat: 'answered'`).
      - Chuỗi đúng trong phiên (`speakingSessionStreak`) hoàn toàn ephemeral, tự động tích lũy khi độ chính xác >= 80% và reset khi dưới 80%; tuyệt đối không ghi vào `profile.streak` hay global app streak.
      - Vi phản hồi micro-feedback toast tự động hiển thị và tự dismiss sau 2.5s; không chặn tương tác.
      - Tuyệt đối loại bỏ điểm fallback giả lập (xóa bỏ fallback `: 85` legacy); hiển thị trung thực "Chưa đủ dữ liệu để đánh giá" khi Web Speech API thiếu bằng chứng hoặc bị từ chối quyền microphone.
      - Microphone Safety: Khi resume hoặc mở phiên, SpeechRecognition được ngắt an toàn (`abort`), microphone không bao giờ tự động kích hoạt nếu người dùng chưa bấm nút Mic. Không lưu runtime MediaStream hay SpeechRecognition vào persistence.
    - **Writing Session Experience & Stage Pipeline**:
      - Bổ sung metric `kind: 'stage_pipeline'` trong [`types/sessionExperience.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/types/sessionExperience.ts) và [`SessionProgressHeader.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/session/SessionProgressHeader.tsx) với 3 bước ngữ nghĩa: `Drafting` (Soạn thảo) -> `Submitted` (Đã nộp) -> `Evaluated` (Đã đánh giá); triệt tiêu hoàn toàn việc bịa `% tiến độ` dựa trên số ký tự/từ.
      - Tích hợp số từ mục tiêu / từ hiện tại trực quan trong header (`X / Y words`).
      - Micro-feedback phản hồi phi gián đoạn khi nộp bài cho AI chấm điểm hoặc lưu điểm hoàn tất.
      - Tự động lưu bản nháp debounced 600ms; khôi phục an toàn sau khi reload; dọn sạch draft và checkpoint khi nộp bài thành công.
    - **After Session & Next Action Panel**:
      - Tích hợp [`NextActionPanel.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/session/NextActionPanel.tsx) cho cả Speaking và Writing sau khi hoàn tất lượt nói hoặc chấm bài luận; cung cấp nút điều hướng chuẩn mực quay về Today Learning Hub (`data-testid="next-action-next-action-today-hub"`), quay lại danh sách bài, hoặc thử lại.
      - Giải phóng đúng chu trình Continuity (`completeResumeActivity`) khi hoàn thành bài, ngăn ngừa stale card trong Continue Learning.
    - **Kiểm thử tự động**:
      - Bộ kiểm thử mới [`SpeakingWritingSessionPhase5.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/SpeakingWritingSessionPhase5.test.tsx) đạt **9/9 tests pass 100%**.
      - Toàn bộ suite liên quan gồm 4 test files, 41 automated tests pass 100%.
  - **PHASE 4 — Reading & Listening Session Experience (`FourSkillsView.tsx`, `ListeningResultSummary.tsx`, `types/sessionExperience.ts`)**:
    - **Before Session UX với `SessionIntro`**:
      - Hiển thị thông số chuẩn xác từ dataset thật: CEFR level, tiêu đề bài học, số câu hỏi trắc nghiệm, thời gian đọc/nghe thật (`readTime` / `duration`), tóm tắt/mục tiêu thật.
      - Ưu tiên metadata kế hoạch học tập (`planTitle`, `planObjective`, `estimatedMinutes`, `planItemId`) khi mở từ Today Learning Hub mà không tạo duration/progress source thứ hai.
      - Hiển thị resume banner chân thực: `"Tiếp tục bài học"`, `"Đã làm X / Y câu (Z còn lại)"` khi có checkpoint dở dang; loại bỏ trùng lặp header DOM giữa `SessionIntro` và inner container.
    - **During Session UX với `SessionProgressHeader` & `SessionMicroFeedback`**:
      - Bổ sung `counterFormat: 'answered'` cho `discrete_items` trong [`types/sessionExperience.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/types/sessionExperience.ts) và [`SessionProgressHeader.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/session/SessionProgressHeader.tsx) để phản ánh tiến độ thực tế theo số câu đã trả lời (`answered / total`) thay vì index vị trí.
      - Tích hợp chuỗi đúng trong phiên (`sessionStreak`) hoàn toàn ephemeral, tăng theo câu trả lời đúng và reset sạch sẽ khi thoát/retry; tuyệt đối không ghi vào `profile.streak` hay global app streak.
      - Micro-feedback toast ngắn gọn, không chặn tương tác (`non-blocking`), tự động ẩn (`auto-dismiss`) sau 2-3s.
    - **Listening Audio & Persistence Safeguards**:
      - Bảo tồn 100% transcript sync, seek bar, tokenization và audio playback controls (`0.75x`, `1.0x`, `1.25x`).
      - Tuyệt đối không serialize hoặc persist đối tượng runtime Audio, SpeechSynthesisUtterance hay DOM elements vào resume checkpoint. Checkpoint chỉ lưu dữ liệu serializable (`lessonId`, `answers`, `totalQuestions`, `progressPercent`).
    - **After Session & Next Action**:
      - Reading: Kết nối [`SessionCompleteSummary.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/session/SessionCompleteSummary.tsx) và [`NextActionPanel.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/session/NextActionPanel.tsx) hiển thị các chỉ số có chứng cứ thật (số câu đúng/tổng, tỷ lệ chính xác %, XP nhận được, từ vựng trọng tâm); cung cấp Next Action định tuyến về Today Hub (`data-testid="next-action-next-action-today-hub"`), quay lại kho bài đọc, hoặc làm lại bài đọc.
      - Listening: Bổ sung Next Action button vào [`ListeningResultSummary.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/ListeningResultSummary.tsx) (`data-testid="btn-next-action-today-hub"`).
      - Giải phóng đúng chu trình Continuity (`completeResumeActivity`) khi hoàn tất, ngăn chặn stale card trong Continue Learning.
    - **Kiểm thử tự động**:
      - Bộ kiểm thử mới [`ReadingListeningSessionPhase4.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/ReadingListeningSessionPhase4.test.tsx) đạt **10/10 tests pass 100%**.
      - Toàn bộ suite tích hợp và hồi quy gồm 9 test files, 100 automated tests pass 100%.
  - **PHASE 1 — Audit Session Lifecycle & Kiến Trúc Nền Tảng**:
    - Khảo sát mã nguồn thực tế toàn bộ các phân hệ học tập: [`FlashcardDeck.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/FlashcardDeck.tsx), [`FourSkillsView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/FourSkillsView.tsx), [`ToeicAssessmentView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/ToeicAssessmentView.tsx), [`QuizArena.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/QuizArena.tsx), [`PronunciationArena.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/PronunciationArena.tsx), [`AITutorView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/AITutorView.tsx), [`TodayLearningPlanWidget.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/TodayLearningPlanWidget.tsx), và [`ContinueLearningSection.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/ContinueLearningSection.tsx).
    - Phân định rõ Single Source of Truth cho từng module, các metric có thể suy diễn và các dữ liệu không tồn tại (tuyệt đối không ngụy tạo).
    - Chốt kiến trúc composable nhẹ nhàng: `Domain State -> Session Adapter / Derived Contract -> Composable UI -> Today Hub / Continuity Routing`, không tạo persistent session store mới hay recommendation engine mới.
  - **PHASE 2 — Shared Session Experience Foundation (`types/sessionExperience.ts`, `services/sessionExperienceAdapter.ts`, `components/session/*`)**:
    - **Hợp đồng dữ liệu Discriminated Union chuẩn mực ([`types/sessionExperience.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/types/sessionExperience.ts))**: Định nghĩa presentation session contract cho 9 module (`flashcard`, `reading`, `listening`, `speaking`, `writing`, `toeic`, `quiz`, `pronunciation`, `tutor`), chỉ phục vụ presentation, orchestration và derived metadata mà không copy business state.
    - **Bộ điều phối trình bày thuần túy ([`services/sessionExperienceAdapter.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/sessionExperienceAdapter.ts))**: Cung cấp `formatSessionDurationBucket`, `clampSessionProgress`, `getTruthfulProgressDisplay`, v.v., triệt tiêu hoàn toàn `NaN` và `Infinity`.
    - **Thành phần giao diện Composable ([`components/session/*`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/session))**: `SessionIntro`, `SessionProgressHeader`, `SessionMicroFeedback`, `SessionCompleteSummary`, `NextActionPanel` cho phép từng phân hệ linh hoạt giữ nguyên bản sắc UX riêng.
    - **Kiểm thử tự động**: 33 unit tests chuyên biệt (`sessionExperienceAdapter.test.ts`, `SessionPrimitives.test.tsx`).
  - **PHASE 3 — Flashcard Reference Integration + Today Hub + Resume**:
    - **Before Session UX với `SessionIntro` trong [`FlashcardDeck.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/FlashcardDeck.tsx)**:
      - Hiển thị màn hình giới thiệu trước phiên học: số thẻ thật (`totalWords`), thời lượng ước tính (`formatSessionDurationBucket` dựa trên thuật toán `calculateTaskEstimatedMinutes('srs_review', totalWords)` chuẩn mực), mục tiêu phiên học có căn cứ (`objective`), và nút bắt đầu `data-testid="btn-start-session"`.
      - Ưu tiên metadata kế hoạch học tập (`planTitle`, `planObjective`, `estimatedMinutes`) khi mở từ Today Learning Hub thông qua `activePracticeConfig` mở rộng trên `AppStore`, không tính toán lại sai lệch thuật toán.
    - **During Session Invariants**:
      - Tái sử dụng `SessionHeader` hiện tại với fixed-height layout và `SessionMicroFeedback` toast.
      - Bảo toàn khóa giao dịch đánh giá nguyên tử `isReviewingRef`, triệt tiêu triệt để race condition và double review.
      - Duy trì `sessionStreak` hoàn toàn cục bộ/ephemeral trong phiên, tuyệt đối không ghi đè vào `profile.streak` hay global app streak.
      - Khắc phục triệt để race condition re-trigger: tách biệt `loadSessionQueueRef` khỏi sự thay đổi của `srsProgressMap`, ngăn ngừa reset hàng đợi hoặc huỷ trạng thái hoàn thành giữa phiên.
    - **After Session & Next Action**:
      - Tái sử dụng `SessionSummary` hiện tại với Observed Session Retention thật và Hardest Cards dựa trên bằng chứng struggle.
      - Bổ sung nút Next Action điều hướng trực tiếp về Dashboard / Today Learning Hub (`data-testid="btn-next-action-today-hub"`), không tự tạo recommendation engine mới.
    - **Resume & Continuity Integration**:
      - Hiển thị banner tiếp tục chân thực: `"Tiếp tục phiên ôn"`, `"Đã ôn X / Y thẻ đã xử lý (Z còn lại)"`.
      - Loại bỏ thẻ đã học khỏi hàng đợi khi resume (Zero Double Review, Zero Double XP).
      - Không thay đổi due date khi resume; giải phóng activity dở dang khi hoàn thành phiên (`completeResumeActivity('flashcard_active_session')`).
    - **Kiểm thử tự động**:
      - Test suite mới [`FlashcardSessionPhase3.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/FlashcardSessionPhase3.test.tsx) đạt **9/9 tests pass 100%**.
      - Toàn bộ suite liên quan gồm 8 test files, 125 automated tests pass 100%.
- **Four Skills Completion Persistence & Unified Zustand State Architecture (Phases 1 — 6)**:
  - **Chuyển đổi Single Source of Truth sang Zustand Store**: Hợp nhất toàn bộ trạng thái hoàn thành bài học Reading, Speaking, Writing từ 3 key rời rạc trong `localStorage` vào contract chuẩn hóa `fourSkillsCompletionProgress: { reading: string[]; speaking: string[]; writing: string[] }` trong Zustand [`useAppStore.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/useAppStore.ts) và [`types/index.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/types/index.ts). Kỹ năng Listening tiếp tục duy trì độc lập qua `completedListeningLessonIds` với cơ chế ủy quyền liền mạch.
  - **Di chuyển dữ liệu một lần an toàn (One-time Rehydration Migration)**: Tự động phát hiện và di chuyển dữ liệu từ 3 legacy keys (`completed_reading_lessons`, `completed_speaking_prompts`, `completed_writing_prompts`) trong `onRehydrateStorage`. Quy trình an toàn tuyệt đối (non-destructive): bỏ qua dữ liệu không hợp lệ, chuẩn hóa/deduplicate ID, hợp nhất đơn điệu với state hiện có; chỉ xóa legacy keys khi parse và chuyển đổi thành công (giữ nguyên key nguồn nếu gặp JSON hỏng/corrupted).
  - **Persistence Whitelist (`partialize`)**: Đưa `fourSkillsCompletionProgress` vào whitelist lưu trữ cục bộ `english_mastery_storage_v2`, kiểm soát kích thước payload an toàn và loại bỏ hoàn toàn các trường runtime/phiên tạm thời.
  - **Chuyển đổi hoàn toàn giao diện (FourSkillsView & Dashboard Cutover)**: Xóa bỏ 100% thao tác đọc/ghi trực tiếp `localStorage` khỏi [`FourSkillsView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/FourSkillsView.tsx) và [`todayLearningPlanService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/todayLearningPlanService.ts), xóa bỏ dual-write. Kích hoạt hoàn thành bài học qua generic action `markFourSkillsLessonCompleted(skill, lessonId)`. Đấu nối Quest 2 trong [`Dashboard.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/Dashboard.tsx) trực tiếp vào `fourSkillsCompletionProgress.speaking.length`.
  - **Sao lưu & Phục hồi toàn vẹn (Backup / Restore)**: Mở rộng `exportBackupData` và `importBackupData` để sao lưu và khôi phục tiến độ 4 kỹ năng. Hỗ trợ tương thích ngược toàn diện cho các file sao lưu phiên bản cũ thiếu trường mới hoặc chứa legacy keys.
  - **Đồng bộ đám mây đa thiết bị (Multi-Device Cloud Sync Monotonic Set Union)**: Tích hợp `four_skills_completion_progress` vào cột JSONB `four_skills_scores` trên Supabase mà không cần migrate cơ sở dữ liệu. Hàm `mergeCloudData` thực hiện phép hợp tập hợp đơn điệu ($local \cup cloud$), chống mất bài học đã hoàn thành khi sync giữa thiết bị mới (trống dữ liệu) và đám mây, hoặc thiết bị đã có bài học với đám mây phiên bản cũ.
  - **Bộ kiểm thử hồi quy toàn diện (Comprehensive Regression Tests)**: Bổ sung 48 unit và integration tests chuyên biệt (`fourSkillsCompletionProgress.test.ts`, `fourSkillsMigrationAndSync.test.ts`), bao quát toàn bộ kịch bản người dùng mới, người dùng legacy, JSON lỗi, ID trùng lặp, mismatch dataset lịch sử, reload, backup/restore và đồng bộ đám mây.
- **Today Learning Hub & Central Orchestration Engine (Phases 1 — 6)**:
  - **PHASE 1 — Audit Kiến Trúc & Xác Định Nguồn Dữ Liệu**:
    - Khảo sát và đối chiếu mã nguồn thực tế toàn hệ thống: [`Dashboard.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/Dashboard.tsx), [`useAppStore.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/useAppStore.ts), [`srsScheduler.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/srsScheduler.ts), [`srsWorkloadForecast.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/srsWorkloadForecast.ts), [`leechDetector.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/leechDetector.ts), [`adaptiveMistakeService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/adaptiveMistakeService.ts), [`adaptivePracticeRouter.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/adaptivePracticeRouter.ts), [`skillsCompetencyService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/skillsCompetencyService.ts), [`fourSkillsLearningBridge.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/fourSkillsLearningBridge.ts), [`learningDictionaryService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/learningDictionaryService.ts), và [`wordConfusionService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/wordConfusionService.ts).
    - Phân định rõ ràng Single Source of Truth và Invariants: Today Learning Plan là tầng điều phối suy diễn động (pure orchestration / derived layer), không sao chép trạng thái persistent, không mutate bất kỳ tham số bộ nhớ nào (FSRS stability, difficulty, retrievability, SM-2 interval, EF, due dates), và không bulk-build hồ sơ học tập cho 10.381 từ từ điển.
    - Định nghĩa tiêu chuẩn bằng chứng hoàn thành thật (Truthful Completion Evidence): nhiệm vụ SRS chỉ hoàn thành khi số từ đã ôn trong ngày đủ bù trừ số thẻ đến hạn; bài sửa lỗi chỉ hoàn thành khi lỗi được giải quyết (consecutive correct >= 2); bài phát âm chỉ tính khi telemetry đạt chuẩn; không cấp cờ completed chỉ vì học viên mở màn hình.
  - **PHASE 2 — Động Cơ Lập Kế Hoạch Học Tập Hôm Nay (`todayLearningPlanService.ts`)**:
    - Xây dựng service thuần túy [`todayLearningPlanService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/todayLearningPlanService.ts): hoàn toàn độc lập với React / DOM, chạy trơn tru offline trong môi trường Node.js và trình duyệt.
    - Hợp đồng dữ liệu chuẩn mực: `TodayLearningPlan` (`date`, `items`, `totalEstimatedMinutes`, `totalTasks`, `completedTasks`, `progress`, `planState`, `stateMessage`) và `LearningPlanItem` (`id`, `type`, `title`, `description`, `count`, `estimatedMinutes`, `timeBucket`, `priority`, `priorityScore`, `tier`, `reason`, `action`, `completed`, `targetItemIds`, `targetLessonId`).
    - Khởi tạo nhiệm vụ từ dữ liệu thật: Overdue SRS, Relearning FSRS, Due SRS, Leech Recovery, Mistake Bank, Pronunciation Queue, Four Skills Deficit, Curriculum Lesson, và Daily New Words Goal.
    - Tính tất định tuyệt đối (Determinism): Cho cùng một bộ `date + learning state`, kết quả tạo kế hoạch luôn đồng nhất 100%, sắp xếp ổn định theo `priorityScore`, `priority`, và `id`.
  - **PHASE 3 — Priority Scoring, Deduplication, Bucketed Time & Plan States**:
    - **Động cơ phân bổ điểm ưu tiên tất định (Deterministic Priority Scoring)**: Đánh giá theo thang điểm minh bạch giải thích được (Overdue: 100 > Relearning: 90 > Due: 85 > Weaknesses: 70-80 > Deficit: 60 > Curriculum: 40-50 > Enrichment: 20).
    - **Khử trùng lặp đa chiều (Deduplication) & Giới hạn Top 2–4 Actions**: Đối soát triệt để `targetLessonId` và độ trùng lặp tập từ (`targetItemIds` overlap $\ge 70\%$) giữa Leech, Mistake Bank và Collocation yếu. Luôn chốt danh sách ở 2–4 nhiệm vụ giá trị nhất, không tạo "rừng card".
    - **Giải thích "Why this?" thân thiện & Bucket thời gian trực quan**: Tạo lý do động viên người học, loại bỏ hoàn toàn các thông số nội bộ (FSRS stability, difficulty, raw telemetry). Quy chuẩn thời gian học thành các bucket rõ ràng (`~5 phút`, `~10 phút`, `~20 phút`), triệt tiêu `NaN`/`Infinity`.
    - **Xử lý 4 Plan States chuyên biệt**: `normal`, `new_user` (lộ trình onboarding không ngụy tạo số 0), `completed_day` (thông điệp hoàn thành + hành động mở rộng), và `heavy_workload` (chia nhỏ phiên ~30 thẻ không làm biến dạng scheduler).
  - **PHASE 4 — Smart CTA, Routing & Reactivity Live Update**:
    - **Hàm điều phối CTA thông minh (`executeLearningPlanAction`)**: 1-click chuyển hướng chính xác sang Flashcard (nạp `activePracticeConfig` với danh sách từ mục tiêu và chế độ collocation), Mistake Bank, Pronunciation Arena, hoặc Four Skills (mở đúng subtab và bài học mục tiêu).
    - **Reactivity tức thì & Local-First Invariant**: Suy diễn động trực tiếp từ Zustand store, tự động cập nhật ngay khi hoàn thành bài ở phân hệ nguồn mà không sinh state persistent trùng lặp (`todayTaskCompleted`). Hoạt động 100% offline, không mutate scheduler.
  - **PHASE 5 — Dashboard UI: Chuyển Đổi Thành Today Learning Hub**:
    - **Tái cấu trúc thứ bậc thị giác chuẩn (Visual Hierarchy)**:
      ```text
      TODAY (Hero Banner & Greeting)
      ↓
      Today Learning Plan (Today Learning Hub)
      ↓
      Progress Today (Chỉ số ngày & Nhiệm vụ Rương Báu)
      ↓
      Adaptive Insight (Sổ bẫy lỗi & Adaptive Summary)
      ↓
      Statistics (Năng lực 4 kỹ năng & Heatmap)
      ```
    - **Thị giác Thẻ Primary (#1) vs Secondary Actions**: Làm nổi bật hành động trọng tâm số 1 (card lớn hơn, gradient phát sáng, CTA nổi bật), các hành động phụ giữ thiết kế thẻ gọn gàng.
    - **Chào hỏi nhẹ nhàng theo thời gian thực (Dynamic Time Greeting)**: Chào buổi sáng / chiều / tối kèm username theo giờ địa phương, không dùng AI/API, không persist.
    - **Xử lý Hydration mượt mà**: Bộ xương Skeleton loader (`aria-busy="true"`) cho Today Hub ngăn chặn hoàn toàn hiện tượng nhấp nháy `0 due -> 18 due` khi Zustand rehydrate.
    - **Tối ưu hóa hiệu năng render**: Memoization toàn diện các selector; ẩn insight vô nghĩa cho new user (không render tràn lan "0 leech, 0 mistake, 0 due, Chưa có retention"); zero layout shift.
    - **Khả năng tiếp cận & Micro-interactions**: Chuẩn hóa `role="progressbar"`, aria labels, visible focus rings, và hỗ trợ `prefers-reduced-motion`.
  - **PHASE 6 — Full Regression & Quality Gate**:
    - `npm test`: **123/123 test files, 2.034/2.034 automated tests passed** (100% pass rate).
    - `npx tsc -b`: **0 compilation errors**.
    - `npm run lint`: **0 errors** (322 stylistic warnings).
    - `npm run build`: Production bundle biên dịch thành công trong 2.15s (PWA Workbox precache 11.3MB, 30 assets).
- **Learning Activity Continuity & Shared Resumable Engine (Phases 1 — 5)**:
  - **PHASE 1 — Audit Resumable Flow Toàn Diện**:
    - Khảo sát thực tế toàn bộ các phân hệ học tập: Reading, Writing, Speaking, Listening, Flashcards, TOEIC Assessment, và AI Tutor.
    - Phân định rõ ràng: module nào hỗ trợ được (Reading, Writing, Speaking, Listening, TOEIC, Flashcards), module chưa nên hỗ trợ ở phase này (AI Tutor do nguy cơ bloat storage bởi chat history khi feedback quan trọng đã vào Mistake Bank), Single Source of Truth cho từng module, checkpoint tối thiểu để khôi phục và các dữ liệu runtime tuyệt đối không persist (MediaStream, audio synthetic buffers, speech recognition instances, DOM layout rects).
  - **PHASE 2 — Shared Continuity Contract & Store Foundation**:
    - **Hợp đồng dữ liệu Discriminated Union chuẩn mực ([`types/learningContinuity.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/types/learningContinuity.ts))**: Định nghĩa `ResumableActivityType` (`reading`, `writing`, `speaking`, `listening`, `toeic`, `flashcard`) và `ResumableActivity` type-safe, không dùng generic `any` hay `unknown` tùy tiện.
    - **Dịch vụ chuẩn hóa & kiểm định độ tươi mới ([`services/learningContinuityService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/learningContinuityService.ts))**: Cung cấp `validateResumeActivity`, `isActivityStale` (quá hạn 7 ngày cho 4 kỹ năng, 24 giờ cho bài thi TOEIC và phiên Flashcard hàng ngày), `sanitizeResumeActivitiesMap` (giới hạn tối đa 25 tác vụ gần nhất, loại bỏ payload lỗi), và `getMostRecentResumableActivity` (lựa chọn tất định tác vụ đang dở dang gần nhất chưa hoàn thành).
    - **Tích hợp Zustand Store API ([`useAppStore.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/useAppStore.ts))**: Bổ sung `resumeActivities: Record<string, ResumableActivity>`, các actions `upsertResumeActivity`, `updateResumeCheckpoint`, `completeResumeActivity`, `removeResumeActivity`, và `getLastResumableActivity`.
    - **Bảo toàn Single Source of Truth & Zero Mutation Invariant**: Continuity chỉ lưu con trỏ trạng thái (pointer/checkpoint) tối thiểu; tuyệt đối không nhân bản dữ liệu tiến độ hay biến đổi FSRS/SM-2, Four Skills scores, Mistake Bank.
    - **Persistence Foundation**: Tích hợp an toàn vào `partialize` của Zustand và bộ lọc làm sạch rehydration `onRehydrateStorage`.
    - **Bộ kiểm thử tự động toàn diện**: Bổ sung 21 tests chuyên biệt cho service và store (`learningContinuityService.test.ts`, `learningContinuityStore.test.ts`).
  - **PHASE 3 — Four Skills Resume: Reading / Speaking / Writing / Listening**:
    - **Semantic Checkpointing trong [`FourSkillsView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/FourSkillsView.tsx)**: Checkpoint chính xác bài học đang mở, câu trả lời trắc nghiệm, lượt hội thoại nói và bản nháp bài viết.
    - **Reading & Listening Continuity**: Lưu trữ đáp án tạm thời, tự động dọn dẹp và đánh dấu completed khi nộp bài quiz hoặc hoàn thành toàn bộ câu hỏi.
    - **Debounced Writing Draft Persistence**: Tự động lưu bản thảo bài luận với debounce 600ms chống nghẽn I/O; khôi phục nguyên vẹn văn bản soạn thảo khi resume; dọn dẹp draft và đóng activity khi chấm điểm/nộp bài thành công.
    - **Mic-Free Speaking Resume Invariant**: Khôi phục chính xác kịch bản và câu thoại của prompt đang nói; tuyệt đối không tự động bật Microphone hay yêu cầu cấp quyền; người học chủ động nhấn Mic khi sẵn sàng.
    - **Four Skills Banner UX**: Hiển thị banner khôi phục với 2 lựa chọn rõ ràng: `data-testid="btn-resume-activity"` (Tiếp tục) và `data-testid="btn-dismiss-resume"` (Bắt đầu bài khác).
    - **Kiểm thử tự động**: Bộ test suite [`FourSkillsResumePhase3.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/FourSkillsResumePhase3.test.tsx) đạt **5/5 tests pass 100%**.
  - **PHASE 4 — Flashcard Session Resume An Toàn FSRS/SM-2**:
    - **Ordered Queue & Card Tracking trong [`FlashcardDeck.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/FlashcardDeck.tsx)**: Lưu trữ danh sách `orderedCardIds`, `currentIndex`, `reviewedCardIds` và tiến độ phiên học.
    - **Loại bỏ thẻ đã học khi Resume (Zero Double Review / Zero Double XP)**: Khi tiếp tục, loại bỏ hoàn toàn các thẻ đã review khỏi hàng đợi; giữ nguyên thứ tự các thẻ còn lại; triệt tiêu 100% nguy cơ cộng thừa XP hoặc làm sai lệch thuật toán FSRS-4.5/SM-2.
    - **Thích ứng thẻ bị xóa**: Tự động lọc bỏ thẻ không còn tồn tại trong kho thẻ hợp nhất mà không gây crash ứng dụng.
    - **Flashcard Banner UX**: Hiển thị banner `data-testid="flashcard-resume-banner"` với `data-testid="btn-resume-flashcards"` và `data-testid="btn-dismiss-flashcards"`.
    - **Kiểm thử tự động**: Bộ test suite [`FlashcardResumePhase4.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/FlashcardResumePhase4.test.tsx) đạt **5/5 tests pass 100%**.
  - **PHASE 5 — TOEIC Assessment Resume & In-Progress Exam Recovery**:
    - **Khôi phục đề thi chuẩn xác 100% qua Snapshot Meta trong [`ToeicAssessmentView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/ToeicAssessmentView.tsx)**: Sử dụng `restoreSnapshotFromMeta` để khôi phục chính xác bộ câu hỏi, nhóm câu hỏi và cấu trúc Part; tuyệt đối không sinh ngẫu nhiên lại từ seed.
    - **Dẫn xuất thời gian trôi qua tất định (Timer Elapsed Derivation)**: Đối với bài thi tính giờ nghiêm ngặt, tự động trừ đi số giây thực tế trôi qua từ `savedAt` (`effectiveTimeLeft = Math.max(0, saved.timeLeft - elapsedSeconds)`).
    - **Bảo lưu trọn vẹn bài thi đang tạm dừng (Paused Timer Preservation)**: Nếu bài thi đang ở trạng thái Paused trước khi thoát tab, bảo lưu 100% số giây còn lại và hiển thị overlay tạm dừng khi tiếp tục.
    - **Tự động thanh lọc bài thi cũ (> 24 giờ)**: Tự động xóa bỏ các attempt dở dang đã quá 24 giờ (`isActivityStale`) để bảo đảm tính chuẩn hóa của kết quả khảo sát.
    - **Dọn dẹp chu trình sống sạch sẽ (Lifecycle Cleanup)**: Nộp bài thi hoặc nhấn Hủy bỏ sẽ giải phóng hoàn toàn attempt khỏi cả `sessionStorage` và `resumeActivities` của Zustand.
    - **Lobby Banner UX**: Banner khôi phục tại sảnh chờ với `data-testid="toeic-resume-banner"`, `data-testid="btn-resume-toeic"`, và `data-testid="btn-discard-toeic"`.
    - **Kiểm thử tự động**: Bộ test suite [`ToeicResumePhase5.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/ToeicResumePhase5.test.tsx) đạt **7/7 tests pass 100%**.
  - **PHASE 6 — AI Tutor Conversation Continuity, Continue Learning Section & Today Hub Orchestration**:
    - **Tách biệt tầng lưu trữ hội thoại ([`services/tutorSessionStorage.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/tutorSessionStorage.ts))**: Lưu trữ transcript hội thoại và bộ nhớ ngữ cảnh tạm thời `sessionMemory` tại layer session riêng biệt với prefix `english_mastery_tutor_session_${scenarioId}`, giới hạn tối đa 30 tin nhắn gần nhất và tự động hết hạn sau 24 giờ (`TUTOR_STALE_MS`). Global store chỉ lưu con trỏ checkpoint tối thiểu (`sessionId`, `scenarioId`, `turnCount`, `lastMessageSummary`).
    - **Quy tắc bất biến chống Double-Ingestion (Anti-Double-Ingestion Invariant)**: Khôi phục phiên hội thoại tuyệt đối không gọi lại `ingestTutorFeedback`, không duplicate các bản ghi Mistake Bank, không cộng dồn XP ảo, và không tạo review event giả vào SRS.
    - **Không ngụy tạo tỷ lệ hoàn thành (Truthful Progress Labeling)**: Không giả định `% completion` đối với các kịch bản hội thoại mở; hiển thị trung thực `X lượt hội thoại` (ví dụ `3 lượt hội thoại`).
    - **Thành phần giao diện ContinueLearningSection ([`components/ContinueLearningSection.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/ContinueLearningSection.tsx))**: Tích hợp trực tiếp trên Dashboard ngay phía trên Today Learning Plan; tự động ẩn hoàn toàn khi không có bài học dở (zero empty cards); phân cấp thị giác rõ ràng với 1 primary card nổi bật và tối đa 2 secondary cards nhỏ gọn; hỗ trợ đầy đủ các module Reading, Writing, Speaking, TOEIC, Flashcards và AI Tutor.
    - **Module-Level Resume Banner**: Bổ sung banner nhắc nhở `data-testid="tutor-resume-banner"` trong `AITutorView` khi người học có phiên hội thoại dở dang ở kịch bản khác với 2 lựa chọn `[Tiếp tục]` và `[Bỏ qua]`.
    - **Khử trùng lặp thông minh trong Today Learning Hub ([`services/todayLearningPlanService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/todayLearningPlanService.ts))**: Tự động chuyển đổi nhiệm vụ SRS Due sang `Tiếp tục phiên Flashcard (X/Y thẻ)` với priority score 92 khi phát hiện có phiên Flashcard đang làm dở, triệt tiêu hoàn toàn sự trùng lặp giữa recommendation và active session.
    - **Kiểm thử tự động**: Bộ test suite [`ContinueLearningPhase6.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/ContinueLearningPhase6.test.tsx) đạt **9/9 tests pass 100%**.
  - **PHASE 7 — Persistence, Cloud Continuity, Stale Recovery & Full Regression Release Gate**:
    - **Sao lưu & Phục hồi toàn vẹn (Backup / Restore Roundtrip)**: Mở rộng `exportBackupData` và `importBackupData` để sao lưu và khôi phục `resumeActivities` trọn vẹn; tương thích ngược hoàn hảo với các phiên bản backup cũ thiếu trường này hoặc payload chứa dữ liệu hỏng.
    - **Thuật toán hợp nhất đám mây đa thiết bị (Cross-Device Merge Invariants)**:
      - **"Completed Always Wins"**: Trạng thái bài học đã hoàn thành luôn thắng và ghi đè trạng thái dở dang từ bất kỳ thiết bị nào.
      - **Uncompleted Conflict Resolution**: Khi cả 2 thiết bị đều chưa hoàn thành, trạng thái có `lastActiveAt` mới nhất sẽ được chọn.
    - **Tự động thanh lọc phiên học hết hạn (Stale Expiry Recovery)**: Thu hồi và dọn dẹp các phiên học quá hạn (> 24 giờ cho TOEIC Assessment, Flashcards, và AI Tutor; > 7 ngày cho các bài học Four Skills) khi merge hoặc load dữ liệu.
    - **Quy tắc bất biến không thay đổi trạng thái (Zero State Mutation Invariant)**: Hành động mở xem, tiếp tục (resume) hoặc thoát khỏi bài học không bao giờ làm thay đổi XP, điểm số kỹ năng, tham số FSRS/SM-2, hay Mistake Bank.
    - **Dọn dẹp phiên khi Reset**: Tích hợp `clearAllTutorSessions()` vào `resetToDefault` của Zustand, bảo đảm reset ứng dụng xóa sạch toàn bộ phiên tạm thời ở cả RAM và `localStorage`.
    - **Kiểm thử tự động & Release Gate**:
      - Bộ test suite [`ContinuityPersistencePhase7.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/__tests__/ContinuityPersistencePhase7.test.tsx) đạt **14/14 tests pass 100%**.
      - `npm test`: **130/130 test files, 2.095/2.095 automated tests passed** (100% pass rate).
      - `npx tsc -b`: **0 compilation errors**.
      - `npm run lint`: **0 errors** (336 stylistic warnings).
      - `npm run build`: Production bundle & PWA Workbox precache 30 entries (11.4 MB) hoàn thành trong 1.81s.

---

## [0.8.0] - 2026-10-06

### Added
- **Nâng Cấp Toàn Diện Flashcard SRS: Hiệu Năng Core, Session UX, Adaptive Presentation & Edge Cases (Phases 1 - 6)**:
  - **PHASE 1 & 2 — Audit Hiệu Năng & Tối Ưu Hóa Core Scheduler**:
    - Bộ nhớ đệm thẻ hợp nhất `_cachedUnifiedCards` trong [`useAppStore.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/useAppStore.ts): loại bỏ việc rebuild mảng hàng nghìn object mỗi khi re-render.
    - Bộ đếm tag số lượng 1-pass $O(N)$ trong [`FlashcardDeck.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/FlashcardDeck.tsx): triệt tiêu 34 lượt quét `.filter()` trên 10.381 từ mỗi khung hình render (giảm thời gian tính toán từ ~400ms xuống < 3ms).
    - Khóa giao dịch đánh giá nguyên tử `isReviewingRef`: triệt tiêu triệt để race condition và hiện tượng click đúp nút rating gây nhảy 2 card hoặc duplicate review events.
    - Cách ly ngữ nghĩa FSRS-4.5 và SM-2: không bao giờ ngụy tạo retrievability hay difficulty cho thẻ SM-2; phân tách rạch ròi giữa số lần quên của scheduler (`lapses`) và số lần đánh giá `Again` thực tế (`againCount`).
  - **PHASE 3 — Session UX Mượt Mà, Fixed-Height Header & Micro-Feedback**:
    - Thành phần `SessionHeader`: hiển thị trực quan `12 / 30`, thanh progress, `18 remaining`, `🔥 Streak 7` nội bộ phiên học (độc lập hoàn toàn với app streak).
    - Layout cố định chiều cao (Fixed-height container): triệt tiêu Layout Shift khi đổi thẻ (CLS = 0).
    - Ephemeral micro-feedback toast sau mỗi đánh giá (`We'll reinforce this one.`, `Getting there.`, `Nice recall!`, `Strong memory!`), tự động biến mất và tôn trọng `prefers-reduced-motion`.
    - Hiệu ứng lật thẻ 3D Framer Motion mượt mà, không remount toàn bộ container Flashcard.
  - **PHASE 4 — Adaptive Card Presentation & Pronunciation Prompt**:
    - Bộ điều phối thuần túy [`adaptiveCardPresentation.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/adaptiveCardPresentation.ts): tự động phân bổ 5 chế độ hiển thị thích ứng (`standard`, `reverse`, `context_cloze`, `collocation`, `confusion_challenge`) dựa trên bằng chứng lỗi thực tế từ `mistakeBank`.
    - Nút luyện phát âm Pronunciation Prompt an toàn: probe `isSpeechRecognitionSupported()` thời gian thực từ `speechService.ts`, kiểm tra quyền micro và hiển thị fallback trực quan khi không được hỗ trợ.
  - **PHASE 5 — Session Summary, Luyện Thẻ Khó & Edge Cases**:
    - Subcomponent `SessionSummary`: hiển thị tổng số thẻ đã học, phân bổ 4 nút rating (Again, Hard, Good, Easy), Observed Session Retention $\frac{\text{hard + good + easy}}{\text{total}} \times 100\%$ (hoặc `—` nếu 0 review), danh sách từ khó nhất phiên học (Hardest Words) dựa trên bằng chứng struggle.
    - Luồng "Luyện lại từ khó" (Review difficult cards): tạo queue ôn tập tăng cường ngay lập tức mà không làm sai lệch ngày đến hạn (due date), không tăng lapse count và không mutate scheduler state của thẻ.
    - Xử lý triệt để các edge cases: Deck rỗng, phiên học 1 thẻ, xóa thẻ giữa chừng, chuyển tab/F5 giữa phiên, undefined card guard, và click dồn dập.
  - **PHASE 6 — Kiểm Thử Toàn Diện & Quality Gate**:
    - Bổ sung 34 tests chuyên biệt cho Flashcard: `FlashcardDeckPerformancePhase2.test.tsx` (8 tests), `FlashcardDeckPhase3Phase4.test.tsx` (15 tests), `FlashcardDeckPhase5.test.tsx` (11 tests).
- **Frontend Countdown, Live Rollover, Cache & Full Regression (GMT+7)**:
  - **Shared Time Utility**: Bổ sung `getVietnamNow` và `getNextLeaderboardReset` vào `leaderboardService.ts`, thống nhất quy chuẩn thời gian giữa frontend và Postgres RPC `Asia/Ho_Chi_Minh`.
  - **Countdown GMT+7**: Đồng hồ đếm ngược trỏ chính xác đến Thứ Hai 00:00:00 VN (Chủ Nhật 23:00 VN còn 1 giờ thay vì 8 giờ; Chủ Nhật 23:59:59 VN còn 1 giây; Thứ Hai 00:00:00 VN reset về 7 ngày).
  - **Live Rollover & Sleep Recovery**: `LeaderboardView.tsx` tự động chuyển đổi `currentWeekId`, tải bảng xếp hạng mới, reset countdown và kiểm tra Lễ trao giải mà không cần reload trang (F5). Bổ sung listener `visibilitychange` và `focus` giúp phục hồi chuyển tuần tức thì khi tỉnh máy tính từ chế độ ngủ (OS sleep) hoặc chuyển tab.
  - **Week-Aware Cache Labeling**: Nhận diện cache tuần cũ (`isStaleWeek = true`) sau mốc Thứ Hai 00:00:00 VN. Bảng điều khiển ngoại tuyến dán nhãn minh bạch "Dữ liệu tuần cũ đã kết thúc — Đang hiển thị bản sao lưu", phân tách rõ rệt với tuần hiện tại.
  - **Daily Quote Boundary Invariant**: Bảo toàn tính tất định của câu châm ngôn theo từng ngày Việt Nam (`00:00:00 VN` đổi câu mới) độc lập với chu kỳ tuần của Leaderboard (`Monday 00:00:00 VN`).
- **Nâng Cấp Chu Kỳ Tuần Bảng Xếp Hạng Chuẩn Giờ Việt Nam (Asia/Ho_Chi_Minh - UTC+7)**:
  - **Single Source of Truth**: Chuyển đổi canonical timezone từ Monday 00:00 UTC sang **Monday 00:00:00 Asia/Ho_Chi_Minh** (`[Monday 00:00:00 VN, Next Monday 00:00:00 VN)` tương đương `[Sunday 17:00:00 UTC, Next Sunday 17:00:00 UTC)`).
  - **Server-Authoritative SQL**: Cập nhật `scripts/setup_weekly_finalization.sql` với `NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'` và `DATE_TRUNC('week', ...)` ép theo múi giờ Việt Nam, bảo toàn kiểm soát quyền thực thi (`service_role` only, RLS enabled), transaction advisory lock (`pg_advisory_xact_lock`), và idempotency (`ALREADY_FINALIZED`).
  - **TypeScript Services**: Cập nhật `leaderboardService.ts` và `weeklyFinalizationService.ts` với các helper tính tuần VN (`getVietnamWeekStart`, `getVietnamWeekEnd`, `getNextVietnamWeekReset`, `getVietnamWeekId`, `getCurrentVietnamWeekDates`, `getVietnamWeekRangeById`), duy trì alias tương thích ngược.
- **Nâng Cấp Bảng Xếp Hạng Thế Hệ Mới — Real-User, Server-Authoritative, Ceremony & Security (Leaderboard v2)**:
  - **PHASE 1 — Xóa Sạch Mock Data & Nền Tảng Real-User**: Loại bỏ toàn bộ mock fallback 12 học viên giả lập. `fetchLeaderboardWithStatus()` chỉ trả về người dùng thật từ `leaderboard_profiles`. Khi mất mạng: trả về cache thật kèm `cachedAt` timestamp — không bao giờ inject fake users. Nguồn `weeklyXp` tách biệt hoàn toàn khỏi `totalXp`.
  - **PHASE 2 — Database Model & Server-Authoritative Weekly Finalization**: RPC `finalize_weekly_leaderboard` (`SECURITY DEFINER`) chốt tuần theo giờ server UTC/VN, snapshot Top 3 vào `weekly_leaderboard_snapshots`, cấp frame entitlement, reset `weekly_xp = 0`. Advisory lock chống race condition. Idempotency: gọi lại cùng tuần → `ALREADY_FINALIZED`. Deterministic week identity `YYYY-Www`.
  - **PHASE 3 — Frame Reward Persist & Equip Security**: 3 khung: `champion_frame` (Top 1, vàng), `elite_frame` (Top 2, bạc), `prestige_frame` (Top 3, đồng). Persist trong `user_frame_entitlements`. RPC `equip_profile_frame` xác minh ownership. Database trigger `check_equipped_frame_ownership` bảo vệ tầng DB. Người thắng lại: `times_won` tăng, không duplicate row.
  - **PHASE 4 — Weekly Results UI & Ceremony**: `WeeklyAwardCeremonyModal.tsx` (ARIA, confetti). `WeeklyResultsModal.tsx` với week selector. Ceremony persist localStorage — không re-fire khi F5. `LeaderboardView.tsx` với offline banner, podium động, frame badges.
  - **PHASE 5 — Security Audit & Full Regression**: 58 bài kiểm thử mới (`phase5SecurityRegressionAudit.test.ts`): không inject rank/XP/entitlement, RLS simulation, finalization full-flow, idempotency sequential & concurrent, realtime debounce, weekly reset regression, award history integrity, zero mock accounts, cross-system regression.
  - **SQL Migrations**: `scripts/setup_leaderboard.sql`, `scripts/setup_weekly_finalization.sql` (finalization, snapshots, entitlements, trigger, RPCs, Realtime).

### Quality Gate
- Tests: **1922 / 1922 passed** (116 test files), bao gồm toàn bộ bộ kiểm thử Flashcard Phases 1-6, Leaderboard v2, Weekly Finalization GMT+7, và Four Skills
- TypeScript `tsc -b`: **0 errors**
- Lint `oxlint`: **0 errors**
- Production build `vite build`: **pass** (2438 modules, 2.71s, PWA precache 30 entries 11.3MB)

---

## [0.7.0] - 2026-10-05

### Added
- **Mở Rộng Toàn Diện Ngân Hàng Four Skills Chuẩn CEFR (96 Bài Luyện Tập A1–C2)**:
  - **Listening Lab (24 bài)**: 4 bài cho mỗi cấp độ A1–C2, tích hợp đồng bộ transcript/câu thời gian thực, audio seek bar, phân đoạn Paragraph & Dialogue, tự động ẩn dịch và ngân hàng câu hỏi trắc nghiệm kiểm tra nghe hiểu chi tiết.
  - **Reading Studio (24 bài)**: 4 bài cho mỗi cấp độ A1–C2, bài đọc hiểu tương tác, tính năng tra từ ngữ cảnh 1-chạm (One-touch Word Lookup), tự động ghi nhận telemetry `readingEncounters` cho kho từ vựng cá nhân.
  - **Speaking Arena (24 bài)**: 4 bài cho mỗi cấp độ A1–C2, kịch bản hội thoại và bài nói đa dạng, nhận diện giọng nói Web Speech API thời gian thực, đối sánh văn bản mẫu Smart Shadowing và phân tích phát âm trực quan.
  - **Writing Studio (24 bài)**: 4 bài cho mỗi cấp độ A1–C2, đa dạng thể loại (Short Description, Email, Invitation, Narrative, Report, Opinion Essay, Analytical Essay, Proposal, Critical Commentary), chấm điểm tự động 4 tiêu chí CEFR qua Gemini AI & Offline Fallback, trực quan hóa chỉnh sửa với Essay Diff Viewer, tự động trích xuất collocations & lỗi ngữ pháp vào Mistake Bank & Flashcard SRS.
  - **Tổng số lượng**: Đạt mốc 96 bài luyện Four Skills hoàn chỉnh (= 24 Listening + 24 Reading + 24 Speaking + 24 Writing), phân bổ chuẩn xác 4 bài cho từng cấp độ CEFR với độ khó tăng dần.
  - Bộ kiểm thử toàn diện: `listeningDatasetIntegrity.test.ts`, `readingDatasetIntegrity.test.ts`, `speakingDatasetIntegrity.test.ts`, `writingDatasetIntegrity.test.ts`, `writingFlowIntegration.test.ts`.

---

## [0.6.0] - 2026-10-04

### Added
- **PHASE 1: Nền Tảng Learning Dictionary (Learning Dictionary Foundation)**:
  - Dịch vụ [`learningDictionaryService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/learningDictionaryService.ts): trích xuất trạng thái học tập thống nhất (Single Source of Truth) kết hợp dữ liệu từ điển tĩnh 10.381 từ + SRS/FSRS + Mistake Bank + Collocations + Leech Detection + CEFR Calibration.
  - Zero state duplication: không lưu bản sao của từ điển tĩnh trong Zustand store.
  - Hợp nhất chuẩn hình thái từ (lemma canonicalization) chuyển biến thể chia thì/số nhiều về từ nguyên bản.
- **PHASE 2: Tích Hợp Trạng Thái Ghi Nhớ FSRS / SM-2 (Memory State Integration)**:
  - Tích hợp chuẩn toán học FSRS Retrievability qua `calculateRetrievability(elapsedDays, stability)`.
  - Nghiêm cấm ngụy tạo chỉ số FSRS cho thẻ SM-2 (giữ `retrievability: null` và `difficulty: null`).
  - Phân biệt minh bạch giữa `lapses` (chu kỳ quên trong scheduler) và `againCount` (tần suất bấm rating Again thực tế).
- **PHASE 3: Telemetry Gặp Từ Trong Reading & Dùng Từ Trong Writing (Context Usage Telemetry)**:
  - [`wordUsageTelemetry.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/wordUsageTelemetry.ts): ghi nhận `readingEncounters` (số phiên bài đọc hợp lệ có từ) và `writingUsages` (số bài viết submit/evaluate có dùng từ).
  - Idempotency lifecycle: chống double-counting khi mở lại từ điển, rerender, hoặc reload bài học.
  - Dữ liệu lưu dưới dạng aggregate tinh gọn trong `wordLearningStats`, bảo đảm kích thước payload LocalStorage < 100KB.
- **PHASE 4: Từ Dễ Nhầm Lẫn, Cụm Từ Yếu & Mạng Lưới Từ Vựng (Confused Words, Weak Collocations & Word Network)**:
  - [`wordConfusionService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/wordConfusionService.ts): trích xuất personalized confused words dựa trên bằng chứng lỗi thực tế từ Mistake Bank; đếm chính xác tần suất cặp nhầm lẫn, không gán nhầm từ `mistakeCount` của từ đích.
  - Phân tách cụm từ thông dụng (common collocations) và cụm từ yếu của cá nhân (weak collocations) chỉ khi có bằng chứng lỗi/thất bại SRS chưa khắc phục.
  - [`wordFamilyService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/wordFamilyService.ts): suy luận mạng lưới gia đình từ ngoại tuyến, loại bỏ trùng lặp từ gốc (root).
- **PHASE 5: Giao Diện Learning Dictionary & Quick Actions (UI & Quick Actions)**:
  - Nâng cấp [`DictionaryView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/DictionaryView.tsx) với các phân mục:
    - [`YourLearningSection.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/dictionary/YourLearningSection.tsx): hiển thị trạng thái ghi nhớ, thuật toán, độ nhớ lại, độ khó, lịch sử ôn tập.
    - [`NeedsPracticeSection.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/dictionary/NeedsPracticeSection.tsx): điểm yếu cần luyện tập, bẫy lỗi và cụm từ yếu.
    - [`WordNetworkSection.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/dictionary/WordNetworkSection.tsx): gia đình từ, từ đồng nghĩa, trái nghĩa, từ hay nhầm.
    - [`CefrCalibrationBadge.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/dictionary/CefrCalibrationBadge.tsx): hiệu chuẩn CEFR từ vựng với trình độ học viên.
    - [`DictionaryQuickActions.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/dictionary/DictionaryQuickActions.tsx): lưu từ canonical, ôn tập ngay khi đến hạn, luyện điểm sai, luyện cụm từ yếu.
  - Xử lý tương thích truy cập A11y, phát hiện hỗ trợ Speech APIs và làm sạch dữ liệu sao chép.
- **PHASE 6: Kiểm Toán Hiệu Năng, Hồi Quy & Phát Hành Chính Thức (Performance, Regression & Final Release Audit)**:
  - Tối ưu hóa tra cứu từ điển $O(1)$ qua `getDictionaryWord` trong RAM Trie Index (< 5ms).
  - Tách biệt hoàn toàn việc tạo Learning Profile động theo từng từ được chọn, không tạo hàng loạt trên 10.381 từ.
  - Kiểm toán chất lượng: Không phát hiện lỗi thời gian chạy chặn phát hành trong các kịch bản kiểm thử (No release-blocking runtime failure found in covered regression scenarios). Dữ liệu lưu trữ duy trì an toàn trong ngân sách kiểm thử (Persistence stayed within the tested storage budget). 0 lỗi TypeScript (`tsc -b`), 0 lỗi lint (`oxlint`), build production tối ưu trong 1.64s.

---

## [0.5.0] - 2026-10-04

### Added
- **PHASE 1: Nền Tảng Ngữ Cảnh Học Tập Gia Sư AI (Tutor Learning Context Foundation)**:
  - Dịch vụ ngữ cảnh [`tutorLearningContext.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/tutorLearningContext.ts): tổng hợp dữ liệu học tập đa nguồn (Four Skills Competency, Mistake Bank, SRS/FSRS, Collocations, Writing/Speaking issues).
  - Thuật toán xếp hạng ưu tiên học tập tất định (Deterministic Priority Ranking) dựa trên tần suất lặp lỗi, recency, leech words và deficit kỹ năng, giới hạn nghiêm ngặt `maxPriorities: 3`.
  - Nguyên tắc bất biến không ngụy tạo mục tiêu (Zero Synthetic Targets): khi người học chưa có lỗi cụ thể, hệ thống từ chối bịa đặt target items giả định.
  - Kiểm soát ngân sách ngữ cảnh Gemini khắt khe với `maxChars: 2500` (~625 tokens).

- **PHASE 2: Hội Thoại Thích Ứng & Ngữ Cảnh Cá Nhân Hóa Gemini (Personalized Gemini Context & Adaptive Conversation)**:
  - Xây dựng prompt thích ứng chuẩn mực theo công thức: `Scenario + Learning Context = Personalized Scenario`, bảo toàn trọn vẹn 5 kịch bản đàm thoại nhập vai gốc (Tech Interview, Daily Standup, Airport, Business Negotiation, IELTS Speaking).
  - Quản lý trạng thái phiên đàm thoại [`tutorSessionManager.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/tutorSessionManager.ts): luân chuyển mục tiêu học tập (Target Rotation) và trích xuất telemetry có cấu trúc (`practicedTargets`, `detectedMistakes`, `masteryDemonstrated`, `grammarFeedback`, `vocabularyFeedback`).
  - Coi telemetry mô hình AI là dữ liệu chưa tin cậy (Untrusted Model Output): kiểm tra schema nghiêm ngặt, fallback an toàn đa tầng (Direct JSON -> Fenced JSON -> Balanced Brace Scanner -> Plain Text Fallback -> Intelligent Mock Engine).

- **PHASE 3: Đưa Phản Hồi AI Vào Vòng Lặp Học Tập (AI Tutor Feedback → Learning System Bridge)**:
  - Cầu nối phản hồi [`tutorFeedbackBridge.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/tutorFeedbackBridge.ts): xác minh bằng chứng ngữ cảnh thực tế (Local Turn Evidence Check) với câu nói của người dùng trước khi ghi nhận lỗi vào Mistake Bank. Phản hồi AI Tutor cập nhật Mistake Bank và bằng chứng học tập thích ứng; lịch trình FSRS/SM-2 chính thức được kiểm soát độc quyền bởi các phiên ôn tập Flashcard/SRS.
  - Chuẩn hóa lỗi canonical (spelling, meaning, grammar, collocation, pronunciation), chuẩn hóa mẫu ngữ pháp và cụm từ; bộ nhớ đệm chống trùng lặp tất định (LRU Ingestion Cache 200 turns) khóa theo composite key (`userId + sessionId + turnId`).
  - Giải quyết điểm yếu trong Mistake Bank (Mistake Bank Mastery Resolution): ghi nhận số lần dùng đúng liên tiếp (`consecutiveCorrect`) và đánh dấu giải quyết lỗi (`resolved: true`) khi người học sử dụng chuẩn xác nhiều lần; tuyệt đối KHÔNG tự ý thay đổi lịch trình hay cấp độ của thẻ SRS/FSRS. Đăng ký Collocation vào SRS chỉ thực hiện khi người dùng có hành động lưu chủ động (`autoEnrollCollocationSRS`).

- **PHASE 4: Giao Diện Cá Nhân Hóa Gia Sư AI, Quyền Riêng Tư & Khả Năng Phục Hồi (UI Personalization, Privacy & Resilience)**:
  - Nâng cấp giao diện [`AITutorView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/AITutorView.tsx): hiển thị banner tinh tế "Mục tiêu hôm nay" (Today's Focus) với CEFR level và 2-3 trọng tâm luyện tập, không làm loãng giao diện hội thoại.
  - Phân tách rạch ròi trạng thái đàm thoại tạm thời (Session State) và dữ liệu học tập vĩnh viễn (Persistent State); nút Reset Chat làm mới phiên mà không xóa lịch sử học tập.
  - Bảo vệ quyền riêng tư người học: không phơi bày điểm số thô, telemetry nội bộ hay prompt kỹ thuật; chế độ Demo (không có API key) hiển thị thông báo minh bạch và tuyệt đối không ghi sai lệch dữ liệu vào Mistake Bank/SRS.
  - Tối ưu hóa hiệu năng memoization: `deriveTutorLearningContext` và `deriveSessionFocusItems` chỉ kích hoạt khi các learning slices cốt lõi thay đổi, gõ phím mượt mà không gây recompute.

- **PHASE 5: Kiểm Toán Hồi Quy Toàn Diện & Chuẩn Bị Phát Hành (Final E2E Regression & Release Audit)**:
  - Bộ kiểm thử hồi quy khép kín [`phase5TutorE2ERegression.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/phase5TutorE2ERegression.test.ts) (19/19 tests passed) bao phủ luồng khép kín E2E, 10 trường hợp biên đặc thù và 6 kiểm chứng bất biến cô lập FSRS/SM-2, LRU session keying, Local evidence và Anti-self-reinforcement.
  - Bộ kiểm thử giao diện [`AITutorPersonalization.test.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/__tests__/AITutorPersonalization.test.tsx) (18/18 tests passed).
  - Toàn bộ dự án: **45 test suites, 646/646 tests passed (100%)**, 0 lỗi TypeScript (`tsc -b`), 0 cảnh báo linter (`oxlint`), bản build thương mại đạt chuẩn tối ưu (1.98s).

---

## [0.4.0] - 2026-10-04

### Added
- **PHASE 1: Động Cơ Toán Học FSRS-4.5 Thuần Túy (Free Spaced Repetition Scheduler v4.5)**:
  - Triển khai động cơ toán học độc lập [`fsrsAlgorithm.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/fsrsAlgorithm.ts) với 17 tham số tối ưu chuẩn (`DEFAULT_FSRS_PARAMETERS`), hàm suy giảm trí nhớ dạng lũy thừa $R(t, S) = (1 + \frac{19}{81}\frac{t}{S})^{-0.5}$, công thức tính khoảng cách tối ưu $I(r, S) = \frac{S}{19/81}(r^{-2} - 1)$, và các quy tắc cập nhật độ khó $D$, độ bền ghi nhớ $S'_r$, và độ bền sau khi quên $S'_f$.
  - Mở rộng hệ thống kiểu dữ liệu trong [`src/types/index.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/types/index.ts): `SRSAlgorithmType`, `FSRSRating`, `FSRSState`, `FSRSMemoryState`, `FSRSSettings`, `FSRSCalculationResult`, tích hợp `fsrs?: FSRSMemoryState` vào `SRSProgress`, `SRSReviewCard` và `VocabWord`.
  - Bộ kiểm thử độc lập [`fsrsAlgorithm.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/fsrsAlgorithm.test.ts) đạt 36/36 tests passed.

- **PHASE 2: Telemetry Ôn Tập & Máy Trạng Thái Thẻ (Review Telemetry & Card State Machine)**:
  - Máy trạng thái thống nhất trong [`srsScheduler.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/srsScheduler.ts): hỗ trợ `New`, `Learning`, `Review`, `Relearning` với nguyên tắc Single Source of Truth, zero duplicated state.
  - Ring buffer `recentReviewEvents` (giới hạn 200 sự kiện gần nhất) ghi nhận chi tiết thời điểm ôn tập, điểm số, trạng thái trước/sau và độ bền dự đoán.
  - Tích hợp bộ đếm rating lịch sử (`againCount`, `hardCount`, `goodCount`, `easyCount`) vào `DailyProgress` giúp suy luận phân bổ rating dài hạn theo 7 ngày, 30 ngày và toàn thời gian.

- **PHASE 3: Động Cơ Tính Toán Retention & Biểu Đồ SVG Thuần Túy**:
  - Dịch vụ pure calculation [`srsAnalytics.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/srsAnalytics.ts): tính Observed/Actual Retention $\frac{\text{hard + good + easy}}{\text{total}}$ trên các cửa sổ 7 ngày, 30 ngày, all-time; an toàn khi lịch sử rỗng (`actualRetention: null`, tránh gán nhầm 0%).
  - Thành phần [`RetentionChart.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/RetentionChart.tsx): biểu đồ đường SVG nhẹ, responsive, hiển thị Actual vs Target Retention và phân bổ thanh rating xếp tầng.
  - Bảng thống kê chi tiết [`SRSAnalyticsPanel.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/SRSAnalyticsPanel.tsx) hiển thị chi tiết số liệu phân tích và khoảng cách retention gap.

- **PHASE 4: Dự Báo Workload & Mô Phỏng Tác Động Retention (Workload Forecast & Simulation)**:
  - Dịch vụ thuần túy [`srsWorkloadForecast.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/srsWorkloadForecast.ts): dự báo tải ôn tập chính xác theo ranh giới ngày lịch (Hôm nay, Ngày mai, 7 ngày tới), gộp thẻ quá hạn vào Hôm nay, không gây đột biến trạng thái thẻ.
  - Mô phỏng tác động retention candidate simulator với công thức mở rộng khoảng cách toán học FSRS $I(r_2) = I(r_1) \cdot \frac{r_2^{-2} - 1}{r_1^{-2} - 1}$, cung cấp cảnh báo trực quan tải học tăng vọt trong [`DailySettingsModal.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/DailySettingsModal.tsx).

- **PHASE 5: Đề Xuất Target Retention Tối Ưu & Bộ Nhận Diện Từ Khó (Leech Detection)**:
  - Dịch vụ [`retentionRecommendation.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/retentionRecommendation.ts): cân bằng tải học và khả năng ghi nhớ dài hạn, bảo vệ cách ly chế độ SM-2 (`isApplicable: false`), ước tính thay đổi khối lượng học theo mô hình lũy thừa $W(r) \propto \frac{r^2}{1 - r^2}$.
  - Dịch vụ [`leechDetector.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/leechDetector.ts): thuật toán tính điểm đa tiêu chí (lapses $\ge 4$, again rate $\ge 35\%$, FSRS difficulty $\ge 8.5$), bảo vệ chia cho 0 và xử lý thẻ cũ an toàn.

- **PHASE 6: Adaptive Learning Hub & Gia Cố Lưu Trữ (Storage Hardening & Rehydration)**:
  - Widget tóm tắt [`AdaptiveLearningSummary.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/AdaptiveLearningSummary.tsx) và widget từ khó [`LeechWordsWidget.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/LeechWordsWidget.tsx) tích hợp trực tiếp vào trung tâm [`Dashboard.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/Dashboard.tsx).
  - Modal phân tích chi tiết [`SRSAnalyticsModal.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/SRSAnalyticsModal.tsx) đóng gói bảng phân tích và biểu đồ SVG.
  - Gia cố lưu trữ Zustand [`useAppStore.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/useAppStore.ts): fallback an toàn khi rehydrate, kiểm tra tải trọng JSON < 100KB sau 1.000 lượt ôn tập.

- **PHASE 7: Kiểm Toán Hồi Quy Toàn Diện & Chuẩn Bị Phát Hành (Final Regression & Release Audit)**:
  - Kiểm chứng hướng ring buffer 201 sự kiện liên tiếp: phần tử mới nhất tại index 0, phần tử cũ nhất bị loại bỏ khi vượt quá 200.
  - Triển khai và kiểm thử chính sách Telemetry Cloud Merge trong `mergeCloudData`: khử trùng lặp theo ID, sắp xếp giảm dần theo timestamp, giới hạn 200 sự kiện mới nhất.
  - Chuẩn hóa thuật ngữ UI: cập nhật nhãn phụ "Thẻ đến hạn" trong widget Adaptive Learning Hub.
  - Làm sạch mã nguồn chết: loại bỏ fallback `reviewHistory` chưa từng tồn tại trong `importBackupData`.
  - Bộ kiểm thử hồi quy 10 tiêu chí [`phase7FinalRegression.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/__tests__/phase7FinalRegression.test.ts) (12/12 tests passed).
  - Kết quả kiểm thử toàn dự án: **32 test suites, 342/342 tests passed (100%)**, 0 lỗi TypeScript (`tsc -b`), 0 cảnh báo linter (`oxlint`), đóng gói PWA thành công với Workbox Service Worker 30 mục precache (9.6MB).

---

## [0.3.0] - 2026-10-04

### Added
- **Hạ tầng Progressive Web App (PWA) Offline-First**:
  - Tích hợp plugin `vite-plugin-pwa` (`^2.0.0`) và thư viện `workbox-window` (`^7.4.1`) với chiến lược Service Worker `registerType: 'prompt'`.
  - Cấu hình hạn mức precache của Workbox `maximumFileSizeToCacheInBytes: 15 * 1024 * 1024` (15MB) trong [`vite.config.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/vite.config.ts), đảm bảo Service Worker precache trọn gói 9.5MB dữ liệu ứng dụng và toàn bộ kho từ vựng tĩnh 10.378 từ.
  - Bộ tài nguyên biểu tượng PWA chuẩn hóa: `icon-192.png`, `icon-512.png`, `maskable-icon-512.png`, `apple-touch-icon.png`, `favicon.ico`, `masked-icon.svg` cùng script tự động hóa [`scripts/generate_pwa_icons.cjs`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/scripts/generate_pwa_icons.cjs).
  - Custom Hook [`usePWA`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/hooks/usePWA.ts) quản lý trạng thái mạng (`isOffline`), theo dõi cập nhật Service Worker (`needRefresh`, `updateServiceWorker`), và xử lý sự kiện cài đặt Add to Home Screen (`isInstallable`, `installApp`).
  - Thành phần giao diện [`PWANotificationBanner`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/PWANotificationBanner.tsx): cảnh báo trực quan chế độ Offline và hiển thị banner cập nhật Service Worker với nút "Cập nhật ngay".
  - Thành phần giao diện [`PWAInstallButton`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/PWAInstallButton.tsx): nút cài đặt ứng dụng xuất hiện mượt mà trên thanh Navbar khi trình duyệt kích hoạt sự kiện `beforeinstallprompt`.
- **Phân hệ Bảng Xếp Hạng Thời Gian Thực (Realtime Leaderboard System)**:
  - Database Migration SQL [`scripts/setup_leaderboard.sql`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/scripts/setup_leaderboard.sql): tạo bảng `leaderboard_profiles`, chỉ mục hiệu năng `idx_leaderboard_weekly_xp` và `idx_leaderboard_streak`, bật Row Level Security (RLS) cho phép đọc công khai và sửa đổi theo `auth.uid()`, đồng thời thêm bảng vào `supabase_realtime` publication.
  - Dịch vụ [`leaderboardService.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/leaderboardService.ts): kết nối WebSocket qua `supabase.channel('public:leaderboard_profiles')`, tích hợp cơ chế Debounce 1.5s chống bão sự kiện, vòng bảo vệ Promise race Timeout 3 giây và Mock Data 12 học viên giả lập đảm bảo Zero-Crash Fallback khi mất mạng hoặc chưa cấu hình backend.
  - Giao diện [`LeaderboardView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/LeaderboardView.tsx): chuyển đổi tab Top XP Tuần vs Top Streak, đồng hồ đếm ngược Weekly Reset Timer, bục vinh danh Top 3 Podium hiệu ứng Framer Motion, và thanh Sticky Bar ghim thứ hạng cá nhân ở đáy màn hình.
  - Tích hợp tab `'leaderboard'` vào hệ thống điều hướng chính tại [`Navbar.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/Navbar.tsx) và [`App.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/App.tsx).
- **Phân hệ Collocations & Idioms Spaced Repetition (SM-2)**:
  - Mở rộng contracts kiểu dữ liệu trong [`src/types/index.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/types/index.ts): `CollocationItem`, `SRSReviewCard`, `VocabItemType`.
  - Tích hợp nút 1-chạm lưu cụm từ/thành ngữ kèm ngữ cảnh vào SRS từ kết quả phân tích dịch thuật trong [`TranslatorView.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/TranslatorView.tsx).
  - Nâng cấp [`FlashcardDeck.tsx`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/components/FlashcardDeck.tsx): tự động nhận diện thẻ Collocation, tạo câu đố Cloze test với masked hint `[ _____ ]`, hiển thị ngữ cảnh câu mẫu và đồng bộ quy trình ôn tập SM-2.
  - Mở rộng Zustand Store trong [`useAppStore.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/useAppStore.ts): thêm `userCollocations: CollocationItem[]` cùng các actions `saveCollocationToSRS`, `deleteCollocation`, và `getUnifiedSRSCards` (hợp nhất từ vựng đơn và collocations vào cùng chu kỳ ôn tập).
- **Bộ Kiểm Thử Tự Động Vitest Mở Rộng Đạt 174 Tests (100% Pass)**:
  - Bổ sung [`useAppStore.mergeCloudData.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/__tests__/useAppStore.mergeCloudData.test.ts): 8 kịch bản kiểm thử phân giải xung đột dữ liệu đám mây toàn diện (Empty/Undefined payload, Fresh Install, Profile Conflict Max XP/Streak & API Key preservation, Deduplication Custom Words & Collocations, SRS Progress Reconcile by higher level/interval, Mistake Bank Resolved status priority, Four Skills Scores safe merge, Corrupted & Malformed payload resilience).
  - Bổ sung [`usePWA.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/hooks/__tests__/usePWA.test.ts): kiểm thử hook PWA, các listener online/offline, và tương tác sự kiện `beforeinstallprompt`.
  - Bổ sung [`leaderboardService.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/leaderboardService.test.ts): kiểm thử truy vấn bảng xếp hạng, đăng ký kênh Realtime WebSocket, cơ chế Debounce và Mock fallback.
  - Bổ sung [`collocationSRS.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/collocationSRS.test.ts): kiểm thử lưu cụm từ, tự sinh masked hints và tích hợp thuật toán SM-2.
  - Bổ sung [`essayGradingIntegration.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/essayGradingIntegration.test.ts), [`readingPassageAndSRS.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/readingPassageAndSRS.test.ts), [`quizDistractorEngine.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/quizDistractorEngine.test.ts), [`mistakeArenaIntegration.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/mistakeArenaIntegration.test.ts), [`wordLookupService.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/wordLookupService.test.ts), và [`textAlignment.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/textAlignment.test.ts).
- **Kịch Bản SQL Seed Kho Từ Điển**:
  - Tạo script [`scripts/seed_10k_vocab.sql`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/scripts/seed_10k_vocab.sql) chứa 10.378 từ vựng Oxford/CEFR chia batch 500 từ phục vụ nạp dữ liệu lên Supabase.

### Changed
- Nâng cấp hàm [`mergeCloudData`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/useAppStore.ts) hỗ trợ phân giải xung đột đa chiều: gộp và chống trùng lặp `userCustomWords` và `userCollocations`; điều hòa `srsProgressMap` theo mức độ ghi nhớ cao nhất; ưu tiên trạng thái `resolved: true` trong `mistakeBank`; bảo toàn khóa API `geminiApiKey` của thiết bị cục bộ; và bọc lớp an toàn Zero-Crash Resilience ghi `console.warn` trước payload dị thường.
- Mở rộng kho từ vựng tĩnh lên **10.378 từ** nạp trực tiếp vào RAM; tối ưu hóa cấu trúc Prefix Indexing trong [`dictionaryIndex.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/dictionaryIndex.ts) (xây dựng chỉ mục cho 10k từ dưới 45ms, tra cứu tiền tố O(1) dưới 0.05ms).
- Tinh chỉnh cấu hình phân tách chunk `manualChunks` trong [`vite.config.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/vite.config.ts): cô lập `vocab-static-data`, `vendor-react`, `vendor-ui`, tối ưu hóa hiệu năng nạp bộ nhớ PWA và giảm kích thước gói bundle chính.
- Cập nhật Whitelist của Zustand `partialize` trong [`useAppStore.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/useAppStore.ts) (`userCollocations`, `userCustomWords`, `fourSkillsScores`) và bảo vệ quota `localStorage` luôn dưới ngưỡng an toàn 1.5MB.

### Fixed
- Khắc phục triệt để lỗi TS2339 trên Store interface bằng việc chuẩn hóa hoàn chỉnh `AppStore` và `UserProfile` trong [`src/types/index.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/types/index.ts) và [`src/store/useAppStore.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/useAppStore.ts).
- Khắc phục lỗi đối sánh key khi cập nhật `mistakeBank` trong `mergeCloudData` đảm bảo cập nhật đúng bản ghi đang tồn tại khi Cloud gửi định danh id hoặc word.
- Sửa lỗi cảnh báo và thất bại build của Workbox khi gói dữ liệu từ điển vượt quá ngưỡng mặc định 2MB bằng cách cấu hình `maximumFileSizeToCacheInBytes: 15 * 1024 * 1024`.
- Điều chỉnh benchmark build time threshold trong [`dictionaryIndex.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/dictionaryIndex.ts) và [`dictionaryIndex.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/services/__tests__/dictionaryIndex.test.ts) phù hợp với quy mô ngân hàng 10.378 từ dưới tải CPU song song.

### Technical Debt Checklist
- [x] Viết bộ Unit Test kiểm tra hàm hợp nhất dữ liệu đám mây an toàn `mergeCloudData` trong [`src/store/useAppStore.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/useAppStore.ts) (Đạt 8/8 kịch bản trong [`src/store/__tests__/useAppStore.mergeCloudData.test.ts`](file:///c:/Users/hoang/.gemini/antigravity-ide/scratch/english-mastery-app/src/store/__tests__/useAppStore.mergeCloudData.test.ts)).
- [x] Di chuyển mảng điểm số 4 kỹ năng vào Zustand store và bảo toàn trong `partialize`.
- [x] Di chuyển cờ danh hiệu học đêm (`hasLearnedNightOwl`) vào Zustand store.
- [x] Xóa bỏ các hàm stub rỗng `syncVocab5000` và `syncVocab1000`.

---

## [0.2.0] - 2026-10-03

### Added
- Khai báo interface `FourSkillsScores` và `AppStore` contract trong `src/types/index.ts`.
- Mở rộng Zustand store `useAppStore.ts` với `fourSkillsScores: FourSkillsScores`, `hasLearnedNightOwl: boolean` cùng các actions: `recordSkillScore`, `setFourSkillsScores`, `setHasLearnedNightOwl`.
- Bổ sung `fourSkillsScores` và `hasLearnedNightOwl` vào whitelist serialize của `partialize` (`english_mastery_storage_v2`), đồng thời đưa vào `exportBackupData` và `importBackupData`.
- Triển khai cơ chế One-time Migration an toàn với `try/catch` trong lifecycle `onRehydrateStorage` tự động di trú dữ liệu cũ từ các key rời rạc (`four_skills_*_scores`, `learned_night_owl`) và dọn sạch bằng `localStorage.removeItem(...)`.
- Bổ sung cơ chế xử lý suy thoái mượt mà (Graceful Degradation) khi trình duyệt không hỗ trợ Web Speech API hoặc người dùng từ chối quyền Micro:
  * Tích hợp `isSpeechRecognitionSupported()` và `getSpeechBrowserSupport()` trong `speechService.ts`.
  * Hiển thị Warning Banner hướng dẫn mở trên Google Chrome / Microsoft Edge và vô hiệu hóa nút Mic trực quan tại `PronunciationArena.tsx` và `FourSkillsView.tsx`.
  * Hiển thị hướng dẫn mở khóa Micro qua biểu tượng ổ khóa URL khi gặp lỗi quyền truy cập (`permission-denied`).
  * Bổ sung bộ 18 unit tests cho speech service trong `speechService.test.ts`.
- Triển khai chính sách Zero-Crash & Error Boundaries cho Google Gemini API & AI Translation:
  * Tái cấu trúc `geminiService.ts` và `aiTranslationService.ts`: Bọc toàn bộ các endpoint bằng `try/catch`, ghi log cảnh báo bằng `console.warn`.
  * Đính kèm cờ metadata `isFallback: true` khi fallback vào mock engine / offline semantic engine.
  * Bổ sung hàm xác thực kết nối `testGeminiApiKey(apiKey)` kiểm tra key thời gian thực.
  * Tích hợp nút và badge thông báo "Kiểm tra kết nối" trực tiếp trong modal cài đặt API key.
  * Bổ sung 15 unit tests kiểm thử toàn diện khả năng chịu lỗi và tính năng test key trong `geminiService.test.ts`.
- Hoàn thiện UI/UX minh bạch trạng thái AI & Modal cấu hình Gemini API:
  * Tạo thành phần dùng chung `AIStatusBadge.tsx`: hiển thị Gemini Live khi đã kết nối trực tiếp hoặc Demo Mode khi chạy offline/fallback.
  * Xây dựng `GeminiKeyModal.tsx`: input bảo mật, nút Kiểm tra kết nối thời gian thực, lưu key vào Zustand store.
  * Tích hợp huy hiệu `AIStatusBadge` và `GeminiKeyModal` vào cả `AITutorView.tsx` và `TranslatorView.tsx`.
- Cài đặt và cấu hình môi trường test [Vitest](https://vitest.dev/) (`test`, `test:watch`, `test:coverage`) trong `vite.config.ts` và `package.json`.
- Bổ sung bộ 20 unit tests cho thuật toán SuperMemo 2 (SM-2) trong `srsAlgorithm.test.ts`.
- Bổ sung bộ 13 unit tests cho thang điểm TOEIC LR (990) và SW (400) trong `toeicScoring.test.ts`.

### Changed
- Tái cấu trúc `skillsCompetencyService.ts`: Loại bỏ hoàn toàn việc đọc/ghi `localStorage` trực tiếp cho điểm 4 kỹ năng; chuyển sang đọc từ `useAppStore.getState().fourSkillsScores`.
- Tái cấu trúc `achievementService.ts`: Chuyển cờ `learned_night_owl` sang Zustand store `hasLearnedNightOwl`.
- Cập nhật `WordManager.tsx`: Chuyển nút nạp kho từ chuẩn sang gọi dịch vụ đồng bộ `syncCloudVocabulariesToStore()`.

### Removed
- Xóa bỏ hoàn toàn 2 hàm stub rỗng `syncVocab5000` và `syncVocab1000` khỏi `src/store/useAppStore.ts` và interface `AppStore`.
- Dọn dẹp việc bóc tách và gọi thực thi 2 hàm này tại `src/App.tsx`, `src/components/OnboardingModal.tsx` và `src/components/WordManager.tsx`.

---

## [0.1.0] - 2026-10-03

### Added
- **Dashboard & Gamification**:
  - Bảng điều khiển trung tâm tổng hợp tiến độ học tập, chuỗi Streak hàng ngày, số tim và điểm kinh nghiệm XP.
  - Hệ thống cấp bậc người dùng gồm 4 bậc: Novice (Level 1-9), VIP Learner (Level 10-24), Master Scholar (Level 25-49), Mythic Legend (Level 50+) với hiệu ứng phát sáng đặc biệt.
  - Biểu đồ nhiệt hoạt động học tập (Activity Heatmap) hiển thị trực quan mức độ chuyên cần theo từng ngày.
  - Hệ thống 12 Thành Tựu & Danh Hiệu tự động tính toán dựa trên dữ liệu học tập thực tế.
- **Flashcard Deck & Spaced Repetition (SRS SM-2)**:
  - Bộ thẻ ghi nhớ Flashcard 3D hai mặt tích hợp phát âm song ngữ (Anh - Mỹ, Anh - Anh) và điều chỉnh tốc độ đọc.
  - Thuật toán SuperMemo 2 (SM-2) tự động tính toán giãn cách ôn tập dựa trên 4 mức độ: Again (Quên), Hard (Khó), Good (Tốt), Easy (Dễ).
  - Hỗ trợ 3 chế độ ôn tập độc lập: *Đến hạn hôm nay*, *Từ mới học hôm nay* và *Toàn bộ kho từ*.
- **Sổ Tay Bẫy Lỗi Sai (Mistake Bank)**:
  - Tự động ghi nhận mọi từ vựng bấm "Quên" trong Flashcard hoặc trả lời sai trong các bài tập minigame.
  - Giao diện luyện tập riêng cho các từ dễ nhầm lẫn; cơ chế tự động giải quyết (Resolved) khi đạt 2 lần trả lời đúng liên tiếp.
- **Đột Phá 4 Kỹ Năng (Four Skills)**:
  - Phân hệ luyện tập chuyên sâu 4 kỹ năng: Luyện Nghe (Listening), Luyện Nói (Speaking), Đọc hiểu (Reading) và Viết luận (Writing).
  - Công cụ đánh giá năng lực và quy đổi điểm trung bình sang thang đo chuẩn quốc tế CEFR (A1, A2, B1, B2, C1, C2).
- **Đấu Trường Trò Chơi (Quiz Arena)**:
  - 4 minigame rèn luyện trí nhớ và phản xạ từ vựng: Ghép Từ Siêu Tốc (Speed Match), Sắp Xếp Ký Tự (Word Scramble), Nghe Chép Chính Tả (Dictation), Trắc Nghiệm Kinh Điển (Classic Quiz).
- **Phòng Luyện Phát Âm (Pronunciation Arena)**:
  - Chấm điểm phát âm bằng giọng nói theo thời gian thực qua Web Speech Recognition API.
  - Hiển thị tỷ lệ khớp từ, đánh dấu từ phát âm chuẩn và từ cần khắc phục.
- **Khảo Thí TOEIC (TOEIC Assessment Center)**:
  - Hệ thống đề thi thử TOEIC chuẩn ETS theo định dạng 2 kỹ năng (Listening & Reading - thang điểm 990) và 4 kỹ năng (Speaking & Writing - thang điểm 400).
  - Phân loại câu hỏi theo từng Part (Photographs, Q&A, Conversations, Talks, Grammar, Text Completion, Reading Passages, Speaking, Writing Email).
  - Chấm điểm tự động và đưa ra nhận xét, lộ trình cải thiện năng lực.
- **Trợ Lý AI Nhập Vai (AI Tutor)**:
  - 5 kịch bản đàm thoại nhập vai thực tế: Tech Mock Interview, Daily Standup, Tiếng Anh Du Lịch, Đàm Phán Doanh Nghiệp, IELTS Speaking Master.
  - Tích hợp Google Gemini 1.5 Flash REST API kèm bộ phân tích ChatFeedback.
- **Siêu Từ Điển Tra Cứu Offline (Dictionary View)**:
  - Kho từ vựng hợp nhất trên RAM với cấu trúc Prefix Indexing O(1) tra cứu tức thì.
  - Hỗ trợ xem định nghĩa Anh - Việt, ví dụ câu, collocations, từ đồng nghĩa và phát âm tức thì.
- **Dịch Thuật Đa Ngữ Cảnh (Contextual Translator)**:
  - Công cụ dịch thuật song ngữ Anh - Việt hỗ trợ 4 tone ngữ cảnh: IT / Tech, Công Sở, Học Thuật và Đời Thường.
  - Xuất đồng thời 3 biến thể dịch kèm phân tích collocations và thuật ngữ chuyên ngành.
- **Quản Lý Từ Vựng & Nhập Hàng Loạt (Word Manager)**:
  - Giao diện thêm, sửa, xóa, đánh dấu yêu thích và Bulk Import từ vựng dạng bảng/CSV.
- **Sao Lưu & Đồng Bộ Đám Mây (Backup & Cloud Sync)**:
  - Tính năng Export/Import hồ sơ, từ vựng và tiến trình học tập dưới dạng file JSON.
  - Tích hợp Supabase Cloud Sync hỗ trợ đồng bộ hai chiều tự động.
- **Bảng Quản Trị Hệ Thống (Admin View)**:
  - Khu vực dành riêng cho quản trị viên để duyệt kho từ vựng dùng chung và quản lý dữ liệu người dùng.
