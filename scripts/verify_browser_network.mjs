// scripts/verify_browser_network.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browserExe = fs.existsSync(CHROME_PATH) ? CHROME_PATH : EDGE_PATH;

const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-audit-'));
const CDP_PORT = 9222;

console.log('=== REAL BROWSER NETWORK AUDIT (CDP) ===');
console.log('Using browser executable:', browserExe);
console.log('Temp profile directory:', tempProfile);

const browserProc = spawn(browserExe, [
  '--headless=new',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${tempProfile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-extensions',
  'about:blank'
], { stdio: 'ignore' });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  try {
    // Wait for browser debug port to be ready
    let versionData = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch {}
      await sleep(300);
    }

    if (!versionData) {
      throw new Error('Chrome remote debugging did not become ready in time.');
    }
    console.log('[CDP Ready] Browser:', versionData.Browser);

    // Create a new target page pointing to frontend localhost:5173
    const newTargetRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?http://localhost:5173`, { method: 'PUT' });
    const targetData = await newTargetRes.json();
    const wsUrl = targetData.webSocketDebuggerUrl;
    console.log('[Target Page Created] wsUrl:', wsUrl);

    const capturedRequests = [];
    const ws = new WebSocket(wsUrl);

    let msgId = 1;
    function sendCommand(method, params = {}) {
      const id = msgId++;
      ws.send(JSON.stringify({ id, method, params }));
      return id;
    }

    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        console.log('[CDP WebSocket Connected]');
        sendCommand('Network.enable');
        sendCommand('Page.enable');
        sendCommand('Runtime.enable');
        resolve();
      };
      ws.onerror = reject;
    });

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Network.requestWillBeSent') {
          const url = msg.params.request.url;
          const method = msg.params.request.method;
          capturedRequests.push({ method, url });
          console.log(`  -> [Network Request] ${method} ${url}`);
        }
        if (msg.method === 'Runtime.consoleAPICalled') {
          const type = msg.params.type;
          const text = msg.params.args.map(a => a.value || a.description).join(' ');
          console.log(`  [Browser Console ${type}] ${text}`);
        }
      } catch {}
    };

    console.log('[Navigating & Exercising Frontend App for 8 seconds...]');
    await sleep(8000);

    // Evaluate script inside page to trigger API check and click Leaderboard tab
    console.log('[Evaluating test script inside browser context: Navigation to Leaderboard & State Check]');
    sendCommand('Runtime.evaluate', {
      expression: `
        (async () => {
          console.log("Current document title:", document.title);
          // Look for Leaderboard navigation button or tab
          const buttons = Array.from(document.querySelectorAll('button, a'));
          const lbBtn = buttons.find(b => (b.innerText || '').includes('Bảng xếp hạng') || (b.innerText || '').includes('Leaderboard'));
          if (lbBtn) {
            console.log("Clicking Leaderboard button in UI...");
            lbBtn.click();
          }
        })()
      `
    });

    await sleep(4000);

    console.log('\n=== REAL BROWSER NETWORK AUDIT RESULTS ===');
    console.log(`Total HTTP/WS network requests captured: ${capturedRequests.length}`);

    const supabaseRequests = capturedRequests.filter(r => 
      r.url.toLowerCase().includes('supabase')
    );

    const aspNetRequests = capturedRequests.filter(r => 
      r.url.includes('localhost:5000') || r.url.includes('127.0.0.1:5000')
    );

    console.log(`- Supabase requests captured: ${supabaseRequests.length}`);
    console.log(`- ASP.NET Core API requests captured: ${aspNetRequests.length}`);

    if (supabaseRequests.length > 0) {
      console.error('❌ REGRESSION DETECTED! The browser made requests to Supabase:');
      supabaseRequests.forEach(r => console.error(`   ${r.method} ${r.url}`));
      process.exit(1);
    } else {
      console.log('✅ ZERO Supabase requests detected during actual browser execution!');
    }

    if (aspNetRequests.length > 0) {
      console.log('✅ Confirmed browser network requests successfully directed to ASP.NET Core backend:');
      aspNetRequests.forEach(r => console.log(`   ${r.method} ${r.url}`));
    } else {
      console.log('ℹ️ No automatic cloud calls triggered (client in guest/offline state until user action).');
    }

    ws.close();
  } finally {
    browserProc.kill();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

run().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
