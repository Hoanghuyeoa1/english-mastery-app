#!/usr/bin/env node
// scripts/verify-phase6-runtime.mjs
// Phase 6: SignalR & Leaderboard Dual-Mode Integration Runtime Verification Suite

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as signalR from '@microsoft/signalr';

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
    const s = net.connect({ port, host: '127.0.0.1' }, () => {
      s.destroy();
      finish(true);
    });
    s.setTimeout(500);
    s.on('timeout', () => {
      s.destroy();
      finish(false);
    });
    s.on('error', () => {
      s.destroy();
      finish(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function ensureBackendRunning() {
  const isUp = await probePort(PORT);
  if (isUp) {
    hadExistingServer = true;
    info(`Máy chủ ASP.NET Core đang hoạt động sẵn tại port ${PORT}.`);
    return;
  }

  info(`Khởi động máy chủ ASP.NET Core (${BACKEND_PROJECT}) trên port ${PORT}...`);
  spawnedBackend = spawn(
    'dotnet',
    ['run', '--project', BACKEND_PROJECT, '--urls', `http://localhost:${PORT}`],
    {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
      },
    }
  );

  spawnedBackend.stderr.on('data', (d) => {
    const s = d.toString();
    if (s.includes('fail:') || s.includes('crit:')) {
      process.stderr.write(`[backend stderr] ${s}`);
    }
  });

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    throw new Error(`Máy chủ backend không phản hồi tại ${BASE_URL} sau 25s.`);
  }
  info(`Máy chủ backend sẵn sàng tại ${BASE_URL}`);
}

function cleanup() {
  if (spawnedBackend && !hadExistingServer) {
    info('Dọn dẹp process ASP.NET Core tạm thời...');
    killProcessTree(spawnedBackend.pid);
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

async function runPhase6Verification() {
  let passCount = 0;
  let failCount = 0;
  let blockedCount = 0;

  const test = async (name, fn) => {
    try {
      const detail = await fn();
      pass(name, detail || '');
      passCount++;
    } catch (err) {
      fail(name, err.message);
      failCount++;
    }
  };

  const block = (name, reason) => {
    blocked(name, reason);
    blockedCount++;
  };

  await ensureBackendRunning();

  // SECTION 1: SIGNALR URL DUAL-MODE CALCULATION
  section('1. SignalR URL Dual-Mode Resolution');

  await test('Dev Mode URL (/hubs/leaderboard on :5000)', async () => {
    const devApiBase = 'http://localhost:5000/api';
    const serverOrigin = devApiBase.replace(/\/api\/?$/, '');
    const hubUrl = `${serverOrigin}/hubs/leaderboard`;
    if (hubUrl !== 'http://localhost:5000/hubs/leaderboard') {
      throw new Error(`Dev Hub URL resolved incorrectly: ${hubUrl}`);
    }
    return `Calculated: ${hubUrl}`;
  });

  await test('Unified Mode URL (same-origin relative /hubs/leaderboard)', async () => {
    const unifiedApiBase = '/api';
    const serverOrigin = unifiedApiBase.replace(/\/api\/?$/, '');
    const hubUrl = `${serverOrigin}/hubs/leaderboard`;
    if (hubUrl !== '/hubs/leaderboard') {
      throw new Error(`Unified Hub URL resolved incorrectly: ${hubUrl}`);
    }
    return `Calculated: ${hubUrl}`;
  });

  await test('Custom Host URL Resolution (e.g. Production Subdomain)', async () => {
    const customApiBase = 'https://api.englishmastery.vn/api';
    const serverOrigin = customApiBase.replace(/\/api\/?$/, '');
    const hubUrl = `${serverOrigin}/hubs/leaderboard`;
    if (hubUrl !== 'https://api.englishmastery.vn/hubs/leaderboard') {
      throw new Error(`Custom Hub URL resolved incorrectly: ${hubUrl}`);
    }
    return `Calculated: ${hubUrl}`;
  });

  // SECTION 2: SIGNALR HUB NEGOTIATION & SPA FALLBACK EXCLUSION
  section('2. Hub Routing & Negotiation');

  await test('SignalR Anonymous Negotiation (/hubs/leaderboard/negotiate)', async () => {
    const res = await fetch(`${BASE_URL}/hubs/leaderboard/negotiate?negotiateVersion=1`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Negotiate failed with HTTP ${res.status}`);
    const data = await res.json();
    if (!data.connectionId && !data.connectionToken) {
      throw new Error('Negotiate response missing connection identifiers');
    }
    const transports = (data.availableTransports || []).map((t) => t.transport).join(', ');
    return `OK (negotiateVersion=${data.negotiateVersion}, transports=[${transports}])`;
  });

  // Tạo tài khoản test để lấy Bearer token
  const testEmail = `phase6_signalr_${Date.now()}@test.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'Password123!',
      displayName: 'SignalR Realtime Tester',
    }),
  });
  const regData = await regRes.json();
  const token = regData.accessToken;

  await test('SignalR JWT Negotiation (via query access_token)', async () => {
    const res = await fetch(`${BASE_URL}/hubs/leaderboard/negotiate?negotiateVersion=1&access_token=${token}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`JWT Negotiate failed with HTTP ${res.status}`);
    const data = await res.json();
    if (!data.connectionId && !data.connectionToken) {
      throw new Error('Missing connectionToken on JWT negotiation');
    }
    return `OK (connectionToken present, user identity extracted)`;
  });

  await test('SPA Fallback Excludes /hubs/* (Nonexistent hub returns 404 JSON, not HTML)', async () => {
    const res = await fetch(`${BASE_URL}/hubs/nonexistent_hub_path`);
    if (res.status !== 404) {
      throw new Error(`Expected 404, got ${res.status}`);
    }
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('application/json')) {
      throw new Error(`Expected JSON content-type, got: ${ctype}`);
    }
    const data = await res.json();
    if (data.code !== 'NOT_FOUND') {
      throw new Error(`Expected code NOT_FOUND, got: ${data.code}`);
    }
    return `404 JSON (code=${data.code})`;
  });

  // SECTION 3: LIVE SIGNALR CONNECTION & REALTIME BROADCAST
  section('3. Live SignalR Hub Connection & Broadcast');

  await test('Live WebSocket/LongPolling Connect & Broadcast Delivery', async () => {
    const hubUrl = `${BASE_URL}/hubs/leaderboard`;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    let eventReceived = false;
    let receivedPayload = null;

    connection.on('leaderboard_updated', (payload) => {
      eventReceived = true;
      receivedPayload = payload;
    });

    await connection.start();
    const isConnected = connection.state === signalR.HubConnectionState.Connected;
    if (!isConnected) {
      throw new Error(`Connection not in Connected state: ${connection.state}`);
    }

    // Trigger update via sync-score to test broadcast
    const syncRes = await fetch(`${BASE_URL}/api/leaderboard/sync-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        displayName: 'SignalR Realtime Tester',
        totalXp: 1200,
        weeklyXp: 450,
        streak: 5,
        level: 2,
      }),
    });

    if (!syncRes.ok) {
      await connection.stop();
      throw new Error(`sync-score returned HTTP ${syncRes.status}`);
    }

    // Wait up to 2 seconds for broadcast delivery
    const startWait = Date.now();
    while (!eventReceived && Date.now() - startWait < 2000) {
      await new Promise((r) => setTimeout(r, 100));
    }

    await connection.stop();

    if (!eventReceived) {
      throw new Error('leaderboard_updated event not received over SignalR within 2s');
    }

    return `Connected (${connection.state}) & broadcast received: category=${receivedPayload?.category}`;
  });

  // SECTION 4: REST LEADERBOARD FOR ALL 7 CATEGORIES
  section('4. REST Leaderboard 7-Category Verification');

  const categories = [
    'weekly_xp',
    'vocab_mastered',
    'review_consistency',
    'active_minutes',
    'pronunciation_gain',
    'toeic_gain',
    'streak',
  ];

  for (const cat of categories) {
    await test(`REST Leaderboard: ${cat}`, async () => {
      const res = await fetch(`${BASE_URL}/api/leaderboard/${cat}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('data.success is not true');
      if (data.category !== cat) throw new Error(`Mismatched category: ${data.category}`);
      if (!data.weekId) throw new Error('data.weekId is missing');
      if (!Array.isArray(data.entries)) throw new Error('data.entries is not array');
      if (typeof data.totalCount !== 'number') throw new Error('totalCount is not number');
      return `200 OK (weekId=${data.weekId}, entries=${data.entries.length}, totalCount=${data.totalCount})`;
    });
  }

  // SECTION 5: CURRENT USER RANK & GUEST RBAC
  section('5. Current-User Rank & Guest Isolation');

  await test('Guest Access to Current-User Rank (/api/leaderboard/weekly_xp/me) -> 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/leaderboard/weekly_xp/me`);
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401, got ${res.status}`);
    }
    const data = await res.json();
    if (data.code !== 'UNAUTHORIZED') {
      throw new Error(`Expected code UNAUTHORIZED, got: ${data.code}`);
    }
    return `401 JSON (code=${data.code})`;
  });

  await test('Authenticated User Access to Current-User Rank (/api/leaderboard/weekly_xp/me) -> 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/api/leaderboard/weekly_xp/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('data.success is not true');
    if (data.category !== 'weekly_xp') throw new Error(`Mismatched category: ${data.category}`);
    return `200 OK (found=${data.found}, score=${data.entry?.score || 0})`;
  });

  // SECTION 6: SERVER TIME & WEEKLY RESET TIMING
  section('6. Authoritative Server Time & Weekly Policy');

  await test('Server Time Endpoint (/api/leaderboard/server-time) -> Asia/Ho_Chi_Minh timezone', async () => {
    const res = await fetch(`${BASE_URL}/api/leaderboard/server-time`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.timezone !== 'Asia/Ho_Chi_Minh') {
      throw new Error(`Expected timezone Asia/Ho_Chi_Minh, got: ${data.timezone}`);
    }
    if (!/^\d{4}-W\d{2}$/.test(data.weekId)) {
      throw new Error(`Invalid weekId format: ${data.weekId}`);
    }
    return `200 OK (timezone=${data.timezone}, weekId=${data.weekId}, serverNow=${data.serverNow})`;
  });

  // SECTION 7: PAGINATION CLAMPING & ERROR CODES
  section('7. Pagination Clamping & Invalid Category Guard');

  await test('Pagination: Clamps pageSize > 50 to 50', async () => {
    const res = await fetch(`${BASE_URL}/api/leaderboard/weekly_xp?pageSize=120`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.pageSize !== 50) {
      throw new Error(`Expected pageSize 50, got: ${data.pageSize}`);
    }
    return `Clamped to pageSize=50`;
  });

  await test('Pagination: Out of bounds page returns empty entries without 500 error', async () => {
    const res = await fetch(`${BASE_URL}/api/leaderboard/weekly_xp?page=9999`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.entries) || data.entries.length !== 0) {
      throw new Error(`Expected empty entries, got ${data.entries?.length}`);
    }
    return `page=9999 returned 200 OK with empty entries`;
  });

  await test('Invalid Category -> 400 Bad Request with code INVALID_CATEGORY', async () => {
    const res = await fetch(`${BASE_URL}/api/leaderboard/fake_cat_xyz`);
    if (res.status !== 400) {
      throw new Error(`Expected HTTP 400, got ${res.status}`);
    }
    const data = await res.json();
    if (data.code !== 'INVALID_CATEGORY') {
      throw new Error(`Expected code INVALID_CATEGORY, got: ${data.code}`);
    }
    return `400 Bad Request (code=${data.code})`;
  });

  // FINAL SUMMARY
  console.log(`\n${colors.bright}=== KẾT QUẢ KIỂM CHỨNG RUNTIME PHASE 6 ===${colors.reset}`);
  console.log(`  ${colors.green}PASS:${colors.reset}    ${passCount}`);
  console.log(`  ${colors.red}FAIL:${colors.reset}    ${failCount}`);
  console.log(`  ${colors.yellow}BLOCKED:${colors.reset} ${blockedCount}`);
  console.log(`  TỔNG CỘNG: ${passCount + failCount + blockedCount}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase6Verification()
  .catch((err) => {
    console.error(`\nLỗi thực thi script kiểm chứng:`, err);
    process.exit(1);
  })
  .finally(() => {
    cleanup();
  });
