import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MANAGED_START = '<!-- lean-context:start -->';
const MANAGED_END = '<!-- lean-context:end -->';
const DEFAULT_IGNORES = new Set([
  '.git', '.svn', '.hg', 'node_modules', 'vendor', 'dist', 'build', 'out',
  '.next', '.nuxt', '.svelte-kit', '.astro', '.turbo', 'coverage', '.cache',
  '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  'target', 'bin', 'obj', '.gradle', '.idea', '.vscode', '.claude', '.agents', '.DS_Store',
  '.parcel-cache', '.expo', '.expo-shared', 'Pods', 'DerivedData', '.terraform',
  '.serverless', '.yarn', '.pnpm-store', '__snapshots__', '.docusaurus', '.vercel',
  '.firebase', '.tox', '.nyc_output', 'tmp', '.parcel'
]);
const LOCK_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb',
  'poetry.lock', 'Pipfile.lock', 'uv.lock', 'Cargo.lock', 'composer.lock',
  'Gemfile.lock', 'Podfile.lock'
]);
const MAX_DISCOVERED_FILES = 20000;
const MAX_MAP_DIRS = 45;
const MAX_IMPORTANT_FILES = 40;
const DATA_LIKE_EXT = /\.(json|jsonl|csv|tsv|log|sql|xml|txt|yaml|yml|ipynb)$/i;
const PROTECTED_DATA_BASENAMES = new Set(['package.json', 'tsconfig.json', 'composer.json', '.env.example']);
const MAX_DATA_FILE_BYTES = 64 * 1024;
const MAX_EXCLUDED_LISTED = 8;
const SYMBOL_RULES = [
  { ext: /\.(jsx?|tsx?|mjs|cjs)$/i, re: /^[ \t]*export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class)\s+([A-Za-z_$][\w$]*)|^[ \t]*export\s+(?:const|let)\s+([A-Za-z_$][\w$]*)/gm },
  { ext: /\.py$/i, re: /^(?:class|def)\s+([A-Za-z_]\w*)/gm },
  { ext: /\.go$/i, re: /^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/gm },
  { ext: /\.rs$/i, re: /^\s*pub\s+(?:fn|struct|enum|trait)\s+([A-Za-z_]\w*)/gm },
  { ext: /\.java$/i, re: /^\s*(?:public|protected)\s+(?:static\s+)?(?:class|interface|enum)\s+([A-Za-z_]\w*)/gm }
];
const MAX_SYMBOL_FILES = 24;
const MAX_SYMBOLS_PER_FILE = 10;
const MAX_SYMBOL_FILE_BYTES = 48 * 1024;

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function readText(file) {
  try { return await fs.readFile(file, 'utf8'); } catch { return ''; }
}

async function writeText(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text.replace(/\r?\n/g, '\n'), 'utf8');
}

function managedBlock() {
  return `${MANAGED_START}\n## Lean Context protocol\n\n- Treat context as a budget. If the task names an exact file or symbol, work there directly; otherwise consult \`.ai-context/project-map.md\` before broad exploration.\n- Search before opening files, and read the smallest useful range.\n- Skip lockfiles, generated output, vendored dependencies, caches, binaries, and minified assets unless directly relevant.\n- Keep searches, logs, and command output narrow. Run targeted checks first and broaden only when justified.\n- Load deeper docs only when relevant. Prefer the user's request and more specific project/subdirectory instructions when rules overlap.\n${MANAGED_END}`;
}

function replaceManagedSection(original, block) {
  const start = original.indexOf(MANAGED_START);
  const end = original.indexOf(MANAGED_END);
  if (start >= 0 && end >= start) {
    return `${original.slice(0, start).trimEnd()}${original.slice(0, start).trimEnd() ? '\n\n' : ''}${block}${original.slice(end + MANAGED_END.length).trim() ? `\n\n${original.slice(end + MANAGED_END.length).trimStart()}` : '\n'}`;
  }
  return `${original.trimEnd()}${original.trim() ? '\n\n' : ''}${block}\n`;
}

async function updateAgents(root) {
  const file = path.join(root, 'AGENTS.md');
  const original = await readText(file);
  await writeText(file, replaceManagedSection(original, managedBlock()));
}

