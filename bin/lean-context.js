#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs/promises';
import { initProject, enableChat, refreshProject, showStats, checkProject, smartProject } from '../lib/index.js';

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith('-') ? args[0] : 'help';
const targetArg = args.find((a, i) => i > 0 && !a.startsWith('-'));
const target = path.resolve(targetArg || process.cwd());
const force = args.includes('--force');
const chat = args.includes('--chat');

function flagValue(name) {
  const prefix = `--${name}=`;
  const arg = args.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function readText(file) {
  try { return await fs.readFile(file, 'utf8'); } catch { return ''; }
}

function roughTokens(text) {
  return Math.ceil(text.length / 4);
}

function parseUsageNumber(value, label) {
  if (value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a non-negative number`);
  return Math.round(number);
}

function formatted(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

async function generateTokenReport(root, options = {}) {
  const contextFiles = [
    ['AGENTS.md', path.join(root, 'AGENTS.md'), 'Always-on for Codex / Antigravity'],
    ['CLAUDE.md', path.join(root, 'CLAUDE.md'), 'Always-on for Claude Code'],
    ['.ai-context/project-map.md', path.join(root, '.ai-context', 'project-map.md'), 'On-demand navigation'],
    ['.agents/skills/lean-context/SKILL.md', path.join(root, '.agents', 'skills', 'lean-context', 'SKILL.md'), 'On-demand Codex / Antigravity skill'],
    ['.claude/skills/lean-context/SKILL.md', path.join(root, '.claude', 'skills', 'lean-context', 'SKILL.md'), 'On-demand Claude skill']
  ];

  const footprint = [];
  for (const [label, file, mode] of contextFiles) {
    const text = await readText(file);
    footprint.push({ label, mode, tokens: roughTokens(text), present: text.length > 0 });
  }

  const mapText = await readText(path.join(root, '.ai-context', 'project-map.md'));
  const indexedMatch = mapText.match(/Relevant files indexed:\s*(\d+)/);
  const fingerprintMatch = mapText.match(/Fingerprint:\s*`([^`]+)`/);
  const indexedFiles = indexedMatch ? Number(indexedMatch[1]) : null;
  const alwaysOn = footprint.filter(item => ['AGENTS.md', 'CLAUDE.md'].includes(item.label)).reduce((sum, item) => sum + item.tokens, 0);
  const onDemand = footprint.filter(item => !['AGENTS.md', 'CLAUDE.md'].includes(item.label)).reduce((sum, item) => sum + item.tokens, 0);

  let mapStatus = 'unknown';
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    mapStatus = await checkProject(root) ? 'current' : 'stale or missing';
  } catch {
    mapStatus = 'invalid';
  }
  process.exitCode = previousExitCode;

  const usage = {
    provider: options.provider || null,
    model: options.model || null,
    inputTokens: parseUsageNumber(options.inputTokens, 'input tokens'),
    cachedInputTokens: parseUsageNumber(options.cachedInputTokens, 'cached input tokens'),
    outputTokens: parseUsageNumber(options.outputTokens, 'output tokens')
  };
  const hasObserved = [usage.inputTokens, usage.cachedInputTokens, usage.outputTokens].some(value => value !== null);
  const generatedAt = new Date();

  const lines = [
    '# lean-context token usage report', '',
    `Generated: ${generatedAt.toISOString()}`,
    `Project: \`${root}\``, '',
    '## Project snapshot', '',
    `- Project map status: **${mapStatus}**`,
    `- Fingerprint: ${fingerprintMatch ? `\`${fingerprintMatch[1]}\`` : 'not available'}`,
    `- Relevant files indexed: ${indexedFiles === null ? 'not available' : formatted(indexedFiles)}`, '',
    '## lean-context footprint', '',
    '| Context file | Loading mode | Approx. tokens |',
    '| --- | --- | ---: |',
    ...footprint.map(item => `| \`${item.label}\` | ${item.present ? item.mode : 'Not installed'} | ${item.present ? `~${formatted(item.tokens)}` : '0'} |`), '',
    `**Approx. always-on root instruction footprint:** ~${formatted(alwaysOn)} tokens`, '',
    `**Approx. optional/on-demand material:** ~${formatted(onDemand)} tokens if every listed on-demand file were loaded.`, '',
    '## Observed provider usage', ''
  ];

  if (hasObserved) {
    lines.push(
      `- Provider: ${usage.provider || 'not supplied'}`,
      `- Model: ${usage.model || 'not supplied'}`,
      `- Input tokens: ${usage.inputTokens === null ? 'not supplied' : formatted(usage.inputTokens)}`,
      `- Cached input tokens: ${usage.cachedInputTokens === null ? 'not supplied' : formatted(usage.cachedInputTokens)}`,
      `- Output tokens: ${usage.outputTokens === null ? 'not supplied' : formatted(usage.outputTokens)}`
    );
    if (usage.inputTokens !== null && usage.outputTokens !== null) lines.push(`- Input + output tokens: ${formatted(usage.inputTokens + usage.outputTokens)}`);
  } else {
    lines.push('No provider-reported token numbers were supplied. Add `--input-tokens=N`, `--cached-input-tokens=N`, and `--output-tokens=N` when your extension/API exposes them.');
  }

  lines.push('', '## Interpretation', '',
    '- Local token estimates use a rough characters / 4 heuristic and are **not billing measurements**.',
    '- Provider usage is kept separate because caching, system prompts, tool calls, history, and billing rules differ between Claude, Codex, and Antigravity.',
    '- For A/B testing, compare the same task, model, reasoning level, starting conversation state, and repository revision.',
    '- Lower provider-reported input usage plus fewer file reads/searches is stronger evidence of savings than the local estimate alone.', '');

  const reportPath = options.output
    ? path.resolve(root, options.output)
    : path.join(root, '.ai-context', 'reports', `token-usage-${generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}.md`);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, lines.join('\n'), 'utf8');
  console.log(`Generated token usage report: ${reportPath}`);
  console.log(`Always-on context: ~${formatted(alwaysOn)} tokens; on-demand material: ~${formatted(onDemand)} tokens`);
  return reportPath;
}

