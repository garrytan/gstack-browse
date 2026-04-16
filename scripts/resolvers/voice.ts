/**
 * Voice profile resolver — loads voice profiles from voices/ directory
 * and provides the voice directive for generateVoiceDirective().
 *
 * This does NOT transform prose (the Eng review correctly identified that
 * as an NL compiler problem). Instead, it replaces the hardcoded voice
 * directive strings with profile-driven content.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface VoiceProfile {
  name: string;
  description: string;
  directive: {
    compact: string;
    full: string;
  };
  priority_instruction?: string;
}

const VOICES_DIR = path.resolve(import.meta.dir, '..', '..', 'voices');
const VALID_NAME = /^[a-z0-9-]+$/;

let profileCache: Map<string, VoiceProfile> | null = null;

function loadProfiles(): Map<string, VoiceProfile> {
  if (profileCache) return profileCache;

  profileCache = new Map();
  if (!fs.existsSync(VOICES_DIR)) return profileCache;

  for (const file of fs.readdirSync(VOICES_DIR)) {
    if (!file.endsWith('.json') || file === 'schema.json') continue;

    const filePath = path.join(VOICES_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const profile: VoiceProfile = JSON.parse(raw);

      // Validate name
      if (!profile.name || !VALID_NAME.test(profile.name)) {
        throw new Error(`Invalid voice profile name "${profile.name}" in ${file}. Must match ${VALID_NAME}`);
      }
      if (!profile.directive?.compact || !profile.directive?.full) {
        throw new Error(`Voice profile "${profile.name}" in ${file} missing directive.compact or directive.full`);
      }

      profileCache.set(profile.name, profile);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`Malformed JSON in voice profile ${file}: ${err.message}`);
      }
      throw err;
    }
  }

  return profileCache;
}

/** Get the active voice profile name from CLI --voice flag or default */
export function getActiveVoice(): string {
  const voiceArg = process.argv.find(a => a.startsWith('--voice'));
  if (voiceArg) {
    const val = voiceArg.includes('=')
      ? voiceArg.split('=')[1]
      : process.argv[process.argv.indexOf(voiceArg) + 1];
    if (val && VALID_NAME.test(val)) return val;
    throw new Error(`Invalid --voice value "${val}". Must match ${VALID_NAME}. Available: ${listVoices().join(', ')}`);
  }
  // Default: caveman-full (CaveStack's identity)
  return 'caveman-full';
}

/** Get a voice profile by name. Throws on unknown name. */
export function getVoiceProfile(name: string): VoiceProfile {
  const profiles = loadProfiles();
  const profile = profiles.get(name);
  if (!profile) {
    throw new Error(`Unknown voice profile "${name}". Available: ${listVoices().join(', ')}`);
  }
  return profile;
}

/** List all available voice profile names */
export function listVoices(): string[] {
  return Array.from(loadProfiles().keys()).sort();
}

/** Get the voice directive string for a given tier and voice profile */
export function getVoiceDirective(tier: number, voiceName?: string): string {
  const name = voiceName ?? getActiveVoice();
  const profile = getVoiceProfile(name);
  return tier <= 1 ? profile.directive.compact : profile.directive.full;
}

/** Get the priority instruction for the runtime hook (if defined) */
export function getPriorityInstruction(voiceName?: string): string | null {
  const name = voiceName ?? getActiveVoice();
  const profile = getVoiceProfile(name);
  return profile.priority_instruction ?? null;
}

/** Clear the profile cache (for testing) */
export function clearProfileCache(): void {
  profileCache = null;
}
