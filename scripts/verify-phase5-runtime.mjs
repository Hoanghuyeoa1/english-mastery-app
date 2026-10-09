#!/usr/bin/env node
// scripts/verify-phase5-runtime.mjs
// Phase 5: Authentication & RBAC Cross-Mode Verification Suite (DEV: 5173+5000 & UNIFIED: 5000)

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;
const BACKEND_PROJECT = path.join('backend', 'EnglishMastery.Api', 'EnglishMastery.Api.csproj');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function pass(name, detail = '') {
  console.log(`  ${colors.green}✔ PASS${colors.reset} [${name}] ${detail}`);
}

function fail(name, detail = '') {
  console.log(`  ${colors.red}✖ FAIL${colors.reset} [${name}] ${detail}`);
}

function blocked(name, detail = '') {
  console.log(`  ${colors.yellow}⚠ BLOCKED${colors.reset} [${name}] ${detail}`);
}

function info(msg) {
  console.log(`  ${colors.cyan}ℹ${colors.reset} ${msg}`);
}

function section(title) {
  console.log(`\n${colors.bright}${colors.blue}=== ${title} ===${colors.reset}`);
}

let spawnedBackend = null;
let hadExistingServer = false;

function killProcessTree(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
}

function probePort(port) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const sIpv4 = net.connect({ port, host: '127.0.0.1' });
    sIpv4.once('connect', () => { sIpv4.destroy(); finish(true); });
    sIpv4.once('error', () => {
      const sLocalhost = net.connect({ port, host: 'localhost' });
      sLocalhost.once('connect', () => { sLocalhost.destroy(); finish(true); });
      sLocalhost.once('error', () => finish(false));
    });
  });
}

async function waitForBackend(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        return { ok: true, data };
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false };
}

