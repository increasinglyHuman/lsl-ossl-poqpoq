/**
 * Mock World — Testable WorldAPI implementation (no Babylon.js required).
 *
 * Provides in-memory implementations of:
 * - MockWorldObject: tracks position, rotation, scale, text, etc.
 * - MockAgent: simulated agent with configurable properties
 * - MockStorage: in-memory key-value store
 * - MockWorldAPI: wires everything together
 *
 * Used for:
 * - Phase 2 testing (script execution without 3D engine)
 * - Unit tests
 * - Standalone editor (Phase 4)
 * - CI/CD pipeline testing
 */

import { Vector3, Quaternion, Color3 } from "../types/math.js";
import type { WorldObject, MaterialConfig, ParticleConfig, AnimationOptions, SoundOptions, PhysicsConfig } from "../types/world-object.js";
import type { Agent } from "../types/agent.js";
import type { RaycastHit, WeatherState } from "../types/events.js";
import type { ScriptPermission } from "../types/events.js";
import type { NPC, NPCFactory, NPCAppearance, NPCMoveOptions, PatrolWaypoint } from "../types/npc.js";
import type { Companion, CompanionAPI } from "../types/companion.js";
import type { WorldAPI, HttpResponse, StorageAPI, HttpAPI, EnvironmentAPI } from "../api/world-api.js";
import type { WorldScript, TimerHandle, ListenHandle } from "../types/world-script.js";
import type { ScriptContainer, Asset, AssetType, LinkTarget } from "../types/script-container.js";

// === Mock WorldObject ===

export class MockWorldObject implements WorldObject {
  readonly id: string;
  name: string;
  description: string;
  readonly creatorId: string;
  readonly ownerId: string;

  private _position: Vector3;
  private _rotation: Quaternion;
  private _scale: Vector3;
  private _text = "";
  private _textColor = Color3.WHITE;
  private _textAlpha = 1;
  private _colors = new Map<number, Color3>();
  private _alphas = new Map<number, number>();
  private _physics: PhysicsConfig = { enabled: false };
  private _velocity = Vector3.ZERO;
  private _links: MockWorldObject[] = [];

  /** Log of all method calls (for test assertions) */
  readonly callLog: Array<{ method: string; args: unknown[] }> = [];

  constructor(
    id: string,
    name: string = "Object",
    options?: {
      position?: Vector3;
      rotation?: Quaternion;
      scale?: Vector3;
      ownerId?: string;
      creatorId?: string;
    }
  ) {
    this.id = id;
    this.name = name;
    this.description = "";
    this._position = options?.position ?? Vector3.ZERO;
    this._rotation = options?.rotation ?? Quaternion.IDENTITY;
    this._scale = options?.scale ?? Vector3.ONE;
    this.ownerId = options?.ownerId ?? "owner-0";
    this.creatorId = options?.creatorId ?? "creator-0";
  }

  private log(method: string, ...args: unknown[]): void {
    this.callLog.push({ method, args });
  }

  getPosition(): Vector3 { return this._position; }
  getRotation(): Quaternion { return this._rotation; }
  getScale(): Vector3 { return this._scale; }

  async setPosition(pos: Vector3, _options?: AnimationOptions): Promise<void> {
    this.log("setPosition", pos);
    this._position = pos;
  }

  async setRotation(rot: Quaternion, _options?: AnimationOptions): Promise<void> {
    this.log("setRotation", rot);
    this._rotation = rot;
  }

  async setScale(scale: Vector3, _options?: AnimationOptions): Promise<void> {
    this.log("setScale", scale);
    this._scale = scale;
  }

  async rotateTo(x: number, y: number, z: number, _options?: AnimationOptions): Promise<void> {
    this.log("rotateTo", x, y, z);
    this._rotation = Quaternion.fromEuler(new Vector3(x, y, z));
  }

  async moveBy(offset: Vector3, _options?: AnimationOptions): Promise<void> {
    this.log("moveBy", offset);
    this._position = this._position.add(offset);
  }

  async scaleBy(factor: number, _options?: AnimationOptions): Promise<void> {
    this.log("scaleBy", factor);
    this._scale = this._scale.scale(factor);
  }

  setColor(color: Color3, face?: number): void {
    this.log("setColor", color, face);
    this._colors.set(face ?? -1, color);
  }

  setAlpha(alpha: number, face?: number): void {
    this.log("setAlpha", alpha, face);
    this._alphas.set(face ?? -1, alpha);
  }

  setTexture(texture: string, face?: number): void { this.log("setTexture", texture, face); }
  setMaterial(config: MaterialConfig, face?: number): void { this.log("setMaterial", config, face); }
  setFullBright(bright: boolean, face?: number): void { this.log("setFullBright", bright, face); }
  setGlow(intensity: number, face?: number): void { this.log("setGlow", intensity, face); }

