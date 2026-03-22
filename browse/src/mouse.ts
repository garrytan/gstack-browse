/**
 * Mouse movement with cubic easing — simulates human-like cursor movement.
 *
 * Tracks last known mouse position on BrowserManager.
 * Eases from current position to target with step count proportional to distance.
 */

import type { Page } from 'playwright';
import type { BrowserManager } from './browser-manager';

/**
 * Cubic ease-in-out: slow start, fast middle, slow end.
 * t ∈ [0, 1] → output ∈ [0, 1]
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Move mouse from current tracked position to (toX, toY) with eased interpolation.
 *
 * Steps: 3–40, proportional to distance (1 step per 20px).
 * Duration: 30–300ms total, proportional to distance (0.5ms per px).
 */
export async function moveMouseEased(
  page: Page,
  bm: BrowserManager,
  toX: number,
  toY: number
): Promise<void> {
  const { x: fromX, y: fromY } = bm.getMousePosition();
  const distance = Math.hypot(toX - fromX, toY - fromY);

  // Skip movement if already at target (or very close)
  if (distance < 2) {
    bm.setMousePosition(toX, toY);
    return;
  }

  const steps = Math.max(3, Math.min(40, Math.ceil(distance / 20)));
  const duration = Math.max(30, Math.min(300, distance * 0.5));
  const stepDelay = duration / steps;

  for (let i = 1; i <= steps; i++) {
    const t = easeInOutCubic(i / steps);
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;
    await page.mouse.move(x, y);
    if (i < steps) {
      await new Promise(r => setTimeout(r, stepDelay));
    }
  }

  bm.setMousePosition(toX, toY);
}
