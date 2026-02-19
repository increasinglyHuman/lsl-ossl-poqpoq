/**
 * Tests for the Timer Manager.
 * Validates multiple named timers per script — a key improvement over LSL's single timer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TimerManager } from "./timer-manager.js";

describe("TimerManager", () => {
  let manager: TimerManager;
  let fired: Array<{ scriptId: string; timerId: string }>;

  beforeEach(() => {
    manager = new TimerManager();
    fired = [];
    manager.onFire((scriptId, timerId) => {
      fired.push({ scriptId, timerId });
    });
  });

  afterEach(() => {
    manager.stop();
  });

  describe("repeating timers", () => {
    it("should fire a timer when time passes", () => {
      const now = performance.now();
      manager.setTimer("script-1", 1, "default"); // 1 second interval

      // Tick at now + 500ms — should NOT fire yet
      manager.tick(now + 500);
      expect(fired).toHaveLength(0);

      // Tick at now + 1100ms — should fire
      manager.tick(now + 1100);
      expect(fired).toHaveLength(1);
      expect(fired[0]).toEqual({ scriptId: "script-1", timerId: "default" });
    });

    it("should support multiple named timers on one script", () => {
      const now = performance.now();
      manager.setTimer("script-1", 1, "autoClose");
      manager.setTimer("script-1", 2, "particleUpdate");
      manager.setTimer("script-1", 5, "patrol");

      // Tick at now + 1100ms — autoClose fires
      manager.tick(now + 1100);
      expect(fired).toHaveLength(1);
      expect(fired[0].timerId).toBe("autoClose");

      // Tick at now + 2100ms — autoClose fires again, particleUpdate fires
      manager.tick(now + 2100);
      expect(fired).toHaveLength(3);
    });

    it("should replace existing timer with same ID", () => {
      const now = performance.now();
      manager.setTimer("script-1", 10, "timer");  // 10 seconds
      manager.setTimer("script-1", 1, "timer");    // Replace with 1 second

      manager.tick(now + 1100);
      expect(fired).toHaveLength(1);
    });
  });

  describe("one-shot timers", () => {
    it("should fire once and auto-remove", () => {
      const now = performance.now();
      manager.setOneShot("script-1", 1, "delayed-action");

      manager.tick(now + 1100);
      expect(fired).toHaveLength(1);
      expect(fired[0].timerId).toBe("delayed-action");

      // Should not fire again
      fired.length = 0;
      manager.tick(now + 2200);
      expect(fired).toHaveLength(0);
    });
  });

  describe("timer cancellation", () => {
    it("should cancel a specific timer", () => {
      const now = performance.now();
      manager.setTimer("script-1", 1, "timer-a");
      manager.setTimer("script-1", 1, "timer-b");

      manager.clearTimer("script-1", "timer-a");

      manager.tick(now + 1100);
      expect(fired).toHaveLength(1);
      expect(fired[0].timerId).toBe("timer-b");
    });

    it("should cancel all timers for a script", () => {
      const now = performance.now();
      manager.setTimer("script-1", 1, "a");
      manager.setTimer("script-1", 1, "b");
      manager.setTimer("script-1", 1, "c");

      manager.clearAllTimers("script-1");

      manager.tick(now + 1100);
      expect(fired).toHaveLength(0);
    });

    it("clearTimer with default ID should clear the default timer", () => {
      const now = performance.now();
      manager.setTimer("script-1", 1); // default ID
      manager.clearTimer("script-1");  // clear default

      manager.tick(now + 1100);
      expect(fired).toHaveLength(0);
    });
  });

  describe("timer inspection", () => {
    it("should check if a timer exists", () => {
      manager.setTimer("script-1", 1, "myTimer");
      expect(manager.hasTimer("script-1", "myTimer")).toBe(true);
      expect(manager.hasTimer("script-1", "nonexistent")).toBe(false);
    });

    it("should list timer IDs for a script", () => {
      manager.setTimer("script-1", 1, "alpha");
      manager.setTimer("script-1", 2, "beta");
      manager.setTimer("script-1", 5, "gamma");

      const ids = manager.getTimerIds("script-1");
      expect(ids).toContain("alpha");
      expect(ids).toContain("beta");
      expect(ids).toContain("gamma");
    });
  });

  describe("multi-script isolation", () => {
    it("should keep timers separate between scripts", () => {
      const now = performance.now();
      manager.setTimer("script-a", 1, "timer");
      manager.setTimer("script-b", 2, "timer");

      // At 1.1s — only script-a fires
      manager.tick(now + 1100);
      expect(fired).toHaveLength(1);
      expect(fired[0].scriptId).toBe("script-a");

      // At 2.1s — script-a fires again, script-b fires first time
      manager.tick(now + 2200);
      expect(fired).toHaveLength(3);
    });

    it("should not affect other scripts when clearing", () => {
      const now = performance.now();
      manager.setTimer("script-a", 1, "timer");
      manager.setTimer("script-b", 1, "timer");

      manager.clearAllTimers("script-a");

      manager.tick(now + 1100);
      expect(fired).toHaveLength(1);
      expect(fired[0].scriptId).toBe("script-b");
    });
  });
});
