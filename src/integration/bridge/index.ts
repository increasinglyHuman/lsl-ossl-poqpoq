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
  HostSystems,
} from "./engine-types.js";
