#!/usr/bin/env node

/**
 * ============================================================================
 * SUPABASE SEED EXPORTER (PHASE 3)
 * Project: english-mastery-app
 * Target Output: scripts/seed_10k_vocab.sql
 *
 * Core Capabilities:
 * 1. Loads all unified vocabulary records from:
 *    - src/data/vocab10000.json (Legacy baseline ~3,378 words)
 *    - src/data/vocab1000.json (Oxford Core 1,000 words)
 *    - scripts/corpus/temp_enriched_words.json (Phase 1 newly enriched words)
 * 2. Deduplicates by normalized word (word.toLowerCase().trim()).
 * 3. Chunks into batches of 500 words per INSERT statement:
 *    INSERT INTO vocabularies (id, word, phonetic, pos, meaning, example, example_vi, cefr, topic)
 *    VALUES (...) ON CONFLICT (word) DO NOTHING;
 * 4. Escapes single quotes (' -> '') and removes line breaks to ensure valid SQL.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const SRC_DATA_DIR = path.join(PROJECT_ROOT, 'src/data');
const DEFAULT_OUTPUT_FILE = path.join(PROJECT_ROOT, 'scripts/seed_10k_vocab.sql');
const CHECKPOINT_FILE = path.join(__dirname, 'temp_enriched_words.json');

// Parse CLI flags
const rawArgs = process.argv.slice(2);
let outputFile = DEFAULT_OUTPUT_FILE;
let batchSize = 500;

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if ((arg === '--output' || arg === '-o') && i + 1 < rawArgs.length) {
    outputFile = path.resolve(rawArgs[++i]);
  } else if (arg.startsWith('--output=')) {
    outputFile = path.resolve(arg.split('=')[1]);
  } else if ((arg === '--batch-size' || arg === '-b') && i + 1 < rawArgs.length) {
    batchSize = parseInt(rawArgs[++i], 10);
  } else if (arg.startsWith('--batch-size=')) {
    batchSize = parseInt(arg.split('=')[1], 10);
  }
}

/**
 * Escape chuỗi an toàn tuyệt đối cho câu lệnh SQL của PostgreSQL / Supabase
 */
