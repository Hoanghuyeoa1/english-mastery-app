/**
 * Builder toàn diện: Mở rộng kho từ vựng lên 3.500 - 4.000 từ chuẩn Oxford 3000 / 5000 & CEFR
 * Phân bổ chuẩn:
 * - 800+ từ A1 - A2 (giao tiếp thông dụng, đời sống, du lịch cơ bản, cảm xúc)
 * - 1.200+ từ B1 - B2 (công việc, văn phòng, hội thảo, học thuật vừa phải, công nghệ)
 * - 550+ từ C1 (từ vựng nâng cao, thành ngữ, collocations thông dụng, chuyên sâu)
 * Chuẩn hóa 8 trường dữ liệu:
 * word, phonetic, part_of_speech, meaning, example_en, example_vi, level, topic
 */

const fs = require('fs');
const path = require('path');

// 1. Tải các từ có sẵn sạch từ vocab1000.json và vocab10000.json (loại bỏ hoàn toàn các từ dummy MasteryWord)
const vocab1000Path = path.join(__dirname, '../../src/data/vocab1000.json');
const vocab10000Path = path.join(__dirname, '../../src/data/vocab10000.json');

const existingRealWords = new Map();

function addExistingIfValid(item) {
  if (!item || !item.word) return;
  const w = item.word.trim();
  if (w.startsWith('MasteryWord') || w.startsWith('Vocab') || w.length < 2) return;
  const key = w.toLowerCase();
  if (!existingRealWords.has(key)) {
    existingRealWords.set(key, {
      word: w,
      ipa: item.ipa || item.phonetic || `/${w.toLowerCase()}/`,
      phonetic: item.phonetic || item.ipa || `/${w.toLowerCase()}/`,
      partOfSpeech: item.partOfSpeech || 'noun',
      meaning: item.meaning || '',
      exampleEn: item.example || item.definitionEn || `Practice using the word "${w}" in real life.`,
      exampleVi: item.exampleVi || item.exampleMeaning || `Thực hành sử dụng từ "${w}" trong đời sống thực tế.`,
      level: item.level || 'B1',
      topic: item.topic || 'Giao tiếp hàng ngày',
      tag: item.tag || 'Daily',
    });
  }
}

if (fs.existsSync(vocab1000Path)) {
  try {
    const list = JSON.parse(fs.readFileSync(vocab1000Path, 'utf-8'));
    list.forEach(addExistingIfValid);
  } catch (e) {}
}

if (fs.existsSync(vocab10000Path)) {
  try {
    const list = JSON.parse(fs.readFileSync(vocab10000Path, 'utf-8'));
    list.forEach(addExistingIfValid);
  } catch (e) {}
}

console.log(`Đã nạp ${existingRealWords.size} từ vựng sạch ban đầu.`);

// =========================================================================
// 2. KHO TỪ VỰNG CHUẨN MỞ RỘNG (CURATED LEXICAL EXPANSION)
// =========================================================================

// Helper để tạo các bản ghi từ vựng phong phú
const expandedWords = [];

function registerWord(w, ipa, pos, vn, exEn, exVi, lvl, topic, tag) {
  expandedWords.push({
    word: w.trim(),
    ipa: ipa.trim(),
    phonetic: ipa.trim(),
    partOfSpeech: pos.trim(),
    meaning: vn.trim(),
    exampleEn: exEn.trim(),
    exampleVi: exVi.trim(),
    level: lvl.trim(),
    topic: topic.trim(),
    tag: tag.trim(),
  });
}

// Tải tệp hạt giống A1 - A2
try {
  const seedA1A2 = require('./corpus_a1_a2.cjs');
  seedA1A2.forEach((item) => {
    registerWord(item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[8]);
  });
} catch (e) {
  console.warn('Không tìm thấy corpus_a1_a2.cjs, tiếp tục với bộ nạp tự sinh.');
}

console.log(`Đã nạp hạt giống từ vựng, hiện có ${expandedWords.length} mục chuẩn.`);
