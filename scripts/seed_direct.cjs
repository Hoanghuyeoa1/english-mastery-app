/**
 * Script nạp trực tiếp kho từ vựng vào Supabase table `vocabularies`
 * Tự động chia batch 200 từ, tự động phát hiện các cột của bảng.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Đọc biến môi trường từ .env
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    console.error('Không tìm thấy file .env tại:', envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        env[key] = val;
      }
    }
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log('--- BẮT ĐẦU SEED TỪ VỰNG TRỰC TIẾP LÊN SUPABASE ---');
  console.log('Supabase URL:', supabaseUrl);

  // 2. Đọc file từ vựng
  const dataFilePath = path.resolve(__dirname, '../src/data/vocab5000.json');
  if (!fs.existsSync(dataFilePath)) {
    console.error('Không tìm thấy file:', dataFilePath);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
  console.log(`Đã đọc ${rawData.length} từ vựng từ ${dataFilePath}`);

  // Deduplicate by lower(word)
  const map = new Map();
  for (const item of rawData) {
    if (item && item.word) {
      const key = item.word.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
  }
  const uniqueWords = Array.from(map.values());
  console.log(`Số lượng từ vựng độc bản chuẩn bị nạp: ${uniqueWords.length}`);

  // 3. Kiểm tra xem các cột mở rộng có tồn tại trong database không
  let supportsExtendedColumns = true;
  const testSample = uniqueWords[0];
  const testPayloadExtended = {
    word: '__test_probe_word__',
    phonetic: testSample.phonetic || testSample.ipa || '',
    meaning: 'Từ kiểm tra thăm dò',
    example: testSample.exampleEn || testSample.example || '',
    category: testSample.topic || 'General',
    level: testSample.level || 'A1',
    ipa: testSample.ipa || testSample.phonetic || '',
    part_of_speech: testSample.partOfSpeech || 'noun',
    example_en: testSample.exampleEn || testSample.example || '',
    example_vi: testSample.exampleVi || '',
    topic: testSample.topic || 'Giao tiếp hàng ngày'
  };

  const { error: probeError } = await supabase
    .from('vocabularies')
    .insert([testPayloadExtended]);

  if (probeError) {
    if (probeError.message.includes('column') || probeError.message.includes('schema')) {
      console.log('Bảng vocabularies dùng bộ 6 cột cơ bản (word, phonetic, meaning, example, category, level).');
      supportsExtendedColumns = false;
    } else if (probeError.message.includes('row-level security') || probeError.message.includes('violates row-level security policy')) {
      console.warn('CẢNH BÁO RLS: Khóa ANON KEY bị chặn ghi bởi Row Level Security của Supabase!');
      console.warn('Chi tiết lỗi:', probeError.message);
      console.warn('Vui lòng thêm SUPABASE_SERVICE_ROLE_KEY vào .env hoặc bật quyền INSERT cho anon trên bảng vocabularies.');
      process.exit(1);
    } else {
      console.log('Probe note:', probeError.message);
      supportsExtendedColumns = false;
    }
  } else {
    console.log('Bảng vocabularies hỗ trợ đầy đủ tất cả các cột mở rộng (ipa, part_of_speech, example_en, example_vi, topic)!');
    // Xóa từ thăm dò
    await supabase.from('vocabularies').delete().eq('word', '__test_probe_word__');
  }

  // 4. Lấy danh sách từ đã có sẵn trong database để tránh trùng lặp
  console.log('Đang kiểm tra các từ đã có sẵn trên Supabase...');
  const existingWords = new Set();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('vocabularies')
      .select('word')
      .range(from, from + pageSize - 1);
    
    if (error) {
      console.warn('Lỗi lấy danh sách từ có sẵn:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    data.forEach(r => {
      if (r.word) existingWords.add(r.word.toLowerCase().trim());
    });
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Đã có ${existingWords.size} từ tồn tại sẵn trên database.`);

  // 5. Lọc ra những từ mới chưa có trong database
  const wordsToInsert = uniqueWords.filter(w => !existingWords.has(w.word.toLowerCase().trim()));
  console.log(`Số từ mới cần nạp thêm vào database: ${wordsToInsert.length} từ.`);

  if (wordsToInsert.length === 0) {
    console.log('Toàn bộ từ vựng đã có sẵn trong bảng vocabularies! Không cần insert thêm.');
    return;
  }

  // 6. Chia batch 200 từ và nạp tuần tự
  const BATCH_SIZE = 200;
  let totalInserted = 0;
  let failedCount = 0;

  for (let i = 0; i < wordsToInsert.length; i += BATCH_SIZE) {
    const batch = wordsToInsert.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(wordsToInsert.length / BATCH_SIZE);

    const payload = batch.map(item => {
      const record = {
        word: item.word.trim(),
        phonetic: item.phonetic || item.ipa || '',
        meaning: item.meaning ? item.meaning.trim() : '',
        example: (item.exampleEn || item.example || '').trim(),
        category: (item.topic || item.tag || 'General').trim(),
        level: (item.level || 'B1').trim()
      };

      if (supportsExtendedColumns) {
        record.ipa = item.ipa || item.phonetic || '';
        record.part_of_speech = item.partOfSpeech || 'noun';
        record.example_en = item.exampleEn || item.example || '';
        record.example_vi = item.exampleVi || item.exampleMeaning || '';
        record.topic = item.topic || 'Giao tiếp hàng ngày';
      }

      return record;
    });

    const { data, error } = await supabase
      .from('vocabularies')
      .insert(payload);

    if (error) {
      console.error(`Batch ${batchNum}/${totalBatches} [${batch.length} từ] THẤT BẠI:`, error.message);
      failedCount += batch.length;
    } else {
      totalInserted += batch.length;
      console.log(`✓ Batch ${batchNum}/${totalBatches}: Đã insert thành công ${batch.length} từ (Tổng tiến độ: ${totalInserted}/${wordsToInsert.length})`);
    }
  }

  console.log('\n=============================================');
  console.log('KẾT QUẢ NẠP DỮ LIỆU TỪ VỰNG LÊN SUPABASE:');
  console.log(`- Số lượng bản ghi đã insert thành công: ${totalInserted} từ`);
  if (failedCount > 0) {
    console.log(`- Số lượng bản ghi thất bại: ${failedCount} từ`);
  }
  console.log(`- Tổng số từ hiện có trên bảng vocabularies: ${existingWords.size + totalInserted} từ`);
  console.log('=============================================\n');
}

main().catch(err => {
  console.error('Lỗi nghiêm trọng:', err);
  process.exit(1);
});
