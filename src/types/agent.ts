/**
 * Agent — represents a user/avatar in the world.
 * Maps to LSL's concept of an avatar/agent, identified by key (UUID).
 */

import type { Vector3, Quaternion } from "./math.js";

/** Agent info for detection and interaction */
export interface Agent {
  /** Unique agent ID (maps to LSL key) */
  readonly id: string;

  /** Display name */
  readonly name: string;

  /** Username (login name) */
  readonly username: string;

  /** Current position in world */
  getPosition(): Vector3;

  /** Current rotation */
  getRotation(): Quaternion;

  /** Current velocity */
  getVelocity(): Vector3;

  /** Is the agent currently in the same region? */
  isPresent(): boolean;

  /** Distance from a point */
  distanceFrom(point: Vector3): number;

  // === Actions on agents ===

  /** Send instant message — maps to llInstantMessage */
  sendMessage(message: string): void;

  /** Give inventory item — maps to llGiveInventory */
  giveItem(itemName: string): void;

  /** Teleport agent — maps to osTeleportAgent (OSSL, requires permission) */
  teleport(destination: Vector3, lookAt?: Vector3): Promise<void>;

  /** Play animation on agent — requires PERMISSION_TRIGGER_ANIMATION */
  playAnimation(animation: string): void;

  /** Stop animation on agent */
  stopAnimation(animation: string): void;

  /** Attach to agent — requires PERMISSION_ATTACH */
  attach(attachPoint: AttachPoint): void;

  /** Detach from agent */
  detach(): void;
}

/** Attachment points — maps to LSL ATTACH_* constants */
export enum AttachPoint {
  Chest = 1,
  Head = 2,
  LeftShoulder = 3,
  RightShoulder = 4,
  LeftHand = 5,
  RightHand = 6,
  LeftFoot = 7,
  RightFoot = 8,
  Back = 9,
  Pelvis = 10,
  Mouth = 11,
  Chin = 12,
  LeftEar = 13,
  RightEar = 14,
  LeftEye = 15,
  RightEye = 16,
  Nose = 17,
  RightUpperArm = 18,
  RightForearm = 19,
  LeftUpperArm = 20,
  LeftForearm = 21,
  RightHip = 22,
  RightUpperLeg = 23,
  RightLowerLeg = 24,
  LeftHip = 25,
  LeftUpperLeg = 26,
  LeftLowerLeg = 27,
  Belly = 28,
  LeftPec = 29,
  RightPec = 30,
  HudCenter2 = 31,
  HudTopRight = 32,
  HudTop = 33,
  HudTopLeft = 34,
  HudCenter = 35,
  HudBottomLeft = 36,
  HudBottom = 37,
  HudBottomRight = 38,
  Neck = 39,
  AvatarCenter = 40,
}
