/**
 * Timer Manager — Multiple named timers per script.
 *
 * Unlike LSL's single timer per script, poqpoq supports:
 * - Multiple named timers (e.g., "autoClose", "particleUpdate", "patrol")
 * - One-shot timers (setTimeout equivalent)
 * - Repeating timers (setInterval equivalent)
 * - Automatic cleanup when scripts terminate
 *
 * Runs on the main thread. Timer fires dispatch onTimer events
 * to the script's worker via the event dispatcher.
 */

import type { TimerEntry } from "./types.js";

/** Callback when a timer fires */
export type TimerFireHandler = (scriptId: string, timerId: string) => void;

export class TimerManager {
  /** All active timers: scriptId → Map<timerId, TimerEntry> */
  private timers = new Map<string, Map<string, TimerEntry>>();
  private fireHandler: TimerFireHandler | null = null;
  private running = false;
  private animFrameId: number | null = null;
  private lastTick = 0;

  /**
   * Set the callback for timer fire events.
   */
  onFire(handler: TimerFireHandler): void {
    this.fireHandler = handler;
  }

  /**
   * Start the timer tick loop.
   * Uses requestAnimationFrame if available, falls back to setInterval.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTick = performance.now();

    if (typeof requestAnimationFrame === "function") {
      this.tickRAF();
    } else {
      // Node.js / test environment fallback
      this.tickInterval();
    }
  }

  /**
   * Stop the timer tick loop.
   */
  stop(): void {
    this.running = false;
    if (this.animFrameId !== null) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.animFrameId);
      }
      this.animFrameId = null;
    }
  }

  /**
   * Set a repeating timer for a script.
   *
   * @param scriptId Script that owns this timer
   * @param interval Seconds between fires
   * @param timerId Optional timer ID (default: "default")
   * @returns The timer ID
   */
  setTimer(scriptId: string, interval: number, timerId: string = "default"): string {
    const scriptTimers = this.getOrCreateScriptTimers(scriptId);

    // If a timer with this ID already exists, replace it
    scriptTimers.set(timerId, {
      scriptId,
      timerId,
      interval: interval * 1000, // Convert to ms
      repeating: true,
      nextFire: performance.now() + interval * 1000,
    });

    return timerId;
  }

  /**
   * Set a one-shot timer (fires once, then auto-removes).
   */
  setOneShot(scriptId: string, delay: number, timerId: string): string {
    const scriptTimers = this.getOrCreateScriptTimers(scriptId);

    scriptTimers.set(timerId, {
      scriptId,
      timerId,
      interval: delay * 1000,
      repeating: false,
      nextFire: performance.now() + delay * 1000,
    });

    return timerId;
  }

  /**
   * Clear a specific timer.
   */
  clearTimer(scriptId: string, timerId: string = "default"): void {
    const scriptTimers = this.timers.get(scriptId);
    if (scriptTimers) {
      scriptTimers.delete(timerId);
      if (scriptTimers.size === 0) {
        this.timers.delete(scriptId);
      }
    }
  }

  /**
   * Clear all timers for a script (called on script termination).
   */
  clearAllTimers(scriptId: string): void {
    this.timers.delete(scriptId);
  }

  /**
   * Check if a script has a specific timer.
   */
  hasTimer(scriptId: string, timerId: string = "default"): boolean {
    return this.timers.get(scriptId)?.has(timerId) ?? false;
  }

  /**
   * Get all timer IDs for a script.
   */
  getTimerIds(scriptId: string): string[] {
    const scriptTimers = this.timers.get(scriptId);
    return scriptTimers ? [...scriptTimers.keys()] : [];
  }

  /**
   * Manually tick the timer system (useful for testing).
   */
  tick(now: number = performance.now()): void {
    this.processTick(now);
  }

  // === Private Methods ===

  private getOrCreateScriptTimers(scriptId: string): Map<string, TimerEntry> {
    let scriptTimers = this.timers.get(scriptId);
    if (!scriptTimers) {
      scriptTimers = new Map();
      this.timers.set(scriptId, scriptTimers);
    }
    return scriptTimers;
  }

  private tickRAF(): void {
    if (!this.running) return;

    const now = performance.now();
    this.processTick(now);
    this.lastTick = now;

    this.animFrameId = requestAnimationFrame(() => this.tickRAF());
  }

  private tickInterval(): void {
    const intervalId = setInterval(() => {
      if (!this.running) {
        clearInterval(intervalId);
        return;
      }
      const now = performance.now();
      this.processTick(now);
      this.lastTick = now;
    }, 16); // ~60fps
  }

  private processTick(now: number): void {
    const toRemove: Array<{ scriptId: string; timerId: string }> = [];

    for (const [scriptId, scriptTimers] of this.timers) {
      for (const [timerId, entry] of scriptTimers) {
        if (now >= entry.nextFire) {
          // Fire the timer
          if (this.fireHandler) {
            this.fireHandler(scriptId, timerId);
          }

          if (entry.repeating) {
            // Schedule next fire
            entry.nextFire = now + entry.interval;
          } else {
            // One-shot: mark for removal
            toRemove.push({ scriptId, timerId });
          }
        }
      }
    }

    // Clean up one-shot timers
    for (const { scriptId, timerId } of toRemove) {
      this.clearTimer(scriptId, timerId);
    }
  }
}
