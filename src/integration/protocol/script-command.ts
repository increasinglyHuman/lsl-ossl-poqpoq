/**
 * ScriptCommand — Typed messages from scripts to the host engine.
 *
 * Every World API call that requires host action becomes a ScriptCommand.
 * These are plain JSON-serializable objects (no class instances) because
 * they cross the Worker boundary.
 *
 * The host (Babylon.js bridge) receives these via a CommandHandler callback
 * and translates them into actual engine calls.
 */

// === Serializable Geometry Types ===
// Plain objects, not class instances — safe for Worker postMessage

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Quat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly s: number;
}

export interface Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

// === Transform Commands ===

export interface SetPositionCommand {
  readonly type: "setPosition";
  readonly objectId: string;
  readonly position: Vec3;
}

export interface SetRotationCommand {
  readonly type: "setRotation";
  readonly objectId: string;
  readonly rotation: Quat;
}

export interface SetScaleCommand {
  readonly type: "setScale";
  readonly objectId: string;
  readonly scale: Vec3;
}

// === Appearance Commands ===

export interface SetColorCommand {
  readonly type: "setColor";
  readonly objectId: string;
  readonly color: Color;
  readonly face: number;
}

export interface SetAlphaCommand {
  readonly type: "setAlpha";
  readonly objectId: string;
  readonly alpha: number;
  readonly face: number;
}

export interface SetTextureCommand {
  readonly type: "setTexture";
  readonly objectId: string;
  readonly texture: string;
  readonly face: number;
}

export interface SetTextCommand {
  readonly type: "setText";
  readonly objectId: string;
  readonly text: string;
  readonly color: Color;
  readonly alpha: number;
}

export interface SetGlowCommand {
  readonly type: "setGlow";
  readonly objectId: string;
  readonly glow: number;
  readonly face: number;
}

// === Communication Commands ===

export interface SayCommand {
  readonly type: "say";
  readonly channel: number;
  readonly message: string;
}

export interface WhisperCommand {
  readonly type: "whisper";
  readonly channel: number;
  readonly message: string;
}

export interface ShoutCommand {
  readonly type: "shout";
  readonly channel: number;
  readonly message: string;
}

export interface RegionSayCommand {
  readonly type: "regionSay";
  readonly channel: number;
  readonly message: string;
}

export interface InstantMessageCommand {
  readonly type: "instantMessage";
  readonly agentId: string;
  readonly message: string;
}

export interface DialogCommand {
  readonly type: "dialog";
  readonly agentId: string;
  readonly message: string;
  readonly buttons: string[];
  readonly channel: number;
}

// === Phase 8: Dialog/UI Extended Commands ===

export interface TextBoxCommand {
  readonly type: "textBox";
  readonly agentId: string;
  readonly message: string;
  readonly channel: number;
}

export interface LoadURLCommand {
  readonly type: "loadURL";
  readonly agentId: string;
  readonly message: string;
  readonly url: string;
}

export interface MapDestinationCommand {
  readonly type: "mapDestination";
  readonly simName: string;
  readonly position: Vec3;
  readonly lookAt: Vec3;
}

// === Phase 8: Communication Extended ===

export interface RegionSayToCommand {
  readonly type: "regionSayTo";
  readonly targetId: string;
  readonly channel: number;
  readonly message: string;
}

// === Phase 8: Inventory Action Commands ===

export interface GiveInventoryCommand {
  readonly type: "giveInventory";
  readonly targetId: string;
  readonly inventory: string;
}

export interface GiveInventoryListCommand {
  readonly type: "giveInventoryList";
  readonly targetId: string;
  readonly folder: string;
  readonly inventory: string[];
}

// === Phase 8: Notecard Commands ===

export interface GetNotecardLineCommand {
  readonly type: "getNotecardLine";
  readonly objectId: string;
  readonly notecard: string;
  readonly line: number;
}

export interface GetNotecardLineCountCommand {
  readonly type: "getNotecardLineCount";
  readonly objectId: string;
  readonly notecard: string;
}

// === Phase 8: Attachment Commands ===

export interface AttachCommand {
  readonly type: "attach";
  readonly objectId: string;
  readonly attachPoint: number;
  readonly temp: boolean;
}

export interface DetachCommand {
  readonly type: "detach";
  readonly objectId: string;
}

// === Effects Commands ===

