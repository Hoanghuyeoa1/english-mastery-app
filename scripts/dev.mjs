#!/usr/bin/env node
// scripts/dev.mjs
// One-command development orchestrator for English Mastery Hub
// Coordinates React/Vite Frontend, ASP.NET Core 10 Backend, and SQL Server Readiness.

import { spawn, execSync } from 'node:child_process';
import net from 'node:net';
import readline from 'node:readline';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const FRONTEND_PORT = 5173;
const BACKEND_PORT = 5000;
const HEALTH_URL = `http://localhost:${BACKEND_PORT}/api/health`;
const BACKEND_PROJECT = path.join('backend', 'EnglishMastery.Api', 'EnglishMastery.Api.csproj');
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
  white: '\x1b[37m',
};

const prefix = {
  system: `${colors.magenta}${colors.bright}[SYSTEM]${colors.reset} `,
  backend: `${colors.cyan}${colors.bright}[BACKEND]${colors.reset} `,
  frontend: `${colors.green}${colors.bright}[FRONTEND]${colors.reset} `,
  error: `${colors.red}${colors.bright}[ERROR]${colors.reset} `,
  warn: `${colors.yellow}${colors.bright}[WARN]${colors.reset} `,
  success: `${colors.green}${colors.bright}[SUCCESS]${colors.reset} `,
};

