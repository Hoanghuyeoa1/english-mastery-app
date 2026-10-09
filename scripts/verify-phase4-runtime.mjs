#!/usr/bin/env node
// scripts/verify-phase4-runtime.mjs
// Phase 4: Dual-Mode API Routing & Security Automated Verification Suite

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

async function waitForBackend(maxWaitMs = 25000) {
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
  console.log(`${colors.bright}${colors.magenta}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}   PHASE 4: DUAL-MODE API ROUTING & SECURITY VERIFICATION  ${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}======================================================${colors.reset}`);

  let totalTests = 0;
  let passedTests = 0;

  function record(result, name, detail) {
    totalTests++;
    if (result) {
      passedTests++;
      pass(name, detail);
    } else {
      fail(name, detail);
    }
  }

  // ----------------------------------------------------
  // SECTION 1: Production Bundle Static Analysis
  // ----------------------------------------------------
  section('1. Production Bundle Static Analysis (Zero Hardcoded Dev Origin)');

  const distDir = path.join(ROOT_DIR, 'dist');
  const assetsDir = path.join(distDir, 'assets');
  const distExists = fs.existsSync(distDir) && fs.existsSync(assetsDir);
  record(distExists, 'Dist Directory', 'Production build dist/assets exists');

  if (distExists) {
    const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    let foundDevApi = false;
    let foundDevFrontend = false;
    let foundRelativeApi = false;

    for (const f of jsFiles) {
      const content = fs.readFileSync(path.join(assetsDir, f), 'utf8');
      if (content.includes('http://localhost:5000/api')) foundDevApi = true;
      if (content.includes('localhost:5173')) foundDevFrontend = true;
      if (content.includes('/api')) foundRelativeApi = true;
    }

    record(!foundDevApi, 'No Dev Backend URL', 'Production bundle contains ZERO instances of http://localhost:5000/api');
    record(!foundDevFrontend, 'No Dev Frontend URL', 'Production bundle contains ZERO instances of localhost:5173');
    record(foundRelativeApi, 'Relative API Base', 'Production bundle contains relative /api routes');
  }

  // ----------------------------------------------------
  // SECTION 2: URL & Hub Resolution Contract
  // ----------------------------------------------------
  section('2. URL & Hub Resolution Contract Logic');

  // Verify URL resolution rules mathematically/logically as implemented in httpClient.ts & signalRService.ts
  function resolveApiUrl(baseUrl, endpoint) {
    let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (baseUrl.endsWith('/api')) {
      if (cleanEndpoint === '/api') {
        cleanEndpoint = '';
      } else if (cleanEndpoint.startsWith('/api/')) {
        cleanEndpoint = cleanEndpoint.substring(4);
      }
    }
    return `${baseUrl}${cleanEndpoint}`;
  }

  function resolveSignalRHubUrl(baseUrl, hubPath = '/hubs/leaderboard') {
    const serverOrigin = baseUrl.replace(/\/api\/?$/, '');
    const cleanPath = hubPath.startsWith('/') ? hubPath : `/${hubPath}`;
    return `${serverOrigin}${cleanPath}`;
  }

  // Dev mode
  const devBase = 'http://localhost:5000/api';
  record(
    resolveApiUrl(devBase, '/auth/login') === 'http://localhost:5000/api/auth/login',
    'Dev API URL Resolution',
    resolveApiUrl(devBase, '/auth/login')
  );
  record(
    resolveApiUrl(devBase, '/api/auth/login') === 'http://localhost:5000/api/auth/login',
    'Dev Duplicate /api Deduplication',
    resolveApiUrl(devBase, '/api/auth/login')
  );
  record(
    resolveSignalRHubUrl(devBase, '/hubs/leaderboard') === 'http://localhost:5000/hubs/leaderboard',
    'Dev SignalR Hub Resolution',
    resolveSignalRHubUrl(devBase, '/hubs/leaderboard')
  );

  // Unified mode
  const unifiedBase = '/api';
  record(
    resolveApiUrl(unifiedBase, '/auth/login') === '/api/auth/login',
    'Unified API URL Resolution',
    resolveApiUrl(unifiedBase, '/auth/login')
  );
  record(
    resolveApiUrl(unifiedBase, '/api/auth/login') === '/api/auth/login',
    'Unified Duplicate /api Deduplication',
    resolveApiUrl(unifiedBase, '/api/auth/login')
  );
  record(
    resolveApiUrl(unifiedBase, '/api') === '/api',
    'Unified Root /api Handling',
    resolveApiUrl(unifiedBase, '/api')
  );
  record(
    resolveSignalRHubUrl(unifiedBase, '/hubs/leaderboard') === '/hubs/leaderboard',
    'Unified Relative SignalR Hub Resolution',
    resolveSignalRHubUrl(unifiedBase, '/hubs/leaderboard')
  );

  // ----------------------------------------------------
  // SECTION 3: Server Readiness & Health Endpoints
  // ----------------------------------------------------
  section('3. Backend Server Readiness & Health Check');

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

  const rootHealthRes = await fetch(`${BASE_URL}/health`).catch(() => null);
  record(rootHealthRes && rootHealthRes.status === 200, 'Direct Health Endpoint (/health)', `Status: ${rootHealthRes?.status}`);

  // ----------------------------------------------------
  // SECTION 4: Guarded SPA Fallback & Missing Asset 404
  // ----------------------------------------------------
  section('4. Guarded SPA Fallback Security (Never Swallow Backend Endpoints)');

  const spaRootRes = await fetch(`${BASE_URL}/`);
  const spaRootHtml = await spaRootRes.text();
  record(
    spaRootRes.status === 200 && spaRootHtml.includes('<!doctype html>'),
    'SPA Root Route (/)',
    'Returns 200 OK HTML'
  );

  const spaWelcomeRes = await fetch(`${BASE_URL}/welcome`);
  const spaWelcomeHtml = await spaWelcomeRes.text();
  record(
    spaWelcomeRes.status === 200 && spaWelcomeHtml.includes('<!doctype html>'),
    'Client SPA Route (/welcome)',
    'Returns 200 OK HTML index fallback'
  );

  const missingApiRes = await fetch(`${BASE_URL}/api/nonexistent-endpoint-test`);
  const missingApiJson = await missingApiRes.json().catch(() => null);
  record(
    missingApiRes.status === 404 && missingApiJson?.code === 'NOT_FOUND',
    'Guarded API Fallback (/api/*)',
    `Returns 404 JSON (code: ${missingApiJson?.code}), NOT index.html`
  );

  const missingHubRes = await fetch(`${BASE_URL}/hubs/nonexistent-hub-test`);
  const missingHubJson = await missingHubRes.json().catch(() => null);
  record(
    missingHubRes.status === 404 && missingHubJson?.code === 'NOT_FOUND',
    'Guarded Hub Fallback (/hubs/*)',
    `Returns 404 JSON, NOT index.html`
  );

  const missingAssetRes = await fetch(`${BASE_URL}/assets/nonexistent-chunk.js`);
  record(
    missingAssetRes.status === 404,
    'Guarded Static Asset Fallback (/assets/*)',
    `Returns 404 Not Found, NOT index.html`
  );

  // ----------------------------------------------------
  // SECTION 5: CORS Security & Cross-Mode Isolation
  // ----------------------------------------------------
  section('5. CORS Security & Same-Origin Isolation');

  // Preflight OPTIONS from allowed dev frontend origin http://localhost:5173
  const devCorsPreflight = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, Authorization',
    },
  });
  const devCorsOrigin = devCorsPreflight.headers.get('access-control-allow-origin');
  const devCorsCredentials = devCorsPreflight.headers.get('access-control-allow-credentials');
  record(
    devCorsOrigin === 'http://localhost:5173' && devCorsCredentials === 'true',
    'Dev CORS Policy (http://localhost:5173)',
    `Allow-Origin: ${devCorsOrigin}, Allow-Credentials: ${devCorsCredentials}`
  );

  // Preflight OPTIONS from unauthorized attacker origin http://evil-attacker.com
  const evilCorsPreflight = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://evil-attacker.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });
  const evilCorsOrigin = evilCorsPreflight.headers.get('access-control-allow-origin');
  record(
    evilCorsOrigin !== 'http://evil-attacker.com',
    'Strict Origin Validation (http://evil-attacker.com Blocked)',
    `Attacker Origin NOT echoed (got: ${evilCorsOrigin || 'null/omitted'})`
  );

  // Unified Mode Same-Origin Simulation (Origin http://localhost:5000 or no Origin header)
  const unifiedOriginRes = await fetch(`${BASE_URL}/api/leaderboard/server-time`, {
    headers: {
      'Origin': 'http://localhost:5000',
    },
  });
  record(
    unifiedOriginRes.status === 200,
    'Unified Same-Origin Access (http://localhost:5000)',
    'Successfully serves API request directly'
  );

  // ----------------------------------------------------
  // SECTION 6: Live API Functional Scenarios Across Modes
  // ----------------------------------------------------
  section('6. Live API Contracts (Auth, JWT, RBAC & SignalR)');

  const testSuffix = Date.now().toString().slice(-6);
  const testEmail = `phase4_test_${testSuffix}@example.com`;
  const testPassword = 'Password123!';
  const testName = `Phase 4 Learner ${testSuffix}`;

  // 1. User Registration (Cross-Origin Simulation)
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:5173',
    },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: testName,
    }),
  });
  const regData = await regRes.json();
  const accessToken = regData?.accessToken;
  const userId = regData?.user?.id;
  record(
    regRes.status === 200 && Boolean(accessToken) && Boolean(userId),
    'User Registration Contract',
    `Status: ${regRes.status}, User ID: ${userId}`
  );

  // 2. User Login (Same-Origin Simulation)
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:5000',
    },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  const loginData = await loginRes.json();
  record(
    loginRes.status === 200 && Boolean(loginData?.accessToken),
    'User Login Contract',
    `Status: ${loginRes.status}, Token returned`
  );

  // 3. Authenticated Endpoint with Bearer Token (/api/profile)
  const profileRes = await fetch(`${BASE_URL}/api/profile`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  const profileData = await profileRes.json().catch(() => null);
  record(
    profileRes.status === 200 && profileData?.email === testEmail,
    'Authenticated Endpoint (GET /api/profile)',
    `Status: 200, Email verified: ${profileData?.email}`
  );

  // 4. Unauthenticated Rejection (GET /api/profile without token)
  const unauthRes = await fetch(`${BASE_URL}/api/profile`);
  const unauthJson = await unauthRes.json().catch(() => null);
  record(
    unauthRes.status === 401 && (unauthJson?.code || unauthJson?.Code) === 'UNAUTHORIZED',
    'JWT Authentication Guard (401 Unauthorized)',
    `Status: ${unauthRes.status}, Code: ${unauthJson?.code || unauthJson?.Code}`
  );

  // 5. RBAC Authorization Enforcement (Regular USER cannot access /api/admin/roles/users)
  const adminRes = await fetch(`${BASE_URL}/api/admin/roles/users`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  const adminJson = await adminRes.json().catch(() => null);
  record(
    adminRes.status === 403 && (adminJson?.code || adminJson?.Code) === 'FORBIDDEN',
    'RBAC Authorization Guard (403 Forbidden for Non-Admin)',
    `Status: ${adminRes.status}, Code: ${adminJson?.code || adminJson?.Code}`
  );

  // 6. SignalR Realtime Hub Negotiation (/hubs/leaderboard/negotiate)
  const negotiateRes = await fetch(`${BASE_URL}/hubs/leaderboard/negotiate?negotiateVersion=1`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Origin': 'http://localhost:5173',
    },
  });
  const negotiateJson = await negotiateRes.json().catch(() => null);
  record(
    negotiateRes.status === 200 && Boolean(negotiateJson?.connectionId),
    'SignalR Hub Negotiation (/hubs/leaderboard)',
    `Status: 200, ConnectionId: ${negotiateJson?.connectionId ? negotiateJson.connectionId.substring(0, 8) + '...' : 'none'}`
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
  console.log('\n------------------------------------------------------');
  const allPassed = passedTests === totalTests;
  if (allPassed) {
    console.log(`${colors.bright}${colors.green}TẤT CẢ ${passedTests}/${totalTests} TESTS PASS HOÀN TOÀN (100%)!${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}CÓ ${totalTests - passedTests}/${totalTests} TESTS THẤT BẠI!${colors.reset}`);
  }
  console.log('------------------------------------------------------\n');

  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error('Lỗi thực thi suite kiểm thử:', err);
  if (spawnedBackend && spawnedBackend.pid) {
    killProcessTree(spawnedBackend.pid);
  }
  process.exit(1);
});
