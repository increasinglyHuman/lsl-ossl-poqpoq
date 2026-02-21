/**
 * Engine Types — Structural interfaces for 3D engine objects.
 *
 * These interfaces describe the shape of Babylon.js objects without
 * importing Babylon.js. TypeScript structural typing means real
 * Babylon.js objects satisfy these interfaces at runtime.
 *
 * This is the key to ADR-004: Scripter ships bridge code that works
 * with Babylon.js without depending on it.
 */

// === Geometry Primitives ===

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface Vec3Settable extends Vec3Like {
  set(x: number, y: number, z: number): void;
}

export interface QuatLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface ColorLike {
  r: number;
  g: number;
  b: number;
}

// === Scene ===

export interface SceneLike {
  meshes: MeshLike[];
  getMeshByName(name: string): MeshLike | null;
  getAnimationGroupByName?(name: string): AnimationGroupLike | null;
}

// === Mesh ===

export interface MeshLike {
  name: string;
  uniqueId?: number;
  position: Vec3Settable;
  scaling: Vec3Settable;
  rotationQuaternion: QuatLike | null;
  visibility: number;
  material: MaterialLike | null;
  metadata: Record<string, unknown> | null;
  isDisposed?(): boolean;
  dispose?(): void;
}

// === Material ===

export interface MaterialLike {
  diffuseColor?: ColorLike;
  albedoColor?: ColorLike;
  emissiveColor?: ColorLike;
  alpha?: number;
}

// === Texture ===

export interface TextureFactoryLike {
  createTexture(url: string): unknown;
  createDynamicTexture(name: string, width: number, height: number): DynamicTextureLike;
  createVideoTexture?(name: string, src: string | HTMLVideoElement): unknown;
}

export interface DynamicTextureLike {
  drawText(text: string, x: number | null, y: number | null, font: string, color: string, clearColor: string | null, invertY?: boolean): void;
  update(invertY?: boolean): void;
}

// === Animation ===

export interface AnimationGroupLike {
  name: string;
  isPlaying: boolean;
  start(loop?: boolean, speedRatio?: number, from?: number, to?: number): void;
  stop(): void;
  pause?(): void;
  reset?(): void;
  weight?: number;
}

// === Physics ===

export interface PhysicsSystemLike {
  applyForce(objectId: string, force: Vec3Like, local?: boolean): void;
  applyImpulse(objectId: string, impulse: Vec3Like, local?: boolean): void;
  configure(objectId: string, config: Record<string, unknown>): void;
  // Phase 7D extensions
  setStatus?(objectId: string, flags: number, value: boolean): void;
  setDamage?(objectId: string, damage: number): void;
  pushObject?(targetId: string, impulse: Vec3Like, angularImpulse: Vec3Like, local?: boolean): void;
  setTorque?(objectId: string, torque: Vec3Like, local?: boolean): void;
  volumeDetect?(objectId: string, enabled: boolean): void;
  collisionFilter?(objectId: string, name: string, id: string, accept: boolean): void;
  setBuoyancy?(objectId: string, buoyancy: number): void;
  stopMoveToTarget?(objectId: string): void;
  lookAt?(objectId: string, target: Vec3Like, strength: number, damping: number): void;
  stopLookAt?(objectId: string): void;
  setPhysicsShape?(objectId: string, shapeType: number, params: readonly unknown[]): void;
}

// === Audio ===

export interface AudioEngineLike {
  playSound(soundId: string, position: Vec3Like, options?: { volume?: number; loop?: boolean }): void;
  stopSound(objectId: string): void;
}

// === NPC ===

export interface NPCManagerLike {
  createNPC(name: string, position: Vec3Like, appearance?: string): string | Promise<string>;
  removeNPC(npcId: string): void;
  moveNPC(npcId: string, position: Vec3Like): void | Promise<void>;
  sayNPC(npcId: string, message: string, channel?: number): void;
  playAnimation(npcId: string, animation: string): void;
  stopAnimation(npcId: string, animation: string): void;
  lookAt?(npcId: string, position: Vec3Like): void;
  follow?(npcId: string, targetId: string, distance?: number): void;
  patrol?(npcId: string, waypoints: Vec3Like[], loop?: boolean): void;
  wander?(npcId: string, center: Vec3Like, radius: number): void;
  setAppearance?(npcId: string, appearance: string): void;
  sit?(npcId: string, targetId: string): void;
  stand?(npcId: string): void;
  // Phase 7C additions
  whisperNPC?(npcId: string, message: string, channel?: number): void;
  shoutNPC?(npcId: string, message: string, channel?: number): void;
  setRotation?(npcId: string, rotation: QuatLike): void;
  getPosition?(npcId: string): Vec3Like | null;
  getRotation?(npcId: string): QuatLike | null;
  touchObject?(npcId: string, targetId: string): void;
  loadAppearance?(npcId: string, appearance: string): void;
  stopMove?(npcId: string): void;
  setSteering?(npcId: string, behaviors: unknown[], maxSpeed?: number, maxForce?: number): void;
  clearSteering?(npcId: string): void;
}

// === Chat / Communication ===

export interface ChatSystemLike {
  say(channel: number, message: string, senderId?: string, senderName?: string): void;
  whisper(channel: number, message: string, senderId?: string, senderName?: string): void;
  shout(channel: number, message: string, senderId?: string, senderName?: string): void;
  regionSay(channel: number, message: string, senderId?: string, senderName?: string): void;
  instantMessage(agentId: string, message: string): void;
  showDialog?(agentId: string, message: string, buttons: string[], channel: number, objectId?: string): void;
}

// === Particle Effects ===

export interface ParticleSystemLike {
  play(config: Record<string, unknown>, objectId: string): void;
  stop(objectId: string): void;
}

// === Permissions ===

export interface PermissionSystemLike {
  requestPermissions(agentId: string, permissions: number, scriptId: string): void;
}

// === Sensor / Perception ===

export interface SensorSystemLike {
  sensor(objectId: string, name: string, type: number, range: number, arc: number, scriptId: string): void;
  sensorRepeat(objectId: string, name: string, type: number, range: number, arc: number, interval: number, scriptId: string): void;
  sensorRemove(scriptId: string): void;
}

// === Environment (Terrain / Water) ===

export interface EnvironmentSystemLike {
  getWaterHeight(position: Vec3Like): number;
  getGroundNormal(offset: Vec3Like): Vec3Like;
  getGroundSlope(offset: Vec3Like): Vec3Like;
  getGroundHeight?(position: Vec3Like): number;
}

// === Inventory / Rez ===

export interface InventorySystemLike {
  rez(objectId: string, inventory: string, position: Vec3Like, velocity: Vec3Like, rotation: QuatLike, startParam: number): void;
  rezAtRoot(objectId: string, inventory: string, position: Vec3Like, velocity: Vec3Like, rotation: QuatLike, startParam: number): void;
}

// === Media Surface ===

export interface MediaSurfaceLike {
  setMedia(objectId: string, face: number, mediaType: string, url: string, options?: Record<string, unknown>): void;
  stopMedia(objectId: string, face: number): void;
  setVolume(objectId: string, volume: number): void;
}

// === Aggregate: All host systems the bridge needs ===

export interface HostSystems {
  audio?: AudioEngineLike;
  npc?: NPCManagerLike;
  physics?: PhysicsSystemLike;
  chat?: ChatSystemLike;
  particles?: ParticleSystemLike;
  permissions?: PermissionSystemLike;
  sensor?: SensorSystemLike;
  media?: MediaSurfaceLike;
  textures?: TextureFactoryLike;
  environment?: EnvironmentSystemLike;
  inventory?: InventorySystemLike;
}
