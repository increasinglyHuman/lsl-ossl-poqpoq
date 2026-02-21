/**
 * Bridge — Reference implementations for host engine integration.
 *
 * These modules let the host (e.g., World with Babylon.js) import
 * a ready-made command handler and event forwarder rather than
 * building their own from scratch.
 */

export { ReferenceBabylonBridge } from "./reference-bridge.js";
export { ReferenceEventForwarder } from "./event-forwarder.js";
export type { EventDispatchFn } from "./event-forwarder.js";
export { ReferenceMediaSurface } from "./media-surface.js";
export type { MediaElementFactory, VideoElementLike, IframeElementLike, MediaSurfaceConfig } from "./media-surface.js";
export { MediaPolicy } from "./media-policy.js";
export type { MediaPolicyConfig } from "./media-policy.js";

// Steering behaviors (pure math, engine-independent)
export {
  seek, flee, arrive, pursue, evade, wander,
  obstacleAvoidance, separation, cohesion, alignment, tether,
  combineForces, truncate, magnitude, normalize,
} from "./steering.js";

// NPC behavior FSMs
export { PatrolRunner, WanderRunner, FollowRunner, GuardRunner, SteeringPresets } from "./npc-behavior.js";
export type { BehaviorState, BehaviorWaypoint } from "./npc-behavior.js";

// Combat presets (declarative config, engine-independent)
export { CombatPresets } from "./combat.js";
export type { ProjectileConfig, ExplosionConfig, MeleeConfig, TurretConfig } from "./combat.js";

// Engine structural interfaces (for advanced consumers writing custom bridges)
export type {
  SceneLike,
  MeshLike,
  MaterialLike,
  Vec3Like,
  Vec3Settable,
  QuatLike,
  ColorLike,
  TextureFactoryLike,
  DynamicTextureLike,
  AnimationGroupLike,
  PhysicsSystemLike,
  AudioEngineLike,
  NPCManagerLike,
  ChatSystemLike,
  ParticleSystemLike,
  PermissionSystemLike,
  SensorSystemLike,
  MediaSurfaceLike,
  EnvironmentSystemLike,
  InventorySystemLike,
  HostSystems,
} from "./engine-types.js";