function logSystem(msg) {
  console.log(`${prefix.system}${msg}`);
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

// Probe if a port is in use (supporting IPv4 and IPv6 on Windows)
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
    const lines = out.split('\n');
    for (const line of lines) {
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

// Check Backend Health and verify if it's our EnglishMastery Backend
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

// Track child processes spawned in THIS session only
const spawnedChildren = new Set();
let isShuttingDown = false;

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

function cleanup(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (spawnedChildren.size > 0) {
    logSystem('Đang dọn dẹp các tiến trình con thuộc phiên làm việc hiện tại...');
    for (const child of spawnedChildren) {
      if (child && child.pid) {
        killProcessTree(child.pid);
      }
    }
    spawnedChildren.clear();
    logSystem('Dọn dẹp hoàn tất.');
  }

  process.exit(exitCode);
}

process.on('SIGINT', () => {
  console.log('\n');
  logSystem('Nhận tín hiệu dừng (Ctrl+C). Đang thoát an toàn...');
  cleanup(0);
});

process.on('SIGTERM', () => {
  cleanup(0);
});

process.on('exit', () => {
  for (const child of spawnedChildren) {
    if (child && child.pid) {
      killProcessTree(child.pid);
    }
  }
});

// Stream process output with colorful prefix and line-by-line formatting
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

async function main() {
  console.log('================================================================');
  console.log('🚀 KHỞI ĐỘNG HỆ THỐNG PHÁT TRIỂN ENGLISH MASTERY HUB (ONE-COMMAND)');
  console.log('================================================================');

  // 1. Port & Process Audit for Port 5173 (Frontend)
  logSystem(`Kiểm tra trạng thái cổng ${FRONTEND_PORT} (Frontend)...`);
  const isPort5173InUse = await probePort(FRONTEND_PORT);
  if (isPort5173InUse) {
    const occupier = getPortOccupier(FRONTEND_PORT);
    const details = occupier ? `bởi tiến trình ${occupier.processName} (PID ${occupier.pid})` : 'bởi một tiến trình đang chạy';
    logError(`Cổng ${FRONTEND_PORT} đang bị chiếm ${details}.`);
    logError(`Theo nguyên tắc an toàn, hệ thống không tự ý kill tiến trình bên ngoài.`);
    logError(`Vui lòng dừng tiến trình chiếm cổng ${FRONTEND_PORT} trước khi chạy 'npm run dev'.`);
    process.exit(1);
  }

  // 2. Port & Process Audit for Port 5000 (Backend)
  logSystem(`Kiểm tra trạng thái cổng ${BACKEND_PORT} (Backend)...`);
  let backendAlreadyRunning = false;
  const isPort5000InUse = await probePort(BACKEND_PORT);

  if (isPort5000InUse) {
    const occupier = getPortOccupier(BACKEND_PORT);
    const health = await checkBackendHealth(2500);

    if (health.isBackend) {
      backendAlreadyRunning = true;
      const pidInfo = occupier ? ` (PID ${occupier.pid})` : '';
      logSystem(`Phát hiện Backend ASP.NET Core đang chạy sẵn trên cổng ${BACKEND_PORT}${pidInfo}.`);
      logSystem(`Tái sử dụng instance hiện có — không khởi động instance thứ hai.`);

      const db = health.data?.database ?? health.data?.Database;
      const isDbConnected = db?.canConnect ?? db?.CanConnect ?? false;
      if (isDbConnected) {
        logSuccess(`[SQL SERVER] Cơ sở dữ liệu EnglishMasteryDev: KẾT NỐI TỐT (Healthy).`);
      } else {
        logWarn(`[SQL SERVER] Cơ sở dữ liệu EnglishMasteryDev đang bị gián đoạn: ${db?.error ?? 'Degraded'}`);
        logWarn(`  Hướng dẫn: Kiểm tra dịch vụ MSSQLSERVER đang chạy trên localhost:1433.`);
      }
    } else {
      const details = occupier ? `bởi tiến trình ${occupier.processName} (PID ${occupier.pid})` : 'bởi một tiến trình khác';
      logError(`Cổng ${BACKEND_PORT} đang bị chiếm ${details} không phải English Mastery Backend.`);
      logError(`Vui lòng giải phóng cổng ${BACKEND_PORT} trước khi khởi động.`);
      process.exit(1);
    }
  }

  // 3. Launch Backend if not already running
  if (!backendAlreadyRunning) {
    logSystem(`Đang khởi động ASP.NET Core 10 Backend (cổng ${BACKEND_PORT})...`);
    const dotnetCmd = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
    const backendChild = spawn(
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

    spawnedChildren.add(backendChild);
    attachLogger(backendChild, prefix.backend);

    backendChild.on('error', (err) => {
      logError(`Không thể khởi động Backend: ${err.message}`);
      cleanup(1);
    });

    backendChild.on('exit', (code, signal) => {
      if (!isShuttingDown) {
        logError(`Tiến trình Backend đã thoát đột ngột (Mã: ${code}, Tín hiệu: ${signal}).`);
        cleanup(code ?? 1);
      }
    });

    // 4. Bounded Readiness Polling
    logSystem(`Đang kiểm tra kết nối Backend & SQL Server (tối đa ${MAX_BACKEND_WAIT_MS / 1000}s)...`);
    const startTime = Date.now();
    let backendReady = false;

    while (Date.now() - startTime < MAX_BACKEND_WAIT_MS) {
      if (isShuttingDown) break;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const health = await checkBackendHealth(1000);
      if (health.isBackend) {
        backendReady = true;
        const data = health.data;
        const env = data?.environment ?? data?.Environment ?? 'Development';
        const db = data?.database ?? data?.Database;
        const isDbConnected = db?.canConnect ?? db?.CanConnect ?? false;

        logSuccess(`[BACKEND] ASP.NET Core 10 đã sẵn sàng trên http://localhost:${BACKEND_PORT} (Môi trường: ${env}).`);
        if (isDbConnected) {
          logSuccess(`[SQL SERVER] Cơ sở dữ liệu EnglishMasteryDev: KẾT NỐI TỐT (Healthy).`);
        } else {
          logWarn(`[SQL SERVER] Backend đã hoạt động nhưng SQL Server chưa kết nối: ${db?.error ?? 'Degraded'}`);
          logWarn(`  Hướng dẫn: Đảm bảo dịch vụ SQL Server (MSSQLSERVER) đang chạy trên localhost:1433.`);
          logWarn(`  Không tự chuyển sang SQLite/LocalDB và không reset cơ sở dữ liệu.`);
        }
        break;
      }
    }

    if (!backendReady && !isShuttingDown) {
      logError(`Quá thời gian chờ Backend khởi động (${MAX_BACKEND_WAIT_MS / 1000}s).`);
      cleanup(1);
    }
  }

  // 5. Launch Frontend (Vite)
  logSystem(`Đang khởi động Vite Frontend (cổng ${FRONTEND_PORT})...`);
  const viteJsPath = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
  const frontendChild = spawn(
    process.execPath,
    [viteJsPath],
    {
      cwd: ROOT_DIR,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        VITE_API_BASE_URL: `http://localhost:${BACKEND_PORT}/api`,
      },
    }
  );

  spawnedChildren.add(frontendChild);
  attachLogger(frontendChild, prefix.frontend);

  frontendChild.on('error', (err) => {
    logError(`Không thể khởi động Vite: ${err.message}`);
    cleanup(1);
  });

  frontendChild.on('exit', (code, signal) => {
    if (!isShuttingDown) {
      logSystem(`Tiến trình Frontend đã kết thúc (Mã: ${code}, Tín hiệu: ${signal}).`);
      cleanup(code ?? 0);
    }
  });

  console.log('----------------------------------------------------------------');
  logSuccess(`English Mastery Hub đang phục vụ tại: http://localhost:${FRONTEND_PORT}`);
  logSuccess(`Backend REST API: http://localhost:${BACKEND_PORT}/api`);
  logSuccess(`SignalR Realtime Hub: http://localhost:${BACKEND_PORT}/hubs/leaderboard`);
  logSystem(`Nhấn Ctrl+C bất cứ lúc nào để dừng an toàn tất cả các dịch vụ.`);
  console.log('----------------------------------------------------------------\n');
}

main().catch((err) => {
  logError(`Lỗi không mong muốn trong trình điều phối: ${err.message}`);
  cleanup(1);
});