export interface PlaySoundCommand {
  readonly type: "playSound";
  readonly objectId: string;
  readonly sound: string;
  readonly volume: number;
  readonly loop: boolean;
}

export interface StopSoundCommand {
  readonly type: "stopSound";
  readonly objectId: string;
}

export interface SetParticlesCommand {
  readonly type: "setParticles";
  readonly objectId: string;
  readonly config: Record<string, unknown>;
}

export interface StopParticlesCommand {
  readonly type: "stopParticles";
  readonly objectId: string;
}

// === Animation Commands ===

export interface PlayAnimationCommand {
  readonly type: "playAnimation";
  readonly targetId: string;
  readonly animation: string;
}

export interface StopAnimationCommand {
  readonly type: "stopAnimation";
  readonly targetId: string;
  readonly animation: string;
}

// === Physics Commands ===

export interface ApplyForceCommand {
  readonly type: "applyForce";
  readonly objectId: string;
  readonly force: Vec3;
  readonly local: boolean;
}

export interface ApplyImpulseCommand {
  readonly type: "applyImpulse";
  readonly objectId: string;
  readonly impulse: Vec3;
  readonly local: boolean;
}

export interface SetPhysicsCommand {
  readonly type: "setPhysics";
  readonly objectId: string;
  readonly config: Record<string, unknown>;
}

// === HTTP Commands ===

export interface HttpRequestCommand {
  readonly type: "httpRequest";
  readonly url: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE";
  readonly body?: string;
  readonly headers?: Record<string, string>;
}

// === NPC Commands ===

export interface NpcCreateCommand {
  readonly type: "npcCreate";
  readonly name: string;
  readonly position: Vec3;
  readonly appearance: string;
}

export interface NpcRemoveCommand {
  readonly type: "npcRemove";
  readonly npcId: string;
}

export interface NpcMoveToCommand {
  readonly type: "npcMoveTo";
  readonly npcId: string;
  readonly position: Vec3;
}

export interface NpcSayCommand {
  readonly type: "npcSay";
  readonly npcId: string;
  readonly message: string;
  readonly channel: number;
}

export interface NpcPlayAnimationCommand {
  readonly type: "npcPlayAnimation";
  readonly npcId: string;
  readonly animation: string;
}

export interface NpcStopAnimationCommand {
  readonly type: "npcStopAnimation";
  readonly npcId: string;
  readonly animation: string;
}

// === Permission Commands ===

export interface RequestPermissionsCommand {
  readonly type: "requestPermissions";
  readonly agentId: string;
  readonly permissions: number;
}

// === Media Commands ===

export interface SetMediaCommand {
  readonly type: "setMedia";
  readonly objectId: string;
  readonly face: number;
  readonly mediaType: "video" | "iframe" | "stream";
  readonly url: string;
  readonly options?: {
    readonly autoplay?: boolean;
    readonly muted?: boolean;
    readonly loop?: boolean;
    readonly width?: number;
    readonly height?: number;
    /** LSL PRIM_MEDIA_* rules list (from llSetPrimMediaParams) */
    readonly rules?: readonly unknown[];
  };
}

export interface StopMediaCommand {
  readonly type: "stopMedia";
  readonly objectId: string;
  readonly face: number;
}

export interface SetMediaVolumeCommand {
  readonly type: "setMediaVolume";
  readonly objectId: string;
  readonly volume: number;
}

// === Sensor Commands ===

export interface SensorCommand {
  readonly type: "sensor";
  readonly objectId: string;
  readonly name: string;
  readonly sensorType: number;
  readonly range: number;
  readonly arc: number;
}

export interface SensorRepeatCommand {
  readonly type: "sensorRepeat";
  readonly objectId: string;
  readonly name: string;
  readonly sensorType: number;
  readonly range: number;
  readonly arc: number;
  readonly interval: number;
}

export interface SensorRemoveCommand {
  readonly type: "sensorRemove";
}

// === Lifecycle Commands ===

export interface RezObjectCommand {
  readonly type: "rezObject";
  readonly objectId: string;
  readonly inventory: string;
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly rotation: Quat;
  readonly startParam: number;
}

export interface DieCommand {
  readonly type: "die";
  readonly objectId: string;
}

// === NPC Extended Commands ===

export interface NpcLookAtCommand {
  readonly type: "npcLookAt";
  readonly npcId: string;
  readonly position: Vec3;
}

