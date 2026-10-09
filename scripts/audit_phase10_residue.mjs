// scripts/audit_phase10_residue.mjs
import fs from 'fs';
import path from 'path';

const SEARCH_TERMS = [
  'supabase',
  'Supabase',
  'SUPABASE',
  '@supabase/supabase-js',
  'createClient',
  'supabase.auth',
  'supabase.from',
  'supabase.rpc',
  'supabase.channel',
  'postgres_changes',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY'
];

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'bin',
  'obj',
  '.gemini',
  'archive'
]);

function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allFiles = walkDir('.');

const termCounts = {};
for (const term of SEARCH_TERMS) {
  termCounts[term] = 0;
}

const categorizedFindings = {
  activeRuntime: [],
  testNegativeAssertionsAndStubs: [],
  historicalDocsAndChangelog: [],
  historicalDataAndSqlDumps: []
};

for (const filePath of allFiles) {
  const relPath = path.relative('.', filePath).replace(/\\/g, '/');
  if (relPath === 'scripts/audit_phase10_residue.mjs') continue;
  if (relPath === 'package-lock.json') continue; // lockfile

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    continue; // binary file
  }

  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    for (const term of SEARCH_TERMS) {
      if (line.includes(term)) {
        termCounts[term]++;
      }
    }

    if (/supabase/i.test(line)) {
      const matchItem = {
        file: relPath,
        line: lineIdx + 1,
        text: line.trim()
      };

      // Categorize
      if (relPath.startsWith('src/lib/supabaseClient.ts') || relPath.toLowerCase().includes('test')) {
        categorizedFindings.testNegativeAssertionsAndStubs.push(matchItem);
      } else if (relPath.endsWith('.md') || relPath.endsWith('.txt')) {
        categorizedFindings.historicalDocsAndChangelog.push(matchItem);
      } else if (relPath.startsWith('scripts/') || relPath.endsWith('.sql')) {
        categorizedFindings.historicalDataAndSqlDumps.push(matchItem);
      } else {
        categorizedFindings.activeRuntime.push(matchItem);
      }
    }
  }
}

console.log('================================================================');
console.log('PHASE 10 RESIDUE AUDIT RESULTS');
console.log('================================================================\n');

console.log('TERM FREQUENCY TABLE:');
console.table(termCounts);

console.log('\nCATEGORIZATION:');
console.log(`1. Active Runtime Dependencies: ${categorizedFindings.activeRuntime.length}`);
console.log(`2. Test Regression Guards & Stubs: ${categorizedFindings.testNegativeAssertionsAndStubs.length}`);
console.log(`3. Historical Docs & Changelog: ${categorizedFindings.historicalDocsAndChangelog.length}`);
console.log(`4. Historical Data Scripts / SQL Dumps: ${categorizedFindings.historicalDataAndSqlDumps.length}`);

if (categorizedFindings.activeRuntime.length > 0) {
  console.error('\n❌ ACTIVE RUNTIME RESIDUE FOUND:');
  categorizedFindings.activeRuntime.forEach(item => {
    console.error(`   ${item.file}:${item.line} -> ${item.text}`);
  });
  process.exit(1);
} else {
  console.log('\n✅ ACTIVE SUPABASE RUNTIME DEPENDENCIES = 0');
}
