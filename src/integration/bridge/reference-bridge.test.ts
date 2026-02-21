import { describe, it, expect, vi } from "vitest";
import { ReferenceBabylonBridge } from "./reference-bridge.js";
import type {
  SceneLike,
  MeshLike,
  Vec3Settable,
  HostSystems,
  MaterialLike,
  AnimationGroupLike,
} from "./engine-types.js";
import type { ScriptCommandEnvelope } from "../protocol/script-command.js";

// === Test Helpers ===

function createVec3(x = 0, y = 0, z = 0): Vec3Settable {
  return {
    x, y, z,
    set(nx: number, ny: number, nz: number) {
      this.x = nx; this.y = ny; this.z = nz;
    },
  };
}

function createMockMesh(name: string): MeshLike {
  return {
    name,
    position: createVec3(),
    scaling: createVec3(1, 1, 1),
    rotationQuaternion: { x: 0, y: 0, z: 0, w: 1 },
    visibility: 1,
    material: {
      diffuseColor: { r: 1, g: 1, b: 1 },
      albedoColor: undefined,
      emissiveColor: { r: 0, g: 0, b: 0 },
      alpha: 1,
    } as MaterialLike,
    metadata: { objectId: name },
    dispose: vi.fn(),
  };
}

function createMockScene(meshes: MeshLike[] = []): SceneLike {
  const animGroups: AnimationGroupLike[] = [];
  return {
    meshes,
    getMeshByName(n: string) {
      return meshes.find(m => m.name === n) ?? null;
    },
    getAnimationGroupByName(n: string) {
      return animGroups.find(g => g.name === n) ?? null;
    },
  };
}

function envelope(command: Record<string, unknown>, containerId = "obj-1", scriptId = "script-1"): ScriptCommandEnvelope {
  return { scriptId, containerId, callId: 0, command } as unknown as ScriptCommandEnvelope;
}

// === Tests ===