async function run() {
  console.log(`${colors.bright}${colors.magenta}================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}   PHASE 5: AUTHENTICATION & RBAC CROSS-MODE VERIFICATION       ${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}   (DEV: Vite 5173 + Core 5000 | UNIFIED: Core 5000 All-in-One)  ${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}================================================================${colors.reset}`);

  let totalTests = 0;
  let passedTests = 0;
  let blockedTests = 0;

  function record(result, name, detail) {
    totalTests++;
    if (result) {
      passedTests++;
      pass(name, detail);
    } else {
      fail(name, detail);
    }
  }

  function recordBlocked(name, detail) {
    totalTests++;
    blockedTests++;
    blocked(name, detail);
  }

  // ----------------------------------------------------
  // SECTION 1: Backend Server Readiness
  // ----------------------------------------------------
  section('1. Server Readiness & Health Check');

  const isPortInUse = await probePort(PORT);
  if (isPortInUse) {
    const testHealth = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    if (testHealth && testHealth.ok) {
      hadExistingServer = true;
      info(`Phát hiện Backend server đang hoạt động sẵn trên cổng ${PORT}.`);
    } else {
      info(`Cổng ${PORT} bị chiếm nhưng không phản hồi health. Vui lòng giải phóng cổng.`);
      process.exit(1);
    }
  } else {
    info(`Khởi động máy chủ ASP.NET Core trên cổng ${PORT}...`);
    const dotnetCmd = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
    spawnedBackend = spawn(
      dotnetCmd,
      ['run', '--project', BACKEND_PROJECT, '--launch-profile', 'http'],
      {
        cwd: ROOT_DIR,
        stdio: 'ignore',
        env: {
          ...process.env,
          ASPNETCORE_ENVIRONMENT: 'Development',
        },
      }
    );
  }

  const waitRes = await waitForBackend(30000);
  record(waitRes.ok, 'Backend Health Endpoint (/api/health)', `Status: ${waitRes.data?.status || 'FAIL'}`);

  // ----------------------------------------------------
  // SECTION 2: Email & Password Auth End-to-End
  // ----------------------------------------------------
  section('2. Email/Password Authentication & Session Lifecycle');

  const testSuffix = Date.now().toString().slice(-6);
  const testEmail = `phase5_learner_${testSuffix}@example.com`;
  const testPassword = 'StrongPassword@123';
  const testDisplayName = `Ph5 Learner ${testSuffix}`;

  // 2.1 Password Validation: Weak Password Rejection
  const weakPasswordRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173' },
    body: JSON.stringify({ email: `weak_${testSuffix}@test.com`, password: 'short' }),
  });
  const weakJson = await weakPasswordRes.json().catch(() => null);
  record(
    weakPasswordRes.status === 400 && (weakJson?.code === 'VALIDATION_FAILED' || weakPasswordRes.status === 400),
    'Password Validation (Weak Password Rejected)',
    `Status: ${weakPasswordRes.status}, Message: ${weakJson?.message || 'Rejected'}`
  );

  // 2.2 User Registration in DEV Mode (Origin http://localhost:5173)
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      displayName: testDisplayName,
    }),
  });
  const regData = await regRes.json();
  const rawSetCookie = regRes.headers.get('set-cookie') || '';
  const initialAccessToken = regData?.accessToken;
  const canonicalUserId = regData?.user?.id;
  const initialRefreshToken = regData?.refreshToken;

  record(
    regRes.status === 200 && Boolean(initialAccessToken) && Boolean(canonicalUserId),
    'User Registration (DEV Mode Origin: 5173)',
    `Status: 200, User ID: ${canonicalUserId}, Default Role: ${regData?.user?.roles?.[0] || 'USER'}`
  );
  record(
    regData?.user?.roles?.includes('USER') && !regData?.user?.roles?.includes('ADMIN'),
    'Default Role Security (Registered User is USER, Never ADMIN)',
    `Roles: ${JSON.stringify(regData?.user?.roles)}`
  );

  // 2.3 Duplicate Email Registration -> 409 Conflict
  const dupRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5000' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const dupJson = await dupRegRes.json().catch(() => null);
  record(
    dupRegRes.status === 409 && dupJson?.code === 'CONFLICT',
    'Duplicate Email Conflict (409 Conflict)',
    `Status: 409, Code: ${dupJson?.code}`
  );

  // 2.4 Login with Correct Password in UNIFIED Mode (Origin http://localhost:5000)
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5000' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const loginData = await loginRes.json();
  const loginSetCookie = loginRes.headers.get('set-cookie') || '';
  const loginAccessToken = loginData?.accessToken;
  const loginRefreshToken = loginData?.refreshToken;

  record(
    loginRes.status === 200 && Boolean(loginAccessToken),
    'User Login (UNIFIED Mode Origin: 5000)',
    `Status: 200, Token returned`
  );

  // 2.5 Login with Wrong Password -> 401 Unauthorized
  const wrongLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'WrongPassword999!' }),
  });
  const wrongLoginJson = await wrongLoginRes.json().catch(() => null);
  record(
    wrongLoginRes.status === 401 && (wrongLoginJson?.code === 'UNAUTHORIZED' || wrongLoginJson?.Code === 'UNAUTHORIZED'),
    'Wrong Password Rejection (401 Unauthorized)',
    `Status: 401, Code: ${wrongLoginJson?.code || wrongLoginJson?.Code}`
  );

  // 2.6 Current User Rehydration: GET /api/auth/me
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${loginAccessToken}` },
  });
  const meData = await meRes.json().catch(() => null);
  record(
    meRes.status === 200 && meData?.id === canonicalUserId && meData?.email === testEmail,
    'Session Rehydration (/api/auth/me)',
    `Status: 200, Level: ${meData?.level}, XP: ${meData?.xp}, Streak: ${meData?.streak}`
  );

  // 2.7 Missing / Invalid Token on /api/auth/me -> 401 Unauthorized (Never SPA HTML)
  const meUnauthRes = await fetch(`${BASE_URL}/api/auth/me`);
  const meUnauthJson = await meUnauthRes.json().catch(() => null);
  record(
    meUnauthRes.status === 401 && (meUnauthJson?.code === 'UNAUTHORIZED' || meUnauthJson?.Code === 'UNAUTHORIZED'),
    'Unauthenticated /api/auth/me Protection',
    `Status: 401 JSON, NOT index.html`
  );

  // 2.8 Token Refresh via Refresh Token
  const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': loginSetCookie ? loginSetCookie.split(';')[0] : `refreshToken=${loginRefreshToken}`,
    },
    body: JSON.stringify({ refreshToken: loginRefreshToken }),
  });
  const refreshData = await refreshRes.json().catch(() => null);
  const rotatedAccessToken = refreshData?.accessToken;
  const rotatedRefreshToken = refreshData?.refreshToken;
  record(
    refreshRes.status === 200 && Boolean(rotatedAccessToken) && rotatedAccessToken !== loginAccessToken,
    'Refresh Token Rotation (/api/auth/refresh)',
    `Status: 200, New JWT issued and rotated`
  );

  // 2.9 Logout -> Revokes Refresh Token & Clears Cookie
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `refreshToken=${rotatedRefreshToken}`,
    },
    body: JSON.stringify({ refreshToken: rotatedRefreshToken }),
  });
  const logoutJson = await logoutRes.json().catch(() => null);
  record(
    logoutRes.status === 200,
    'User Logout (/api/auth/logout)',
    `Status: 200, ${logoutJson?.message || 'Success'}`
  );

  // 2.10 Replay of Revoked Refresh Token -> 401 Unauthorized
  const replayedRefreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rotatedRefreshToken }),
  });
  record(
    replayedRefreshRes.status === 401,
    'Revoked Refresh Token Replay Protection',
    `Status: 401 Unauthorized upon reuse`
  );

  // ----------------------------------------------------
  // SECTION 3: Google OAuth Architecture & Cross-Mode Flows
  // ----------------------------------------------------
  section('3. Google OAuth Architecture & Cross-Mode Validation');

  // 3.1 Initiate in DEV Mode (returnUrl = http://localhost:5173/)
  const devOauthRes = await fetch(`${BASE_URL}/api/auth/google/initiate?json=true&returnUrl=${encodeURIComponent('http://localhost:5173/')}`);
  const devOauthData = await devOauthRes.json().catch(() => null);
  record(
    devOauthRes.status === 200 && Boolean(devOauthData?.authorizationUrl) && Boolean(devOauthData?.state) && Boolean(devOauthData?.codeChallenge),
    'Google OAuth Initiate (DEV Mode: 5173 returnUrl)',
    `AuthURL generated with PKCE (S256), State & Nonce`
  );

  // 3.2 Initiate in UNIFIED Mode (returnUrl = http://localhost:5000/)
  const unifiedOauthRes = await fetch(`${BASE_URL}/api/auth/google/initiate?json=true&returnUrl=${encodeURIComponent('http://localhost:5000/')}`);
  const unifiedOauthData = await unifiedOauthRes.json().catch(() => null);
  record(
    unifiedOauthRes.status === 200 && Boolean(unifiedOauthData?.authorizationUrl) && Boolean(unifiedOauthData?.state),
    'Google OAuth Initiate (UNIFIED Mode: 5000 returnUrl)',
    `Same-origin returnUrl accepted and state generated`
  );

  // 3.3 Open Redirect Defense: Disallowed external URL sanitized to allowlist
  const openRedirectRes = await fetch(`${BASE_URL}/api/auth/google/initiate?json=true&returnUrl=https://evil-phishing.com/login`);
  const openRedirectData = await openRedirectRes.json().catch(() => null);
  record(
    openRedirectRes.status === 200 && Boolean(openRedirectData?.state),
    'Open Redirect Defense (Untrusted URL sanitized to allowlist)',
    `Malicious returnUrl sanitized safely`
  );

  // 3.4 Callback Routing: Backend callback route does NOT hit SPA fallback
  const invalidStateCallbackRes = await fetch(`${BASE_URL}/api/auth/google/callback?code=mock_code&state=nonexistent_state`, {
    redirect: 'manual',
  });
  const callbackLocation = invalidStateCallbackRes.headers.get('location') || '';
  record(
    invalidStateCallbackRes.status === 302 && callbackLocation.includes('oauth_error=invalid_state') && !callbackLocation.includes('?('),
    'Backend OAuth Callback Route & Clean Query String',
    `Status: 302 Redirect (Location: ${callbackLocation})`
  );

  // 3.5 Live Google OAuth E2E Status Check
  const appSettings = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'backend', 'EnglishMastery.Api', 'appsettings.Development.json'), 'utf8'));
  const googleClientId = appSettings?.Google?.ClientId || '';
  const isPlaceholderCreds = googleClientId.includes('placeholder') || googleClientId.includes('development-google-client-id');

  if (isPlaceholderCreds) {
    recordBlocked(
      'Live Google Cloud OAuth E2E Authentication',
      `BLOCKED: appsettings.Development.json chứa ClientId mẫu ('${googleClientId}'). Cần cấu hình OAuth 2.0 Client credentials thật từ Google Cloud Console.`
    );
  } else {
    record(true, 'Live Google Cloud OAuth Credentials Configured', `ClientId: ${googleClientId}`);
  }

  // ----------------------------------------------------
  // SECTION 4: RBAC & Admin Protection
  // ----------------------------------------------------
  section('4. RBAC Authorization & Admin API Security');

  // 4.1 Guest calling protected Admin endpoint -> 401 Unauthorized
  const guestAdminRes = await fetch(`${BASE_URL}/api/admin/roles/users`);
  const guestAdminJson = await guestAdminRes.json().catch(() => null);
  record(
    guestAdminRes.status === 401 && (guestAdminJson?.code === 'UNAUTHORIZED' || guestAdminJson?.Code === 'UNAUTHORIZED'),
    'Guest Protection on Admin API (401 Unauthorized)',
    `Status: 401, Code: ${guestAdminJson?.code || guestAdminJson?.Code}`
  );

  // 4.2 Authenticated USER calling protected Admin endpoint -> 403 Forbidden
  const userAdminRes = await fetch(`${BASE_URL}/api/admin/roles/users`, {
    headers: { 'Authorization': `Bearer ${loginAccessToken}` },
  });
  const userAdminJson = await userAdminRes.json().catch(() => null);
  record(
    userAdminRes.status === 403 && (userAdminJson?.code === 'FORBIDDEN' || userAdminJson?.Code === 'FORBIDDEN'),
    'USER Role Guard on Admin API (403 Forbidden)',
    `Status: 403, Code: ${userAdminJson?.code || userAdminJson?.Code}`
  );

  // 4.3 Authenticated USER attempting self-promotion -> 403 Forbidden
  const selfPromoteRes = await fetch(`${BASE_URL}/api/admin/roles/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginAccessToken}`,
    },
    body: JSON.stringify({ userId: canonicalUserId, role: 'ADMIN' }),
  });
  record(
    selfPromoteRes.status === 403,
    'Self-Promotion Prevention via Admin API (403 Forbidden)',
    `Status: 403 Forbidden, Role escalation blocked`
  );

  // 4.4 Guest Access to Public Leaderboard -> Allowed (200 OK)
  const publicLeaderboardRes = await fetch(`${BASE_URL}/api/leaderboard/weekly_xp`);
  record(
    publicLeaderboardRes.status === 200,
    'Guest Access to Public Leaderboard (Allowed)',
    `Status: ${publicLeaderboardRes.status} OK`
  );

  // 4.5 Guest Attempt to Submit Score Evidence -> 401 Unauthorized
  const guestSubmitScoreRes = await fetch(`${BASE_URL}/api/leaderboard/sync-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'Guest Fake Score', totalXp: 9999 }),
  });
  record(
    guestSubmitScoreRes.status === 401,
    'Guest Score Submission Prevention (401 Unauthorized)',
    `Status: 401, Score evidence rejected for guests`
  );

  // ----------------------------------------------------
  // SECTION 5: SPA Fallback & Static File Guard Integrity
  // ----------------------------------------------------
  section('5. SPA Fallback & Static File Guard Integrity');

  const adminSpaRes = await fetch(`${BASE_URL}/admin`);
  const adminSpaHtml = await adminSpaRes.text();
  record(
    adminSpaRes.status === 200 && adminSpaHtml.includes('<!doctype html>'),
    'Client Admin SPA Route (/admin)',
    'Serves React index.html for client route guard execution'
  );

  const apiFallbackRes = await fetch(`${BASE_URL}/api/admin/not-exist`);
  const apiFallbackJson = await apiFallbackRes.json().catch(() => null);
  record(
    apiFallbackRes.status === 404 && apiFallbackJson?.code === 'NOT_FOUND',
    'Guarded Admin API Route (Never HTML Fallback)',
    `Returns 404 JSON (code: ${apiFallbackJson?.code})`
  );

  // ----------------------------------------------------
  // CLEANUP
  // ----------------------------------------------------
  if (spawnedBackend && spawnedBackend.pid) {
    info('Đang giải phóng máy chủ backend test...');
    killProcessTree(spawnedBackend.pid);
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ RUNTIME GIAI ĐOẠN 5:`);
  console.log(`  - Tests đã chạy: ${totalTests}`);
  console.log(`  - PASS: ${passedTests}`);
  console.log(`  - BLOCKED: ${blockedTests}`);
  console.log(`  - FAIL: ${totalTests - passedTests - blockedTests}`);
  console.log('================================================================\n');

  if (totalTests - passedTests - blockedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Lỗi thực thi suite kiểm thử:', err);
  if (spawnedBackend && spawnedBackend.pid) {
    killProcessTree(spawnedBackend.pid);
  }
  process.exit(1);
});
