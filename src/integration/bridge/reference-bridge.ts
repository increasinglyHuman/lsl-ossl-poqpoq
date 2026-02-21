/**
 * Reference Babylon Bridge — Command handler that executes ScriptCommands
 * against a 3D engine using structural interfaces.
 *
 * This replaces World's BabylonBridge.ts. World imports this from Scripter
 * and passes its Babylon.js scene + subsystems. TypeScript structural typing
 * ensures Babylon.js objects satisfy our interfaces without direct imports.
 *
 * Usage (in World repo):
 *   import { ReferenceBabylonBridge } from "blackbox-scripter/bridge";
 *   const bridge = new ReferenceBabylonBridge(scene, { audio, npc, physics, chat });
 *   adapter.onScriptCommand(bridge.handle);
 */

import type { ScriptCommandEnvelope, ScriptCommand } from "../protocol/script-command.js";
import type {
  SceneLike,
  MeshLike,
  HostSystems,
  ColorLike,
} from "./engine-types.js";

export class ReferenceBabylonBridge {
  private scene: SceneLike;
  private systems: HostSystems;

  constructor(scene: SceneLike, systems: HostSystems = {}) {
    this.scene = scene;
    this.systems = systems;

    // Bind handle so it can be passed as a callback directly
    this.handle = this.handle.bind(this);
  }

  /**
   * Handle a ScriptCommand envelope. This is the CommandHandler callback
   * registered with ScriptHostAdapter.onScriptCommand().
   */
  handle(envelope: ScriptCommandEnvelope): unknown | Promise<unknown> {
    const cmd = envelope.command;
    return this.dispatch(cmd, envelope.containerId, envelope.scriptId);
  }

