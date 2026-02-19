/**
 * WorldAPI — the global API surface available to all scripts via `this.world`.
 * This replaces LSL's flat `ll*` function namespace with structured, typed APIs.
 *
 * In the sandbox, scripts receive a frozen implementation of this interface.
 * The implementation bridges to Babylon.js (or a mock for testing).
 */

import type { Vector3, Color3 } from "../types/math.js";
import type { Agent } from "../types/agent.js";
import type { WorldObject, SoundOptions } from "../types/world-object.js";
import type { DetectedType, RaycastHit, WeatherState } from "../types/events.js";
import type { NPCFactory } from "../types/npc.js";
import type { CompanionAPI } from "../types/companion.js";
import type { WorldScript, TimerHandle, ListenHandle } from "../types/world-script.js";
import type { ScriptPermission } from "../types/events.js";

/** HTTP response from world.http calls */
export interface HttpResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

/** Persistent key-value storage API */
export interface StorageAPI {
  /** Get a value by key */
  get(key: string): Promise<string | null>;
  /** Set a value (persists across script restarts) */
  set(key: string, value: string): Promise<void>;
  /** Delete a key */
  delete(key: string): Promise<void>;
  /** List all keys */
  keys(): Promise<string[]>;
}

/** HTTP client API (proxied through platform gateway) */
export interface HttpAPI {
  /** HTTP GET — maps to llHTTPRequest with METHOD_GET */
  get(url: string, headers?: Record<string, string>): Promise<HttpResponse>;
  /** HTTP POST */
  post(url: string, body: string, headers?: Record<string, string>): Promise<HttpResponse>;
  /** HTTP PUT */
  put(url: string, body: string, headers?: Record<string, string>): Promise<HttpResponse>;
  /** HTTP DELETE */
  delete(url: string, headers?: Record<string, string>): Promise<HttpResponse>;
}

/** Environment controls */
export interface EnvironmentAPI {
  /** Get current simulated time (hours, 0-24) */
  getTimeOfDay(): number;
  /** Set simulated time — maps to poqpoq #setTime command */
  setTimeOfDay(hour: number): void;
  /** Get current weather */
  getWeather(): WeatherState;
  /** Set weather — maps to poqpoq #setWeather command */
  setWeather(weather: Partial<WeatherState>): void;
  /** Set wind direction/speed */
  setWind(direction: Vector3, speed: number): void;
  /** Set gravity strength */
  setGravity(strength: number): void;
  /** Get current sun direction */
  getSunDirection(): Vector3;
}

/**
 * The World API — available to scripts as `this.world`.
 *
 * Design principles:
 * - Structured namespaces (world.npc.*, world.http.*, world.storage.*)
 *   instead of flat ll* function soup
 * - Async/await instead of callback-hell
 * - Typed parameters instead of bitmask constants
 * - All methods are safe to call from the sandbox
 */
export interface WorldAPI {
  // === Object Access ===

  /** Get an object by ID or name */
  getObject(idOrName: string): WorldObject | null;

  /** Get all objects in a radius */
  getObjectsInRadius(center: Vector3, radius: number): WorldObject[];

  /** Get the terrain height at a position — maps to llGround */
  getGroundHeight(position: Vector3): number;

  // === Communication ===

  /** Say on channel — maps to llSay */
  say(channel: number, message: string): void;

  /** Whisper on channel — maps to llWhisper */
  whisper(channel: number, message: string): void;

  /** Shout on channel — maps to llShout */
  shout(channel: number, message: string): void;

  /** Region-say — maps to llRegionSay */
  regionSay(channel: number, message: string): void;

  /** Listen on channel — maps to llListen */
  listen(channel: number, name?: string, id?: string, message?: string): ListenHandle;

  /**
   * Send link message — maps to llMessageLinked.
   * Routes through the LinkMessageBus to all matching scripts in the container.
   */
  sendLinkMessage(link: number, num: number, str: string, id: string): void;

  // === Agents ===

  /** Get agent by ID */
  getAgent(id: string): Agent | null;

  /** Get all agents in the region */
  getAgents(): Agent[];

  /** Get number of agents — maps to llGetRegionAgentCount */
  getAgentCount(): number;

  // === Timers ===

  /** Set repeating timer — supports multiple named timers */
  setTimer(interval: number, id?: string): TimerHandle;

  /** Clear a timer */
  clearTimer(id?: string): void;

  /** One-shot timeout (internal) */
  setTimeout(callback: () => void, ms: number): void;

  // === Perception ===

  /** Trigger a sensor scan — maps to llSensor */
  sensor(name: string, id: string, type: number, range: number, arc: number): void;

  /** Repeating sensor — maps to llSensorRepeat */
  sensorRepeat(name: string, id: string, type: number, range: number, arc: number, rate: number): void;

  /** Stop sensor — maps to llSensorRemove */
  sensorRemove(): void;

  /** Raycast — maps to llCastRay */
  raycast(start: Vector3, end: Vector3): RaycastHit[];

  // === Permissions ===

  /** Request permissions — maps to llRequestPermissions */
  requestPermissions(agentId: string, permissions: ScriptPermission): void;

  // === Sub-APIs ===

  /** NPC management */
  readonly npc: NPCFactory;

  /** Persistent storage (replaces LSL's notecard/linkset data hacks) */
  readonly storage: StorageAPI;

  /** HTTP client (proxied for security) */
  readonly http: HttpAPI;

  /** Environment controls */
  readonly environment: EnvironmentAPI;

  /** AI Companion */
  readonly companion: CompanionAPI;

  // === Utility ===

  /** Get simulation time in seconds — maps to llGetTime */
  getTime(): number;

  /** Get Unix timestamp — maps to llGetUnixTime */
  getUnixTime(): number;

  /** Get region name — maps to llGetRegionName */
  getRegionName(): string;

  /** Log to console (debugging) */
  log(...args: unknown[]): void;

  /** Reset a script */
  resetScript(script: WorldScript): void;

  /** Sleep for N seconds — maps to llSleep but DOES NOT block other scripts */
  sleep(seconds: number): Promise<void>;
}
