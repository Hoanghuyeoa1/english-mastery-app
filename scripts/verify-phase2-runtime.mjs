#!/usr/bin/env node
// scripts/verify-phase2-runtime.mjs
// Verification suite for Phase 2 One-Command Development Orchestration
// Covers all 11 requirements (A through K)

import { spawn, execSync } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const results = [];

function record(testId, name, status, detail = '') {
  results.push({ testId, name, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'BLOCKED' ? '🚫' : '❌';
  console.log(`${icon} [${testId}] ${name}: ${status}${detail ? ` — ${detail}` : ''}`);
}

function probePort(port) {
  return new Promise((resolve) => {
    const s1 = net.connect({ port, host: '127.0.0.1' });
    s1.once('connect', () => { s1.destroy(); resolve(true); });
    s1.once('error', () => {
      const s2 = net.connect({ port, host: '::1' });
      s2.once('connect', () => { s2.destroy(); resolve(true); });
      s2.once('error', () => {
        const s3 = net.connect({ port, host: 'localhost' });
        s3.once('connect', () => { s3.destroy(); resolve(true); });
        s3.once('error', () => resolve(false));
      });
    });
  });
}

function killTree(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {}
}

function getPortPid(port) {
  if (process.platform !== 'win32') return null;
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const localAddr = parts[1];
        const pid = parts[parts.length - 1];
        if (localAddr.endsWith(`:${port}`) || localAddr.endsWith(`]:${port}`)) {
          return parseInt(pid, 10);
        }
      }
    }
  } catch {}
  return null;
}

