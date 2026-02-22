/**
 * Command Router — Converts untyped API calls to typed ScriptCommand protocol.
 *
 * The runtime sends API calls as { method: "object.setPosition", args: [pos] }.
 * The CommandRouter converts these into typed ScriptCommand objects and
 * forwards them to the host's CommandHandler.
 *
 * Built-in methods (timers, listen, link messages) are handled by
 * ScriptManager.handleBuiltInCall() before reaching the router.
 */

import type {
  ScriptCommand,
  ScriptCommandEnvelope,
  CommandHandler,
  Vec3,
  Quat,
  Color,
} from "../protocol/script-command.js";

/** The signature of ScriptManager's WorldApiResolver */
export type ApiResolverFn = (
  scriptId: string,
  method: string,
  args: unknown[]
) => unknown | Promise<unknown>;

/**
 * Maps from the runtime's untyped method+args to typed ScriptCommand,
 * forwards to a CommandHandler, and returns the handler's result.
 */
export class CommandRouter {
  private handler: CommandHandler | null = null;
  private nextCallId = 0;

  /** Container ID lookup: scriptId → containerId */
  private containerLookup: (scriptId: string) => string;

  constructor(containerLookup: (scriptId: string) => string) {
    this.containerLookup = containerLookup;
  }

  /**
   * Register the command handler (typically the Babylon.js bridge).
   */
  onCommand(handler: CommandHandler): void {
    this.handler = handler;
  }

  /**
   * Resolve an API call. Returns the result from the command handler.
   * If the method can't be routed, returns undefined (built-in passthrough).
   */
  resolve(scriptId: string, method: string, args: unknown[]): unknown | Promise<unknown> {
    const command = this.methodToCommand(scriptId, method, args);
    if (!command) return undefined;

    if (!this.handler) {
      throw new Error(`No command handler registered for: ${method}`);
    }

    const containerId = this.containerLookup(scriptId);
    const envelope: ScriptCommandEnvelope = {
      scriptId,
      containerId,
      callId: this.nextCallId++,
      command,
    };

    return this.handler(envelope);
  }

  /**
   * Create an ApiResolverFn for use with ScriptManager.setApiResolver().
   * Built-in methods that return undefined will fall through.
   */
  createResolver(): ApiResolverFn {
    return (scriptId, method, args) => this.resolve(scriptId, method, args);
  }