  setText(text: string, color?: Color3, alpha?: number): void {
    this.log("setText", text, color, alpha);
    this._text = text;
    if (color) this._textColor = color;
    if (alpha !== undefined) this._textAlpha = alpha;
  }

  getText(): string { return this._text; }

  setPhysics(config: PhysicsConfig): void {
    this.log("setPhysics", config);
    this._physics = { ...this._physics, ...config };
  }

  applyForce(force: Vector3, local?: boolean): void { this.log("applyForce", force, local); }
  applyImpulse(impulse: Vector3, local?: boolean): void { this.log("applyImpulse", impulse, local); }
  applyTorque(torque: Vector3, local?: boolean): void { this.log("applyTorque", torque, local); }
  getVelocity(): Vector3 { return this._velocity; }
  getAngularVelocity(): Vector3 { return Vector3.ZERO; }
  setVelocity(vel: Vector3): void {
    this.log("setVelocity", vel);
    this._velocity = vel;
  }

  particles(config: ParticleConfig): void { this.log("particles", config); }
  stopParticles(): void { this.log("stopParticles"); }
  playSound(sound: string, options?: SoundOptions): void { this.log("playSound", sound, options); }
  stopSound(): void { this.log("stopSound"); }
  loopSound(sound: string, volume?: number): void { this.log("loopSound", sound, volume); }

  getLinkCount(): number { return this._links.length + 1; }
  getLink(linkNumber: number): WorldObject | null {
    if (linkNumber === 0) return this;
    return this._links[linkNumber - 1] ?? null;
  }
  getLinks(): WorldObject[] { return [this, ...this._links]; }

  addLink(obj: MockWorldObject): void { this._links.push(obj); }

  setClickAction(action: "none" | "touch" | "sit" | "buy" | "pay" | "open"): void {
    this.log("setClickAction", action);
  }

  setSitTarget(offset: Vector3, rotation: Quaternion): void {
    this.log("setSitTarget", offset, rotation);
  }

  canModify(): boolean { return true; }
  canCopy(): boolean { return true; }
  canTransfer(): boolean { return true; }

  raycast(direction: Vector3, distance: number): RaycastHit | null {
    this.log("raycast", direction, distance);
    return null;
  }

  // === Inventory & Attachment ===
  allowInventoryDrop(allow: boolean): void { this.log("allowInventoryDrop", allow); }
  getAttached(): number { return 0; }

  // === Media on Prim ===
  setMediaParams(face: number, params: unknown[]): number {
    this.log("setMediaParams", face, params);
    return 0;
  }
  clearMedia(face?: number): number {
    this.log("clearMedia", face);
    return 0;
  }
  getMediaParams(face: number, params: unknown[]): unknown[] {
    this.log("getMediaParams", face, params);
    return [];
  }
}

// === Mock Agent ===

export class MockAgent implements Agent {
  readonly id: string;
  readonly name: string;
  readonly username: string;

  private _position: Vector3;
  private _present = true;

  readonly callLog: Array<{ method: string; args: unknown[] }> = [];

  constructor(id: string, name: string, position?: Vector3) {
    this.id = id;
    this.name = name;
    this.username = name.toLowerCase().replace(/\s/g, ".");
    this._position = position ?? Vector3.ZERO;
  }

  getPosition(): Vector3 { return this._position; }
  getRotation(): Quaternion { return Quaternion.IDENTITY; }
  getVelocity(): Vector3 { return Vector3.ZERO; }
  isPresent(): boolean { return this._present; }
  distanceFrom(pos: Vector3): number { return this._position.distanceTo(pos); }
  sendMessage(message: string): void { this.callLog.push({ method: "sendMessage", args: [message] }); }
  giveItem(itemId: string): void { this.callLog.push({ method: "giveItem", args: [itemId] }); }
  async teleport(destination: Vector3, lookAt?: Vector3): Promise<void> {
    this.callLog.push({ method: "teleport", args: [destination, lookAt] });
    this._position = destination;
  }
  playAnimation(name: string): void { this.callLog.push({ method: "playAnimation", args: [name] }); }
  stopAnimation(name: string): void { this.callLog.push({ method: "stopAnimation", args: [name] }); }
  attach(point: number): void { this.callLog.push({ method: "attach", args: [point] }); }
  detach(): void { this.callLog.push({ method: "detach", args: [] }); }

  setPresent(present: boolean): void { this._present = present; }
  setPosition(pos: Vector3): void { this._position = pos; }
}

// === Mock Container ===

