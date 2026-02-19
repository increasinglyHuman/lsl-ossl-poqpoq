/**
 * WorldScript — the base class all user scripts extend.
 * Preserves LSL's state machine and event-driven philosophy
 * while adding modern TypeScript capabilities.
 *
 * Usage:
 *   export default class Door extends WorldScript {
 *     states = {
 *       closed: {
 *         onTouchStart(agent) { this.transitionTo("open"); }
 *       },
 *       open: {
 *         onTimer() { this.transitionTo("closed"); }
 *       }
 *     };
 *   }
 */

import type { Vector3, Color3 } from "./math.js";
import type { Agent } from "./agent.js";
import type { WorldObject } from "./world-object.js";
import type { ScriptEventHandlers, ScriptPermission } from "./events.js";
import type { WorldAPI } from "../api/world-api.js";

/** State definition — a map of event handler methods */
export type StateDefinition = Partial<ScriptEventHandlers>;

/** Timer handle for cancellation */
export interface TimerHandle {
  readonly id: string;
  cancel(): void;
}

/** Listen handle for removing listeners */
export interface ListenHandle {
  readonly id: string;
  remove(): void;
}

/**
 * WorldScript is the base class for all poqpoq scripts.
 *
 * Key differences from LSL:
 * - Scripts can control multiple objects (not just the prim they're in)
 * - Multiple named timers (not just one global timer)
 * - Async/await for sequential operations
 * - Real data structures (Map, Set, Array, classes)
 * - Module imports for code reuse
 * - No 64KB memory limit
 */
export abstract class WorldScript implements ScriptEventHandlers {
  /** The primary object this script is attached to */
  readonly object!: WorldObject;

  /** The world API — access to global operations */
  readonly world!: WorldAPI;

  /** The agent who owns this script/object */
  readonly owner!: Agent;

  // === State Machine ===

  /** Current active state name. Starts as "default". */
  private _currentState = "default";

  /**
   * State definitions. Override in subclass to define states.
   * The "default" state is required (mirrors LSL's `default` state).
   *
   * Each state is an object with event handler methods.
   * When a state is active, its handlers receive events.
   * The script-level handlers (defined directly on the class) ALWAYS fire,
   * regardless of state — they act as global handlers.
   */
  states: Record<string, StateDefinition> = {};

  /** Get current state name */
  get currentState(): string {
    return this._currentState;
  }

  /**
   * Transition to a new state — maps to LSL's `state X;`
   * Fires onStateExit for old state, then onStateEntry for new state.
   */
  async transitionTo(newState: string): Promise<void> {
    if (newState === this._currentState) return;

    const oldState = this._currentState;

    // Fire exit handlers
    const exitHandler = this.states[oldState]?.onStateExit;
    if (exitHandler) await exitHandler.call(this, oldState);
    if (this.onStateExit) await this.onStateExit(oldState);

    // Switch state
    this._currentState = newState;

    // Fire entry handlers
    const entryHandler = this.states[newState]?.onStateEntry;
    if (entryHandler) await entryHandler.call(this, newState);
    if (this.onStateEntry) await this.onStateEntry(newState);
  }

  // === Communication ===

  /** Say on channel — maps to llSay */
  say(channel: number, message: string): void {
    this.world.say(channel, message);
  }

  /** Whisper on channel — maps to llWhisper */
  whisper(channel: number, message: string): void {
    this.world.whisper(channel, message);
  }

  /** Shout on channel — maps to llShout */
  shout(channel: number, message: string): void {
    this.world.shout(channel, message);
  }

  /** Listen on a channel — maps to llListen. Returns handle for removal. */
  listen(
    channel: number,
    name?: string,
    id?: string,
    message?: string
  ): ListenHandle {
    return this.world.listen(channel, name, id, message);
  }

  // === Timers ===

  /**
   * Set a repeating timer — maps to llSetTimerEvent.
   * Unlike LSL, supports multiple named timers.
   * @param interval Seconds between fires
   * @param id Optional timer ID (default: "default")
   */
  setTimer(interval: number, id?: string): TimerHandle {
    return this.world.setTimer(interval, id);
  }

  /** Cancel a timer by ID */
  clearTimer(id?: string): void {
    this.world.clearTimer(id);
  }

  /** One-shot delayed execution (not available in LSL) */
  delay(seconds: number): Promise<void> {
    return new Promise(resolve => {
      this.world.setTimeout(resolve, seconds * 1000);
    });
  }

  // === Perception ===

  /** Trigger a sensor scan — maps to llSensor */
  sensor(
    name: string,
    id: string,
    type: number,
    range: number,
    arc: number
  ): void {
    this.world.sensor(name, id, type, range, arc);
  }

  /** Trigger a repeating sensor — maps to llSensorRepeat */
  sensorRepeat(
    name: string,
    id: string,
    type: number,
    range: number,
    arc: number,
    rate: number
  ): void {
    this.world.sensorRepeat(name, id, type, range, arc, rate);
  }

  /** Stop repeating sensor — maps to llSensorRemove */
  sensorRemove(): void {
    this.world.sensorRemove();
  }

  // === Permissions ===

  /** Request permissions from agent — maps to llRequestPermissions */
  requestPermissions(agent: Agent, permissions: ScriptPermission): void {
    this.world.requestPermissions(agent.id, permissions);
  }

  // === Utility ===

  /** Get a random float 0-1 — maps to llFrand(1.0) */
  random(): number {
    return Math.random();
  }

  /** Get current simulation time — maps to llGetTime */
  getTime(): number {
    return this.world.getTime();
  }

  /** Reset script — maps to llResetScript */
  reset(): void {
    this.world.resetScript(this);
  }

  /** Log to console (debugging) — no LSL equivalent */
  log(...args: unknown[]): void {
    this.world.log(...args);
  }

  // === Event handler stubs (override in subclass) ===
  // These are the "global" handlers that fire regardless of state.
  // State-specific handlers are defined in the `states` object.

  onStateEntry?(state: string): void | Promise<void>;
  onStateExit?(state: string): void | Promise<void>;
  onRez?(startParam: number): void | Promise<void>;
  onScriptReset?(): void | Promise<void>;
  onTouchStart?(agent: Agent, face: number): void | Promise<void>;
  onTouch?(agent: Agent, face: number): void | Promise<void>;
  onTouchEnd?(agent: Agent, face: number): void | Promise<void>;
  onTimer?(timerId?: string): void | Promise<void>;
  onListen?(channel: number, name: string, id: string, message: string): void | Promise<void>;
}