  private dispatch(cmd: ScriptCommand, containerId: string, scriptId: string): unknown | Promise<unknown> {
    switch (cmd.type) {
      // === Transform ===
      case "setPosition":
        return this.setPosition(cmd.objectId, cmd.position);
      case "setRotation":
        return this.setRotation(cmd.objectId, cmd.rotation);
      case "setScale":
        return this.setScale(cmd.objectId, cmd.scale);

      // === Appearance ===
      case "setColor":
        return this.setColor(cmd.objectId, cmd.color, cmd.face);
      case "setAlpha":
        return this.setAlpha(cmd.objectId, cmd.alpha, cmd.face);
      case "setTexture":
        return this.setTexture(cmd.objectId, cmd.texture, cmd.face);
      case "setText":
        return this.setText(cmd.objectId, cmd.text, cmd.color, cmd.alpha);
      case "setGlow":
        return this.setGlow(cmd.objectId, cmd.glow, cmd.face);

      // === Communication ===
      case "say":
        return this.systems.chat?.say(cmd.channel, cmd.message, containerId);
      case "whisper":
        return this.systems.chat?.whisper(cmd.channel, cmd.message, containerId);
      case "shout":
        return this.systems.chat?.shout(cmd.channel, cmd.message, containerId);
      case "regionSay":
        return this.systems.chat?.regionSay(cmd.channel, cmd.message, containerId);
      case "instantMessage":
        return this.systems.chat?.instantMessage(cmd.agentId, cmd.message);
      case "dialog":
        return this.systems.chat?.showDialog?.(cmd.agentId, cmd.message, cmd.buttons, cmd.channel, containerId);

      // === Effects ===
      case "playSound":
        return this.playSound(cmd.objectId, cmd.sound, cmd.volume, cmd.loop);
      case "stopSound":
        return this.systems.audio?.stopSound(cmd.objectId);
      case "setParticles":
        return this.systems.particles?.play(cmd.config, cmd.objectId);
      case "stopParticles":
        return this.systems.particles?.stop(cmd.objectId);

      // === Animation ===
      case "playAnimation":
        return this.playAnimation(cmd.targetId, cmd.animation);
      case "stopAnimation":
        return this.stopAnimation(cmd.targetId, cmd.animation);

      // === Physics ===
      case "applyForce":
        return this.systems.physics?.applyForce(cmd.objectId, cmd.force, cmd.local);
      case "applyImpulse":
        return this.systems.physics?.applyImpulse(cmd.objectId, cmd.impulse, cmd.local);
      case "setPhysics":
        return this.systems.physics?.configure(cmd.objectId, cmd.config);

      // === HTTP ===
      case "httpRequest":
        return this.httpRequest(cmd.url, cmd.method, cmd.body, cmd.headers);

      // === NPC ===
      case "npcCreate":
        return this.systems.npc?.createNPC(cmd.name, cmd.position, cmd.appearance);
      case "npcRemove":
        return this.systems.npc?.removeNPC(cmd.npcId);
      case "npcMoveTo":
        return this.systems.npc?.moveNPC(cmd.npcId, cmd.position);
      case "npcSay":
        return this.systems.npc?.sayNPC(cmd.npcId, cmd.message, cmd.channel);
      case "npcPlayAnimation":
        return this.systems.npc?.playAnimation(cmd.npcId, cmd.animation);
      case "npcStopAnimation":
        return this.systems.npc?.stopAnimation(cmd.npcId, cmd.animation);

      // === Permissions ===
      case "requestPermissions":
        return this.systems.permissions?.requestPermissions(cmd.agentId, cmd.permissions, scriptId);

      // === Media ===
      case "setMedia":
        return this.systems.media?.setMedia(cmd.objectId, cmd.face, cmd.mediaType, cmd.url, cmd.options as Record<string, unknown>);
      case "stopMedia":
        return this.systems.media?.stopMedia(cmd.objectId, cmd.face);
      case "setMediaVolume":
        return this.systems.media?.setVolume(cmd.objectId, cmd.volume);

      // === Sensors ===
      case "sensor":
        return this.systems.sensor?.sensor(cmd.objectId, cmd.name, cmd.sensorType, cmd.range, cmd.arc, scriptId);
      case "sensorRepeat":
        return this.systems.sensor?.sensorRepeat(cmd.objectId, cmd.name, cmd.sensorType, cmd.range, cmd.arc, cmd.interval, scriptId);
      case "sensorRemove":
        return this.systems.sensor?.sensorRemove(scriptId);

      // === Physics Extended (Phase 7D) ===
      case "setStatus":
        return this.systems.physics?.setStatus?.(cmd.objectId, cmd.flags, cmd.value);
      case "setDamage":
        return this.systems.physics?.setDamage?.(cmd.objectId, cmd.damage);
      case "pushObject":
        return this.systems.physics?.pushObject?.(cmd.targetId, cmd.impulse, cmd.angularImpulse, cmd.local);
      case "setTorque":
        return this.systems.physics?.setTorque?.(cmd.objectId, cmd.torque, cmd.local);
      case "volumeDetect":
        return this.systems.physics?.volumeDetect?.(cmd.objectId, cmd.enabled);
      case "collisionFilter":
        return this.systems.physics?.collisionFilter?.(cmd.objectId, cmd.name, cmd.id, cmd.accept);
      case "setBuoyancy":
        return this.systems.physics?.setBuoyancy?.(cmd.objectId, cmd.buoyancy);
      case "stopMoveToTarget":
        return this.systems.physics?.stopMoveToTarget?.(cmd.objectId);
      case "lookAt":
        return this.systems.physics?.lookAt?.(cmd.objectId, cmd.target, cmd.strength, cmd.damping);
      case "stopLookAt":
        return this.systems.physics?.stopLookAt?.(cmd.objectId);
      case "setPhysicsShape":
        return this.systems.physics?.setPhysicsShape?.(cmd.objectId, cmd.shapeType, cmd.params);

      // === Lifecycle ===
      case "rezObject":
        return this.systems.inventory?.rez(cmd.objectId, cmd.inventory, cmd.position, cmd.velocity, { x: cmd.rotation.x, y: cmd.rotation.y, z: cmd.rotation.z, w: cmd.rotation.s }, cmd.startParam);
      case "rezAtRoot":
        return this.systems.inventory?.rezAtRoot(cmd.objectId, cmd.inventory, cmd.position, cmd.velocity, { x: cmd.rotation.x, y: cmd.rotation.y, z: cmd.rotation.z, w: cmd.rotation.s }, cmd.startParam);
      case "die": {
        const mesh = this.findMesh(cmd.objectId);
        mesh?.dispose?.();
        return;
      }

      // === NPC Extended ===
      case "npcLookAt":
        return this.systems.npc?.lookAt?.(cmd.npcId, cmd.position);
      case "npcFollow":
        return this.systems.npc?.follow?.(cmd.npcId, cmd.targetId, cmd.distance);
      case "npcPatrol":
        return this.systems.npc?.patrol?.(cmd.npcId, cmd.waypoints, cmd.loop);
      case "npcWander":
        return this.systems.npc?.wander?.(cmd.npcId, cmd.center, cmd.radius);

      // === NPC Phase 7C ===
      case "npcWhisper":
        return this.systems.npc?.whisperNPC?.(cmd.npcId, cmd.message, cmd.channel);
      case "npcShout":
        return this.systems.npc?.shoutNPC?.(cmd.npcId, cmd.message, cmd.channel);
      case "npcSit":
        return this.systems.npc?.sit?.(cmd.npcId, cmd.targetId);
      case "npcStand":
        return this.systems.npc?.stand?.(cmd.npcId);
      case "npcSetRotation":
        // Protocol Quat uses { s } (LSL convention), engine QuatLike uses { w }
        return this.systems.npc?.setRotation?.(cmd.npcId, { x: cmd.rotation.x, y: cmd.rotation.y, z: cmd.rotation.z, w: cmd.rotation.s });
      case "npcGetPosition":
        return this.systems.npc?.getPosition?.(cmd.npcId);
      case "npcGetRotation":
        return this.systems.npc?.getRotation?.(cmd.npcId);
      case "npcTouch":
        return this.systems.npc?.touchObject?.(cmd.npcId, cmd.targetId);
      case "npcLoadAppearance":
        return this.systems.npc?.loadAppearance?.(cmd.npcId, cmd.appearance);
      case "npcStopMove":
        return this.systems.npc?.stopMove?.(cmd.npcId);

      // === Steering ===
      case "npcSetSteering":
        return this.systems.npc?.setSteering?.(cmd.npcId, cmd.behaviors as unknown[], cmd.maxSpeed, cmd.maxForce);
      case "npcClearSteering":
        return this.systems.npc?.clearSteering?.(cmd.npcId);

      default:
        return undefined;
    }
  }