export class MockContainer implements ScriptContainer {
  readonly id: string;
  readonly object: WorldObject;
  scripts: string[] = [];
  private assets = new Map<string, Asset>();
  private linkMessageCallback?: (link: LinkTarget, num: number, str: string, id: string) => void;

  constructor(id: string, object: WorldObject) {
    this.id = id;
    this.object = object;
  }

  private static readonly TYPE_MAP: Record<string, number> = {
    texture: 0, sound: 1, landmark: 3, clothing: 5, object: 6,
    notecard: 7, script: 10, bodypart: 13, animation: 20,
  };

  private static readonly REVERSE_TYPE_MAP: Record<number, AssetType> = {
    0: "texture", 1: "sound", 3: "landmark", 5: "clothing", 6: "object",
    7: "notecard", 10: "script", 13: "bodypart", 20: "animation",
  };

  getAsset(name: string): Asset | null { return this.assets.get(name) ?? null; }
  getAssets(type?: AssetType): Asset[] {
    const all = [...this.assets.values()];
    return type ? all.filter((a) => a.type === type) : all;
  }
  hasAsset(name: string): boolean { return this.assets.has(name); }
  getAssetCount(type?: AssetType | number): number {
    if (typeof type === "number") {
      const assetType = MockContainer.REVERSE_TYPE_MAP[type];
      return assetType ? this.getAssets(assetType).length : 0;
    }
    return this.getAssets(type).length;
  }

  getAssetName(type: AssetType | number, index: number): string {
    const assetType = typeof type === "number" ? MockContainer.REVERSE_TYPE_MAP[type] : type;
    if (!assetType) return "";
    const filtered = this.getAssets(assetType);
    return filtered[index]?.name ?? "";
  }

  getAssetType(name: string): number {
    const asset = this.assets.get(name);
    if (!asset) return -1;
    return MockContainer.TYPE_MAP[asset.type] ?? -1;
  }

  getAssetCreator(name: string): string {
    return this.assets.has(name) ? "creator-0" : "";
  }

  getAssetPermMask(_name: string, _mask: number): number {
    return 0x7FFFFFFF;
  }

  removeAsset(name: string): void {
    this.assets.delete(name);
  }

  sendLinkMessage(link: LinkTarget, num: number, str: string, id: string): void {
    if (this.linkMessageCallback) {
      this.linkMessageCallback(link, num, str, id);
    }
  }

  // Test helpers
  addAsset(asset: Asset): void { this.assets.set(asset.name, asset); }
  onLinkMessage(cb: (link: LinkTarget, num: number, str: string, id: string) => void): void {
    this.linkMessageCallback = cb;
  }
}

// === Mock Storage ===

class MockStorage implements StorageAPI {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> { return this.store.get(key) ?? null; }
  async set(key: string, value: string): Promise<void> { this.store.set(key, value); }
  async delete(key: string): Promise<void> { this.store.delete(key); }
  async keys(): Promise<string[]> { return [...this.store.keys()]; }
}

// === Mock HTTP ===

class MockHttp implements HttpAPI {
  readonly requestLog: Array<{ method: string; url: string }> = [];

  private response: HttpResponse = { status: 200, headers: {}, body: "{}" };

  setResponse(response: Partial<HttpResponse>): void {
    this.response = { ...this.response, ...response };
  }

  async get(url: string): Promise<HttpResponse> {
    this.requestLog.push({ method: "GET", url });
    return this.response;
  }
  async post(url: string): Promise<HttpResponse> {
    this.requestLog.push({ method: "POST", url });
    return this.response;
  }
  async put(url: string): Promise<HttpResponse> {
    this.requestLog.push({ method: "PUT", url });
    return this.response;
  }
  async delete(url: string): Promise<HttpResponse> {
    this.requestLog.push({ method: "DELETE", url });
    return this.response;
  }
}

// === Mock Environment ===

class MockEnvironment implements EnvironmentAPI {
  private timeOfDay = 12;
  private weather: WeatherState = { type: "clear", intensity: 0, windDirection: Vector3.ZERO, windSpeed: 0 } as WeatherState;

  getTimeOfDay(): number { return this.timeOfDay; }
  setTimeOfDay(hour: number): void { this.timeOfDay = hour; }
  getWeather(): WeatherState { return this.weather; }
  setWeather(weather: Partial<WeatherState>): void { this.weather = { ...this.weather, ...weather }; }
  setWind(_direction: Vector3, _speed: number): void {}
  setGravity(_strength: number): void {}
  getSunDirection(): Vector3 { return new Vector3(0, 1, 0); }
}

// === Mock NPC Factory ===

class MockNPCFactory implements NPCFactory {
  private npcs = new Map<string, NPC>();

