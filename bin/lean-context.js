#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { initProject, enableChat, refreshProject, showStats, checkProject, smartProject } from '../lib/index.js';

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith('-') ? args[0] : 'help';
const targetArg = args.find((a, i) => i > 0 && !a.startsWith('-'));
const target = path.resolve(targetArg || process.cwd());
const force = args.includes('--force');
const chat = args.includes('--chat');

function help() {
  console.log(`lean-context\n\nUsage:\n  lean-context init [project] [--chat]
  lean-context chat [project]\n  lean-context smart [project]\n  lean-context refresh [project]\n  lean-context stats [project]\n  lean-context check [project]\n\nWhat it does:\n  - creates/updates a small AGENTS.md context protocol\n  - makes Claude Code import that same AGENTS.md via CLAUDE.md\n  - generates .ai-context/project-map.md for on-demand project navigation\n  - optional --chat installs invocable skills for Claude, Codex, and Antigravity\n  - avoids vendor/build/lockfile noise and keeps always-loaded context small\n`);
}

try {
  if (command === 'init') await initProject(target, { force, chat });
  else if (command === 'chat') await enableChat(target);
  else if (command === 'smart') await smartProject(target);
  else if (command === 'refresh') await refreshProject(target);
  else if (command === 'stats') await showStats(target);
  else if (command === 'check') await checkProject(target);
  else help();
} catch (error) {
  console.error(`lean-context: ${error.message}`);
  process.exitCode = 1;
}