function escapeSqlString(val) {
  if (val === null || val === undefined) return "''";
  const str = String(val)
    .replace(/'/g, "''")        // Escape single quote
    .replace(/\\/g, "\\\\")     // Escape backslash
    .replace(/\r?\n/g, ' ')     // Chuyển ký tự xuống dòng thành dấu cách
    .trim();
  return `'${str}'`;
}

/**
 * Đọc và hợp nhất toàn bộ dữ liệu từ vựng
 */
function collectAllVocabulary() {
  const wordMap = new Map();

  // 1. Nạp từ src/data/vocab10000.json
  const v10kPath = path.join(SRC_DATA_DIR, 'vocab10000.json');
  if (fs.existsSync(v10kPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(v10kPath, 'utf8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.word) {
            const key = item.word.toLowerCase().trim();
            if (!wordMap.has(key)) {
              wordMap.set(key, {
                id: item.id || `v3k_${wordMap.size + 1}`,
                word: item.word,
                phonetic: item.phonetic || item.ipa || '',
                pos: item.pos || item.partOfSpeech || 'noun',
                meaning: item.meaning || '',
                example: item.example || item.exampleEn || '',
                example_vi: item.example_vi || item.exampleVi || item.exampleMeaning || '',
                cefr: item.cefr || item.level || 'B1',
                topic: item.topic || 'Giao tiếp hàng ngày'
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[WARN] Lỗi khi đọc vocab10000.json: ${err.message}`);
    }
  }

  // 2. Nạp từ src/data/vocab1000.json (bổ sung nếu có từ thiếu)
  const v1kPath = path.join(SRC_DATA_DIR, 'vocab1000.json');
  if (fs.existsSync(v1kPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(v1kPath, 'utf8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.word) {
            const key = item.word.toLowerCase().trim();
            if (!wordMap.has(key)) {
              wordMap.set(key, {
                id: item.id || `v3k_${wordMap.size + 1}`,
                word: item.word,
                phonetic: item.phonetic || item.ipa || '',
                pos: item.partOfSpeech || 'noun',
                meaning: item.meaning || '',
                example: item.exampleEn || item.example || '',
                example_vi: item.exampleVi || item.exampleMeaning || '',
                cefr: item.level || 'A1',
                topic: item.topic || 'Giao tiếp hàng ngày'
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[WARN] Lỗi khi đọc vocab1000.json: ${err.message}`);
    }
  }

  // 3. Nạp từ file Checkpoint Phase 1 (temp_enriched_words.json)
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.word) {
            const key = item.word.toLowerCase().trim();
            if (!wordMap.has(key)) {
              wordMap.set(key, {
                id: item.id,
                word: item.word,
                phonetic: item.phonetic || item.ipa || '',
                pos: item.partOfSpeech || 'noun',
                meaning: item.meaning || '',
                example: item.example || item.exampleEn || '',
                example_vi: item.exampleVi || item.exampleMeaning || '',
                cefr: item.level || 'B2',
                topic: item.topic || 'Học thuật'
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[WARN] Lỗi khi đọc checkpoint file: ${err.message}`);
    }
  }

  return Array.from(wordMap.values());
}

/**
 * Main Generator
 */
function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║    SUPABASE SQL SEED EXPORT ENGINE (PHASE 3)                       ║
╚════════════════════════════════════════════════════════════════════╝
`);

  console.log('🔍 [1/3] Hợp nhất toàn bộ dữ liệu từ vựng...');
  const allVocab = collectAllVocabulary();
  console.log(`   ✔ Tổng số từ vựng duy nhất được nạp: ${allVocab.length.toLocaleString()} từ`);

  console.log(`\n⚙️ [2/3] Xây dựng các khối lệnh SQL (Mỗi mẻ ${batchSize} dòng)...`);

  let sqlContent = `-- ============================================================================\n`;
  sqlContent += `-- SUPABASE BATCH SEED: EXPANDED OXFORD / CEFR VOCABULARY\n`;
  sqlContent += `-- Total Unique Records: ${allVocab.length}\n`;
  sqlContent += `-- Generated At: ${new Date().toISOString()}\n`;
  sqlContent += `-- Batch Size: ${batchSize} words per INSERT block\n`;
  sqlContent += `-- ============================================================================\n\n`;

  // Preamble: Bổ sung cấu trúc bảng & Chỉ mục idempotent
  sqlContent += `-- 1. Bổ sung các cột nếu bảng đã tồn tại nhưng thiếu cấu trúc\n`;
  sqlContent += `CREATE TABLE IF NOT EXISTS vocabularies (\n`;
  sqlContent += `  id text PRIMARY KEY,\n`;
  sqlContent += `  word text NOT NULL,\n`;
  sqlContent += `  phonetic text,\n`;
  sqlContent += `  pos text,\n`;
  sqlContent += `  meaning text,\n`;
  sqlContent += `  example text,\n`;
  sqlContent += `  example_vi text,\n`;
  sqlContent += `  cefr text,\n`;
  sqlContent += `  topic text,\n`;
  sqlContent += `  created_at timestamptz DEFAULT now()\n`;
  sqlContent += `);\n\n`;

  sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS phonetic text;\n`;
  sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS pos text;\n`;
  sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS example text;\n`;
  sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS example_vi text;\n`;
  sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS cefr text;\n`;
  sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS topic text;\n\n`;

  sqlContent += `-- 2. Thiết lập ràng buộc Unique để hỗ trợ chống trùng lặp dữ liệu\n`;
  sqlContent += `CREATE UNIQUE INDEX IF NOT EXISTS vocabularies_word_idx ON vocabularies (word);\n`;
  sqlContent += `CREATE UNIQUE INDEX IF NOT EXISTS vocabularies_lower_word_idx ON vocabularies (LOWER(word));\n\n`;

  sqlContent += `-- ============================================================================\n`;
  sqlContent += `-- 3. BẮT ĐẦU CHÈN DỮ LIỆU THEO CÁC MẺ (${batchSize} TỪ / MẺ)\n`;
  sqlContent += `-- ============================================================================\n\n`;

  const totalBatches = Math.ceil(allVocab.length / batchSize);

  for (let b = 0; b < totalBatches; b++) {
    const startIdx = b * batchSize;
    const endIdx = Math.min(startIdx + batchSize, allVocab.length);
    const chunk = allVocab.slice(startIdx, endIdx);

    sqlContent += `-- --- BATCH ${b + 1}/${totalBatches} (Hàng ${startIdx + 1} đến ${endIdx}) ---\n`;
    sqlContent += `INSERT INTO vocabularies (id, word, phonetic, pos, meaning, example, example_vi, cefr, topic)\nVALUES\n`;

    const rowStrings = chunk.map((item) => {
      const id = escapeSqlString(item.id);
      const word = escapeSqlString(item.word);
      const phonetic = escapeSqlString(item.phonetic);
      const pos = escapeSqlString(item.pos);
      const meaning = escapeSqlString(item.meaning);
      const example = escapeSqlString(item.example);
      const example_vi = escapeSqlString(item.example_vi);
      const cefr = escapeSqlString(item.cefr);
      const topic = escapeSqlString(item.topic);

      return `  (${id}, ${word}, ${phonetic}, ${pos}, ${meaning}, ${example}, ${example_vi}, ${cefr}, ${topic})`;
    });

    sqlContent += rowStrings.join(',\n');
    sqlContent += `\nON CONFLICT (word) DO NOTHING;\n\n`;
  }

  console.log('💾 [3/3] Xuất file SQL seed...');
  fs.writeFileSync(outputFile, sqlContent, 'utf8');

  const stats = fs.statSync(outputFile);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  const sizeKb = (stats.size / 1024).toFixed(1);

  console.log(`\n============================================================`);
  console.log('🎉 XUẤT FILE SUPABASE SEED THÀNH CÔNG:');
  console.log(`• Đường dẫn file       : ${outputFile}`);
  console.log(`• Tổng số từ xuất ra   : ${allVocab.length.toLocaleString()} từ`);
  console.log(`• Tổng số khối INSERT  : ${totalBatches} mẻ (mỗi mẻ ${batchSize} từ)`);
  console.log(`• Kích thước file SQL  : ${sizeMb} MB (${sizeKb} KB)`);
  console.log(`• Cú pháp xung đột     : ON CONFLICT (word) DO NOTHING`);
  console.log(`============================================================\n`);
}

main();
