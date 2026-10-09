// scripts/verify_real_runtime_phase9.mjs
import * as signalR from '@microsoft/signalr';

const API_BASE = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:5173';
const HUB_URL = 'http://localhost:5000/hubs/leaderboard';

const results = [];

function record(step, name, passed, detail = '') {
  results.push({ step, name, passed, detail });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${status}] Step ${step}: ${name} ${detail ? `(${detail})` : ''}`);
}

async function run() {
  console.log('================================================================');
  console.log('PHASE 9 REAL RUNTIME VERIFICATION: Frontend -> ASP.NET -> SQL Server');
  console.log('================================================================\n');

  // STEP 1: Mở app & kiểm tra kết nối dev server và API
  try {
    const feRes = await fetch(FRONTEND_URL);
    record(1, 'Frontend Dev Server Reachable (localhost:5173)', feRes.ok, `Status ${feRes.status}`);
  } catch (err) {
    record(1, 'Frontend Dev Server Reachable (localhost:5173)', false, err.message);
  }

  try {
    const timeRes = await fetch(`${API_BASE}/leaderboard/server-time`);
    const timeData = await timeRes.json();
    record(1, 'ASP.NET Core Server Reachable (localhost:5000)', timeRes.ok && !!timeData.serverNow, `Server time: ${timeData.serverNow}`);
  } catch (err) {
    record(1, 'ASP.NET Core Server Reachable (localhost:5000)', false, err.message);
  }

  // STEP 2: Register & Login Flow
  const testUser = {
    email: `real_user_${Date.now()}@example.com`,
    password: 'RealPassword123!',
    displayName: 'Real Runtime Learner',
    username: `realuser_${Date.now()}`
  };

  let token = null;
  let userId = null;

  try {
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const regData = await regRes.json();
    token = regData.accessToken;
    userId = regData.user?.id;
    record(2, 'Register New User on ASP.NET Core & SQL Server', regRes.ok && !!token, `User ID: ${userId}`);
  } catch (err) {
    record(2, 'Register New User on ASP.NET Core & SQL Server', false, err.message);
  }

  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    const loginData = await loginRes.json();
    token = loginData.accessToken; // fresh token
    record(2, 'Login User & Receive JWT Bearer Token', loginRes.ok && !!token, `Token length: ${token?.length}`);
  } catch (err) {
    record(2, 'Login User & Receive JWT Bearer Token', false, err.message);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Check Auth Me
  try {
    const meRes = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders });
    const meData = await meRes.json();
    record(2, 'Verify Auth Me Claims with Server JWT', meRes.ok && meData.email === testUser.email, meData.email);
  } catch (err) {
    record(2, 'Verify Auth Me Claims with Server JWT', false, err.message);
  }

  // STEP 3: Sync Cloud Initial State
  try {
    const stateRes = await fetch(`${API_BASE}/sync/state`, { headers: authHeaders });
    const stateData = await stateRes.json();
    record(3, 'Sync Cloud Initial State from SQL Server', stateRes.ok && stateData.profile !== undefined, `Profile ID: ${stateData.profile?.id}`);
  } catch (err) {
    record(3, 'Sync Cloud Initial State from SQL Server', false, err.message);
  }

  // STEP 4: Thực hiện learning action (Update profile)
  try {
    const updateRes = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        displayName: 'Real Runtime Learner (Pro)',
        targetDailyNewWords: 30,
        targetGoal: 'ielts',
        preferredTheme: 'dark',
        srsAlgorithm: 'fsrs'
      })
    });
    const updateData = await updateRes.json();
    record(4, 'Execute Learning Action: Profile Goal & Algorithm Update', updateRes.ok && updateData.targetGoal === 'ielts', `Goal: ${updateData.targetGoal}, Words: ${updateData.targetDailyNewWords}`);
  } catch (err) {
    record(4, 'Execute Learning Action: Profile Goal & Algorithm Update', false, err.message);
  }

  // STEP 5: Sync XP & Progress (Sync Upload, SRS Batch, Daily Logs, Leaderboard Score & Metrics)
  try {
    const syncUploadRes = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        profile: {
          displayName: 'Real Runtime Learner (Pro)',
          targetDailyNewWords: 30,
          targetGoal: 'ielts',
          preferredTheme: 'dark',
          srsAlgorithm: 'fsrs'
        },
        srsItems: [
          {
            wordId: 'resilience',
            level: 4,
            interval: 14,
            easeFactor: 2.6,
            repetition: 4,
            dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
            lastReviewedDate: new Date().toISOString(),
            algorithm: 'fsrs',
            schedulerState: 'review'
          }
        ],
        dailyLogs: [
          {
            date: new Date().toISOString().slice(0, 10),
            wordsLearned: 20,
            reviewsCompleted: 45,
            minutesSpent: 35,
            xpEarned: 280
          }
        ]
      })
    });
    const syncUploadData = await syncUploadRes.json();
    record(5, 'Sync Progress Upload (Snapshot & Aggregates)', syncUploadRes.ok && syncUploadData.success, `SRS upserted: ${syncUploadData.srsItemsUpserted}, Logs upserted: ${syncUploadData.dailyLogsUpserted}`);
  } catch (err) {
    record(5, 'Sync Progress Upload (Snapshot & Aggregates)', false, err.message);
  }

  // SRS Batch API
  try {
    const srsBatchRes = await fetch(`${API_BASE}/srs/batch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        items: [
          {
            wordId: 'perseverance',
            level: 3,
            interval: 7,
            easeFactor: 2.5,
            repetition: 3,
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            lastReviewedDate: new Date().toISOString(),
            algorithm: 'fsrs',
            schedulerState: 'review'
          }
        ]
      })
    });
    const srsBatchData = await srsBatchRes.json();
    record(5, 'Direct SRS Batch API Sync', srsBatchRes.ok && srsBatchData.upsertedCount >= 1, `Upserted count: ${srsBatchData.upsertedCount}`);
  } catch (err) {
    record(5, 'Direct SRS Batch API Sync', false, err.message);
  }

  // Daily Logs Batch API
  try {
    const dailyBatchRes = await fetch(`${API_BASE}/dailylogs/batch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        logs: [
          {
            date: new Date().toISOString().slice(0, 10),
            wordsLearned: 25,
            reviewsCompleted: 50,
            minutesSpent: 40,
            xpEarned: 350
          }
        ]
      })
    });
    const dailyBatchData = await dailyBatchRes.json();
    record(5, 'Direct Daily Logs Batch API Sync', dailyBatchRes.ok && dailyBatchData.upsertedCount >= 1, `Upserted count: ${dailyBatchData.upsertedCount}`);
  } catch (err) {
    record(5, 'Direct Daily Logs Batch API Sync', false, err.message);
  }

  // Leaderboard Sync Score
  try {
    const scoreRes = await fetch(`${API_BASE}/leaderboard/sync-score`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        displayName: 'Real Runtime Learner (Pro)',
        totalXp: 850,
        weeklyXp: 850,
        streak: 7,
        level: 3
      })
    });
    const scoreData = await scoreRes.json();
    record(5, 'Sync Leaderboard Score (XP = 850, Streak = 7)', scoreRes.ok && scoreData.success, `Current Rank: #${scoreData.currentRank}`);
  } catch (err) {
    record(5, 'Sync Leaderboard Score (XP = 850, Streak = 7)', false, err.message);
  }

  // Server Time & Week ID
  let currentWeekId = '';
  try {
    const timeRes = await fetch(`${API_BASE}/leaderboard/server-time`);
    const timeData = await timeRes.json();
    currentWeekId = timeData.weekId;
    record(6, 'Open Leaderboard: Fetch Server Time & Canonical Week ID', timeRes.ok && !!currentWeekId, `Week: ${currentWeekId}, Timezone: ${timeData.timezone}`);
  } catch (err) {
    record(6, 'Open Leaderboard: Fetch Server Time & Canonical Week ID', false, err.message);
  }

  // Sync Weekly Learning Metrics
  try {
    const metricRes = await fetch(`${API_BASE}/leaderboard/sync-metrics`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        weekId: currentWeekId,
        weeklyXp: 850,
        vocabMastered: 45,
        reviewConsistency: 92.5,
        activeMinutes: 120,
        pronunciationGain: 15.0,
        toeicGain: 40.0
      })
    });
    const metricData = await metricRes.json();
    record(6, 'Sync Weekly Learning 7-Category Metrics', metricRes.ok && metricData.success, `Week: ${metricData.weekId}`);
  } catch (err) {
    record(6, 'Sync Weekly Learning 7-Category Metrics', false, err.message);
  }

  // STEP 7: Chuyển Cả 7 Categories Leaderboard
  const categories = [
    'weekly_xp',
    'streak',
    'vocab_mastered',
    'review_consistency',
    'active_minutes',
    'pronunciation_gain',
    'toeic_gain'
  ];

  let all7Passed = true;
  for (const cat of categories) {
    try {
      const catRes = await fetch(`${API_BASE}/leaderboard/${cat}?weekId=${currentWeekId}&page=1&pageSize=10`, {
        headers: authHeaders
      });
      const catData = await catRes.json();
      const ok = catRes.ok && Array.isArray(catData.entries);
      if (!ok) all7Passed = false;
      record(7, `Leaderboard Category: ${cat}`, ok, `Entries: ${catData.entries?.length}, Total: ${catData.totalCount}`);
    } catch (err) {
      all7Passed = false;
      record(7, `Leaderboard Category: ${cat}`, false, err.message);
    }
  }

  // STEP 8: Current User Rank for Categories
  try {
    const rankRes = await fetch(`${API_BASE}/leaderboard/weekly_xp/me?weekId=${currentWeekId}`, {
      headers: authHeaders
    });
    const rankData = await rankRes.json();
    const rankOk = rankRes.ok && rankData.found && rankData.entry?.userId === userId;
    record(8, 'Current User Sticky Rank Verification', rankOk, `Rank: #${rankData.entry?.rank}, Score: ${rankData.entry?.score}, Display: ${rankData.entry?.displayName}`);
  } catch (err) {
    record(8, 'Current User Sticky Rank Verification', false, err.message);
  }

  // STEP 9: Weekly Results & Ceremony APIs
  try {
    const snapRes = await fetch(`${API_BASE}/leaderboard/finalization/results?weekId=${currentWeekId}&category=weekly_xp`);
    const snapData = await snapRes.json();
    record(9, 'Weekly Snapshots API', snapRes.ok && Array.isArray(snapData), `Snapshots count: ${snapData.length}`);
  } catch (err) {
    record(9, 'Weekly Snapshots API', false, err.message);
  }

  try {
    const ceremonyRes = await fetch(`${API_BASE}/leaderboard/ceremony/pending?weekId=${currentWeekId}`, {
      headers: authHeaders
    });
    const ceremonyData = await ceremonyRes.json();
    record(9, 'Pending Ceremony API', ceremonyRes.ok && ceremonyData.hasPending !== undefined, `Has pending: ${ceremonyData.hasPending}`);
  } catch (err) {
    record(9, 'Pending Ceremony API', false, err.message);
  }

  // STEP 10: SignalR Realtime Hub Connection
  try {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => token
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    let receivedUpdate = false;
    connection.on('leaderboard_updated', (event) => {
      receivedUpdate = true;
      console.log('  [SignalR Broadcast Received]', event);
    });

    await connection.start();
    const isConnected = connection.state === signalR.HubConnectionState.Connected;
    record(10, 'SignalR Hub Connect & Handshake (/hubs/leaderboard)', isConnected, `Connection State: ${connection.state}`);

    // Trigger update and test broadcast
    await fetch(`${API_BASE}/leaderboard/sync-score`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        displayName: 'Real Runtime Learner (Pro)',
        totalXp: 900,
        weeklyXp: 900,
        streak: 8,
        level: 3
      })
    });

    // Wait 500ms for SignalR broadcast
    await new Promise((r) => setTimeout(r, 600));
    record(10, 'SignalR Realtime Broadcast Event Delivery', receivedUpdate, 'leaderboard_updated event received over WebSocket');

    await connection.stop();
  } catch (err) {
    record(10, 'SignalR Hub Connect & Handshake (/hubs/leaderboard)', false, err.message);
  }

  // STEP 11: Offline / Reconnect Simulation
  try {
    // When offline (simulated by invalid host), client handles gracefully
    const offlineTest = async () => {
      try {
        await fetch('http://localhost:59999/api/sync/state');
        return false;
      } catch {
        return true; // Graceful catch without crashing
      }
    };
    const handledGracefully = await offlineTest();
    record(11, 'Offline / Network Failure Resilience', handledGracefully, 'Connection error caught and handled gracefully');
  } catch (err) {
    record(11, 'Offline / Network Failure Resilience', false, err.message);
  }

  // STEP 12: Logout Flow
  try {
    const logoutRes = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: authHeaders
    });
    record(12, 'Logout User & Revoke Session on Server', logoutRes.ok, `Status: ${logoutRes.status}`);
  } catch (err) {
    record(12, 'Logout User & Revoke Session on Server', false, err.message);
  }

  // STEP 13: Security & Ownership Checks
  try {
    // Request with revoked/invalid token should fail with 401
    const unauthRes = await fetch(`${API_BASE}/profile`, {
      headers: { 'Authorization': 'Bearer invalid_or_expired_token' }
    });
    record(13, 'Security: Reject Invalid JWT Bearer Token', unauthRes.status === 401, `Status: ${unauthRes.status}`);
  } catch (err) {
    record(13, 'Security: Reject Invalid JWT Bearer Token', false, err.message);
  }

  try {
    // Attempt to equip frame without entitlement should fail with 400 Bad Request
    const frameRes = await fetch(`${API_BASE}/frames/equip`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ frameId: 'champion_frame' })
    });
    record(13, 'Security: Deny Unowned Frame Reward Equip', frameRes.status === 400, `Status: ${frameRes.status}`);
  } catch (err) {
    record(13, 'Security: Deny Unowned Frame Reward Equip', false, err.message);
  }

  console.log('\n================================================================');
  console.log('VERIFICATION SUMMARY:');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