export interface NpcFollowCommand {
  readonly type: "npcFollow";
  readonly npcId: string;
  readonly targetId: string;
  readonly distance: number;
}

export interface NpcPatrolCommand {
  readonly type: "npcPatrol";
  readonly npcId: string;
  readonly waypoints: Vec3[];
  readonly loop: boolean;
}

export interface NpcWanderCommand {
  readonly type: "npcWander";
  readonly npcId: string;
  readonly center: Vec3;
  readonly radius: number;
}

// === NPC Phase 7C Commands ===

export interface NpcWhisperCommand {
  readonly type: "npcWhisper";
  readonly npcId: string;
  readonly message: string;
  readonly channel: number;
}

export interface NpcShoutCommand {
  readonly type: "npcShout";
  readonly npcId: string;
  readonly message: string;
  readonly channel: number;
}

export interface NpcSitCommand {
  readonly type: "npcSit";
  readonly npcId: string;
  readonly targetId: string;
}

export interface NpcStandCommand {
  readonly type: "npcStand";
  readonly npcId: string;
}

export interface NpcSetRotationCommand {
  readonly type: "npcSetRotation";
  readonly npcId: string;
  readonly rotation: Quat;
}

export interface NpcGetPositionCommand {
  readonly type: "npcGetPosition";
  readonly npcId: string;
}

export interface NpcGetRotationCommand {
  readonly type: "npcGetRotation";
  readonly npcId: string;
}

export interface NpcTouchCommand {
  readonly type: "npcTouch";
  readonly npcId: string;
  readonly targetId: string;
}

export interface NpcLoadAppearanceCommand {
  readonly type: "npcLoadAppearance";
  readonly npcId: string;
  readonly appearance: string;
}

export interface NpcStopMoveCommand {
  readonly type: "npcStopMove";
  readonly npcId: string;
}

// === Steering Behaviors ===

/** Declarative steering behavior configuration (discriminated union). */
export type SteeringBehaviorConfig =
  | { readonly behavior: "seek"; readonly target: Vec3; readonly weight?: number }
  | { readonly behavior: "flee"; readonly target: Vec3; readonly panicDistance?: number; readonly weight?: number }
  | { readonly behavior: "arrive"; readonly target: Vec3; readonly slowingRadius?: number; readonly weight?: number }
  | { readonly behavior: "pursue"; readonly targetId: string; readonly weight?: number }
  | { readonly behavior: "evade"; readonly targetId: string; readonly panicDistance?: number; readonly weight?: number }
  | { readonly behavior: "wander"; readonly radius?: number; readonly distance?: number; readonly jitter?: number; readonly weight?: number }
  | { readonly behavior: "separation"; readonly distance?: number; readonly weight?: number }
  | { readonly behavior: "cohesion"; readonly distance?: number; readonly weight?: number }
  | { readonly behavior: "alignment"; readonly distance?: number; readonly weight?: number }
  | { readonly behavior: "obstacleAvoidance"; readonly feelerLength?: number; readonly weight?: number }
  | { readonly behavior: "tether"; readonly anchor: Vec3; readonly radius: number; readonly weight?: number };

export interface NpcSetSteeringCommand {
  readonly type: "npcSetSteering";
  readonly npcId: string;
  readonly behaviors: readonly SteeringBehaviorConfig[];
  readonly maxSpeed?: number;
  readonly maxForce?: number;
}

export interface NpcClearSteeringCommand {
  readonly type: "npcClearSteering";
  readonly npcId: string;
}

// === Phase 7D: Physics Extended, Combat & Environment ===

export interface SetStatusCommand {
  readonly type: "setStatus";
  readonly objectId: string;
  readonly flags: number;
  readonly value: boolean;
}

export interface SetDamageCommand {
  readonly type: "setDamage";
  readonly objectId: string;
  readonly damage: number;
}

export interface PushObjectCommand {
  readonly type: "pushObject";
  readonly targetId: string;
  readonly impulse: Vec3;
  readonly angularImpulse: Vec3;
  readonly local: boolean;
}

export interface SetTorqueCommand {
  readonly type: "setTorque";
  readonly objectId: string;
  readonly torque: Vec3;
  readonly local: boolean;
}

export interface VolumeDetectCommand {
  readonly type: "volumeDetect";
  readonly objectId: string;
  readonly enabled: boolean;
}

export interface CollisionFilterCommand {
  readonly type: "collisionFilter";
  readonly objectId: string;
  readonly name: string;
  readonly id: string;
  readonly accept: boolean;
}