  // === Transform Implementations ===

  private setPosition(objectId: string, position: { x: number; y: number; z: number }): void {
    const mesh = this.findMesh(objectId);
    if (!mesh) return;
    mesh.position.set(position.x, position.y, position.z);
  }

  private setRotation(objectId: string, rotation: { x: number; y: number; z: number; s: number }): void {
    const mesh = this.findMesh(objectId);
    if (!mesh) return;
    // Protocol uses { x, y, z, s } (LSL convention), Babylon uses { x, y, z, w }
    if (mesh.rotationQuaternion) {
      mesh.rotationQuaternion.x = rotation.x;
      mesh.rotationQuaternion.y = rotation.y;
      mesh.rotationQuaternion.z = rotation.z;
      mesh.rotationQuaternion.w = rotation.s;
    }
  }

  private setScale(objectId: string, scale: { x: number; y: number; z: number }): void {
    const mesh = this.findMesh(objectId);
    if (!mesh) return;
    mesh.scaling.set(scale.x, scale.y, scale.z);
  }

  // === Appearance Implementations ===

  private setColor(objectId: string, color: ColorLike, _face: number): void {
    const mesh = this.findMesh(objectId);
    if (!mesh?.material) return;
    const mat = mesh.material;
    // Babylon PBR uses albedoColor, Standard uses diffuseColor
    const target = mat.albedoColor ?? mat.diffuseColor;
    if (target) {
      target.r = color.r;
      target.g = color.g;
      target.b = color.b;
    }
  }