async function updateClaude(root) {
  const file = path.join(root, 'CLAUDE.md');
  const original = await readText(file);
  const block = `${MANAGED_START}\n@AGENTS.md\n${MANAGED_END}`;
  await writeText(file, replaceManagedSection(original, block));
}

async function listWithGit(root) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], { maxBuffer: 1024 * 1024 });
    if (stdout.trim() !== 'true') return null;
    const result = await execFileAsync('git', ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard'], { maxBuffer: 8 * 1024 * 1024 });
    return result.stdout.split(/\r?\n/).filter(Boolean).slice(0, MAX_DISCOVERED_FILES);
  } catch {
    return null;
  }
}

function shouldIgnoreParts(parts) {
  return parts.some(part => DEFAULT_IGNORES.has(part));
}

async function walk(root) {
  const out = [];
  async function visit(dir, rel = '') {
    if (out.length >= MAX_DISCOVERED_FILES) return;
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const parts = childRel.split('/');
      if (shouldIgnoreParts(parts)) continue;
      if (entry.isDirectory()) await visit(path.join(dir, entry.name), childRel);
      else if (entry.isFile()) out.push(childRel);
      if (out.length >= MAX_DISCOVERED_FILES) return;
    }
  }
  await visit(root);
  return out;
}

function filterFiles(files) {
  return files.filter(rel => {
    const normalized = rel.replace(/\\/g, '/');
    if (normalized === 'AGENTS.md' || normalized === 'CLAUDE.md' || normalized.startsWith('.ai-context/')) return false;
    const parts = normalized.split('/');
    if (shouldIgnoreParts(parts)) return false;
    if (LOCK_FILES.has(parts.at(-1))) return false;
    if (/\.(min\.(js|css)|map|png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|woff2?|ttf|eot|mp4|mov|mp3|wav)$/i.test(normalized)) return false;
    return true;
  });
}

async function partitionOversizedDataFiles(root, files) {
  const kept = [];
  const excluded = [];
  for (const rel of files) {
    const base = rel.split('/').pop();
    if (DATA_LIKE_EXT.test(rel) && !PROTECTED_DATA_BASENAMES.has(base)) {
      let stat;
      try { stat = await fs.stat(path.join(root, rel)); } catch { stat = null; }
      if (stat && stat.size > MAX_DATA_FILE_BYTES) {
        excluded.push({ file: rel, bytes: stat.size });
        continue;
      }
    }
    kept.push(rel);
  }
  excluded.sort((a, b) => b.bytes - a.bytes);
  return { kept, excluded };
}

async function extractSymbolIndex(root, candidateFiles) {
  const out = [];
  for (const rel of candidateFiles) {
    if (out.length >= MAX_SYMBOL_FILES) break;
    const rule = SYMBOL_RULES.find(r => r.ext.test(rel));
    if (!rule) continue;
    const full = path.join(root, rel);
    let stat;
    try { stat = await fs.stat(full); } catch { continue; }
    if (stat.size > MAX_SYMBOL_FILE_BYTES) continue;
    const text = await readText(full);
    const re = new RegExp(rule.re.source, rule.re.flags);
    const names = [];
    let match;
    while ((match = re.exec(text))) {
      const name = match[1] || match[2];
      if (name && !names.includes(name)) names.push(name);
      if (names.length >= MAX_SYMBOLS_PER_FILE) break;
    }
    if (names.length) out.push({ file: rel, symbols: names });
  }
  return out;
}

async function loadPackageJson(root) {
  const file = path.join(root, 'package.json');
  if (!await exists(file)) return null;
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}

function detectStack(files, pkg) {
  const names = new Set(files.map(f => f.replace(/\\/g, '/')));
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const stack = [];
  const add = value => { if (value && !stack.includes(value)) stack.push(value); };
  if (pkg) add('Node.js');
  if (deps.next) add('Next.js');
  if (deps.react || deps['react-dom']) add('React');
  if (deps.vue) add('Vue');
  if (deps.svelte) add('Svelte');
  if (deps.astro) add('Astro');
  if (deps.vite) add('Vite');
  if (deps.express) add('Express');
  if (deps['@nestjs/core']) add('NestJS');
  if (deps['@remix-run/react']) add('Remix');
  if (deps.typescript || [...names].some(x => /\.tsx?$/.test(x))) add('TypeScript');
  if (deps.tailwindcss || names.has('tailwind.config.js') || names.has('tailwind.config.ts')) add('Tailwind CSS');
  if (deps.prisma || deps['@prisma/client'] || names.has('prisma/schema.prisma')) add('Prisma');
  if (deps['@supabase/supabase-js']) add('Supabase');
  if (names.has('pyproject.toml') || names.has('requirements.txt') || [...names].some(x => /\.py$/.test(x))) add('Python');
  if (names.has('go.mod')) add('Go');
  if (names.has('Cargo.toml')) add('Rust');
  if ([...names].some(x => /\.csproj$/.test(x))) add('.NET');
  if (names.has('pom.xml') || names.has('build.gradle') || names.has('build.gradle.kts')) add('Java/JVM');
  return stack;
}

