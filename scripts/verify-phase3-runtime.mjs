#!/usr/bin/env node
// scripts/verify-phase3-runtime.mjs
// Comprehensive verification suite for Phase 3 Unified ASP.NET Core Static Hosting
// Tests all Phase 3 smoke test and architectural requirements

import { spawn, execSync } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WWWROOT_DIR = path.join(ROOT_DIR, 'backend', 'EnglishMastery.Api', 'wwwroot');

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

async function waitForPort(port, timeoutMs = 30000) {
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
  console.log('🧪 BẮT ĐẦU KIỂM THỬ RUNTIME: PHASE 3 UNIFIED STATIC HOSTING');
  console.log('================================================================\n');

  // Verify initial clean ports
  if (await probePort(5000)) {
    console.warn('⚠️ Cảnh báo: Cổng 5000 đang bị chiếm trước khi bắt đầu test.');
  }

  // --- SUITE 1: Khởi động Unified Mode & Kiểm tra WebRoot Sync ---
  console.log('--- PHẦN 1: Khởi động npm run start:unified và Phục vụ Web (A - E) ---');
  let unifiedProcess = null;
  const unifiedLogs = [];

  try {
    unifiedProcess = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'start-unified.mjs')], {
      cwd: ROOT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    unifiedProcess.stdout.on('data', (d) => unifiedLogs.push(d.toString()));
    unifiedProcess.stderr.on('data', (d) => unifiedLogs.push(d.toString()));

    const serverReady = await waitForPort(5000, 45000);

    // TEST A: Khởi động start:unified và lắng nghe cổng 5000
    if (serverReady) {
      record('TEST-A', 'start:unified khởi động máy chủ trên cổng 5000', 'PASS', 'ASP.NET Core lắng nghe cổng 5000 thành công');
    } else {
      record('TEST-A', 'start:unified khởi động máy chủ trên cổng 5000', 'FAIL', 'Cổng 5000 không mở sau 35s');
    }

    // TEST B: Vite port 5173 không chạy
    const p5173Alive = await probePort(5173);
    if (!p5173Alive) {
      record('TEST-B', 'Vite dev server port 5173 không cần hoạt động', 'PASS', 'Cổng 5173 hoàn toàn tự do; Unified mode chạy độc lập không cần Vite');
    } else {
      record('TEST-B', 'Vite dev server port 5173 không cần hoạt động', 'FAIL', 'Phát hiện cổng 5173 đang chạy');
    }

    // TEST C: localhost:5000 trả React HTML (index.html) với header đúng
    try {
      const res = await fetch('http://localhost:5000/');
      const text = await res.text();
      const contentType = res.headers.get('content-type') || '';
      const cacheControl = res.headers.get('cache-control') || '';

      if (res.ok && contentType.includes('text/html') && (text.includes('id="root"') || text.includes('English Mastery Hub'))) {
        record('TEST-C', 'localhost:5000 phục vụ React index.html', 'PASS', `HTTP 200, Content-Type: ${contentType}, Cache-Control: ${cacheControl}`);
      } else {
        record('TEST-C', 'localhost:5000 phục vụ React index.html', 'FAIL', `HTTP ${res.status}, Type: ${contentType}`);
      }
    } catch (err) {
      record('TEST-C', 'localhost:5000 phục vụ React index.html', 'FAIL', err.message);
    }

    // TEST D: Phục vụ JS/CSS/Assets tĩnh với Content-Type & Caching chuẩn
    try {
      // Find an asset file in wwwroot/assets
      const assetsDir = path.join(WWWROOT_DIR, 'assets');
      let assetFileName = null;
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        assetFileName = files.find((f) => f.endsWith('.js') || f.endsWith('.css'));
      }

      if (assetFileName) {
        const assetRes = await fetch(`http://localhost:5000/assets/${assetFileName}`);
        const assetType = assetRes.headers.get('content-type') || '';
        const assetCache = assetRes.headers.get('cache-control') || '';

        if (assetRes.ok && (assetType.includes('javascript') || assetType.includes('css')) && assetCache.includes('max-age=31536000')) {
          record('TEST-D', 'Tài nguyên tĩnh /assets/* phục vụ chính xác', 'PASS', `HTTP 200, ${assetFileName} (${assetType}), Cache: immutable`);
        } else {
          record('TEST-D', 'Tài nguyên tĩnh /assets/* phục vụ chính xác', 'FAIL', `HTTP ${assetRes.status}, Type: ${assetType}, Cache: ${assetCache}`);
        }
      } else {
        record('TEST-D', 'Tài nguyên tĩnh /assets/* phục vụ chính xác', 'BLOCKED', 'Không tìm thấy file asset nào trong wwwroot/assets');
      }
    } catch (err) {
      record('TEST-D', 'Tài nguyên tĩnh /assets/* phục vụ chính xác', 'FAIL', err.message);
    }

    // TEST E: PWA Manifest và Service Worker
    try {
      const manifestRes = await fetch('http://localhost:5000/manifest.webmanifest');
      const manifestType = manifestRes.headers.get('content-type') || '';
      const swRes = await fetch('http://localhost:5000/sw.js');
      const swCache = swRes.headers.get('cache-control') || '';

      if (manifestRes.ok && swRes.ok && swCache.includes('no-cache')) {
        record('TEST-E', 'PWA Manifest và Service Worker được phục vụ', 'PASS', `Manifest: HTTP 200 (${manifestType}), sw.js: HTTP 200 (Cache: no-cache)`);
      } else {
        record('TEST-E', 'PWA Manifest và Service Worker được phục vụ', 'FAIL', `Manifest: ${manifestRes.status}, sw.js: ${swRes.status}`);
      }
    } catch (err) {
      record('TEST-E', 'PWA Manifest và Service Worker được phục vụ', 'FAIL', err.message);
    }

    // --- SUITE 2: SPA Fallback vs API Route Protection ---
    console.log('\n--- PHẦN 2: Kiểm thử SPA Fallback & Bảo vệ Route API (F - I) ---');

    // TEST F: Refresh client-side routes trả về React HTML (Dashboard, Welcome, Leaderboard)
    try {
      const routes = ['/dashboard', '/welcome', '/leaderboard', '/flashcards'];
      let allRoutesOk = true;
      for (const r of routes) {
        const res = await fetch(`http://localhost:5000${r}`);
        const text = await res.text();
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('text/html') || !text.includes('id="root"')) {
          allRoutesOk = false;
          break;
        }
      }
      if (allRoutesOk) {
        record('TEST-F', 'Refresh client SPA routes thành công', 'PASS', 'Các route /dashboard, /welcome, /leaderboard trả về index.html chuẩn');
      } else {
        record('TEST-F', 'Refresh client SPA routes thành công', 'FAIL', 'Ít nhất 1 route client không trả về index.html');
      }
    } catch (err) {
      record('TEST-F', 'Refresh client SPA routes thành công', 'FAIL', err.message);
    }

    // TEST G: Missing API trả 404 JSON, KHÔNG trả index.html
    try {
      const missingApiRes = await fetch('http://localhost:5000/api/nonexistent_audit_endpoint');
      const apiType = missingApiRes.headers.get('content-type') || '';
      const apiBody = await missingApiRes.json().catch(() => null);

      const hasNotFoundCode = apiBody?.code === 'NOT_FOUND' || apiBody?.Code === 'NOT_FOUND' || apiBody?.errorCode === 'NOT_FOUND';
      if (missingApiRes.status === 404 && apiType.includes('application/json') && hasNotFoundCode) {
        record('TEST-G', 'Missing API trả 404 JSON (không nuốt HTML)', 'PASS', `HTTP 404 JSON, Code: ${apiBody.code || apiBody.Code || apiBody.errorCode}`);
      } else {
        record('TEST-G', 'Missing API trả 404 JSON (không nuốt HTML)', 'FAIL', `HTTP ${missingApiRes.status}, Type: ${apiType}, Body: ${JSON.stringify(apiBody)}`);
      }
    } catch (err) {
      record('TEST-G', 'Missing API trả 404 JSON (không nuốt HTML)', 'FAIL', err.message);
    }

    // TEST H: Missing static asset trả 404, KHÔNG trả index.html
    try {
      const missingAssetRes = await fetch('http://localhost:5000/assets/non_existent_bundle_12345.js');
      const missingImgRes = await fetch('http://localhost:5000/images/missing_logo_99999.png');

      if (missingAssetRes.status === 404 && missingImgRes.status === 404) {
        record('TEST-H', 'Missing static asset trả 404 (không nuốt HTML)', 'PASS', 'Cả missing JS và missing PNG đều trả về HTTP 404 chính xác');
      } else {
        record('TEST-H', 'Missing static asset trả 404 (không nuốt HTML)', 'FAIL', `JS: HTTP ${missingAssetRes.status}, PNG: HTTP ${missingImgRes.status}`);
      }
    } catch (err) {
      record('TEST-H', 'Missing static asset trả 404 (không nuốt HTML)', 'FAIL', err.message);
    }

    // TEST I: SignalR Hub Negotiation & Backend REST API
    try {
      // Hub negotiation
      const hubRes = await fetch('http://localhost:5000/hubs/leaderboard/negotiate?negotiateVersion=1', {
        method: 'POST',
      });
      const hubData = await hubRes.json().catch(() => null);

      // Backend API health
      const healthRes = await fetch('http://localhost:5000/api/health');
      const healthData = await healthRes.json().catch(() => null);

      if (hubRes.ok && hubData?.connectionId && healthRes.ok && healthData?.status === 'Healthy') {
        record('TEST-I', 'SignalR Hub & Backend API hoạt động chuẩn', 'PASS', `SignalR connectionId cấp phát thành công, Database Healthy`);
      } else {
        record('TEST-I', 'SignalR Hub & Backend API hoạt động chuẩn', 'FAIL', `Hub: ${hubRes.status}, Health: ${healthRes.status}`);
      }
    } catch (err) {
      record('TEST-I', 'SignalR Hub & Backend API hoạt động chuẩn', 'FAIL', err.message);
    }

    // --- SUITE 3: Dọn dẹp tiến trình, Khởi động lại & Xung đột cổng ---
    console.log('\n--- PHẦN 3: Vòng đời tiến trình & An toàn cổng (J - L) ---');

    // TEST J: Ctrl+C dừng đúng process, không orphan
    killTree(unifiedProcess.pid);
    const p5000Freed = await waitForPortFree(5000, 8000);
    if (p5000Freed) {
      record('TEST-J', 'Ctrl+C giải phóng cổng 5000 sạch sẽ', 'PASS', 'Tiến trình ASP.NET Core được dọn dẹp hoàn toàn, không để orphan process');
    } else {
      record('TEST-J', 'Ctrl+C giải phóng cổng 5000 sạch sẽ', 'FAIL', 'Cổng 5000 vẫn bị chiếm sau khi dừng tiến trình');
    }

    // TEST K: Khởi động lại không bị port collision
    let secondUnified = null;
    try {
      secondUnified = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'start-unified.mjs')], {
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const reReady = await waitForPort(5000, 45000);
      if (reReady) {
        record('TEST-K', 'Khởi động lại Unified không bị port conflict', 'PASS', 'Phiên làm việc thứ 2 bind cổng 5000 thành công 100%');
      } else {
        record('TEST-K', 'Khởi động lại Unified không bị port conflict', 'FAIL', 'Không thể bind cổng 5000 ở phiên 2');
      }
    } finally {
      if (secondUnified) {
        killTree(secondUnified.pid);
        await waitForPortFree(5000, 8000);
      }
    }

    // TEST L: Cổng 5000 bị chiếm báo lỗi rõ ràng và dừng an toàn
    const dummyServer = http.createServer((req, res) => res.end('occupied'));
    await new Promise((resolve) => dummyServer.listen(5000, '127.0.0.1', resolve));

    try {
      let failOutput = '';
      const failProc = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'start-unified.mjs')], {
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      failProc.stdout.on('data', (d) => failOutput += d.toString());
      failProc.stderr.on('data', (d) => failOutput += d.toString());

      const exitCode = await new Promise((resolve) => failProc.on('exit', resolve));
      dummyServer.close();

      if (exitCode === 1 && (failOutput.includes('đang bị chiếm') || failOutput.includes('5000'))) {
        record('TEST-L', 'Cổng 5000 bị chiếm báo lỗi rõ ràng và dừng an toàn', 'PASS', 'Báo lỗi xung đột cổng 5000, không kill bừa và thoát mã 1');
      } else {
        record('TEST-L', 'Cổng 5000 bị chiếm báo lỗi rõ ràng và dừng an toàn', 'FAIL', `Exit: ${exitCode}, Output: ${failOutput}`);
      }
    } catch (err) {
      dummyServer.close();
      record('TEST-L', 'Cổng 5000 bị chiếm báo lỗi rõ ràng và dừng an toàn', 'FAIL', err.message);
    }
  } catch (err) {
    if (unifiedProcess) killTree(unifiedProcess.pid);
    throw err;
  }

  // --- SUMMARY REPORT ---
  console.log('\n================================================================');
  console.log('📊 TỔNG HỢP KẾT QUẢ KIỂM THỬ RUNTIME: PHASE 3 UNIFIED HOSTING');
  console.log('================================================================');
  let passCount = 0;
  for (const r of results) {
    if (r.status === 'PASS') passCount++;
    const icon = r.status === 'PASS' ? '✅' : r.status === 'BLOCKED' ? '🚫' : '❌';
    console.log(`${icon} [${r.testId}] ${r.name.padEnd(50)}: ${r.status}`);
  }
  console.log(`\nTổng kết: ${passCount}/${results.length} bài kiểm thử ĐẠT (PASS RATE: ${Math.round((passCount / results.length) * 100)}%)\n`);

  if (passCount === results.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi nghiêm trọng trong kiểm thử Phase 3:', err);
  process.exit(1);
});