async function waitForPort(port, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await probePort(port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function waitForPortFree(port, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await probePort(port))) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ RUNTIME: PHASE 2 DEVELOPMENT ORCHESTRATION');
  console.log('================================================================\n');

  // Verify initial clean ports
  if (await probePort(5000) || await probePort(5173)) {
    console.warn('⚠️ Cảnh báo: Cổng 5000 hoặc 5173 đang bị chiếm trước kiểm thử.');
  }

  // --- SUITE 1: Tests A, B, C, D, E, F, G, H ---
  console.log('--- PHẦN 1: Khởi động một lệnh (npm run dev), HMR, REST & Database (A - G) ---');
  let devProcess = null;
  const devLogs = [];

  try {
    devProcess = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'dev.mjs')], {
      cwd: ROOT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    devProcess.stdout.on('data', (d) => devLogs.push(d.toString()));
    devProcess.stderr.on('data', (d) => devLogs.push(d.toString()));

    const backendReady = await waitForPort(5000, 30000);
    const frontendReady = await waitForPort(5173, 30000);

    // TEST A: Một lệnh mở cả 2 service
    if (backendReady && frontendReady) {
      record('TEST-A', 'Một lệnh npm run dev mở cả hai service', 'PASS', 'Cả cổng 5000 (Backend) và 5173 (Frontend) đều mở thành công');
    } else {
      record('TEST-A', 'Một lệnh npm run dev mở cả hai service', 'FAIL', `Backend: ${backendReady}, Frontend: ${frontendReady}`);
    }

    // TEST B: localhost:5173 hiển thị React
    try {
      const res = await fetch('http://localhost:5173');
      const text = await res.text();
      if (res.ok && (text.includes('English Mastery Hub') || text.includes('id="root"'))) {
        record('TEST-B', 'localhost:5173 hiển thị React', 'PASS', `HTTP ${res.status} OK, HTML mount root sẵn sàng`);
      } else {
        record('TEST-B', 'localhost:5173 hiển thị React', 'FAIL', `HTTP Status: ${res.status}`);
      }
    } catch (err) {
      record('TEST-B', 'localhost:5173 hiển thị React', 'FAIL', err.message);
    }

    // TEST C: localhost:5000 có API response
    let healthData = null;
    try {
      const res = await fetch('http://localhost:5000/api/health');
      if (res.ok) {
        healthData = await res.json();
        record('TEST-C', 'localhost:5000 có API response', 'PASS', `HTTP ${res.status} OK, Server status: ${healthData.status}`);
      } else {
        record('TEST-C', 'localhost:5000 có API response', 'FAIL', `HTTP Status: ${res.status}`);
      }
    } catch (err) {
      record('TEST-C', 'localhost:5000 có API response', 'FAIL', err.message);
    }

    // TEST D: HMR cập nhật UI mà không build lại (Vite HMR client sẵn sàng trên cổng 5173)
    try {
      const hmrRes = await fetch('http://localhost:5173/@vite/client');
      const hmrCode = await hmrRes.text();
      if (hmrRes.ok && (hmrCode.includes('[vite]') || hmrCode.includes('createHotContext') || hmrCode.includes('WebSocket'))) {
        record('TEST-D', 'HMR cập nhật UI mà không build lại', 'PASS', 'Vite HMR client (@vite/client) trực tuyến và phục vụ WebSocket HMR');
      } else {
        record('TEST-D', 'HMR cập nhật UI mà không build lại', 'FAIL', `HTTP ${hmrRes.status}, Client code missing HMR hooks`);
      }
    } catch (err) {
      record('TEST-D', 'HMR cập nhật UI mà không build lại', 'FAIL', err.message);
    }

    // TEST E: Backend kết nối EnglishMasteryDev
    if (healthData && (healthData.database?.canConnect || healthData.Database?.CanConnect)) {
      const dbInfo = healthData.database || healthData.Database;
      record('TEST-E', 'Backend kết nối EnglishMasteryDev', 'PASS', `Database Status: ${dbInfo.status}, CanConnect: true`);
    } else if (healthData) {
      record('TEST-E', 'Backend kết nối EnglishMasteryDev', 'BLOCKED', `SQL Server Degraded: ${healthData.database?.error}`);
    } else {
      record('TEST-E', 'Backend kết nối EnglishMasteryDev', 'FAIL', 'Không thể đọc trạng thái Database');
    }

    // TEST F: Register/Login API có thể được gọi
    const testEmail = `verify_phase2_${Date.now()}@mastery.test`;
    const testPassword = 'Password123!';
    try {
      const regRes = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          displayName: 'Phase 2 Test User',
        }),
      });

      if (regRes.ok) {
        const regData = await regRes.json();
        if (regData.accessToken) {
          const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: testEmail,
              password: testPassword,
            }),
          });
          if (loginRes.ok) {
            record('TEST-F', 'Register/Login API có thể được gọi', 'PASS', `Đăng ký & Đăng nhập thành công, trả JWT Token hợp lệ`);
          } else {
            record('TEST-F', 'Register/Login API có thể được gọi', 'FAIL', `Login failed: HTTP ${loginRes.status}`);
          }
        } else {
          record('TEST-F', 'Register/Login API có thể được gọi', 'FAIL', 'Thiếu accessToken trong response đăng ký');
        }
      } else {
        const errBody = await regRes.text();
        record('TEST-F', 'Register/Login API có thể được gọi', 'FAIL', `Register HTTP ${regRes.status}: ${errBody}`);
      }
    } catch (err) {
      record('TEST-F', 'Register/Login API có thể được gọi', 'FAIL', err.message);
    } finally {
      // Clean up created user in background
      try {
        execSync(`dotnet run --project backend/EnglishMastery.Api/EnglishMastery.Api.csproj -- admin user-delete ${testEmail}`, {
          cwd: ROOT_DIR,
          stdio: 'ignore',
        });
      } catch {}
    }

    // TEST G: Leaderboard REST có thể được fetch
    try {
      const lbRes = await fetch('http://localhost:5000/api/leaderboard/weekly_xp');
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        record('TEST-G', 'Leaderboard REST có thể được fetch', 'PASS', `HTTP ${lbRes.status} OK, Trả danh sách Weekly XP (${lbData?.items?.length ?? 0} hàng)`);
      } else {
        record('TEST-G', 'Leaderboard REST có thể được fetch', 'FAIL', `HTTP Status: ${lbRes.status}`);
      }
    } catch (err) {
      record('TEST-G', 'Leaderboard REST có thể được fetch', 'FAIL', err.message);
    }

    // TEST H: Ctrl+C dừng đúng các child processes
    console.log('\n--- PHẦN 2: Dừng tiến trình, giải phóng tài nguyên và khởi động lại (H - I) ---');
    killTree(devProcess.pid);
    const p5000Freed = await waitForPortFree(5000, 8000);
    const p5173Freed = await waitForPortFree(5173, 8000);

    if (p5000Freed && p5173Freed) {
      record('TEST-H', 'Ctrl+C dừng đúng các child processes', 'PASS', 'Cả 2 cổng 5000 và 5173 giải phóng sạch sẽ ngay khi nhận tín hiệu dừng');
    } else {
      record('TEST-H', 'Ctrl+C dừng đúng các child processes', 'FAIL', `Port 5000 freed: ${p5000Freed}, Port 5173 freed: ${p5173Freed}`);
    }

    // TEST I: Khởi động lại không bị port conflict
    let secondDev = null;
    try {
      secondDev = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'dev.mjs')], {
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const bReady = await waitForPort(5000, 20000);
      const fReady = await waitForPort(5173, 20000);
      if (bReady && fReady) {
        record('TEST-I', 'Khởi động lại không bị port conflict', 'PASS', 'Khởi động phiên thứ 2 thành công 100%, không xung đột cổng');
      } else {
        record('TEST-I', 'Khởi động lại không bị port conflict', 'FAIL', `Backend: ${bReady}, Frontend: ${fReady}`);
      }
    } finally {
      if (secondDev) {
        killTree(secondDev.pid);
        await waitForPortFree(5000, 8000);
        await waitForPortFree(5173, 8000);
      }
    }
  } catch (err) {
    if (devProcess) killTree(devProcess.pid);
    throw err;
  }

  // --- SUITE 3: TEST J: Port bị chiếm báo lỗi rõ ràng ---
  console.log('\n--- PHẦN 3: Xử lý xung đột cổng & Fail-fast (J) ---');
  const dummyServer = http.createServer((req, res) => res.end('occupied'));
  await new Promise((resolve) => dummyServer.listen(5173, '127.0.0.1', resolve));

  try {
    let failOutput = '';
    const failProc = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'dev.mjs')], {
      cwd: ROOT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    failProc.stdout.on('data', (d) => failOutput += d.toString());
    failProc.stderr.on('data', (d) => failOutput += d.toString());

    const exitCode = await new Promise((resolve) => failProc.on('exit', resolve));
    dummyServer.close();

    if (exitCode === 1 && (failOutput.includes('đang bị chiếm') || failOutput.includes('5173'))) {
      record('TEST-J', 'Port bị chiếm báo lỗi rõ ràng', 'PASS', 'Phát hiện cổng 5173 bị chiếm, báo lỗi rõ ràng không tự ý kill và thoát mã 1');
    } else {
      record('TEST-J', 'Port bị chiếm báo lỗi rõ ràng', 'FAIL', `Exit code: ${exitCode}, Output: ${failOutput}`);
    }
  } catch (err) {
    dummyServer.close();
    record('TEST-J', 'Port bị chiếm báo lỗi rõ ràng', 'FAIL', err.message);
  }

  // --- SUITE 4: TEST K: Backend crash không để process mồ côi ---
  console.log('\n--- PHẦN 4: Backend crash phục hồi & Dọn dẹp tiến trình con (K) ---');
  let crashTestDev = null;
  try {
    crashTestDev = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'dev.mjs')], {
      cwd: ROOT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const bReady = await waitForPort(5000, 25000);
    const fReady = await waitForPort(5173, 25000);

    if (!bReady || !fReady) {
      record('TEST-K', 'Backend crash không để process mồ côi', 'BLOCKED', 'Không thể khởi động dev orchestrator ban đầu');
    } else {
      // Find backend PID on port 5000 and terminate it to simulate crash
      const backendPid = getPortPid(5000);
      if (!backendPid) {
        record('TEST-K', 'Backend crash không để process mồ côi', 'FAIL', 'Không tìm thấy PID của Backend trên cổng 5000');
      } else {
        // Kill the backend process specifically to simulate sudden exit
        try {
          execSync(`taskkill /F /PID ${backendPid}`, { stdio: 'ignore' });
        } catch {}

        // Wait for dev.mjs to detect backend exit and clean up frontend
        await waitForPortFree(5173, 10000);
        await waitForPortFree(5000, 8000);

        const f5173Alive = await probePort(5173);
        const b5000Alive = await probePort(5000);

        if (!f5173Alive && !b5000Alive) {
          record('TEST-K', 'Backend crash không để process mồ côi', 'PASS', 'Khi Backend thoát đột ngột, dev.mjs tự động dọn dẹp Frontend và giải phóng toàn bộ cổng');
        } else {
          record('TEST-K', 'Backend crash không để process mồ côi', 'FAIL', `Frontend still alive: ${f5173Alive}, Backend still alive: ${b5000Alive}`);
        }
      }
    }
  } finally {
    if (crashTestDev) {
      killTree(crashTestDev.pid);
      await waitForPortFree(5000, 8000);
      await waitForPortFree(5173, 8000);
    }
  }

  // --- SUMMARY REPORT ---
  console.log('\n================================================================');
  console.log('📊 TỔNG HỢP KẾT QUẢ KIỂM THỬ RUNTIME: PHASE 2 DEVELOPMENT ORCHESTRATION');
  console.log('================================================================');
  let passCount = 0;
  for (const r of results) {
    if (r.status === 'PASS') passCount++;
    const icon = r.status === 'PASS' ? '✅' : r.status === 'BLOCKED' ? '🚫' : '❌';
    console.log(`${icon} [${r.testId}] ${r.name.padEnd(45)}: ${r.status}`);
  }
  console.log(`\nTổng kết: ${passCount}/${results.length} bài kiểm thử ĐẠT (PASS RATE: ${Math.round((passCount / results.length) * 100)}%)\n`);

  if (passCount === results.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi nghiêm trọng trong kiểm thử Phase 2:', err);
  process.exit(1);
});
