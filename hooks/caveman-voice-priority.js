#!/usr/bin/env node
// CaveStack Voice Priority Hook — SessionStart companion to caveman-activate.js
//
// Runs AFTER caveman-activate.js on every session start.
// Reads the active voice profile and emits a priority instruction that tells
// the model: "skill SKILL.md files were compiled with this voice profile,
// follow the voice rules in the Voice section."
//
// This is belt-and-suspenders: the build-time voice profile already wrote the
// right Voice section into each SKILL.md. This hook reinforces it at runtime
// so the model doesn't revert to verbose defaults mid-session.
//
// Does NOT modify vendored caveman-activate.js.

const fs = require('fs');
const path = require('path');

// Try to load the active voice profile's priority instruction
const voicesDir = path.resolve(__dirname, '..', 'voices');
const defaultVoice = 'caveman-full';

function getActiveVoiceName() {
  // Check environment variable first
  const envVoice = process.env.CAVESTACK_VOICE;
  if (envVoice) return envVoice;

  // Check config file
  const configPaths = [
    path.join(process.env.XDG_CONFIG_HOME || path.join(require('os').homedir(), '.config'), 'cavestack', 'config.json'),
    path.join(require('os').homedir(), '.cavestack', 'config.yaml'),
  ];

  for (const configPath of configPaths) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      // Simple YAML/JSON voice key extraction
      const match = content.match(/["']?voice["']?\s*[:=]\s*["']?([a-z0-9-]+)["']?/);
      if (match) return match[1];
    } catch { /* config not found, continue */ }
  }

  return defaultVoice;
}

try {
  const voiceName = getActiveVoiceName();
  const profilePath = path.join(voicesDir, `${voiceName}.json`);

  if (!fs.existsSync(profilePath)) {
    // Unknown voice — emit nothing, let caveman-activate handle it
    process.stdout.write('OK');
    process.exit(0);
  }

  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

  if (profile.priority_instruction) {
    process.stdout.write(profile.priority_instruction);
  } else {
    process.stdout.write('OK');
  }
} catch (err) {
  // Silent fail — priority hook is belt-and-suspenders, not critical
  process.stdout.write('OK');
}