  private setAlpha(objectId: string, alpha: number, _face: number): void {
    const mesh = this.findMesh(objectId);
    if (!mesh) return;
    mesh.visibility = alpha;
    if (mesh.material) {
      mesh.material.alpha = alpha;
    }
  }

  private setTexture(objectId: string, texture: string, _face: number): void {
    const mesh = this.findMesh(objectId);
    if (!mesh?.material) return;
    if (this.systems.textures) {
      const tex = this.systems.textures.createTexture(texture);
      // Assign to material's diffuse texture slot
      (mesh.material as Record<string, unknown>).diffuseTexture = tex;
    }
  }

  private setText(objectId: string, text: string, color: ColorLike, alpha: number): void {
    const mesh = this.findMesh(objectId);
    if (!mesh) return;
    if (this.systems.textures) {
      const dynTex = this.systems.textures.createDynamicTexture(`text_${objectId}`, 512, 64);
      const colorStr = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
      dynTex.drawText(text, null, null, "bold 36px Arial", colorStr, "transparent", true);
      dynTex.update();
    }
  }

  private setGlow(objectId: string, glow: number, _face: number): void {
    const mesh = this.findMesh(objectId);
    if (!mesh?.material) return;
    const mat = mesh.material;
    if (mat.emissiveColor) {
      // Scale the diffuse/albedo color by glow intensity for emissive
      const source = mat.albedoColor ?? mat.diffuseColor;
      if (source) {
        mat.emissiveColor.r = source.r * glow;
        mat.emissiveColor.g = source.g * glow;
        mat.emissiveColor.b = source.b * glow;
      }
    }
  }

  // === Effects Implementations ===

  private playSound(objectId: string, sound: string, volume: number, loop: boolean): void {
    const mesh = this.findMesh(objectId);
    if (!mesh) return;
    this.systems.audio?.playSound(sound, mesh.position, { volume, loop });
  }

  // === Animation Implementations ===

  private playAnimation(targetId: string, animation: string): void {
    // Check NPC first, then scene animation groups
    if (this.systems.npc) {
      this.systems.npc.playAnimation(targetId, animation);
      return;
    }
    const group = this.scene.getAnimationGroupByName?.(animation);
    if (group) {
      group.start(false);
    }
  }

  private stopAnimation(targetId: string, animation: string): void {
    if (this.systems.npc) {
      this.systems.npc.stopAnimation(targetId, animation);
      return;
    }
    const group = this.scene.getAnimationGroupByName?.(animation);
    if (group) {
      group.stop();
    }
  }

  // === HTTP Implementation ===

  private async httpRequest(
    url: string,
    method: string,
    body?: string,
    headers?: Record<string, string>,
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    try {
      const response = await fetch(url, {
        method,
        body: body ?? undefined,
        headers: headers ?? undefined,
      });
      const responseBody = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => { responseHeaders[k] = v; });
      return { status: response.status, body: responseBody, headers: responseHeaders };
    } catch (err) {
      return {
        status: 0,
        body: err instanceof Error ? err.message : String(err),
        headers: {},
      };
    }
  }

  // === Mesh Lookup ===

  private findMesh(objectId: string): MeshLike | null {
    // Try by name first (most common — objectId stored as mesh name)
    const byName = this.scene.getMeshByName(objectId);
    if (byName) return byName;

    // Fallback: check metadata.objectId
    for (const mesh of this.scene.meshes) {
      if (mesh.metadata?.objectId === objectId) return mesh;
    }

    return null;
  }
}
