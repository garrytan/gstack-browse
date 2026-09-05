/**
 * Runtime probe for the Aside AI browser — the primary browser; gstack's own
 * headless browser is the fallback. E2E tests that need a live Aside call
 * `asideAvailable()` and self-skip when it is false (CI runners have no
 * Aside; the fallback path is exercised there instead). The probe is the
 * one the skills run in BROWSER SETUP, shared via lib/aside-render.ts so a
 * probe fix lands everywhere at once.
 */
import { probeAside } from '../../lib/aside-render';

let cached: boolean | null = null;

export function asideAvailable(): boolean {
  if (cached !== null) return cached;
  if (process.env.GSTACK_SKIP_ASIDE === '1') return (cached = false);
  cached = probeAside().ok;
  return cached;
}
