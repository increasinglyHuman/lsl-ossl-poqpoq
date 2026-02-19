/**
 * poqpoq Script Engine — Type exports
 */

export { Vector3, Quaternion, Color3 } from "./math.js";
export { WorldScript } from "./world-script.js";
export type { StateDefinition, TimerHandle, ListenHandle } from "./world-script.js";
export type { WorldObject, MaterialConfig, ParticleConfig, AnimationOptions, SoundOptions, PhysicsConfig } from "./world-object.js";
export { ALL_SIDES } from "./world-object.js";
export type { Agent } from "./agent.js";
export { AttachPoint } from "./agent.js";
export type { NPC, NPCFactory, NPCAppearance, NPCMoveOptions, PatrolWaypoint } from "./npc.js";
export type { Companion, CompanionAPI } from "./companion.js";
export type {
  ScriptEventHandlers,
  DetectedInfo,
  RaycastHit,
  WeatherState,
  QuestProgress,
  ZoneInfo,
} from "./events.js";
export {
  DetectedType,
  ScriptPermission,
  ControlFlag,
  ChangeFlag,
} from "./events.js";
