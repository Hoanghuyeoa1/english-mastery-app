#!/usr/bin/env node
// scripts/start-unified.mjs
// Single-Origin Unified Hosting Orchestrator for English Mastery Hub
// Builds React via Vite, syncs bundle to ASP.NET Core wwwroot, and launches unified server on port 5000.

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import readline from 'node:readline';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = 5000;
const HEALTH_URL = `http://localhost:${PORT}/api/health`;
const BACKEND_PROJECT = path.join('backend', 'EnglishMastery.Api', 'EnglishMastery.Api.csproj');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const WWWROOT_DIR = path.join(ROOT_DIR, 'backend', 'EnglishMastery.Api', 'wwwroot');
const MAX_BACKEND_WAIT_MS = 30000;
const POLL_INTERVAL_MS = 500;

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const prefix = {
  system: `${colors.magenta}${colors.bright}[UNIFIED-SYSTEM]${colors.reset} `,
  build: `${colors.blue}${colors.bright}[REACT-BUILD]${colors.reset} `,
  backend: `${colors.cyan}${colors.bright}[UNIFIED-SERVER]${colors.reset} `,
  error: `${colors.red}${colors.bright}[ERROR]${colors.reset} `,
  warn: `${colors.yellow}${colors.bright}[WARN]${colors.reset} `,
  success: `${colors.green}${colors.bright}[SUCCESS]${colors.reset} `,
};

function logSystem(msg) {
  console.log(`${prefix.system}${msg}`);
}
function logBuild(msg) {
  console.log(`${prefix.build}${msg}`);
}
function logWarn(msg) {
  console.warn(`${prefix.warn}${msg}`);
}
function logError(msg) {
  console.error(`${prefix.error}${msg}`);
}
function logSuccess(msg) {
  console.log(`${prefix.success}${msg}`);
}

// Probe if port is in use
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
      const sIpv6 = net.connect({ port, host: '::1' });
      sIpv6.once('connect', () => { sIpv6.destroy(); finish(true); });
      sIpv6.once('error', () => {
        const sLocalhost = net.connect({ port, host: 'localhost' });
        sLocalhost.once('connect', () => { sLocalhost.destroy(); finish(true); });
        sLocalhost.once('error', () => finish(false));
      });
    });
  });
}

// Find PID and process name occupying a port on Windows
function getPortOccupier(port) {
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
          let processName = 'Unknown';
          try {
            const taskOut = execSync(`tasklist /fi "PID eq ${pid}" /fo csv /nh`, {
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'ignore'],
            });
            const m = taskOut.trim().split('","');
            if (m.length > 0) {
              processName = m[0].replace(/"/g, '');
            }
          } catch {}
          return { pid, processName };
        }
      }
    }
  } catch {}
  return null;
}

// Check Backend Health
async function checkBackendHealth(timeoutMs = 2500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timer);

    const isRecognizedHttp = res.ok || res.status === 503;
    if (isRecognizedHttp) {
      const data = await res.json().catch(() => null);
      if (data && (data.database !== undefined || data.Database !== undefined || data.serverTimeUtc !== undefined)) {
        return { isBackend: true, data, status: res.status };
      }
    }
    return { isBackend: false, data: null, status: res.status };
  } catch (err) {
    return { isBackend: false, data: null, error: err };
  }
}

// Process Tree Termination
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

let backendChild = null;
let isShuttingDown = false;

function cleanup(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (backendChild && backendChild.pid) {
    logSystem('Đang dừng máy chủ Unified ASP.NET Core...');
    killProcessTree(backendChild.pid);
    backendChild = null;
    logSystem('Đã giải phóng máy chủ an toàn.');
  }

  process.exit(exitCode);
}

process.on('SIGINT', () => {
  console.log('\n');
  logSystem('Nhận tín hiệu dừng (Ctrl+C). Đang thoát Unified Mode an toàn...');
  cleanup(0);
});

process.on('SIGTERM', () => {
  cleanup(0);
});

process.on('exit', () => {
  if (backendChild && backendChild.pid) {
    killProcessTree(backendChild.pid);
  }
});

// Stream process output
function attachLogger(child, prefixText) {
  if (child.stdout) {
    const rlOut = readline.createInterface({ input: child.stdout });
    rlOut.on('line', (line) => {
      if (line.trim().length > 0) {
        console.log(`${prefixText}${line}`);
      }
    });
  }
  if (child.stderr) {
    const rlErr = readline.createInterface({ input: child.stderr });
    rlErr.on('line', (line) => {
      if (line.trim().length > 0) {
        console.error(`${prefixText}${colors.red}${line}${colors.reset}`);
      }
    });
  }
}

// Build React via Vite
function buildReactFrontend() {
  logBuild('Bắt đầu quy trình biên dịch React Production Build bằng Vite...');

  // Clean stale dist
  try {
    if (fs.existsSync(DIST_DIR)) {
      fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    logWarn(`Không thể xóa thư mục dist cũ: ${err.message}`);
  }

  const viteJsPath = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
  const buildResult = spawn(process.execPath, [viteJsPath, 'build'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      VITE_API_BASE_URL: '/api',
    },
  });

  return new Promise((resolve) => {
    buildResult.on('close', (code) => {
      if (code === 0) {
        logSuccess('React Production Build bằng Vite hoàn tất thành công (100%).');
        resolve(true);
      } else {
        logError(`Biên dịch React thất bại (Mã thoát: ${code}). Dừng quy trình khởi động Unified.`);
        resolve(false);
      }
    });
    buildResult.on('error', (err) => {
      logError(`Lỗi thực thi lệnh vite build: ${err.message}`);
      resolve(false);
    });
  });
}

