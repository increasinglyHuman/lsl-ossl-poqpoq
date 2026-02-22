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

  describe("NPC extended commands", () => {
    function createFullNpcMock() {
      return {
        createNPC: vi.fn(), removeNPC: vi.fn(), moveNPC: vi.fn(),
        sayNPC: vi.fn(), playAnimation: vi.fn(), stopAnimation: vi.fn(),
        lookAt: vi.fn(), follow: vi.fn(), patrol: vi.fn(), wander: vi.fn(),
        whisperNPC: vi.fn(), shoutNPC: vi.fn(),
        sit: vi.fn(), stand: vi.fn(),
        setRotation: vi.fn(),
        getPosition: vi.fn().mockReturnValue({ x: 1, y: 2, z: 3 }),
        getRotation: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0, w: 1 }),
        touchObject: vi.fn(), loadAppearance: vi.fn(), stopMove: vi.fn(),
        setSteering: vi.fn(), clearSteering: vi.fn(),
        setAppearance: vi.fn(),
      };
    }

    it("npcLookAt delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcLookAt", npcId: "npc-1", position: { x: 5, y: 0, z: 5 } }));
      expect(npc.lookAt).toHaveBeenCalledWith("npc-1", { x: 5, y: 0, z: 5 });
    });

    it("npcFollow delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcFollow", npcId: "npc-1", targetId: "agent-1", distance: 3 }));
      expect(npc.follow).toHaveBeenCalledWith("npc-1", "agent-1", 3);
    });

    it("npcPatrol delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      const wps = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 10 }];
      bridge.handle(envelope({ type: "npcPatrol", npcId: "npc-1", waypoints: wps, loop: true }));
      expect(npc.patrol).toHaveBeenCalledWith("npc-1", wps, true);
    });

    it("npcWander delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcWander", npcId: "npc-1", center: { x: 5, y: 0, z: 5 }, radius: 10 }));
      expect(npc.wander).toHaveBeenCalledWith("npc-1", { x: 5, y: 0, z: 5 }, 10);
    });

    it("npcWhisper delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcWhisper", npcId: "npc-1", message: "Psst", channel: 5 }));
      expect(npc.whisperNPC).toHaveBeenCalledWith("npc-1", "Psst", 5);
    });

    it("npcShout delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcShout", npcId: "npc-1", message: "HEY!", channel: 0 }));
      expect(npc.shoutNPC).toHaveBeenCalledWith("npc-1", "HEY!", 0);
    });

    it("npcSit delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcSit", npcId: "npc-1", targetId: "chair-1" }));
      expect(npc.sit).toHaveBeenCalledWith("npc-1", "chair-1");
    });

    it("npcStand delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcStand", npcId: "npc-1" }));
      expect(npc.stand).toHaveBeenCalledWith("npc-1");
    });

    it("npcSetRotation delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcSetRotation", npcId: "npc-1", rotation: { x: 0, y: 0.7, z: 0, s: 0.7 } }));
      expect(npc.setRotation).toHaveBeenCalledWith("npc-1", { x: 0, y: 0.7, z: 0, w: 0.7 });
    });

    it("npcGetPosition returns position from NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      const result = bridge.handle(envelope({ type: "npcGetPosition", npcId: "npc-1" }));
      expect(npc.getPosition).toHaveBeenCalledWith("npc-1");
      expect(result).toEqual({ x: 1, y: 2, z: 3 });
    });

    it("npcGetRotation returns rotation from NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      const result = bridge.handle(envelope({ type: "npcGetRotation", npcId: "npc-1" }));
      expect(npc.getRotation).toHaveBeenCalledWith("npc-1");
      expect(result).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    });

    it("npcTouch delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcTouch", npcId: "npc-1", targetId: "button-1" }));
      expect(npc.touchObject).toHaveBeenCalledWith("npc-1", "button-1");
    });

    it("npcLoadAppearance delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcLoadAppearance", npcId: "npc-1", appearance: "warrior" }));
      expect(npc.loadAppearance).toHaveBeenCalledWith("npc-1", "warrior");
    });

    it("npcStopMove delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcStopMove", npcId: "npc-1" }));
      expect(npc.stopMove).toHaveBeenCalledWith("npc-1");
    });

    it("npcSetSteering delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      const behaviors = [
        { behavior: "wander", weight: 1.0, radius: 5 },
        { behavior: "tether", weight: 2.0, anchor: { x: 0, y: 0, z: 0 }, radius: 15 },
      ];
      bridge.handle(envelope({ type: "npcSetSteering", npcId: "npc-1", behaviors, maxSpeed: 3, maxForce: 5 }));
      expect(npc.setSteering).toHaveBeenCalledWith("npc-1", behaviors, 3, 5);
    });

    it("npcClearSteering delegates to NPC manager", () => {
      const npc = createFullNpcMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { npc });
      bridge.handle(envelope({ type: "npcClearSteering", npcId: "npc-1" }));
      expect(npc.clearSteering).toHaveBeenCalledWith("npc-1");
    });
  });

  describe("Phase 7D: Physics extended commands", () => {
    function createPhysicsMock() {
      return {
        applyForce: vi.fn(), applyImpulse: vi.fn(), configure: vi.fn(),
        setStatus: vi.fn(), setDamage: vi.fn(), pushObject: vi.fn(),
        setTorque: vi.fn(), volumeDetect: vi.fn(), collisionFilter: vi.fn(),
        setBuoyancy: vi.fn(), stopMoveToTarget: vi.fn(), lookAt: vi.fn(),
        stopLookAt: vi.fn(), setPhysicsShape: vi.fn(),
      };
    }

    it("setStatus delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "setStatus", objectId: "obj-1", flags: 0x01, value: true }));
      expect(physics.setStatus).toHaveBeenCalledWith("obj-1", 0x01, true);
    });

    it("setDamage delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "setDamage", objectId: "obj-1", damage: 100 }));
      expect(physics.setDamage).toHaveBeenCalledWith("obj-1", 100);
    });

    it("pushObject delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "pushObject", targetId: "target-1", impulse: { x: 0, y: 10, z: 0 }, angularImpulse: { x: 0, y: 0, z: 1 }, local: false }));
      expect(physics.pushObject).toHaveBeenCalledWith("target-1", { x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: 1 }, false);
    });

    it("setTorque delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "setTorque", objectId: "obj-1", torque: { x: 0, y: 5, z: 0 }, local: true }));
      expect(physics.setTorque).toHaveBeenCalledWith("obj-1", { x: 0, y: 5, z: 0 }, true);
    });

    it("volumeDetect delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "volumeDetect", objectId: "obj-1", enabled: true }));
      expect(physics.volumeDetect).toHaveBeenCalledWith("obj-1", true);
    });

    it("collisionFilter delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "collisionFilter", objectId: "obj-1", name: "enemy", id: "uuid-1", accept: true }));
      expect(physics.collisionFilter).toHaveBeenCalledWith("obj-1", "enemy", "uuid-1", true);
    });

    it("setBuoyancy delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "setBuoyancy", objectId: "obj-1", buoyancy: 1.0 }));
      expect(physics.setBuoyancy).toHaveBeenCalledWith("obj-1", 1.0);
    });

    it("stopMoveToTarget delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "stopMoveToTarget", objectId: "obj-1" }));
      expect(physics.stopMoveToTarget).toHaveBeenCalledWith("obj-1");
    });

    it("lookAt delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "lookAt", objectId: "obj-1", target: { x: 10, y: 0, z: 10 }, strength: 1.0, damping: 0.5 }));
      expect(physics.lookAt).toHaveBeenCalledWith("obj-1", { x: 10, y: 0, z: 10 }, 1.0, 0.5);
    });

    it("stopLookAt delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "stopLookAt", objectId: "obj-1" }));
      expect(physics.stopLookAt).toHaveBeenCalledWith("obj-1");
    });

    it("setPhysicsShape delegates to physics system", () => {
      const physics = createPhysicsMock();
      const bridge = new ReferenceBabylonBridge(createMockScene(), { physics });
      bridge.handle(envelope({ type: "setPhysicsShape", objectId: "obj-1", shapeType: 2, params: [] }));
      expect(physics.setPhysicsShape).toHaveBeenCalledWith("obj-1", 2, []);
    });
  });

  describe("Phase 7D: Lifecycle extended commands", () => {
    it("rezObject delegates to inventory system", () => {
      const inventory = { rez: vi.fn(), rezAtRoot: vi.fn() };
      const bridge = new ReferenceBabylonBridge(createMockScene(), { inventory });
      bridge.handle(envelope({
        type: "rezObject", objectId: "obj-1", inventory: "bullet",
        position: { x: 1, y: 2, z: 3 }, velocity: { x: 0, y: 0, z: 10 },
        rotation: { x: 0, y: 0, z: 0, s: 1 }, startParam: 0,
      }));
      expect(inventory.rez).toHaveBeenCalledWith(
        "obj-1", "bullet", { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 10 },
        { x: 0, y: 0, z: 0, w: 1 }, 0,
      );
    });

    it("rezAtRoot delegates to inventory system", () => {
      const inventory = { rez: vi.fn(), rezAtRoot: vi.fn() };
      const bridge = new ReferenceBabylonBridge(createMockScene(), { inventory });
      bridge.handle(envelope({
        type: "rezAtRoot", objectId: "obj-1", inventory: "tower",
        position: { x: 5, y: 0, z: 5 }, velocity: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, s: 1 }, startParam: 42,
      }));
      expect(inventory.rezAtRoot).toHaveBeenCalledWith(
        "obj-1", "tower", { x: 5, y: 0, z: 5 }, { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 }, 42,
      );
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

  describe("Phase 8: dialogs, HUDs & inventory", () => {
    function createDialogMock() {
      return { textBox: vi.fn(), loadURL: vi.fn(), mapDestination: vi.fn() };
    }

    function createAttachmentMock() {
      return { attach: vi.fn(), detach: vi.fn() };
    }

    it("textBox delegates to dialog system", () => {
      const scene = createMockScene([]);
      const dialog = createDialogMock();
      const bridge = new ReferenceBabylonBridge(scene, { dialog } as unknown as HostSystems);

      bridge.handle(envelope({ type: "textBox", agentId: "agent-1", message: "Enter name:", channel: 99 }));

      expect(dialog.textBox).toHaveBeenCalledWith("agent-1", "Enter name:", 99);
    });

    it("textBox falls back to chat.showDialog when no dialog system", () => {
      const scene = createMockScene([]);
      const chat = { say: vi.fn(), whisper: vi.fn(), shout: vi.fn(), regionSay: vi.fn(), instantMessage: vi.fn(), showDialog: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { chat } as unknown as HostSystems);

      bridge.handle(envelope({ type: "textBox", agentId: "agent-1", message: "Enter:", channel: 5 }));

      expect(chat.showDialog).toHaveBeenCalledWith("agent-1", "Enter:", [], 5, "obj-1");
    });

    it("loadURL delegates to dialog system", () => {
      const scene = createMockScene([]);
      const dialog = createDialogMock();
      const bridge = new ReferenceBabylonBridge(scene, { dialog } as unknown as HostSystems);

      bridge.handle(envelope({ type: "loadURL", agentId: "agent-1", message: "Visit us", url: "https://example.com" }));

      expect(dialog.loadURL).toHaveBeenCalledWith("agent-1", "Visit us", "https://example.com");
    });

    it("mapDestination delegates to dialog system", () => {
      const scene = createMockScene([]);
      const dialog = createDialogMock();
      const bridge = new ReferenceBabylonBridge(scene, { dialog } as unknown as HostSystems);

      bridge.handle(envelope({ type: "mapDestination", simName: "Sandbox", position: { x: 128, y: 128, z: 50 }, lookAt: { x: 0, y: 0, z: 0 } }));

      expect(dialog.mapDestination).toHaveBeenCalledWith("Sandbox", { x: 128, y: 128, z: 50 }, { x: 0, y: 0, z: 0 });
    });

    it("regionSayTo delegates to chat system", () => {
      const scene = createMockScene([]);
      const chat = { say: vi.fn(), whisper: vi.fn(), shout: vi.fn(), regionSay: vi.fn(), instantMessage: vi.fn(), regionSayTo: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { chat } as unknown as HostSystems);

      bridge.handle(envelope({ type: "regionSayTo", targetId: "target-1", channel: 42, message: "hello" }));

      expect(chat.regionSayTo).toHaveBeenCalledWith("target-1", 42, "hello");
    });

    it("giveInventory delegates to inventory system", () => {
      const scene = createMockScene([]);
      const inventory = { rez: vi.fn(), rezAtRoot: vi.fn(), give: vi.fn(), giveList: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { inventory } as unknown as HostSystems);

      bridge.handle(envelope({ type: "giveInventory", targetId: "target-1", inventory: "sword" }));

      expect(inventory.give).toHaveBeenCalledWith("obj-1", "target-1", "sword");
    });

    it("giveInventoryList delegates to inventory system", () => {
      const scene = createMockScene([]);
      const inventory = { rez: vi.fn(), rezAtRoot: vi.fn(), give: vi.fn(), giveList: vi.fn() };
      const bridge = new ReferenceBabylonBridge(scene, { inventory } as unknown as HostSystems);

      bridge.handle(envelope({ type: "giveInventoryList", targetId: "target-1", folder: "Gifts", inventory: ["a", "b"] }));

      expect(inventory.giveList).toHaveBeenCalledWith("obj-1", "target-1", "Gifts", ["a", "b"]);
    });

    it("getNotecardLine delegates to inventory system", () => {
      const scene = createMockScene([]);
      const inventory = { rez: vi.fn(), rezAtRoot: vi.fn(), getNotecardLine: vi.fn().mockReturnValue("line data") };
      const bridge = new ReferenceBabylonBridge(scene, { inventory } as unknown as HostSystems);

      const result = bridge.handle(envelope({ type: "getNotecardLine", objectId: "obj-1", notecard: "config", line: 3 }));

      expect(inventory.getNotecardLine).toHaveBeenCalledWith("obj-1", "config", 3);
      expect(result).toBe("line data");
    });

    it("attach delegates to attachment system", () => {
      const scene = createMockScene([]);
      const attachment = createAttachmentMock();
      const bridge = new ReferenceBabylonBridge(scene, { attachment } as unknown as HostSystems);

      bridge.handle(envelope({ type: "attach", objectId: "obj-1", attachPoint: 35, temp: true }));

      expect(attachment.attach).toHaveBeenCalledWith("obj-1", 35, true);
    });

    it("detach delegates to attachment system", () => {
      const scene = createMockScene([]);
      const attachment = createAttachmentMock();
      const bridge = new ReferenceBabylonBridge(scene, { attachment } as unknown as HostSystems);

      bridge.handle(envelope({ type: "detach", objectId: "obj-1" }));

      expect(attachment.detach).toHaveBeenCalledWith("obj-1");
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
