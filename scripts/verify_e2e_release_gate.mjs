// scripts/verify_e2e_release_gate.mjs
// Phase 8 End-to-End Verification Gate

import { execSync } from 'child_process';

const BASE_URL = 'http://localhost:5000';
const results = [];

function record(name, pass, details = '') {
  results.push({ name, pass, details });
  const icon = pass ? '✓ PASS' : '✗ FAIL';
  console.log(`[${icon}] ${name}${details ? ` -> ${details}` : ''}`);
}

async function runE2E() {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU KIỂM CHỨNG END-TO-END (PHASE 8 RELEASE GATE)');
  console.log('====================================================\n');

  // 1. Health & Database check
  console.log('--- [1. Health & SQL Server Database Check] ---');
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    const isHealthy = healthRes.ok && (healthData.database?.canConnect || healthData.Database?.CanConnect);
    record('API /api/health trả về 200 & SQL Server Healthy', isHealthy, `Status: ${healthData.status}`);
  } catch (err) {
    record('API /api/health kết nối thành công', false, err.message);
    console.error('Không thể kết nối đến Backend. Dừng kiểm chứng E2E.');
    process.exit(1);
  }

  // 2. Auth E2E Testing
  console.log('\n--- [2. Authentication End-to-End Pipeline] ---');
  const testId = Date.now().toString(36);
  const testEmail = `e2e_user_${testId}@testdomain.com`;
  const testPassword = 'Password123!';
  const testDisplayName = `E2E Tester ${testId}`;
  let registeredToken = null;
  let registeredUserId = null;

  // 2.1 Register new valid user
  try {
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
      }),
    });
    const regData = await regRes.json();
    const regOk = (regRes.status === 200 || regRes.status === 201) && Boolean(regData.accessToken && regData.user?.id);
    if (regOk) {
      registeredToken = regData.accessToken;
      registeredUserId = regData.user.id;
    }
    record('Đăng ký tài khoản mới thành công (HTTP 200/201 & JWT)', regOk, `UserId: ${registeredUserId}`);
  } catch (err) {
    record('Đăng ký tài khoản mới', false, err.message);
  }

  // 2.2 Verify SQL record in EnglishMasteryDev database directly
  try {
    const sqlQuery = `sqlcmd -S localhost -E -C -Q "USE EnglishMasteryDev; SELECT Email, DisplayName FROM AspNetUsers WHERE Email = '${testEmail}'"`;
    const sqlOutput = execSync(sqlQuery, { encoding: 'utf-8' });
    const userInDb = sqlOutput.includes(testEmail);
    record('Xác minh bản ghi SQL Server thật trong AspNetUsers', userInDb, `Email: ${testEmail}`);
  } catch (err) {
    record('Xác minh bản ghi SQL Server thật', false, err.message);
  }

  // 2.3 Duplicate email rejection
  try {
    const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        displayName: 'Duplicate Attempt',
      }),
    });
    const dupData = await dupRes.json();
    const dupOk = (dupRes.status === 409 || dupRes.status === 400) && (dupData.code === 'CONFLICT' || dupData.code === 'EMAIL_EXISTS' || dupData.message?.includes('được sử dụng'));
    record('Chặn đăng ký email trùng lặp (HTTP 409/400 rõ ràng)', dupOk, `Status: ${dupRes.status}, Code: ${dupData.code || dupData.message}`);
  } catch (err) {
    record('Chặn đăng ký email trùng lặp', false, err.message);
  }

  // 2.4 Invalid weak password rejection
  try {
    const weakRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `weak_${testId}@testdomain.com`,
        password: '123', // less than 6 chars
        displayName: 'Weak Pass User',
      }),
    });
    const weakData = await weakRes.json();
    const weakOk = weakRes.status === 400 && (weakData.code === 'VALIDATION_FAILED' || weakRes.status === 400);
    record('Chặn mật khẩu yếu không hợp lệ (HTTP 400 Validation)', weakOk, `Code: ${weakData.code || weakRes.status}`);
  } catch (err) {
    record('Chặn mật khẩu yếu', false, err.message);
  }

  // 2.5 Login with valid credentials
  let loginToken = null;
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    const loginOk = loginRes.status === 200 && Boolean(loginData.accessToken);
    if (loginOk) loginToken = loginData.accessToken;
    record('Đăng nhập với tài khoản vừa tạo (HTTP 200 & Access Token)', loginOk);
  } catch (err) {
    record('Đăng nhập tài khoản', false, err.message);
  }

  // 2.6 Login with invalid password
  try {
    const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword!',
      }),
    });
    const badLoginData = await badLoginRes.json();
    const badLoginOk = badLoginRes.status === 401 && (badLoginData.code === 'UNAUTHORIZED' || badLoginData.code === 'INVALID_CREDENTIALS');
    record('Từ chối mật khẩu sai an toàn (HTTP 401 Unauthorized)', badLoginOk, `Code: ${badLoginData.code}`);
  } catch (err) {
    record('Từ chối mật khẩu sai', false, err.message);
  }

  // 2.7 Fetch authenticated profile using Bearer token (/api/auth/me & /api/profile)
  try {
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginToken || registeredToken}` },
    });
    const meData = await meRes.json();
    const meOk = meRes.status === 200 && meData.id === registeredUserId && meData.email === testEmail;
    record('Đọc người dùng hiện tại qua JWT Bearer (/api/auth/me)', meOk, `Name: ${meData.displayName}`);
  } catch (err) {
    record('Đọc người dùng hiện tại qua JWT', false, err.message);
  }

  // 2.8 Logout endpoint
  try {
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginToken || registeredToken}` 
      },
    });
    record('Đăng xuất phiên làm việc (HTTP 200)', logoutRes.status === 200);
  } catch (err) {
    record('Đăng xuất phiên làm việc', false, err.message);
  }

  // 3. Leaderboard 7 Categories E2E Testing
  console.log('\n--- [3. Leaderboard 7 Categories REST Pipeline] ---');
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
    try {
      const catRes = await fetch(`${BASE_URL}/api/leaderboard/${cat}`);
      const catData = await catRes.json();
      const catOk = catRes.status === 200 && catData.success === true && catData.category === cat && Array.isArray(catData.entries);
      record(`Category '${cat}': Trả về dữ liệu chuẩn (HTTP 200, success: true)`, catOk, `Total: ${catData.totalCount}, Week: ${catData.weekId}`);
    } catch (err) {
      record(`Category '${cat}'`, false, err.message);
    }
  }

  // 3.8 Current user rank for ineligible/new user
  try {
    const myRankRes = await fetch(`${BASE_URL}/api/leaderboard/weekly_xp/me`, {
      headers: { Authorization: `Bearer ${loginToken || registeredToken}` },
    });
    const myRankData = await myRankRes.json();
    // User hasn't earned XP yet -> found is false, entry is null/omitted, never a fake rank
    const rankOk = myRankRes.status === 200 && myRankData.success === true && myRankData.found === false && !myRankData.entry;
    record('Học viên mới chưa có điểm: Báo found=false & không có rank ảo', rankOk, `Found: ${myRankData.found}, Entry: ${myRankData.entry || 'null/omitted'}`);
  } catch (err) {
    record('Kiểm tra rank học viên mới', false, err.message);
  }

  // 3.9 Guest accessing private rank without JWT
  try {
    const unauthRankRes = await fetch(`${BASE_URL}/api/leaderboard/weekly_xp/me`);
    record('Khách vãng lai gọi endpoint cá nhân: Bị chặn chuẩn HTTP 401', unauthRankRes.status === 401);
  } catch (err) {
    record('Khách gọi endpoint cá nhân', false, err.message);
  }

  // 4. SignalR Realtime Hub Handshake
  console.log('\n--- [4. SignalR Realtime Hub Handshake] ---');
  try {
    const sigRes = await fetch(`${BASE_URL}/hubs/leaderboard/negotiate?negotiateVersion=1`, {
      method: 'POST',
    });
    const sigData = await sigRes.json();
    const sigOk = sigRes.status === 200 && Boolean(sigData.connectionId || sigData.connectionToken);
    record('SignalR Negotiation thành công (HTTP 200, WebSockets)', sigOk, `ConnectionId: ${sigData.connectionId?.substring(0, 8)}...`);
  } catch (err) {
    record('SignalR Negotiation', false, err.message);
  }

  // 5. Cleanup test user safely from SQL Server
  if (registeredUserId) {
    console.log('\n--- [5. Dọn Dẹp An Toàn Dữ Liệu Test (Database Cleanup)] ---');
    try {
      const cleanupSql = `sqlcmd -S localhost -E -C -Q "USE EnglishMasteryDev; DELETE FROM RefreshTokens WHERE UserId = '${registeredUserId}'; DELETE FROM UserProfiles WHERE UserId = '${registeredUserId}'; DELETE FROM AspNetUsers WHERE Id = '${registeredUserId}'"`;
      execSync(cleanupSql);
      record('Dọn dẹp bản ghi test an toàn khỏi EnglishMasteryDev (Chỉ xóa test user)', true, `Deleted: ${registeredUserId}`);
    } catch (err) {
      record('Dọn dẹp bản ghi test an toàn', false, err.message);
    }
  }

  // Summary
  console.log('\n====================================================');
  console.log('📊 KẾT QUẢ TỔNG HỢP KIỂM CHỨNG E2E (PHASE 8)');
  console.log('====================================================');
  const allPass = results.every((r) => r.pass);
  const passedCount = results.filter((r) => r.pass).length;
  console.log(`Tổng số ca kiểm chứng: ${results.length}`);
  console.log(`Thành công (PASS):     ${passedCount}`);
  console.log(`Thất bại (FAIL):       ${results.length - passedCount}`);
  console.log('====================================================');
  if (allPass) {
    console.log('🎉 TẤT CẢ CÁC CA KIỂM CHỨNG E2E ĐỀU ĐẠT CHUẨN (100% PASS)!');
    process.exit(0);
  } else {
    console.error('❌ MỘT SỐ CA KIỂM CHỨNG THẤT BẠI!');
    process.exit(1);
  }
}

runE2E();