export interface SetBuoyancyCommand {
  readonly type: "setBuoyancy";
  readonly objectId: string;
  readonly buoyancy: number;
}

export interface StopMoveToTargetCommand {
  readonly type: "stopMoveToTarget";
  readonly objectId: string;
}

export interface LookAtCommand {
  readonly type: "lookAt";
  readonly objectId: string;
  readonly target: Vec3;
  readonly strength: number;
  readonly damping: number;
}

export interface StopLookAtCommand {
  readonly type: "stopLookAt";
  readonly objectId: string;
}

export interface SetPhysicsShapeCommand {
  readonly type: "setPhysicsShape";
  readonly objectId: string;
  readonly shapeType: number;
  readonly params: readonly unknown[];
}

export interface RezAtRootCommand {
  readonly type: "rezAtRoot";
  readonly objectId: string;
  readonly inventory: string;
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly rotation: Quat;
  readonly startParam: number;
}

// === Discriminated Union ===

export type ScriptCommand =
  // Transform
  | SetPositionCommand
  | SetRotationCommand
  | SetScaleCommand
  // Appearance
  | SetColorCommand
  | SetAlphaCommand
  | SetTextureCommand
  | SetTextCommand
  | SetGlowCommand
  // Communication
  | SayCommand
  | WhisperCommand
  | ShoutCommand
  | RegionSayCommand
  | InstantMessageCommand
  | DialogCommand
  // Effects
  | PlaySoundCommand
  | StopSoundCommand
  | SetParticlesCommand
  | StopParticlesCommand
  // Animation
  | PlayAnimationCommand
  | StopAnimationCommand
  // Physics
  | ApplyForceCommand
  | ApplyImpulseCommand
  | SetPhysicsCommand
  // HTTP
  | HttpRequestCommand
  // NPC
  | NpcCreateCommand
  | NpcRemoveCommand
  | NpcMoveToCommand
  | NpcSayCommand
  | NpcPlayAnimationCommand
  | NpcStopAnimationCommand
  // Permissions
  | RequestPermissionsCommand
  // Media
  | SetMediaCommand
  | StopMediaCommand
  | SetMediaVolumeCommand
  // Sensors
  | SensorCommand
  | SensorRepeatCommand
  | SensorRemoveCommand
  // Lifecycle
  | RezObjectCommand
  | DieCommand
  // NPC Extended
  | NpcLookAtCommand
  | NpcFollowCommand
  | NpcPatrolCommand
  | NpcWanderCommand
  // NPC Phase 7C
  | NpcWhisperCommand
  | NpcShoutCommand
  | NpcSitCommand
  | NpcStandCommand
  | NpcSetRotationCommand
  | NpcGetPositionCommand
  | NpcGetRotationCommand
  | NpcTouchCommand
  | NpcLoadAppearanceCommand
  | NpcStopMoveCommand
  // Steering
  | NpcSetSteeringCommand
  | NpcClearSteeringCommand
  // Phase 7D: Physics Extended, Combat & Environment
  | SetStatusCommand
  | SetDamageCommand
  | PushObjectCommand
  | SetTorqueCommand
  | VolumeDetectCommand
  | CollisionFilterCommand
  | SetBuoyancyCommand
  | StopMoveToTargetCommand
  | LookAtCommand
  | StopLookAtCommand
  | SetPhysicsShapeCommand
  | RezAtRootCommand
  // Phase 8: Dialogs, HUDs & Inventory
  | TextBoxCommand
  | LoadURLCommand
  | MapDestinationCommand
  | RegionSayToCommand
  | GiveInventoryCommand
  | GiveInventoryListCommand
  | GetNotecardLineCommand
  | GetNotecardLineCountCommand
  | AttachCommand
  | DetachCommand;

// === Envelope (adds routing metadata) ===

export interface ScriptCommandEnvelope {
  /** Script instance that generated this command */
  readonly scriptId: string;
  /** Container (object) the script belongs to */
  readonly containerId: string;
  /** Unique call ID for request/response correlation */
  readonly callId: number;
  /** The command payload */
  readonly command: ScriptCommand;
}

// === Handler type ===

export type CommandHandler = (envelope: ScriptCommandEnvelope) => unknown | Promise<unknown>;

/** All possible command type discriminants */
export type ScriptCommandType = ScriptCommand["type"];
