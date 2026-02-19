/**
 * WorldObject — represents any object in the 3D scene that scripts can interact with.
 * Maps to LSL's concept of a prim/linkset, but decoupled from script ownership.
 */

import type { Vector3, Quaternion, Color3 } from "./math.js";

/** Material/texture configuration for object faces */
export interface MaterialConfig {
  color?: Color3;
  alpha?: number;
  texture?: string;
  glow?: number;
  fullBright?: boolean;
  offsetU?: number;
  offsetV?: number;
  scaleU?: number;
  scaleV?: number;
  rotation?: number;
}

/** Particle system configuration */
export interface ParticleConfig {
  texture?: string;
  color?: Color3;
  endColor?: Color3;
  startAlpha?: number;
  endAlpha?: number;
  startScale?: Vector3;
  endScale?: Vector3;
  burstRate?: number;
  burstCount?: number;
  maxAge?: number;
  particleLifetime?: number;
  speed?: number;
  acceleration?: Vector3;
  pattern?: "drop" | "explode" | "angle" | "cone";
  angle?: number;
  omega?: Vector3;
}

/** Animation options for smooth transitions */
export interface AnimationOptions {
  duration?: number;
  easing?: "linear" | "easeIn" | "easeOut" | "easeInOut";
}

/** Sound playback options */
export interface SoundOptions {
  volume?: number;
  loop?: boolean;
  spatial?: boolean;
  radius?: number;
}

/** Physics properties */
export interface PhysicsConfig {
  enabled?: boolean;
  mass?: number;
  friction?: number;
  restitution?: number;
  gravity?: boolean;
}

/** ALL_SIDES constant — matches LSL */
export const ALL_SIDES = -1;

/**
 * WorldObject interface — the API surface scripts use to manipulate objects.
 * Every method that could take time returns a Promise for async/await support.
 */
export interface WorldObject {
  /** Unique object ID (maps to LSL key/UUID) */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Description text */
  readonly description: string;

  /** Creator's agent ID */
  readonly creatorId: string;

  /** Owner's agent ID */
  readonly ownerId: string;

  // === Transform ===
  getPosition(): Vector3;
  getRotation(): Quaternion;
  getScale(): Vector3;

  setPosition(pos: Vector3, options?: AnimationOptions): Promise<void>;
  setRotation(rot: Quaternion, options?: AnimationOptions): Promise<void>;
  setScale(scale: Vector3, options?: AnimationOptions): Promise<void>;

  /** Convenience: rotate to Euler angles in degrees */
  rotateTo(x: number, y: number, z: number, options?: AnimationOptions): Promise<void>;

  /** Move relative to current position */
  moveBy(offset: Vector3, options?: AnimationOptions): Promise<void>;

  /** Scale uniformly */
  scaleBy(factor: number, options?: AnimationOptions): Promise<void>;

  // === Appearance ===
  setColor(color: Color3, face?: number): void;
  setAlpha(alpha: number, face?: number): void;
  setTexture(texture: string, face?: number): void;
  setMaterial(config: MaterialConfig, face?: number): void;
  setFullBright(bright: boolean, face?: number): void;
  setGlow(intensity: number, face?: number): void;

  // === Text & Display ===
  /** Floating text above object — maps to llSetText */
  setText(text: string, color?: Color3, alpha?: number): void;

  // === Physics ===
  setPhysics(config: PhysicsConfig): void;
  applyForce(force: Vector3, local?: boolean): void;
  applyImpulse(impulse: Vector3, local?: boolean): void;
  applyTorque(torque: Vector3, local?: boolean): void;
  getVelocity(): Vector3;
  getAngularVelocity(): Vector3;
  setVelocity(vel: Vector3): void;

  // === Effects ===
  particles(config: ParticleConfig): void;
  stopParticles(): void;
  playSound(sound: string, options?: SoundOptions): void;
  stopSound(): void;
  loopSound(sound: string, volume?: number): void;

  // === Linkset ===
  /** Get number of links (prims) — maps to llGetNumberOfPrims */
  getLinkCount(): number;

  /** Get a linked prim by number — maps to llGetLinkKey */
  getLink(linkNumber: number): WorldObject | null;

  /** Get all linked prims */
  getLinks(): WorldObject[];

  // === Interaction ===
  /** Set click action type */
  setClickAction(action: "none" | "touch" | "sit" | "buy" | "pay" | "open"): void;

  /** Set sit target — maps to llSitTarget */
  setSitTarget(offset: Vector3, rotation: Quaternion): void;

  // === Permissions ===
  /** Check if object allows a specific operation */
  canModify(): boolean;
  canCopy(): boolean;
  canTransfer(): boolean;

  // === Raycasting ===
  /** Cast a ray from this object */
  raycast(direction: Vector3, distance: number): import("./events.js").RaycastHit | null;
}
