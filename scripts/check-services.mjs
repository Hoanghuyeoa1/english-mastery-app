// scripts/check-services.mjs
// Lightweight pre-flight diagnostic check for English Mastery Hub development environment

const HEALTH_URL = 'http://localhost:5000/api/health';

console.log('----------------------------------------------------');
console.log('🔍 Kiểm tra trạng thái hệ thống English Mastery Hub:');
console.log('----------------------------------------------------');

try {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  const res = await fetch(HEALTH_URL, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (res.ok) {
    const data = await res.json();
    const env = data.environment ?? data.Environment ?? 'Development';
    const serverTime = data.serverTimeUtc ?? data.ServerTimeUtc ?? 'N/A';
    const isDbConnected = data.database?.canConnect ?? data.Database?.CanConnect ?? false;

    console.log(`[✓] Backend ASP.NET Core: TRỰC TUYẾN (Cổng 5000)`);
    console.log(`    - Môi trường:        ${env}`);
    console.log(`    - Giờ hệ thống UTC:  ${serverTime}`);
    console.log(`    - SQL Server:        ${isDbConnected ? 'KẾT NỐI TỐT (Healthy)' : 'GIÁN ĐOẠN (Degraded)'}`);
    console.log(`    - SignalR Hub:       SẴN SÀNG (http://localhost:5000/hubs/leaderboard)`);
    console.log('----------------------------------------------------');
    console.log('🎉 Hệ thống Backend & Database đã sẵn sàng phục vụ Frontend!');
    process.exit(0);
  } else if (res.status === 503) {
    const data = await res.json().catch(() => null);
    const dbErr = data?.database?.error ?? data?.Database?.Error ?? 'Không thể kết nối đến cơ sở dữ liệu EnglishMasteryDev';
    console.log(`[!] Backend ASP.NET Core: TRỰC TUYẾN (Cổng 5000)`);
    console.log(`    - SQL Server:        GIÁN ĐOẠN (Degraded - HTTP 503)`);
    console.log(`    - Chi tiết lỗi:      ${dbErr}`);
    console.log(`    - Hướng dẫn:         Đảm bảo dịch vụ SQL Server (MSSQLSERVER) đang chạy trên localhost:1433.`);
    console.log('----------------------------------------------------');
    process.exit(1);
  } else {
    console.warn(`[!] Backend phản hồi với mã lỗi HTTP ${res.status}:`);
    const errText = await res.text();
    console.warn(errText);
    process.exit(1);
  }
} catch (err) {
  console.log(`[X] Backend ASP.NET Core: CHƯA KHỞI CHẠY (Cổng 5000 không phản hồi)`);
  console.log(`    - Để khởi động đồng thời cả Frontend Vite, Backend ASP.NET Core và kiểm tra SQL Server:`);
  console.log(`      Chạy: npm run dev`);
  console.log(`    - Hoặc chạy backend riêng: npm run backend`);
  console.log('----------------------------------------------------');
  process.exit(0);
}
