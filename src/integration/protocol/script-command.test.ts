import { describe, it, expect } from "vitest";
import type {
  ScriptCommand,
  ScriptCommandEnvelope,
  SetPositionCommand,
  SayCommand,
  NpcCreateCommand,
  HttpRequestCommand,
  PlaySoundCommand,
  SetColorCommand,
  ApplyForceCommand,
  DialogCommand,
  SetParticlesCommand,
  PlayAnimationCommand,
  SetPhysicsCommand,
  RequestPermissionsCommand,
  SetTextCommand,
} from "./script-command.js";

describe("ScriptCommand", () => {
  describe("construction", () => {
    it("creates a setPosition command", () => {
      const cmd: SetPositionCommand = {
        type: "setPosition",
        objectId: "obj-123",
        position: { x: 128, y: 128, z: 25 },
      };
      expect(cmd.type).toBe("setPosition");
      expect(cmd.position.x).toBe(128);
    });

    it("creates a say command", () => {
      const cmd: SayCommand = {
        type: "say",
        channel: 0,
        message: "Hello, World!",
      };
      expect(cmd.type).toBe("say");
      expect(cmd.channel).toBe(0);
      expect(cmd.message).toBe("Hello, World!");
    });

    it("creates an npcCreate command", () => {
      const cmd: NpcCreateCommand = {
        type: "npcCreate",
        name: "Guard",
        position: { x: 10, y: 0, z: 10 },
        appearance: "guard-appearance",
      };
      expect(cmd.type).toBe("npcCreate");
      expect(cmd.name).toBe("Guard");
    });

    it("creates an httpRequest command", () => {
      const cmd: HttpRequestCommand = {
        type: "httpRequest",
        url: "https://example.com/api",
        method: "POST",
        body: '{"key":"value"}',
        headers: { "Content-Type": "application/json" },
      };
      expect(cmd.type).toBe("httpRequest");
      expect(cmd.method).toBe("POST");
      expect(cmd.headers?.["Content-Type"]).toBe("application/json");
    });

    it("creates a playSound command", () => {
      const cmd: PlaySoundCommand = {
        type: "playSound",
        objectId: "obj-456",
        sound: "door-open.ogg",
        volume: 0.8,
        loop: false,
      };
      expect(cmd.type).toBe("playSound");
      expect(cmd.volume).toBe(0.8);
      expect(cmd.loop).toBe(false);
    });

    it("creates a setColor command", () => {
      const cmd: SetColorCommand = {
        type: "setColor",
        objectId: "obj-789",
        color: { r: 1, g: 0, b: 0 },
        face: -1,
      };
      expect(cmd.color.r).toBe(1);
      expect(cmd.face).toBe(-1);
    });

    it("creates a dialog command", () => {
      const cmd: DialogCommand = {
        type: "dialog",
        agentId: "agent-1",
        message: "Choose an option:",
        buttons: ["Yes", "No", "Maybe"],
        channel: 42,
      };
      expect(cmd.buttons).toHaveLength(3);
      expect(cmd.channel).toBe(42);
    });

    it("creates a setText command", () => {
      const cmd: SetTextCommand = {
        type: "setText",
        objectId: "obj-1",
        text: "Floating text",
        color: { r: 1, g: 1, b: 1 },
        alpha: 0.5,
      };
      expect(cmd.text).toBe("Floating text");
      expect(cmd.alpha).toBe(0.5);
    });
  });

  describe("JSON serialization", () => {
    it("round-trips through JSON", () => {
      const cmd: ScriptCommand = {
        type: "setPosition",
        objectId: "obj-123",
        position: { x: 1.5, y: 2.5, z: 3.5 },
      };
      const json = JSON.stringify(cmd);
      const parsed = JSON.parse(json) as ScriptCommand;
      expect(parsed).toEqual(cmd);
    });

    it("serializes complex commands", () => {
      const cmd: ScriptCommand = {
        type: "setParticles",
        objectId: "obj-1",
        config: { maxParticles: 100, lifetime: 5, color: { r: 1, g: 0, b: 0 } },
      };
      const json = JSON.stringify(cmd);
      const parsed = JSON.parse(json) as SetParticlesCommand;
      expect(parsed.config.maxParticles).toBe(100);
    });

    it("serializes httpRequest with optional fields", () => {
      const cmd: HttpRequestCommand = {
        type: "httpRequest",
        url: "https://api.example.com",
        method: "GET",
      };
      const json = JSON.stringify(cmd);
      const parsed = JSON.parse(json) as HttpRequestCommand;
      expect(parsed.body).toBeUndefined();
      expect(parsed.headers).toBeUndefined();
    });
  });

  describe("type narrowing", () => {
    it("narrows via switch on type discriminant", () => {
      const commands: ScriptCommand[] = [
        { type: "setPosition", objectId: "a", position: { x: 0, y: 0, z: 0 } },
        { type: "say", channel: 0, message: "hi" },
        { type: "npcMoveTo", npcId: "npc-1", position: { x: 5, y: 0, z: 5 } },
        { type: "applyForce", objectId: "b", force: { x: 0, y: 10, z: 0 }, local: false },
        { type: "playAnimation", targetId: "agent-1", animation: "wave" },
        { type: "setPhysics", objectId: "c", config: { gravity: false } },
        { type: "requestPermissions", agentId: "a-1", permissions: 0x10 },
      ];

      for (const cmd of commands) {
        switch (cmd.type) {
          case "setPosition":
            expect(cmd.position).toBeDefined();
            break;
          case "say":
            expect(cmd.message).toBe("hi");
            break;
          case "npcMoveTo":
            expect(cmd.npcId).toBe("npc-1");
            break;
          case "applyForce":
            expect(cmd.force.y).toBe(10);
            break;
          case "playAnimation":
            expect(cmd.animation).toBe("wave");
            break;
          case "setPhysics":
            expect(cmd.config.gravity).toBe(false);
            break;
          case "requestPermissions":
            expect(cmd.permissions).toBe(0x10);
            break;
        }
      }
    });
  });

  describe("ScriptCommandEnvelope", () => {
    it("wraps a command with routing metadata", () => {
      const envelope: ScriptCommandEnvelope = {
        scriptId: "script-abc",
        containerId: "container-def",
        callId: 42,
        command: {
          type: "say",
          channel: 0,
          message: "Hello from envelope",
        },
      };
      expect(envelope.scriptId).toBe("script-abc");
      expect(envelope.callId).toBe(42);
      expect(envelope.command.type).toBe("say");
    });

    it("round-trips envelope through JSON", () => {
      const envelope: ScriptCommandEnvelope = {
        scriptId: "s-1",
        containerId: "c-1",
        callId: 99,
        command: {
          type: "setScale",
          objectId: "obj-1",
          scale: { x: 2, y: 2, z: 2 },
        },
      };
      const roundTripped = JSON.parse(JSON.stringify(envelope)) as ScriptCommandEnvelope;
      expect(roundTripped).toEqual(envelope);
    });
  });
});
