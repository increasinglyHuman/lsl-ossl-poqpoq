/**
 * ScriptEvent — Typed messages from the host engine to scripts.
 *
 * Every world event that scripts can handle becomes a ScriptEvent.
 * The host (Babylon.js bridge) creates these when something happens
 * in the 3D world and sends them to the ScriptHostAdapter for dispatch.
 *
 * Like ScriptCommand, all types are plain JSON-serializable objects.
 */

import type { Vec3, Color } from "./script-command.js";

// === Agent Info (serializable subset for events) ===

export interface AgentInfo {
  readonly id: string;
  readonly name: string;
  readonly position?: Vec3;
}

export interface ObjectInfo {
  readonly id: string;
  readonly name: string;
  readonly position?: Vec3;
}

// === Touch Events ===

export interface TouchStartEvent {
  readonly type: "touchStart";
  readonly agent: AgentInfo;
  readonly face: number;
}

export interface TouchEvent {
  readonly type: "touch";
  readonly agent: AgentInfo;
  readonly face: number;
}

export interface TouchEndEvent {
  readonly type: "touchEnd";
  readonly agent: AgentInfo;
  readonly face: number;
}

// === Collision Events ===

export interface CollisionStartEvent {
  readonly type: "collisionStart";
  readonly other: ObjectInfo;
}

export interface CollisionEvent {
  readonly type: "collision";
  readonly other: ObjectInfo;
}

export interface CollisionEndEvent {
  readonly type: "collisionEnd";
  readonly other: ObjectInfo;
}

// === Communication Events ===

export interface ListenEvent {
  readonly type: "listen";
  readonly channel: number;
  readonly senderName: string;
  readonly senderId: string;
  readonly message: string;
}

// === Lifecycle Events ===

export interface TimerEvent {
  readonly type: "timer";
  readonly timerId: string;
}

export interface RezEvent {
  readonly type: "rez";
  readonly startParam: number;
}

export interface ChangedEvent {
  readonly type: "changed";
  readonly change: number;
}

export interface MoneyEvent {
  readonly type: "money";
  readonly agent: AgentInfo;
  readonly amount: number;
}

export interface PermissionsEvent {
  readonly type: "permissions";
  readonly permissions: number;
}

// === Perception Events ===

export interface SensorEvent {
  readonly type: "sensor";
  readonly detected: AgentInfo[];
}

export interface NoSensorEvent {
  readonly type: "noSensor";
}

// === Data Events ===

export interface DataserverEvent {
  readonly type: "dataserver";
  readonly queryId: string;
  readonly data: string;
}

export interface HttpResponseEvent {
  readonly type: "httpResponse";
  readonly requestId: string;
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

// === poqpoq Extension Events ===

export interface PlayerEnterZoneEvent {
  readonly type: "playerEnterZone";
  readonly agent: AgentInfo;
  readonly zoneId: string;
  readonly zoneName: string;
}

export interface PlayerLeaveZoneEvent {
  readonly type: "playerLeaveZone";
  readonly agent: AgentInfo;
  readonly zoneId: string;
  readonly zoneName: string;
}

export interface DayNightCycleEvent {
  readonly type: "dayNightCycle";
  readonly phase: "dawn" | "day" | "dusk" | "night";
  readonly hour: number;
}

export interface WeatherChangeEvent {
  readonly type: "weatherChange";
  readonly weather: string;
  readonly intensity: number;
}

// === Discriminated Union ===

export type ScriptEvent =
  // Touch
  | TouchStartEvent
  | TouchEvent
  | TouchEndEvent
  // Collision
  | CollisionStartEvent
  | CollisionEvent
  | CollisionEndEvent
  // Communication
  | ListenEvent
  // Lifecycle
  | TimerEvent
  | RezEvent
  | ChangedEvent
  | MoneyEvent
  | PermissionsEvent
  // Perception
  | SensorEvent
  | NoSensorEvent
  // Data
  | DataserverEvent
  | HttpResponseEvent
  // poqpoq extensions
  | PlayerEnterZoneEvent
  | PlayerLeaveZoneEvent
  | DayNightCycleEvent
  | WeatherChangeEvent;

// === Envelope (adds routing metadata) ===

export interface ScriptEventEnvelope {
  /** Target object to receive this event (all scripts on this object) */
  readonly targetObjectId: string;
  /** Optional: target a specific script instead of all on the object */
  readonly targetScriptId?: string;
  /** The event payload */
  readonly event: ScriptEvent;
}

/** All possible event type discriminants */
export type ScriptEventType = ScriptEvent["type"];