function help() {
  console.log(`lean-context\n\nUsage:\n  lean-context init [project] [--chat]
  lean-context chat [project]\n  lean-context smart [project]\n  lean-context refresh [project]\n  lean-context stats [project]\n  lean-context report [project] [--provider=NAME] [--model=NAME] [--input-tokens=N] [--cached-input-tokens=N] [--output-tokens=N] [--output=PATH]\n  lean-context check [project]\n\nWhat it does:\n  - creates/updates a small AGENTS.md context protocol\n  - makes Claude Code import that same AGENTS.md via CLAUDE.md\n  - generates .ai-context/project-map.md for on-demand project navigation\n  - optional --chat installs invocable skills for Claude, Codex, and Antigravity\n  - avoids vendor/build/lockfile noise and keeps always-loaded context small\n`);
}

try {
  if (command === 'init') await initProject(target, { force, chat });
  else if (command === 'chat') await enableChat(target);
  else if (command === 'smart') await smartProject(target);
  else if (command === 'refresh') await refreshProject(target);
  else if (command === 'stats') await showStats(target);
  else if (command === 'report') await generateTokenReport(target, {
    provider: flagValue('provider'),
    model: flagValue('model'),
    inputTokens: flagValue('input-tokens'),
    cachedInputTokens: flagValue('cached-input-tokens'),
    outputTokens: flagValue('output-tokens'),
    output: flagValue('output')
  });
  else if (command === 'check') await checkProject(target);
  else help();
} catch (error) {
  console.error(`lean-context: ${error.message}`);
  process.exitCode = 1;
}