// Sync dist -> wwwroot
function syncToWwwroot() {
  logSystem('Đang đồng bộ React bundle vào backend/EnglishMastery.Api/wwwroot...');
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`Thư mục dist không tồn tại tại: ${DIST_DIR}`);
  }
  const indexHtmlPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error('Thư mục dist thiếu file index.html');
  }

  try {
    if (fs.existsSync(WWWROOT_DIR)) {
      fs.rmSync(WWWROOT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(WWWROOT_DIR, { recursive: true });
    fs.cpSync(DIST_DIR, WWWROOT_DIR, { recursive: true });
    logSuccess('Đã đồng bộ toàn bộ tài nguyên vào wwwroot thành công.');
  } catch (err) {
    throw new Error(`Lỗi sao chép tài nguyên vào wwwroot: ${err.message}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('🏛️ KHỞI ĐỘNG ENGLISH MASTERY HUB — CHẾ ĐỘ UNIFIED (SINGLE-ORIGIN)');
  console.log('================================================================');

  // 1. Port 5000 Audit
  logSystem(`Kiểm tra trạng thái cổng ${PORT} (Unified Host)...`);
  const isPort5000InUse = await probePort(PORT);
  if (isPort5000InUse) {
    const occupier = getPortOccupier(PORT);
    const details = occupier ? `bởi tiến trình ${occupier.processName} (PID ${occupier.pid})` : 'bởi một tiến trình đang chạy';
    logError(`Cổng ${PORT} đang bị chiếm ${details}.`);
    logError(`Theo nguyên tắc an toàn, hệ thống không tự ý kill tiến trình bên ngoài.`);
    logError(`Vui lòng dừng tiến trình chiếm cổng ${PORT} trước khi chạy 'npm run start:unified'.`);
    process.exit(1);
  }

  // 2. Build React
  const buildOk = await buildReactFrontend();
  if (!buildOk) {
    process.exit(1);
  }

  // 3. Sync to wwwroot
  try {
    syncToWwwroot();
  } catch (err) {
    logError(err.message);
    process.exit(1);
  }

  // 4. Launch ASP.NET Core Unified Server
  logSystem(`Đang khởi động ASP.NET Core Unified Server trên cổng ${PORT}...`);
  const dotnetCmd = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
  backendChild = spawn(
    dotnetCmd,
    ['run', '--project', BACKEND_PROJECT, '--launch-profile', 'http'],
    {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
      },
    }
  );

  attachLogger(backendChild, prefix.backend);

  backendChild.on('error', (err) => {
    logError(`Không thể khởi động máy chủ Unified: ${err.message}`);
    cleanup(1);
  });

  backendChild.on('exit', (code, signal) => {
    if (!isShuttingDown) {
      logError(`Máy chủ Unified đã thoát đột ngột (Mã: ${code}, Tín hiệu: ${signal}).`);
      cleanup(code ?? 1);
    }
  });

  // 5. Polling Readiness
  logSystem(`Đang kiểm tra máy chủ Unified & SQL Server sẵn sàng (tối đa ${MAX_BACKEND_WAIT_MS / 1000}s)...`);
  const startTime = Date.now();
  let serverReady = false;

  while (Date.now() - startTime < MAX_BACKEND_WAIT_MS) {
    if (isShuttingDown) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const health = await checkBackendHealth(1000);
    if (health.isBackend) {
      serverReady = true;
      const data = health.data;
      const db = data?.database ?? data?.Database;
      const isDbConnected = db?.canConnect ?? db?.CanConnect ?? false;

      logSuccess(`[SERVER] Máy chủ Unified ASP.NET Core 10 đã trực tuyến trên http://localhost:${PORT}.`);
      if (isDbConnected) {
        logSuccess(`[SQL SERVER] Cơ sở dữ liệu EnglishMasteryDev: KẾT NỐI TỐT (Healthy).`);
      } else {
        logWarn(`[SQL SERVER] Cơ sở dữ liệu EnglishMasteryDev đang bị gián đoạn: ${db?.error ?? 'Degraded'}`);
        logWarn(`  Hướng dẫn: Kiểm tra dịch vụ MSSQLSERVER đang chạy trên localhost:1433.`);
      }
      break;
    }
  }

  if (!serverReady && !isShuttingDown) {
    logError(`Quá thời gian chờ máy chủ Unified khởi động (${MAX_BACKEND_WAIT_MS / 1000}s).`);
    cleanup(1);
  }

  console.log('----------------------------------------------------------------');
  logSuccess(`🎉 English Mastery Hub (Unified Mode) đang hoạt động tại:`);
  logSuccess(`👉 Website & React SPA:   http://localhost:${PORT}`);
  logSuccess(`👉 REST API Root:          http://localhost:${PORT}/api`);
  logSuccess(`👉 SignalR Realtime Hub:   http://localhost:${PORT}/hubs/leaderboard`);
  logSuccess(`👉 Health Check Endpoint:  http://localhost:${PORT}/api/health`);
  logSystem(`💡 Vite Dev Server (cổng 5173): KHÔNG CHẠY (Không cần thiết trong Unified Mode)`);
  logSystem(`Nhấn Ctrl+C bất cứ lúc nào để dừng an toàn máy chủ.`);
  console.log('----------------------------------------------------------------\n');
}

main().catch((err) => {
  logError(`Lỗi không mong muốn trong Unified Orchestrator: ${err.message}`);
  cleanup(1);
});
