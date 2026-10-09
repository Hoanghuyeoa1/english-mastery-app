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

const allFiles = walk('src');
console.log(`Analyzing ${allFiles.length} source files...`);

function getImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Match ES6 imports: import ... from '...' or import '...'
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"](.*?)['"]/g;
  const imports = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

const graph = new Map();
const fileNormalizedMap = new Map();

for (const f of allFiles) {
  const norm = path.normalize(path.resolve(f)).toLowerCase();
  fileNormalizedMap.set(norm, f);
  graph.set(norm, []);
}

function resolveImport(sourceFile, importPath) {
  if (!importPath.startsWith('.')) {
    // External package
    return null;
  }
  const dir = path.dirname(sourceFile);
  const candidateBase = path.resolve(dir, importPath);
  const possiblePaths = [
    candidateBase,
    candidateBase + '.ts',
    candidateBase + '.tsx',
    path.join(candidateBase, 'index.ts'),
    path.join(candidateBase, 'index.tsx')
  ];

  for (const p of possiblePaths) {
    const norm = path.normalize(p).toLowerCase();
    if (fileNormalizedMap.has(norm)) {
      return norm;
    }
  }
  return null;
}

// Build graph & check layering rules
const illegalLayers = [];

for (const sourceNorm of graph.keys()) {
  const sourceReal = fileNormalizedMap.get(sourceNorm);
  const relSource = path.relative(process.cwd(), sourceReal).replace(/\\/g, '/');
  const imps = getImports(sourceReal);

  for (const imp of imps) {
    const targetNorm = resolveImport(sourceReal, imp);
    if (targetNorm) {
      graph.get(sourceNorm).push(targetNorm);

      const targetReal = fileNormalizedMap.get(targetNorm);
      const relTarget = path.relative(process.cwd(), targetReal).replace(/\\/g, '/');

      // Rule A: store cannot import components
      if (relSource.startsWith('src/store/') && relTarget.startsWith('src/components/')) {
        illegalLayers.push({ type: 'STORE -> COMPONENT', from: relSource, to: relTarget });
      }

      // Rule B: service cannot import components
      if (relSource.startsWith('src/services/') && relTarget.startsWith('src/components/')) {
        illegalLayers.push({ type: 'SERVICE -> COMPONENT', from: relSource, to: relTarget });
      }

      // Rule C: types cannot import service, store, or component
      if (relSource.startsWith('src/types/') && (
        relTarget.startsWith('src/services/') ||
        relTarget.startsWith('src/store/') ||
        relTarget.startsWith('src/components/')
      )) {
        illegalLayers.push({ type: 'TYPES -> HIGHER_LAYER', from: relSource, to: relTarget });
      }
    }
  }
}

// Cycle Detection (Tarjan / DFS)
const visited = new Set();
const stack = new Set();
const cycles = [];

function dfs(node, pathStack = []) {
  visited.add(node);
  stack.add(node);
  pathStack.push(node);

  const neighbors = graph.get(node) || [];
  for (const next of neighbors) {
    if (!visited.has(next)) {
      dfs(next, [...pathStack]);
    } else if (stack.has(next)) {
      const cycleStartIdx = pathStack.indexOf(next);
      const cycle = pathStack.slice(cycleStartIdx).concat(next).map(p => {
        return path.relative(process.cwd(), fileNormalizedMap.get(p)).replace(/\\/g, '/');
      });
      cycles.push(cycle);
    }
  }

  stack.delete(node);
}

for (const node of graph.keys()) {
  if (!visited.has(node)) {
    dfs(node);
  }
}

console.log('--- AUDIT RESULTS ---');
console.log(`Total Cycles Found: ${cycles.length}`);
if (cycles.length > 0) {
  console.log('CYCLES:');
  cycles.forEach((c, idx) => {
    console.log(`  [Cycle ${idx + 1}]: ${c.join(' -> ')}`);
  });
} else {
  console.log('PASS: Zero circular dependencies in the codebase!');
}

console.log(`Illegal Layer Violations: ${illegalLayers.length}`);
if (illegalLayers.length > 0) {
  console.log('LAYER VIOLATIONS:');
  illegalLayers.forEach((v, idx) => {
    console.log(`  [Violation ${idx + 1}]: (${v.type}) ${v.from} -> ${v.to}`);
  });
} else {
  console.log('PASS: Zero architectural layering violations (store/service -> component)!');
}