function dirSummary(files) {
  const counts = new Map();
  for (const rel of files) {
    const parts = rel.split('/');
    if (parts.length === 1) continue;
    const one = parts[0];
    counts.set(one, (counts.get(one) || 0) + 1);
    if (parts.length > 2) {
      const two = `${parts[0]}/${parts[1]}`;
      counts.set(two, (counts.get(two) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_MAP_DIRS);
}

function importantFiles(files) {
  const priorities = [
    /(^|\/)README(\.|$)/i,
    /(^|\/)(package\.json|pyproject\.toml|go\.mod|Cargo\.toml|composer\.json|Gemfile)$/,
    /(^|\/)(tsconfig[^/]*\.json|vite\.config\.[^/]+|next\.config\.[^/]+|astro\.config\.[^/]+|svelte\.config\.[^/]+)$/,
    /(^|\/)(docker-compose[^/]*\.ya?ml|Dockerfile|vercel\.json|netlify\.toml)$/,
    /(^|\/)(prisma\/schema\.prisma|drizzle\.config\.[^/]+)$/,
    // Shared logic (data/formatting/util helpers other files import) is exactly
    // what a targeted task needs to find, but rarely matches any other tier.
    /(^|\/)(src\/)?(lib|utils|helpers|services|hooks)\/[^/]+\.(tsx?|jsx?|py|go|rs)$/,
    /(^|\/)(src|app|pages)\/(index|main|entry|layout|page)\.[^/]+$/,
    /(^|\/)\.env\.example$/
  ];
  return files
    .map(file => ({ file, score: priorities.reduce((s, re, i) => s + (re.test(file) ? (priorities.length - i) * 10 : 0), 0) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, MAX_IMPORTANT_FILES)
    .map(x => x.file);
}

function scriptsSection(pkg) {
  if (!pkg?.scripts) return ['- No package scripts detected.'];
  const preferred = ['dev', 'build', 'test', 'lint', 'typecheck', 'check', 'format', 'start'];
  const keys = Object.keys(pkg.scripts);
  const chosen = [...preferred.filter(k => keys.includes(k)), ...keys.filter(k => !preferred.includes(k)).slice(0, 6)];
  return chosen.map(k => `- \`npm run ${k}\` — ${pkg.scripts[k]}`);
}

function fingerprint(files, pkgText = '') {
  const hash = crypto.createHash('sha256');
  hash.update(files.join('\n'));
  hash.update('\n');
  hash.update(pkgText);
  return hash.digest('hex').slice(0, 16);
}

async function scan(root) {
  const viaGit = await listWithGit(root);
  const raw = viaGit || await walk(root);
  const preFilter = filterFiles(raw).sort();
  const { kept: files, excluded } = await partitionOversizedDataFiles(root, preFilter);
  const pkg = await loadPackageJson(root);
  const pkgText = pkg ? JSON.stringify({ scripts: pkg.scripts || {}, dependencies: pkg.dependencies || {}, devDependencies: pkg.devDependencies || {} }) : '';
  const important = importantFiles(files);
  const symbols = await extractSymbolIndex(root, important);
  return {
    files,
    pkg,
    stack: detectStack(files, pkg),
    dirs: dirSummary(files),
    important,
    symbols,
    excludedLarge: excluded.slice(0, MAX_EXCLUDED_LISTED),
    excludedLargeTotal: excluded.length,
    fingerprint: fingerprint(files, pkgText),
    source: viaGit ? 'git' : 'filesystem'
  };
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

function renderSymbolsSection(symbols) {
  if (!symbols.length) return '- No symbol index generated for this snapshot.';
  return symbols.map(entry => `- \`${entry.file}\`: ${entry.symbols.join(', ')}`).join('\n');
}

function renderExcludedSection(data) {
  if (!data.excludedLargeTotal) return '- None. No oversized generated/data files detected.';
  const shown = data.excludedLarge.map(x => `- \`${x.file}\` (${formatBytes(x.bytes)})`).join('\n');
  const remaining = data.excludedLargeTotal - data.excludedLarge.length;
  const tail = remaining > 0 ? `\n- …and ${remaining} more oversized data-like file(s), not indexed.` : '';
  return `${shown}${tail}`;
}

function renderMap(data) {
  const now = new Date().toISOString();
  return `# Project map\n\n> Generated by lean-context. This file is navigation context, not a substitute for reading the exact code you are changing.\n\n## Snapshot\n\n- Generated: ${now}\n- Fingerprint: \`${data.fingerprint}\`\n- Discovery: ${data.source}\n- Relevant files indexed: ${data.files.length}\n- Detected stack: ${data.stack.length ? data.stack.join(', ') : 'Generic / not confidently detected'}\n\n## Preferred commands\n\n${scriptsSection(data.pkg).join('\n')}\n\n## High-signal files\n\n${data.important.length ? data.important.map(x => `- \`${x}\``).join('\n') : '- No high-signal files detected automatically.'}\n\n## Key symbols\n\nTop-level exports/definitions in high-signal files, so you can grep for a name instead of reading the whole file.\n\n${renderSymbolsSection(data.symbols)}\n\n## Directory map\n\n${data.dirs.length ? data.dirs.map(([dir, count]) => `- \`${dir}/\` — ${count} indexed files`).join('\n') : '- Flat or very small project.'}\n\n## Excluded oversized data-like files (>${formatBytes(MAX_DATA_FILE_BYTES)})\n\nThese were skipped during indexing (fixtures, dumps, logs). If you must use one, read a narrow range — do not cat the whole file.\n\n${renderExcludedSection(data)}\n\n## Context discipline\n\nUse this map to choose where to search next. Open only files needed for the current task. Search for symbols before reading large modules, and avoid generated/vendor/lockfile content unless directly relevant.\n`;
}

async function writeState(root, data) {
  const file = path.join(root, '.ai-context', 'state.json');
  await writeText(file, JSON.stringify({ version: 1, fingerprint: data.fingerprint, generatedAt: new Date().toISOString() }, null, 2) + '\n');
}

async function writeMap(root, data) {
  await writeText(path.join(root, '.ai-context', 'project-map.md'), renderMap(data));
  await writeState(root, data);
}

async function ensureIgnore(root) {
  const file = path.join(root, '.ai-context', '.gitignore');
  if (!await exists(file)) await writeText(file, '# Local-only lean-context scratch data\n*.tmp\n');
}

async function copyFileEnsuringDir(source, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(source, dest);
}

async function installChatIntegrations(root) {
  const sharedSkillRoot = path.join(root, '.agents', 'skills', 'lean-context');
  const claudeSkillRoot = path.join(root, '.claude', 'skills', 'lean-context');
  const toolRoot = path.join(root, '.ai-context', 'tool');

  await copyFileEnsuringDir(
    path.join(PACKAGE_ROOT, 'templates', 'skills', 'shared', 'SKILL.md'),
    path.join(sharedSkillRoot, 'SKILL.md')
  );
  await copyFileEnsuringDir(
    path.join(PACKAGE_ROOT, 'templates', 'skills', 'shared', 'agents', 'openai.yaml'),
    path.join(sharedSkillRoot, 'agents', 'openai.yaml')
  );
  await copyFileEnsuringDir(
    path.join(PACKAGE_ROOT, 'templates', 'skills', 'claude', 'SKILL.md'),
    path.join(claudeSkillRoot, 'SKILL.md')
  );

  await copyFileEnsuringDir(path.join(PACKAGE_ROOT, 'lib', 'index.js'), path.join(toolRoot, 'lib', 'index.js'));
  await copyFileEnsuringDir(path.join(PACKAGE_ROOT, 'bin', 'lean-context.js'), path.join(toolRoot, 'bin', 'lean-context.js'));
  await writeText(path.join(toolRoot, 'package.json'), JSON.stringify({ type: 'module', private: true }, null, 2) + '\n');

  console.log('Chat integrations enabled:');
  console.log('- Claude Code: /lean-context [smart|refresh|check|stats|init]');
  console.log('- Codex: $lean-context [smart|refresh|check|stats|init] (or choose it via /skills)');
  console.log('- Antigravity: /lean-context [smart|refresh|check|stats|init]');
}

function roughTokens(text) {
  return Math.ceil(text.length / 4);
}

export async function initProject(root, options = {}) {
  if (!await exists(root)) throw new Error(`project path does not exist: ${root}`);
  const data = await scan(root);
  await updateAgents(root);
  await updateClaude(root);
  await writeMap(root, data);
  await ensureIgnore(root);
  if (options.chat) await installChatIntegrations(root);
  const agents = await readText(path.join(root, 'AGENTS.md'));
  const claude = await readText(path.join(root, 'CLAUDE.md'));
  console.log(`Initialized lean-context in ${root}`);
  console.log(`Always-on managed context: ~${roughTokens(managedBlock())} tokens (+ any pre-existing instructions)`);
  console.log(`Project map: ${data.files.length} relevant files -> .ai-context/project-map.md`);
  console.log(`Shared entrypoint: AGENTS.md; Claude imports it through CLAUDE.md`);
  if (agents.length + claude.length > 24000) console.log('Warning: existing root instruction files are large; run lean-context stats.');
}

export async function enableChat(root) {
  if (!await exists(root)) throw new Error(`project path does not exist: ${root}`);
  await initProject(root, { chat: true });
}

export async function refreshProject(root) {
  if (!await exists(root)) throw new Error(`project path does not exist: ${root}`);
  const data = await scan(root);
  await writeMap(root, data);
  console.log(`Refreshed .ai-context/project-map.md (${data.files.length} relevant files, fingerprint ${data.fingerprint})`);
}

export async function showStats(root) {
  const paths = [
    ['AGENTS.md', path.join(root, 'AGENTS.md'), 'always-on for Codex / Antigravity'],
    ['CLAUDE.md', path.join(root, 'CLAUDE.md'), 'always-on for Claude Code'],
    ['.ai-context/project-map.md', path.join(root, '.ai-context', 'project-map.md'), 'on-demand navigation']
  ];
  let totalAlways = 0;
  console.log('lean-context approximate token footprint (chars / 4):');
  for (const [label, file, mode] of paths) {
    const text = await readText(file);
    const tokens = roughTokens(text);
    console.log(`- ${label}: ~${tokens} tokens (${mode})`);
    if (label !== '.ai-context/project-map.md') totalAlways += tokens;
  }
  console.log(`Approx. root instruction footprint before provider/system context: ~${totalAlways} tokens`);
  console.log('Note: actual billing/context usage depends on the IDE, model, caching, conversation history, tools, and files read.');
}

async function getMapStatus(root) {
  const stateText = await readText(path.join(root, '.ai-context', 'state.json'));
  if (!stateText) return { current: false, missing: true };
  let state;
  try { state = JSON.parse(stateText); } catch { return { current: false, invalid: true }; }
  const data = await scan(root);
  return { current: state.fingerprint === data.fingerprint, state, data };
}

export async function checkProject(root) {
  const status = await getMapStatus(root);
  if (status.missing) {
    console.log('No lean-context state found. Run: lean-context init');
    process.exitCode = 2;
    return false;
  }
  if (status.invalid) throw new Error('invalid .ai-context/state.json');
  if (status.current) {
    console.log('Project map is current.');
    return true;
  }
  console.log(`Project map is stale: ${status.state.fingerprint} -> ${status.data.fingerprint}`);
  console.log('Run: lean-context refresh');
  process.exitCode = 2;
  return false;
}

export async function smartProject(root) {
  if (!await exists(root)) throw new Error(`project path does not exist: ${root}`);
  const status = await getMapStatus(root);
  if (status.missing || status.invalid) {
    console.log(status.missing ? 'Lean-context state missing; repairing initialization.' : 'Lean-context state invalid; repairing initialization.');
    await initProject(root);
  } else if (!status.current) {
    console.log(`Project map is stale: ${status.state.fingerprint} -> ${status.data.fingerprint}`);
    await refreshProject(root);
  } else {
    console.log('Project map is current.');
  }
  await showStats(root);
}
