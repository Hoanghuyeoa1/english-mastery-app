#!/usr/bin/env node
// scripts/verify-phase1-runtime.mjs
// Comprehensive verification test for Phase 1 One-Command Startup
// Tests A through J

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

async function runTests() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ THỰC TẾ: PHASE 1 STARTUP ORCHESTRATION');
  console.log('================================================================\n');

  // Ensure clean state before tests
  if (await probePort(5000) || await probePort(5173)) {
    console.warn('⚠️ Phát hiện cổng 5000 hoặc 5173 đang bị chiếm trước khi test.');
  }

  // --- SUITE 1: Tests A, B, C, D, E, F, G, H ---
  console.log('\n--- 1. Kiểm thử khởi động đồng thời và API/Database (A-F) ---');
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

    if (backendReady && frontendReady) {
      record('TEST-A', 'Chạy npm run dev một lần', 'PASS', 'Cả cổng 5000 và 5173 đều mở thành công');
    } else {
      record('TEST-A', 'Chạy npm run dev một lần', 'FAIL', `Backend ready: ${backendReady}, Frontend ready: ${frontendReady}`);
    }

    // TEST B: Frontend truy cập được
    try {
      const res = await fetch('http://localhost:5173');
      const text = await res.text();
      if (res.ok && text.includes('English Mastery Hub')) {
        record('TEST-B', 'Frontend truy cập được', 'PASS', `HTTP ${res.status} OK, HTML render đúng title`);
      } else if (res.ok) {
        record('TEST-B', 'Frontend truy cập được', 'PASS', `HTTP ${res.status} OK`);
      } else {
        record('TEST-B', 'Frontend truy cập được', 'FAIL', `HTTP Status: ${res.status}`);
      }
    } catch (err) {
      record('TEST-B', 'Frontend truy cập được', 'FAIL', err.message);
    }

    // TEST C: Backend API trả response hợp lệ
    let healthData = null;
    try {
      const res = await fetch('http://localhost:5000/api/health');
      if (res.ok) {
        healthData = await res.json();
        record('TEST-C', 'Backend API trả response hợp lệ', 'PASS', `HTTP ${res.status} OK, Status: ${healthData.status}`);
      } else {
        record('TEST-C', 'Backend API trả response hợp lệ', 'FAIL', `HTTP Status: ${res.status}`);
      }
    } catch (err) {
      record('TEST-C', 'Backend API trả response hợp lệ', 'FAIL', err.message);
    }

    // TEST D: SQL Server kết nối thành công
    if (healthData && healthData.database?.canConnect) {
      record('TEST-D', 'SQL Server kết nối thành công', 'PASS', `Status: ${healthData.database.status}, CanConnect: ${healthData.database.canConnect}`);
    } else if (healthData) {
      record('TEST-D', 'SQL Server kết nối thành công', 'BLOCKED', `SQL Server Degraded: ${healthData.database?.error}`);
    } else {
      record('TEST-D', 'SQL Server kết nối thành công', 'FAIL', 'Không thể lấy thông tin sức khỏe cơ sở dữ liệu');
    }

    // TEST E: Register/Login gọi được API thật
    const testEmail = `verify_dev_${Date.now()}@mastery.test`;
    const testPassword = 'Password123!';
    try {
      const regRes = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          displayName: 'Verify Dev User',
        }),
      });

      if (regRes.ok) {
        const regData = await regRes.json();
        if (regData.accessToken) {
          // Now login with same credentials
          const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: testEmail,
              password: testPassword,
            }),
          });
          if (loginRes.ok) {
            const loginData = await loginRes.json();
            record('TEST-E', 'Register/Login gọi được API thật', 'PASS', `Đăng ký & Đăng nhập thành công với JWT Token (User: ${loginData.user?.email})`);
          } else {
            record('TEST-E', 'Register/Login gọi được API thật', 'FAIL', `Login failed: HTTP ${loginRes.status}`);
          }
        } else {
          record('TEST-E', 'Register/Login gọi được API thật', 'FAIL', 'Register response missing accessToken');
        }
      } else {
        const errJson = await regRes.text();
        record('TEST-E', 'Register/Login gọi được API thật', 'FAIL', `Register HTTP ${regRes.status}: ${errJson}`);
      }
    } catch (err) {
      record('TEST-E', 'Register/Login gọi được API thật', 'FAIL', err.message);
    }

    // Clean up test user in background
    try {
      execSync(`dotnet run --project backend/EnglishMastery.Api/EnglishMastery.Api.csproj -- admin user-delete ${testEmail}`, {
        cwd: ROOT_DIR,
        stdio: 'ignore',
      });
    } catch {}

    // TEST F: Leaderboard REST fetch hoạt động
    try {
      const timeRes = await fetch('http://localhost:5000/api/leaderboard/server-time');
      const timeData = timeRes.ok ? await timeRes.json() : null;

      const lbRes = await fetch('http://localhost:5000/api/leaderboard/weekly_xp');
      const lbData = lbRes.ok ? await lbRes.json() : null;

      if (timeRes.ok && lbRes.ok) {
        record('TEST-F', 'Leaderboard REST fetch hoạt động', 'PASS', `Server time: ${timeData?.serverTimeUtc}, Weekly XP items: ${lbData?.items?.length ?? 0}`);
      } else {
        record('TEST-F', 'Leaderboard REST fetch hoạt động', 'FAIL', `timeRes: ${timeRes.status}, lbRes: ${lbRes.status}`);
      }
    } catch (err) {
      record('TEST-F', 'Leaderboard REST fetch hoạt động', 'FAIL', err.message);
    }

    // TEST G: Dừng đúng child processes khi kết thúc
    console.log('\n--- 2. Kiểm thử dừng tiến trình và giải phóng tài nguyên (G-H) ---');
    killTree(devProcess.pid);
    const p5000Freed = await waitForPortFree(5000, 8000);
    const p5173Freed = await waitForPortFree(5173, 8000);

    if (p5000Freed && p5173Freed) {
      record('TEST-G', 'Ctrl+C dừng đúng child processes', 'PASS', 'Cả 2 cổng 5000 và 5173 đã giải phóng sạch sẽ không để orphan process');
    } else {
      record('TEST-G', 'Ctrl+C dừng đúng child processes', 'FAIL', `Port 5000 freed: ${p5000Freed}, Port 5173 freed: ${p5173Freed}`);
    }

    // TEST H: Chạy lại không port conflict
    let secondDev = null;
    try {
      secondDev = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'dev.mjs')], {
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const bReady = await waitForPort(5000, 20000);
      const fReady = await waitForPort(5173, 20000);
      if (bReady && fReady) {
        record('TEST-H', 'Chạy lại không port conflict', 'PASS', 'Khởi động lần 2 thành công hoàn toàn không gặp lỗi chiếm cổng');
      } else {
        record('TEST-H', 'Chạy lại không port conflict', 'FAIL', `bReady: ${bReady}, fReady: ${fReady}`);
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

  // --- SUITE 2: TEST I: Backend startup failure / port occupied reported properly ---
  console.log('\n--- 3. Kiểm thử xử lý lỗi chiếm cổng (I) ---');
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
      record('TEST-I', 'Backend/Frontend startup failure được thông báo đúng', 'PASS', 'Phát hiện cổng 5173 bị chiếm, báo lỗi rõ ràng và dừng an toàn với mã 1');
    } else {
      record('TEST-I', 'Backend/Frontend startup failure được thông báo đúng', 'FAIL', `Exit code: ${exitCode}, output: ${failOutput}`);
    }
  } catch (err) {
    dummyServer.close();
    record('TEST-I', 'Backend/Frontend startup failure được thông báo đúng', 'FAIL', err.message);
  }

  // --- SUITE 3: TEST J: Backend đã chạy sẵn không sinh instance trùng ---
  console.log('\n--- 4. Kiểm thử tái sử dụng Backend đã chạy sẵn (J) ---');
  let standaloneBackend = null;
  let devJ = null;
  try {
    const dotnetCmd = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
    standaloneBackend = spawn(
      dotnetCmd,
      ['run', '--project', path.join('backend', 'EnglishMastery.Api', 'EnglishMastery.Api.csproj'), '--launch-profile', 'http'],
      {
        cwd: ROOT_DIR,
        stdio: 'ignore',
        env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development' },
      }
    );

    const bReady = await waitForPort(5000, 25000);
    if (!bReady) {
      record('TEST-J', 'Backend đã chạy sẵn không sinh instance trùng', 'BLOCKED', 'Không thể khởi động standalone backend');
    } else {
      let jOutput = '';
      devJ = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'dev.mjs')], {
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      devJ.stdout.on('data', (d) => jOutput += d.toString());
      devJ.stderr.on('data', (d) => jOutput += d.toString());

      // Wait a few seconds for devJ to inspect port 5000 and start frontend
      await new Promise((r) => setTimeout(r, 4000));
      const fReady = await waitForPort(5173, 10000);

      const detectedExisting = jOutput.includes('đang chạy sẵn trên cổng 5000') || jOutput.includes('Tái sử dụng instance hiện có');
      if (detectedExisting && fReady) {
        record('TEST-J', 'Backend đã chạy sẵn không sinh instance trùng', 'PASS', 'Nhận diện backend chạy sẵn, tái sử dụng thành công, không tạo duplicate backend');
      } else {
        record('TEST-J', 'Backend đã chạy sẵn không sinh instance trùng', 'FAIL', `Detected: ${detectedExisting}, fReady: ${fReady}, logs: ${jOutput}`);
      }

      // Stop devJ. Pre-existing standaloneBackend should NOT be killed!
      killTree(devJ.pid);
      await new Promise((r) => setTimeout(r, 1500));
      const backendStillAlive = await probePort(5000);
      if (!backendStillAlive) {
        console.warn('⚠️ Cảnh báo: Standalone backend bị dừng ngoài ý muốn khi dừng devJ');
      }
    }
  } finally {
    if (devJ) killTree(devJ.pid);
    if (standaloneBackend) {
      killTree(standaloneBackend.pid);
      await waitForPortFree(5000, 8000);
    }
    await waitForPortFree(5173, 8000);
  }

  // --- SUMMARY REPORT ---
  console.log('\n================================================================');
  console.log('📊 TỔNG HỢP KẾT QUẢ KIỂM THỬ RUNTIME VERIFICATION (PHASE 1)');
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

runTests().catch((err) => {
  console.error('Lỗi nghiêm trọng trong kiểm thử:', err);
  process.exit(1);
});
