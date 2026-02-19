/**
 * Event system types — all events a WorldScript can respond to.
 * Maps LSL's ~35 events to TypeScript method signatures,
 * plus poqpoq-specific extensions.
 */

import type { Vector3, Quaternion } from "./math.js";
import type { Agent } from "./agent.js";
import type { WorldObject } from "./world-object.js";
import type { Companion } from "./companion.js";

/** Detection info for sensor/collision events — maps to llDetected* functions */
export interface DetectedInfo {
  readonly id: string;
  readonly name: string;
  readonly position: Vector3;
  readonly rotation: Quaternion;
  readonly velocity: Vector3;
  readonly type: DetectedType;
  readonly owner: string;
  readonly group: string;
  readonly linkNumber: number;
}

export enum DetectedType {
  Agent = 1,
  Active = 2,
  Passive = 4,
  Scripted = 8,
}

/** Raycast hit result */
export interface RaycastHit {
  readonly object: WorldObject;
  readonly position: Vector3;
  readonly normal: Vector3;
  readonly distance: number;
  readonly face: number;
}

/** Weather state for environment events */
export interface WeatherState {
  readonly type: "clear" | "cloudy" | "rain" | "snow" | "fog" | "storm";
  readonly intensity: number;
  readonly windDirection: Vector3;
  readonly windSpeed: number;
}

/** Quest progress info */
export interface QuestProgress {
  readonly questId: string;
  readonly questName: string;
  readonly stage: number;
  readonly totalStages: number;
}

/** Zone info for spatial events */
export interface ZoneInfo {
  readonly id: string;
  readonly name: string;
  readonly bounds: { min: Vector3; max: Vector3 };
}

/** Permission flags — maps to LSL PERMISSION_* constants */
export enum ScriptPermission {
  Debit = 0x0002,
  TakeControls = 0x0004,
  TriggerAnimation = 0x0010,
  Attach = 0x0020,
  ChangeLinks = 0x0080,
  TrackCamera = 0x0400,
  ControlCamera = 0x0800,
  Teleport = 0x1000,
  OverrideAnimations = 0x8000,
}

/** Control flags for agent control events */
export enum ControlFlag {
  Forward = 0x0001,
  Back = 0x0002,
  Left = 0x0004,
  Right = 0x0008,
  Up = 0x0010,
  Down = 0x0020,
  RotateLeft = 0x0100,
  RotateRight = 0x0200,
  LeftButton = 0x10000000,
  MouseLook = 0x20000000,
}

/** Change flags for the onChanged event — maps to LSL CHANGED_* constants */
export enum ChangeFlag {
  Inventory = 0x0001,
  Color = 0x0002,
  Shape = 0x0004,
  Scale = 0x0008,
  Texture = 0x0010,
  Link = 0x0020,
  AllowedDrop = 0x0040,
  Owner = 0x0080,
  Region = 0x0100,
  Teleport = 0x0200,
  RegionStart = 0x0400,
  Media = 0x0800,
}

/**
 * Script event handlers interface.
 * All methods are optional — scripts only implement the events they care about.
 *
 * LSL events map directly:
 *   state_entry    → onStateEntry
 *   state_exit     → onStateExit
 *   touch_start    → onTouchStart
 *   touch          → onTouch
 *   touch_end      → onTouchEnd
 *   collision_start → onCollisionStart
 *   timer          → onTimer
 *   listen         → onListen
 *   sensor         → onSensor
 *   no_sensor      → onNoSensor
 *   etc.
 */
export interface ScriptEventHandlers {
  // === Lifecycle (LSL: state_entry, state_exit, on_rez) ===
  onStateEntry?(state: string): void | Promise<void>;
  onStateExit?(state: string): void | Promise<void>;
  onRez?(startParam: number): void | Promise<void>;
  onScriptReset?(): void | Promise<void>;

  // === Touch (LSL: touch_start, touch, touch_end) ===
  onTouchStart?(agent: Agent, face: number): void | Promise<void>;
  onTouch?(agent: Agent, face: number): void | Promise<void>;
  onTouchEnd?(agent: Agent, face: number): void | Promise<void>;

  // === Collision (LSL: collision_start, collision, collision_end) ===
  onCollisionStart?(detected: DetectedInfo[]): void | Promise<void>;
  onCollision?(detected: DetectedInfo[]): void | Promise<void>;
  onCollisionEnd?(detected: DetectedInfo[]): void | Promise<void>;
  onLandCollisionStart?(position: Vector3): void | Promise<void>;

  // === Communication (LSL: listen) ===
  onListen?(channel: number, name: string, id: string, message: string): void | Promise<void>;

  // === Timer (LSL: timer) ===
  onTimer?(timerId?: string): void | Promise<void>;

  // === Perception (LSL: sensor, no_sensor) ===
  onSensor?(detected: DetectedInfo[]): void | Promise<void>;
  onNoSensor?(): void | Promise<void>;

  // === Agent interaction (LSL: money, control, run_time_permissions) ===
  onMoney?(agent: Agent, amount: number): void | Promise<void>;
  onControl?(agent: Agent, held: number, changed: number): void | Promise<void>;
  onPermissions?(agent: Agent, permissions: number): void | Promise<void>;

  // === Object state (LSL: changed, attach, moving_start, moving_end) ===
  onChanged?(change: number): void | Promise<void>;
  onAttach?(agentId: string): void | Promise<void>;
  onMovingStart?(): void | Promise<void>;
  onMovingEnd?(): void | Promise<void>;

  // === Inter-script (LSL: link_message) ===
  onLinkMessage?(
    senderLink: number,
    num: number,
    str: string,
    id: string
  ): void | Promise<void>;

  // === Data (LSL: dataserver, http_response) ===
  onDataserver?(queryId: string, data: string): void | Promise<void>;
  onHttpResponse?(
    requestId: string,
    status: number,
    headers: Record<string, string>,
    body: string
  ): void | Promise<void>;

  // === Navigation (LSL: at_target, not_at_target, at_rot_target) ===
  onAtTarget?(handle: number, targetPos: Vector3, currentPos: Vector3): void | Promise<void>;
  onNotAtTarget?(): void | Promise<void>;
  onAtRotTarget?(
    handle: number,
    targetRot: Quaternion,
    currentRot: Quaternion
  ): void | Promise<void>;

  // === poqpoq Extensions ===
  onCompanionMessage?(companion: Companion, message: string): void | Promise<void>;
  onPlayerEnterZone?(agent: Agent, zone: ZoneInfo): void | Promise<void>;
  onPlayerLeaveZone?(agent: Agent, zone: ZoneInfo): void | Promise<void>;
  onDayNightCycle?(phase: "dawn" | "day" | "dusk" | "night"): void | Promise<void>;
  onWeatherChange?(weather: WeatherState): void | Promise<void>;
  onQuestProgress?(progress: QuestProgress): void | Promise<void>;
}
