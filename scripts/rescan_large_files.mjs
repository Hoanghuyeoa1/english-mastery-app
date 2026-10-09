import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.git' && item !== 'dist' && item !== '__tests__') {
        results = results.concat(walk(full));
      }
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

const files = walk('src');

const stats = files.map(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n').length;
  const bytes = fs.statSync(file).size;
  const importMatches = content.match(/(?:import|export)\s+(?:[\s\S]*?from\s+)?['"][^'"]+['"]/g) || [];
  const exportMatches = content.match(/export\s+(?:const|function|class|type|interface|enum|default|\*|\{)/g) || [];
  
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
  return {
    path: relPath,
    lines,
    bytes,
    kb: (bytes / 1024).toFixed(1),
    imports: importMatches.length,
    exports: exportMatches.length,
  };
});

stats.sort((a, b) => b.lines - a.lines);

console.log('--- RE-SCAN: TOP 35 LARGEST FILES (> 500 lines) ---');
const largeFiles = stats.filter(s => s.lines >= 500);
largeFiles.forEach((f, idx) => {
  console.log(`${idx + 1}. [${f.lines} lines | ${f.kb} KB | ${f.imports} imps | ${f.exports} exps] ${f.path}`);
});

console.log(`\nTotal source files scanned: ${stats.length}`);
console.log(`Files >= 1200 lines: ${stats.filter(s => s.lines >= 1200).length}`);
console.log(`Files 800 - 1199 lines: ${stats.filter(s => s.lines >= 800 && s.lines < 1200).length}`);
console.log(`Files 500 - 799 lines: ${stats.filter(s => s.lines >= 500 && s.lines < 800).length}`);
console.log(`Files < 500 lines: ${stats.filter(s => s.lines < 500).length}`);