describe("ReferenceBabylonBridge", () => {
  describe("Transform commands", () => {
    it("setPosition updates mesh position", () => {
      const mesh = createMockMesh("obj-1");
      const scene = createMockScene([mesh]);
      const bridge = new ReferenceBabylonBridge(scene);

      bridge.handle(envelope({ type: "setPosition", objectId: "obj-1", position: { x: 1, y: 2, z: 3 } }));

      expect(mesh.position.x).toBe(1);
      expect(mesh.position.y).toBe(2);
      expect(mesh.position.z).toBe(3);
    });

    it("setRotation updates quaternion", () => {
      const mesh = createMockMesh("obj-1");
      const scene = createMockScene([mesh]);
      const bridge = new ReferenceBabylonBridge(scene);

      bridge.handle(envelope({ type: "setRotation", objectId: "obj-1", rotation: { x: 0.1, y: 0.2, z: 0.3, s: 0.9 } }));

      expect(mesh.rotationQuaternion!.x).toBe(0.1);
      expect(mesh.rotationQuaternion!.y).toBe(0.2);
      expect(mesh.rotationQuaternion!.z).toBe(0.3);
      expect(mesh.rotationQuaternion!.w).toBe(0.9);
    });

    it("setScale updates mesh scaling", () => {
      const mesh = createMockMesh("obj-1");
      const scene = createMockScene([mesh]);
      const bridge = new ReferenceBabylonBridge(scene);

      bridge.handle(envelope({ type: "setScale", objectId: "obj-1", scale: { x: 2, y: 3, z: 4 } }));

      expect(mesh.scaling.x).toBe(2);
      expect(mesh.scaling.y).toBe(3);
      expect(mesh.scaling.z).toBe(4);
    });

    it("ignores commands for non-existent meshes", () => {
      const scene = createMockScene([]);
      const bridge = new ReferenceBabylonBridge(scene);

      // Should not throw
      bridge.handle(envelope({ type: "setPosition", objectId: "missing", position: { x: 1, y: 2, z: 3 } }));
    });
  });

  describe("Appearance commands", () => {
    it("setColor updates material diffuseColor", () => {
      const mesh = createMockMesh("obj-1");
      const scene = createMockScene([mesh]);
      const bridge = new ReferenceBabylonBridge(scene);

      bridge.handle(envelope({ type: "setColor", objectId: "obj-1", color: { r: 1, g: 0, b: 0 }, face: 0 }));

      expect(mesh.material!.diffuseColor!.r).toBe(1);
      expect(mesh.material!.diffuseColor!.g).toBe(0);
      expect(mesh.material!.diffuseColor!.b).toBe(0);
    });

    it("setAlpha updates mesh visibility and material alpha", () => {
      const mesh = createMockMesh("obj-1");
      const scene = createMockScene([mesh]);
      const bridge = new ReferenceBabylonBridge(scene);

      bridge.handle(envelope({ type: "setAlpha", objectId: "obj-1", alpha: 0.5, face: 0 }));

      expect(mesh.visibility).toBe(0.5);
      expect(mesh.material!.alpha).toBe(0.5);
    });

    it("setGlow scales emissive from diffuse color", () => {
      const mesh = createMockMesh("obj-1");
      mesh.material!.diffuseColor = { r: 1, g: 0.5, b: 0 };
      const scene = createMockScene([mesh]);
      const bridge = new ReferenceBabylonBridge(scene);

      bridge.handle(envelope({ type: "setGlow", objectId: "obj-1", glow: 0.5, face: 0 }));

      expect(mesh.material!.emissiveColor!.r).toBeCloseTo(0.5);
      expect(mesh.material!.emissiveColor!.g).toBeCloseTo(0.25);
      expect(mesh.material!.emissiveColor!.b).toBeCloseTo(0);
    });
  });

  describe("Communication commands", () => {
    it("say delegates to chat system", () => {
      const scene = createMockScene([]);
      const chat = { say: vi.fn(), whisper: vi.fn(), shout: vi.fn(), regionSay: vi.fn(), instantMessage: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { chat });

      bridge.handle(envelope({ type: "say", channel: 0, message: "Hello" }));

      expect(chat.say).toHaveBeenCalledWith(0, "Hello", "obj-1");
    });

    it("whisper delegates to chat system", () => {
      const scene = createMockScene([]);
      const chat = { say: vi.fn(), whisper: vi.fn(), shout: vi.fn(), regionSay: vi.fn(), instantMessage: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { chat });

      bridge.handle(envelope({ type: "whisper", channel: 5, message: "Psst" }));

      expect(chat.whisper).toHaveBeenCalledWith(5, "Psst", "obj-1");
    });

    it("instantMessage delegates to chat system", () => {
      const scene = createMockScene([]);
      const chat = { say: vi.fn(), whisper: vi.fn(), shout: vi.fn(), regionSay: vi.fn(), instantMessage: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { chat });

      bridge.handle(envelope({ type: "instantMessage", agentId: "agent-1", message: "Hey" }));

      expect(chat.instantMessage).toHaveBeenCalledWith("agent-1", "Hey");
    });
  });

  describe("Effects commands", () => {
    it("playSound delegates to audio engine with mesh position", () => {
      const mesh = createMockMesh("obj-1");
      mesh.position.set(10, 20, 30);
      const scene = createMockScene([mesh]);
      const audio = { playSound: vi.fn(), stopSound: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { audio });

      bridge.handle(envelope({ type: "playSound", objectId: "obj-1", sound: "bell.wav", volume: 0.8, loop: false }));

      expect(audio.playSound).toHaveBeenCalledWith("bell.wav", mesh.position, { volume: 0.8, loop: false });
    });

    it("stopSound delegates to audio engine", () => {
      const scene = createMockScene([]);
      const audio = { playSound: vi.fn(), stopSound: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { audio });

      bridge.handle(envelope({ type: "stopSound", objectId: "obj-1" }));

      expect(audio.stopSound).toHaveBeenCalledWith("obj-1");
    });

    it("setParticles delegates to particle system", () => {
      const scene = createMockScene([]);
      const particles = { play: vi.fn(), stop: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { particles });

      const config = { burstRate: 0.1, speed: 2 };
      bridge.handle(envelope({ type: "setParticles", objectId: "obj-1", config }));

      expect(particles.play).toHaveBeenCalledWith(config, "obj-1");
    });
  });

  describe("Physics commands", () => {
    it("applyForce delegates to physics system", () => {
      const scene = createMockScene([]);
      const physics = { applyForce: vi.fn(), applyImpulse: vi.fn(), configure: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { physics });

      bridge.handle(envelope({ type: "applyForce", objectId: "obj-1", force: { x: 0, y: 10, z: 0 }, local: false }));

      expect(physics.applyForce).toHaveBeenCalledWith("obj-1", { x: 0, y: 10, z: 0 }, false);
    });

    it("applyImpulse delegates to physics system", () => {
      const scene = createMockScene([]);
      const physics = { applyForce: vi.fn(), applyImpulse: vi.fn(), configure: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { physics });

      bridge.handle(envelope({ type: "applyImpulse", objectId: "obj-1", impulse: { x: 5, y: 0, z: 0 }, local: true }));

      expect(physics.applyImpulse).toHaveBeenCalledWith("obj-1", { x: 5, y: 0, z: 0 }, true);
    });

    it("setPhysics delegates to physics system", () => {
      const scene = createMockScene([]);
      const physics = { applyForce: vi.fn(), applyImpulse: vi.fn(), configure: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { physics });

      const config = { mass: 10, friction: 0.5 };
      bridge.handle(envelope({ type: "setPhysics", objectId: "obj-1", config }));

      expect(physics.configure).toHaveBeenCalledWith("obj-1", config);
    });
  });

  describe("NPC commands", () => {
    it("npcCreate delegates to NPC manager", () => {
      const scene = createMockScene([]);
      const npc = {
        createNPC: vi.fn().mockReturnValue("npc-1"),
        removeNPC: vi.fn(), moveNPC: vi.fn(), sayNPC: vi.fn(),
        playAnimation: vi.fn(), stopAnimation: vi.fn(),
      };
      const bridge = new ReferenceBabylonBridge(scene, { npc });

      const result = bridge.handle(envelope({ type: "npcCreate", name: "Guard", position: { x: 1, y: 0, z: 1 }, appearance: "default" }));

      expect(npc.createNPC).toHaveBeenCalledWith("Guard", { x: 1, y: 0, z: 1 }, "default");
      expect(result).toBe("npc-1");
    });

    it("npcRemove delegates to NPC manager", () => {
      const scene = createMockScene([]);
      const npc = {
        createNPC: vi.fn(), removeNPC: vi.fn(), moveNPC: vi.fn(),
        sayNPC: vi.fn(), playAnimation: vi.fn(), stopAnimation: vi.fn(),
      };
      const bridge = new ReferenceBabylonBridge(scene, { npc });

      bridge.handle(envelope({ type: "npcRemove", npcId: "npc-1" }));

      expect(npc.removeNPC).toHaveBeenCalledWith("npc-1");
    });

    it("npcMoveTo delegates to NPC manager", () => {
      const scene = createMockScene([]);
      const npc = {
        createNPC: vi.fn(), removeNPC: vi.fn(), moveNPC: vi.fn(),
        sayNPC: vi.fn(), playAnimation: vi.fn(), stopAnimation: vi.fn(),
      };
      const bridge = new ReferenceBabylonBridge(scene, { npc });

      bridge.handle(envelope({ type: "npcMoveTo", npcId: "npc-1", position: { x: 5, y: 0, z: 5 } }));

      expect(npc.moveNPC).toHaveBeenCalledWith("npc-1", { x: 5, y: 0, z: 5 });
    });

    it("npcSay delegates to NPC manager", () => {
      const scene = createMockScene([]);
      const npc = {
        createNPC: vi.fn(), removeNPC: vi.fn(), moveNPC: vi.fn(),
        sayNPC: vi.fn(), playAnimation: vi.fn(), stopAnimation: vi.fn(),
      };
      const bridge = new ReferenceBabylonBridge(scene, { npc });

      bridge.handle(envelope({ type: "npcSay", npcId: "npc-1", message: "Hello!", channel: 0 }));

      expect(npc.sayNPC).toHaveBeenCalledWith("npc-1", "Hello!", 0);
    });
  });

  describe("Media commands", () => {
    it("setMedia delegates to media system", () => {
      const scene = createMockScene([]);
      const media = { setMedia: vi.fn(), stopMedia: vi.fn(), setVolume: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { media });

      bridge.handle(envelope({
        type: "setMedia", objectId: "obj-1", face: 0,
        mediaType: "video", url: "https://youtube.com/embed/abc",
      }));

      expect(media.setMedia).toHaveBeenCalledWith("obj-1", 0, "video", "https://youtube.com/embed/abc", undefined);
    });

    it("stopMedia delegates to media system", () => {
      const scene = createMockScene([]);
      const media = { setMedia: vi.fn(), stopMedia: vi.fn(), setVolume: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { media });

      bridge.handle(envelope({ type: "stopMedia", objectId: "obj-1", face: 0 }));

      expect(media.stopMedia).toHaveBeenCalledWith("obj-1", 0);
    });
  });

  describe("Lifecycle commands", () => {
    it("die disposes the mesh", () => {
      const mesh = createMockMesh("obj-1");
      const scene = createMockScene([mesh]);
      const bridge = new ReferenceBabylonBridge(scene);

      bridge.handle(envelope({ type: "die", objectId: "obj-1" }));

      expect(mesh.dispose).toHaveBeenCalled();
    });
  });

  describe("Sensor commands", () => {
    it("sensor delegates to sensor system", () => {
      const scene = createMockScene([]);
      const sensor = { sensor: vi.fn(), sensorRepeat: vi.fn(), sensorRemove: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { sensor });

      bridge.handle(envelope({ type: "sensor", objectId: "obj-1", name: "", sensorType: 1, range: 20, arc: Math.PI }));

      expect(sensor.sensor).toHaveBeenCalledWith("obj-1", "", 1, 20, Math.PI, "script-1");
    });

    it("sensorRemove delegates to sensor system", () => {
      const scene = createMockScene([]);
      const sensor = { sensor: vi.fn(), sensorRepeat: vi.fn(), sensorRemove: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { sensor });

      bridge.handle(envelope({ type: "sensorRemove" }));

      expect(sensor.sensorRemove).toHaveBeenCalledWith("script-1");
    });
  });

  describe("Mesh lookup", () => {
    it("finds mesh by name", () => {
      const mesh = createMockMesh("door-1");
      const scene = createMockScene([mesh]);
      const bridge = new ReferenceBabylonBridge(scene);

      bridge.handle(envelope({ type: "setPosition", objectId: "door-1", position: { x: 1, y: 2, z: 3 } }));

      expect(mesh.position.x).toBe(1);
    });

    it("falls back to metadata.objectId", () => {
      const mesh = createMockMesh("some-internal-name");
      mesh.metadata = { objectId: "my-door" };
      const scene = createMockScene([mesh]);
      const bridge = new ReferenceBabylonBridge(scene);

      bridge.handle(envelope({ type: "setPosition", objectId: "my-door", position: { x: 5, y: 0, z: 0 } }));

      expect(mesh.position.x).toBe(5);
    });
  });

  describe("handle binding", () => {
    it("handle can be passed as standalone callback", () => {
      const mesh = createMockMesh("obj-1");
      const scene = createMockScene([mesh]);
      const bridge = new ReferenceBabylonBridge(scene);

      // Simulate passing handle as callback (loses `this` without bind)
      const handler = bridge.handle;
      handler(envelope({ type: "setPosition", objectId: "obj-1", position: { x: 9, y: 8, z: 7 } }));

      expect(mesh.position.x).toBe(9);
    });
  });

  describe("unknown commands", () => {
    it("returns undefined for unknown command types", () => {
      const scene = createMockScene([]);
      const bridge = new ReferenceBabylonBridge(scene);

      const result = bridge.handle(envelope({ type: "unknownCommand" }));

      expect(result).toBeUndefined();
    });
  });

  describe("graceful degradation without systems", () => {
    it("does not throw when chat system is not provided", () => {
      const scene = createMockScene([]);
      const bridge = new ReferenceBabylonBridge(scene, {});

      // Should not throw — returns undefined
      const result = bridge.handle(envelope({ type: "say", channel: 0, message: "test" }));
      expect(result).toBeUndefined();
    });

    it("does not throw when physics system is not provided", () => {
      const scene = createMockScene([]);
      const bridge = new ReferenceBabylonBridge(scene, {});

      const result = bridge.handle(envelope({ type: "applyForce", objectId: "obj-1", force: { x: 0, y: 10, z: 0 }, local: false }));
      expect(result).toBeUndefined();
    });

    it("does not throw when NPC manager is not provided", () => {
      const scene = createMockScene([]);
      const bridge = new ReferenceBabylonBridge(scene, {});

      const result = bridge.handle(envelope({ type: "npcCreate", name: "Bob", position: { x: 0, y: 0, z: 0 }, appearance: "" }));
      expect(result).toBeUndefined();
    });
  });
});