  create(name: string, position: Vector3, _appearance?: NPCAppearance): NPC {
    const npc = createMockNPC(name, position);
    this.npcs.set(npc.id, npc);
    return npc;
  }
  get(id: string): NPC | null { return this.npcs.get(id) ?? null; }
  getAll(): NPC[] { return [...this.npcs.values()]; }
  removeAll(): void { this.npcs.clear(); }
}

function createMockNPC(name: string, position: Vector3): NPC {
  const id = `npc_${Math.random().toString(36).slice(2, 10)}`;
  let pos = position;
  return {
    id,
    name,
    isActive: () => true,
    getPosition: () => pos,
    getRotation: () => Quaternion.IDENTITY,
    setPosition: (p) => { pos = p; },
    setRotation: () => {},
    moveTo: async () => {},
    stop: () => {},
    lookAt: () => {},
    follow: () => {},
    patrol: () => {},
    wander: () => {},
    say: () => {},
    whisper: () => {},
    shout: () => {},
    playAnimation: () => {},
    stopAnimation: () => {},
    sit: () => {},
    stand: () => {},
    setAppearance: () => {},
    remove: () => {},
  };
}

// === Mock Companion ===

class MockCompanionAPI implements CompanionAPI {
  get(): Companion | null { return null; }
  isAvailable(): boolean { return false; }
}

// === Mock World API ===

export class MockWorldAPI implements WorldAPI {
  readonly objects = new Map<string, MockWorldObject>();
  readonly agents = new Map<string, MockAgent>();
  readonly npc: NPCFactory;
  readonly storage: StorageAPI;
  readonly http: HttpAPI;
  readonly environment: EnvironmentAPI;
  readonly companion: CompanionAPI;

  /** Log of all communication */
  readonly chatLog: Array<{ type: string; channel: number; message: string }> = [];

  private _time = 0;
  private _regionName = "Mock Region";

  constructor() {
    this.npc = new MockNPCFactory();
    this.storage = new MockStorage();
    this.http = new MockHttp();
    this.environment = new MockEnvironment();
    this.companion = new MockCompanionAPI();
  }

  // Object access
  getObject(idOrName: string): WorldObject | null {
    return this.objects.get(idOrName) ??
      [...this.objects.values()].find((o) => o.name === idOrName) ?? null;
  }
  getObjectsInRadius(center: Vector3, radius: number): WorldObject[] {
    return [...this.objects.values()].filter(
      (o) => o.getPosition().distanceTo(center) <= radius
    );
  }
  getGroundHeight(_position: Vector3): number { return 0; }

  // Communication
  say(channel: number, message: string): void {
    this.chatLog.push({ type: "say", channel, message });
  }
  whisper(channel: number, message: string): void {
    this.chatLog.push({ type: "whisper", channel, message });
  }
  shout(channel: number, message: string): void {
    this.chatLog.push({ type: "shout", channel, message });
  }
  regionSay(channel: number, message: string): void {
    this.chatLog.push({ type: "regionSay", channel, message });
  }
  listen(_channel: number, _name?: string, _id?: string, _message?: string): ListenHandle {
    return { id: "mock_listen", remove: () => {} };
  }
  sendLinkMessage(_link: number, _num: number, _str: string, _id: string): void {}

  // Agents
  getAgent(id: string): Agent | null { return this.agents.get(id) ?? null; }
  getAgents(): Agent[] { return [...this.agents.values()]; }
  getAgentCount(): number { return this.agents.size; }

  // Timers (handled by TimerManager, but interface requires them)
  setTimer(_interval: number, _id?: string): TimerHandle {
    return { id: "mock_timer", cancel: () => {} };
  }
  clearTimer(_id?: string): void {}
  setTimeout(_callback: () => void, _ms: number): void {}

  // Perception
  sensor(): void {}
  sensorRepeat(): void {}
  sensorRemove(): void {}
  raycast(_start: Vector3, _end: Vector3): RaycastHit[] { return []; }

  // Permissions
  requestPermissions(_agentId: string, _permissions: ScriptPermission): void {}

  // Utility
  getTime(): number { return this._time; }
  getUnixTime(): number { return Math.floor(Date.now() / 1000); }
  getRegionName(): string { return this._regionName; }
  log(...args: unknown[]): void { console.log("[MockWorld]", ...args); }
  resetScript(_script: WorldScript): void {}
  async sleep(_seconds: number): Promise<void> {}

  // === Test Helpers ===

  addObject(obj: MockWorldObject): void { this.objects.set(obj.id, obj); }
  addAgent(agent: MockAgent): void { this.agents.set(agent.id, agent); }
  setTime(time: number): void { this._time = time; }
  setRegionName(name: string): void { this._regionName = name; }
}
