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
  | RequestPermissionsCommand;

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
