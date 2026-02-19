/**
 * NPC (Non-Player Character) system — first-class citizen, not bolted on.
 * Maps to OSSL's osNpc* functions but with a proper object-oriented API.
 */

import type { Vector3, Quaternion } from "./math.js";

/** NPC appearance configuration */
export interface NPCAppearance {
  /** Notecard or appearance preset name */
  preset?: string;
  /** Direct appearance data */
  shape?: string;
  skin?: string;
  hair?: string;
  outfit?: string[];
}

/** NPC movement behavior */
export interface NPCMoveOptions {
  /** Movement speed (default: walking) */
  speed?: "walk" | "run" | "fly";
  /** Use pathfinding? */
  pathfind?: boolean;
  /** Stop distance from target */
  stopDistance?: number;
  /** Maximum time to reach target before giving up */
  timeout?: number;
}

/** NPC behavior preset for common patterns */
export type NPCBehavior = "idle" | "wander" | "patrol" | "follow" | "guard" | "vendor";

/** NPC patrol waypoint */
export interface PatrolWaypoint {
  position: Vector3;
  lookAt?: Vector3;
  pauseDuration?: number;
  animation?: string;
  say?: string;
}

/**
 * NPC interface — full control over non-player characters.
 * Every async method returns a Promise for natural sequential scripting.
 */
export interface NPC {
  /** Unique NPC ID */
  readonly id: string;

  /** Display name */
  readonly name: string;

  /** Is the NPC currently alive/active? */
  isActive(): boolean;

  // === Transform ===
  getPosition(): Vector3;
  getRotation(): Quaternion;
  setPosition(pos: Vector3): void;
  setRotation(rot: Quaternion): void;

  // === Movement ===
  /** Move to a position — resolves when arrived */
  moveTo(position: Vector3, options?: NPCMoveOptions): Promise<void>;

  /** Stop all movement */
  stop(): void;

  /** Look at a position or agent */
  lookAt(target: Vector3): void;

  /** Follow an agent */
  follow(agentId: string, distance?: number): void;

  /** Patrol a series of waypoints */
  patrol(waypoints: PatrolWaypoint[], loop?: boolean): void;

  /** Wander randomly within radius */
  wander(center: Vector3, radius: number): void;

  // === Communication ===
  /** NPC says something — maps to osNpcSay */
  say(message: string, channel?: number): void;

  /** NPC whispers */
  whisper(message: string, channel?: number): void;

  /** NPC shouts */
  shout(message: string, channel?: number): void;

  // === Animation ===
  /** Play an animation */
  playAnimation(animation: string): void;

  /** Stop an animation */
  stopAnimation(animation: string): void;

  // === Interaction ===
  /** Sit on an object — maps to osNpcSit */
  sit(target: string): void;

  /** Stand up — maps to osNpcStand */
  stand(): void;

  // === Appearance ===
  /** Change NPC appearance */
  setAppearance(appearance: NPCAppearance): void;

  // === Lifecycle ===
  /** Remove the NPC from the world — maps to osNpcRemove */
  remove(): void;
}

/** NPC factory — available via world.npc */
export interface NPCFactory {
  /** Create a new NPC — maps to osNpcCreate */
  create(
    name: string,
    position: Vector3,
    appearance?: NPCAppearance
  ): NPC;

  /** Get an existing NPC by ID */
  get(id: string): NPC | null;

  /** Get all active NPCs */
  getAll(): NPC[];

  /** Remove all NPCs created by this script */
  removeAll(): void;
}
