import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initProject, enableChat, refreshProject, checkProject } from '../lib/index.js';

const execFileAsync = promisify(execFile);

test('init preserves existing instructions and creates managed context files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lean-context-'));
  await fs.writeFile(path.join(dir, 'AGENTS.md'), '# Existing\n\nKeep me.\n');
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' }, dependencies: { react: '^19.0.0' } }));
  await fs.mkdir(path.join(dir, 'src'));
  await fs.writeFile(path.join(dir, 'src', 'main.js'), 'console.log("hi")\n');

  await initProject(dir);

  const agents = await fs.readFile(path.join(dir, 'AGENTS.md'), 'utf8');
  const claude = await fs.readFile(path.join(dir, 'CLAUDE.md'), 'utf8');
  const map = await fs.readFile(path.join(dir, '.ai-context', 'project-map.md'), 'utf8');
  assert.match(agents, /Keep me\./);
  assert.match(agents, /Lean Context protocol/);
  assert.match(claude, /@AGENTS\.md/);
  assert.match(map, /React/);
  assert.match(map, /npm run test/);
});

test('refresh updates map after project structure changes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lean-context-'));
  await fs.writeFile(path.join(dir, 'package.json'), '{}');
  await initProject(dir);
  await fs.mkdir(path.join(dir, 'app'));
  await fs.writeFile(path.join(dir, 'app', 'page.tsx'), 'export default function Page() {}\n');
  await refreshProject(dir);
  const map = await fs.readFile(path.join(dir, '.ai-context', 'project-map.md'), 'utf8');
  assert.match(map, /app\/page\.tsx/);
  await checkProject(dir);
});

test('init is idempotent and check is current immediately after init', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lean-context-'));
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ scripts: { build: 'echo build' } }));
  await initProject(dir);
  await checkProject(dir);
  const once = await fs.readFile(path.join(dir, 'AGENTS.md'), 'utf8');
  await initProject(dir);
  const twice = await fs.readFile(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.equal((twice.match(/<!-- lean-context:start -->/g) || []).length, 1);
  assert.equal(once, twice);
  await checkProject(dir);
});

test('chat mode installs Claude and shared Codex/Antigravity skills plus offline runner', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lean-context-'));
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  await fs.mkdir(path.join(dir, 'src'));
  await fs.writeFile(path.join(dir, 'src', 'index.js'), 'export const ok = true;\n');

  await initProject(dir, { chat: true });

  const claudeSkill = await fs.readFile(path.join(dir, '.claude', 'skills', 'lean-context', 'SKILL.md'), 'utf8');
  const sharedSkill = await fs.readFile(path.join(dir, '.agents', 'skills', 'lean-context', 'SKILL.md'), 'utf8');
  const codexMeta = await fs.readFile(path.join(dir, '.agents', 'skills', 'lean-context', 'agents', 'openai.yaml'), 'utf8');
  const runner = path.join(dir, '.ai-context', 'tool', 'bin', 'lean-context.js');

  assert.match(claudeSkill, /disable-model-invocation: true/);
  assert.match(sharedSkill, /vendored local runner/);
  assert.match(codexMeta, /allow_implicit_invocation: false/);
  await fs.access(runner);

  const { stdout } = await execFileAsync(process.execPath, [runner, 'stats', '.'], { cwd: dir });
  assert.match(stdout, /approximate token footprint/);

  const oldExit = process.exitCode;
  process.exitCode = undefined;
  await checkProject(dir);
  assert.equal(process.exitCode, undefined);
  process.exitCode = oldExit;
});

test('chat command can be enabled after a normal init', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lean-context-'));
  await fs.writeFile(path.join(dir, 'package.json'), '{}');
  await initProject(dir);
  await assert.rejects(fs.access(path.join(dir, '.claude', 'skills', 'lean-context', 'SKILL.md')));
  await enableChat(dir);
  await fs.access(path.join(dir, '.claude', 'skills', 'lean-context', 'SKILL.md'));
  await fs.access(path.join(dir, '.agents', 'skills', 'lean-context', 'SKILL.md'));
});