  /**
   * Convert a method string + args to a typed ScriptCommand.
   * Returns null if the method isn't recognized (built-in or unknown).
   */
  private methodToCommand(scriptId: string, method: string, args: unknown[]): ScriptCommand | null {
    const containerId = this.containerLookup(scriptId);

    switch (method) {
      // === Object Transform ===
      case "object.setPosition":
        return { type: "setPosition", objectId: containerId, position: args[0] as Vec3 };
      case "object.setRotation":
        return { type: "setRotation", objectId: containerId, rotation: args[0] as Quat };
      case "object.setScale":
        return { type: "setScale", objectId: containerId, scale: args[0] as Vec3 };

      // === Object Appearance ===
      case "object.setColor":
        return { type: "setColor", objectId: containerId, color: args[0] as Color, face: args[1] as number };
      case "object.setAlpha":
        return { type: "setAlpha", objectId: containerId, alpha: args[0] as number, face: args[1] as number };
      case "object.setTexture":
        return { type: "setTexture", objectId: containerId, texture: args[0] as string, face: args[1] as number };
      case "object.setText":
        return { type: "setText", objectId: containerId, text: args[0] as string, color: args[1] as Color, alpha: args[2] as number };
      case "object.setGlow":
        return { type: "setGlow", objectId: containerId, glow: args[0] as number, face: args[1] as number };

      // === Communication ===
      case "world.say":
        return { type: "say", channel: args[0] as number, message: args[1] as string };
      case "world.whisper":
        return { type: "whisper", channel: args[0] as number, message: args[1] as string };
      case "world.shout":
        return { type: "shout", channel: args[0] as number, message: args[1] as string };
      case "world.regionSay":
        return { type: "regionSay", channel: args[0] as number, message: args[1] as string };
      case "world.instantMessage":
        return { type: "instantMessage", agentId: args[0] as string, message: args[1] as string };
      case "world.dialog":
        return {
          type: "dialog",
          agentId: args[0] as string,
          message: args[1] as string,
          buttons: args[2] as string[],
          channel: args[3] as number,
        };

      // === Effects ===
      case "object.playSound":
        return {
          type: "playSound",
          objectId: containerId,
          sound: args[0] as string,
          volume: (args[1] as number) ?? 1.0,
          loop: (args[2] as boolean) ?? false,
        };
      case "object.stopSound":
        return { type: "stopSound", objectId: containerId };
      case "object.loopSound":
        return {
          type: "playSound",
          objectId: containerId,
          sound: args[0] as string,
          volume: (args[1] as number) ?? 1.0,
          loop: true,
        };
      case "object.particles":
        return { type: "setParticles", objectId: containerId, config: args[0] as Record<string, unknown> };
      case "object.stopParticles":
        return { type: "stopParticles", objectId: containerId };

      // === Animation ===
      case "object.playAnimation":
      case "world.playAnimation":
        return { type: "playAnimation", targetId: args[0] as string, animation: args[1] as string };
      case "object.stopAnimation":
      case "world.stopAnimation":
        return { type: "stopAnimation", targetId: args[0] as string, animation: args[1] as string };

      // === Physics ===
      case "object.applyForce":
        return { type: "applyForce", objectId: containerId, force: args[0] as Vec3, local: (args[1] as boolean) ?? false };
      case "object.applyImpulse":
        return { type: "applyImpulse", objectId: containerId, impulse: args[0] as Vec3, local: (args[1] as boolean) ?? false };
      case "object.setPhysics":
        return { type: "setPhysics", objectId: containerId, config: args[0] as Record<string, unknown> };

      // === HTTP ===
      case "world.httpRequest":
        return {
          type: "httpRequest",
          url: args[0] as string,
          method: (args[1] as "GET" | "POST" | "PUT" | "DELETE") ?? "GET",
          body: args[2] as string | undefined,
          headers: args[3] as Record<string, string> | undefined,
        };

      // === NPC ===
      case "world.npcCreate":
        return { type: "npcCreate", name: args[0] as string, position: args[1] as Vec3, appearance: args[2] as string };
      case "world.npcRemove":
        return { type: "npcRemove", npcId: args[0] as string };
      case "world.npcMoveTo":
        return { type: "npcMoveTo", npcId: args[0] as string, position: args[1] as Vec3 };
      case "world.npcSay":
        return { type: "npcSay", npcId: args[0] as string, message: args[1] as string, channel: (args[2] as number) ?? 0 };
      case "world.npcPlayAnimation":
        return { type: "npcPlayAnimation", npcId: args[0] as string, animation: args[1] as string };
      case "world.npcStopAnimation":
        return { type: "npcStopAnimation", npcId: args[0] as string, animation: args[1] as string };

      // === Permissions ===
      case "world.requestPermissions":
        return { type: "requestPermissions", agentId: args[0] as string, permissions: args[1] as number };

      // === Media ===
      case "object.setMedia":
        return {
          type: "setMedia",
          objectId: containerId,
          face: args[0] as number,
          mediaType: (args[1] as "video" | "iframe" | "stream") ?? "video",
          url: args[2] as string,
          options: args[3] as Record<string, unknown> | undefined,
        };
      case "object.stopMedia":
        return { type: "stopMedia", objectId: containerId, face: args[0] as number };
      case "object.setMediaVolume":
        return { type: "setMediaVolume", objectId: containerId, volume: args[0] as number };

      // Media rules-list API (LSL compat — PRIM_MEDIA_* constants)
      case "object.setMediaParams":
        return {
          type: "setMedia",
          objectId: containerId,
          face: args[0] as number,
          mediaType: "video",
          url: "",
          options: { rules: args[1] as unknown[] },
        };
      case "object.clearMedia":
        return { type: "stopMedia", objectId: containerId, face: (args[0] as number) ?? -1 };

      // === Sensors ===
      case "world.sensor":
        return {
          type: "sensor",
          objectId: containerId,
          name: args[0] as string,
          sensorType: args[1] as number,
          range: args[2] as number,
          arc: args[3] as number,
        };
      case "world.sensorRepeat":
        return {
          type: "sensorRepeat",
          objectId: containerId,
          name: args[0] as string,
          sensorType: args[1] as number,
          range: args[2] as number,
          arc: args[3] as number,
          interval: args[4] as number,
        };
      case "world.sensorRemove":
        return { type: "sensorRemove" };

      // === Lifecycle ===
      case "object.die":
        return { type: "die", objectId: containerId };

      // === NPC Extended ===
      case "world.npcLookAt":
        return { type: "npcLookAt", npcId: args[0] as string, position: args[1] as import("../protocol/script-command.js").Vec3 };
      case "world.npcFollow":
        return { type: "npcFollow", npcId: args[0] as string, targetId: args[1] as string, distance: (args[2] as number) ?? 2.0 };
      case "world.npcPatrol":
        return { type: "npcPatrol", npcId: args[0] as string, waypoints: args[1] as import("../protocol/script-command.js").Vec3[], loop: (args[2] as boolean) ?? true };
      case "world.npcWander":
        return { type: "npcWander", npcId: args[0] as string, center: args[1] as import("../protocol/script-command.js").Vec3, radius: args[2] as number };

      // === NPC Phase 7C ===
      case "world.npcWhisper":
        return { type: "npcWhisper", npcId: args[0] as string, message: args[1] as string, channel: (args[2] as number) ?? 0 };
      case "world.npcShout":
        return { type: "npcShout", npcId: args[0] as string, message: args[1] as string, channel: (args[2] as number) ?? 0 };
      case "world.npcSit":
        return { type: "npcSit", npcId: args[0] as string, targetId: args[1] as string };
      case "world.npcStand":
        return { type: "npcStand", npcId: args[0] as string };
      case "world.npcSetRotation":
        return { type: "npcSetRotation", npcId: args[0] as string, rotation: args[1] as Quat };
      case "world.npcGetPosition":
        return { type: "npcGetPosition", npcId: args[0] as string };
      case "world.npcGetRotation":
        return { type: "npcGetRotation", npcId: args[0] as string };
      case "world.npcTouch":
        return { type: "npcTouch", npcId: args[0] as string, targetId: args[1] as string };
      case "world.npcLoadAppearance":
        return { type: "npcLoadAppearance", npcId: args[0] as string, appearance: args[1] as string };
      case "world.npcStopMove":
        return { type: "npcStopMove", npcId: args[0] as string };

      // === Steering ===
      case "world.npcSetSteering":
        return {
          type: "npcSetSteering",
          npcId: args[0] as string,
          behaviors: args[1] as import("../protocol/script-command.js").SteeringBehaviorConfig[],
          maxSpeed: args[2] as number | undefined,
          maxForce: args[3] as number | undefined,
        };
      case "world.npcClearSteering":
        return { type: "npcClearSteering", npcId: args[0] as string };

      // === Physics Extended (Phase 7D) ===
      case "object.setStatus":
        return { type: "setStatus", objectId: containerId, flags: args[0] as number, value: args[1] as boolean };
      case "object.setDamage":
        return { type: "setDamage", objectId: containerId, damage: args[0] as number };
      case "world.pushObject":
        return { type: "pushObject", targetId: args[0] as string, impulse: args[1] as Vec3, angularImpulse: args[2] as Vec3, local: (args[3] as boolean) ?? false };
      case "object.setTorque":
        return { type: "setTorque", objectId: containerId, torque: args[0] as Vec3, local: (args[1] as boolean) ?? false };
      case "object.volumeDetect":
        return { type: "volumeDetect", objectId: containerId, enabled: args[0] as boolean };
      case "object.collisionFilter":
        return { type: "collisionFilter", objectId: containerId, name: args[0] as string, id: args[1] as string, accept: args[2] as boolean };
      case "object.setBuoyancy":
        return { type: "setBuoyancy", objectId: containerId, buoyancy: args[0] as number };
      case "object.stopMoveToTarget":
        return { type: "stopMoveToTarget", objectId: containerId };
      case "object.lookAt":
        return { type: "lookAt", objectId: containerId, target: args[0] as Vec3, strength: args[1] as number, damping: args[2] as number };
      case "object.stopLookAt":
        return { type: "stopLookAt", objectId: containerId };
      case "object.setPhysicsShape":
        return { type: "setPhysicsShape", objectId: containerId, shapeType: args[0] as number, params: args[1] as unknown[] };
      case "object.rez":
        return { type: "rezObject", objectId: containerId, inventory: args[0] as string, position: args[1] as Vec3, velocity: args[2] as Vec3, rotation: args[3] as Quat, startParam: args[4] as number };
      case "object.rezAtRoot":
        return { type: "rezAtRoot", objectId: containerId, inventory: args[0] as string, position: args[1] as Vec3, velocity: args[2] as Vec3, rotation: args[3] as Quat, startParam: args[4] as number };

      // === Phase 8: Dialogs, HUDs & Inventory ===
      case "world.textBox":
        return { type: "textBox", agentId: args[0] as string, message: args[1] as string, channel: args[2] as number };
      case "world.loadURL":
        return { type: "loadURL", agentId: args[0] as string, message: args[1] as string, url: args[2] as string };
      case "world.mapDestination":
        return { type: "mapDestination", simName: args[0] as string, position: args[1] as Vec3, lookAt: args[2] as Vec3 };
      case "world.regionSayTo":
        return { type: "regionSayTo", targetId: args[0] as string, channel: args[1] as number, message: args[2] as string };
      case "world.giveInventory":
        return { type: "giveInventory", targetId: args[0] as string, inventory: args[1] as string };
      case "world.giveInventoryList":
        return { type: "giveInventoryList", targetId: args[0] as string, folder: args[1] as string, inventory: args[2] as string[] };
      case "world.getNotecardLine":
        return { type: "getNotecardLine", objectId: containerId, notecard: args[0] as string, line: args[1] as number };
      case "world.getNumberOfNotecardLines":
        return { type: "getNotecardLineCount", objectId: containerId, notecard: args[0] as string };
      case "world.attachToAvatar":
        return { type: "attach", objectId: containerId, attachPoint: args[0] as number, temp: false };
      case "world.attachToAvatarTemp":
        return { type: "attach", objectId: containerId, attachPoint: args[0] as number, temp: true };
      case "world.detachFromAvatar":
        return { type: "detach", objectId: containerId };

      // === Built-in methods handled by ScriptManager ===
      // These return null → the caller skips them (handled upstream)
      case "world.setTimer":
      case "world.clearTimer":
      case "world.setTimeout":
      case "world.listen":
      case "world.log":
      case "world.resetScript":
      case "container.sendLinkMessage":
        return null;

      default:
        return null;
    }
  }
}
