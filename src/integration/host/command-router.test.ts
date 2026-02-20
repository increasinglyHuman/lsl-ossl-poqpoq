import { describe, it, expect, vi } from "vitest";
import { CommandRouter } from "./command-router.js";
import type { ScriptCommandEnvelope, ScriptCommand } from "../protocol/script-command.js";

function createRouter() {
  const containerMap = new Map<string, string>([
    ["script-1", "container-A"],
    ["script-2", "container-B"],
  ]);

  const router = new CommandRouter((scriptId) => containerMap.get(scriptId) ?? "unknown");
  return router;
}

describe("CommandRouter", () => {
  describe("transform commands", () => {
    it("routes object.setPosition", async () => {
      const router = createRouter();
      const received: ScriptCommandEnvelope[] = [];
      router.onCommand((env) => { received.push(env); });

      await router.resolve("script-1", "object.setPosition", [{ x: 1, y: 2, z: 3 }]);

      expect(received).toHaveLength(1);
      expect(received[0].command.type).toBe("setPosition");
      expect(received[0].scriptId).toBe("script-1");
      expect(received[0].containerId).toBe("container-A");
      if (received[0].command.type === "setPosition") {
        expect(received[0].command.position).toEqual({ x: 1, y: 2, z: 3 });
      }
    });

    it("routes object.setRotation", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.setRotation", [{ x: 0, y: 0, z: 0, s: 1 }]);

      expect(received[0].type).toBe("setRotation");
      if (received[0].type === "setRotation") {
        expect(received[0].rotation.s).toBe(1);
      }
    });

    it("routes object.setScale", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.setScale", [{ x: 2, y: 2, z: 2 }]);

      expect(received[0].type).toBe("setScale");
    });
  });

  describe("appearance commands", () => {
    it("routes object.setColor", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.setColor", [{ r: 1, g: 0, b: 0 }, -1]);

      expect(received[0].type).toBe("setColor");
      if (received[0].type === "setColor") {
        expect(received[0].color).toEqual({ r: 1, g: 0, b: 0 });
        expect(received[0].face).toBe(-1);
      }
    });

    it("routes object.setAlpha", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.setAlpha", [0.5, 0]);

      expect(received[0].type).toBe("setAlpha");
      if (received[0].type === "setAlpha") {
        expect(received[0].alpha).toBe(0.5);
      }
    });

    it("routes object.setText", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.setText", ["Hello", { r: 1, g: 1, b: 1 }, 1.0]);

      expect(received[0].type).toBe("setText");
      if (received[0].type === "setText") {
        expect(received[0].text).toBe("Hello");
      }
    });

    it("routes object.setTexture", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.setTexture", ["texture-uuid", 0]);

      expect(received[0].type).toBe("setTexture");
    });

    it("routes object.setGlow", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.setGlow", [0.5, -1]);

      expect(received[0].type).toBe("setGlow");
    });
  });

  describe("communication commands", () => {
    it("routes world.say", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.say", [0, "Hello!"]);

      expect(received[0].type).toBe("say");
      if (received[0].type === "say") {
        expect(received[0].channel).toBe(0);
        expect(received[0].message).toBe("Hello!");
      }
    });

    it("routes world.whisper", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.whisper", [0, "Psst..."]);

      expect(received[0].type).toBe("whisper");
    });

    it("routes world.shout", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.shout", [0, "HEY!"]);

      expect(received[0].type).toBe("shout");
    });

    it("routes world.regionSay", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.regionSay", [42, "broadcast"]);

      expect(received[0].type).toBe("regionSay");
    });

    it("routes world.instantMessage", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.instantMessage", ["agent-1", "Private msg"]);

      expect(received[0].type).toBe("instantMessage");
    });

    it("routes world.dialog", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.dialog", ["agent-1", "Choose:", ["A", "B"], 99]);

      expect(received[0].type).toBe("dialog");
      if (received[0].type === "dialog") {
        expect(received[0].buttons).toEqual(["A", "B"]);
        expect(received[0].channel).toBe(99);
      }
    });
  });

  describe("effects commands", () => {
    it("routes object.playSound", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.playSound", ["ding.ogg", 0.8]);

      expect(received[0].type).toBe("playSound");
      if (received[0].type === "playSound") {
        expect(received[0].sound).toBe("ding.ogg");
        expect(received[0].volume).toBe(0.8);
        expect(received[0].loop).toBe(false);
      }
    });

    it("routes object.loopSound as playSound with loop=true", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.loopSound", ["ambient.ogg", 0.5]);

      expect(received[0].type).toBe("playSound");
      if (received[0].type === "playSound") {
        expect(received[0].loop).toBe(true);
      }
    });

    it("routes object.stopSound", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.stopSound", []);

      expect(received[0].type).toBe("stopSound");
    });

    it("routes object.particles", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.particles", [{ maxAge: 5 }]);

      expect(received[0].type).toBe("setParticles");
    });
  });

  describe("physics commands", () => {
    it("routes object.applyForce", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.applyForce", [{ x: 0, y: 10, z: 0 }, false]);

      expect(received[0].type).toBe("applyForce");
      if (received[0].type === "applyForce") {
        expect(received[0].force.y).toBe(10);
        expect(received[0].local).toBe(false);
      }
    });

    it("routes object.applyImpulse", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.applyImpulse", [{ x: 5, y: 0, z: 0 }, true]);

      expect(received[0].type).toBe("applyImpulse");
      if (received[0].type === "applyImpulse") {
        expect(received[0].local).toBe(true);
      }
    });

    it("routes object.setPhysics", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "object.setPhysics", [{ gravity: false }]);

      expect(received[0].type).toBe("setPhysics");
    });
  });

  describe("NPC commands", () => {
    it("routes world.npcCreate", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.npcCreate", ["Guard", { x: 10, y: 0, z: 10 }, "guard-look"]);

      expect(received[0].type).toBe("npcCreate");
      if (received[0].type === "npcCreate") {
        expect(received[0].name).toBe("Guard");
      }
    });

    it("routes world.npcMoveTo", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.npcMoveTo", ["npc-1", { x: 20, y: 0, z: 20 }]);

      expect(received[0].type).toBe("npcMoveTo");
    });

    it("routes world.npcSay", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.npcSay", ["npc-1", "Hello traveler"]);

      expect(received[0].type).toBe("npcSay");
      if (received[0].type === "npcSay") {
        expect(received[0].channel).toBe(0); // default
      }
    });
  });

  describe("HTTP and permissions", () => {
    it("routes world.httpRequest", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.httpRequest", ["https://api.example.com", "POST", '{"x":1}']);

      expect(received[0].type).toBe("httpRequest");
      if (received[0].type === "httpRequest") {
        expect(received[0].method).toBe("POST");
        expect(received[0].body).toBe('{"x":1}');
      }
    });

    it("routes world.requestPermissions", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      await router.resolve("script-1", "world.requestPermissions", ["agent-1", 0x10]);

      expect(received[0].type).toBe("requestPermissions");
    });
  });

  describe("built-in passthrough", () => {
    it("returns undefined for built-in methods", () => {
      const router = createRouter();
      const handler = vi.fn();
      router.onCommand(handler);

      const builtins = [
        "world.setTimer",
        "world.clearTimer",
        "world.setTimeout",
        "world.listen",
        "world.log",
        "world.resetScript",
        "container.sendLinkMessage",
      ];

      for (const method of builtins) {
        const result = router.resolve("script-1", method, []);
        expect(result).toBeUndefined();
      }

      expect(handler).not.toHaveBeenCalled();
    });

    it("returns undefined for unknown methods", () => {
      const router = createRouter();
      const handler = vi.fn();
      router.onCommand(handler);

      const result = router.resolve("script-1", "world.unknownMethod", []);
      expect(result).toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("envelope metadata", () => {
    it("includes correct scriptId and containerId", async () => {
      const router = createRouter();
      const received: ScriptCommandEnvelope[] = [];
      router.onCommand((env) => { received.push(env); });

      await router.resolve("script-2", "world.say", [0, "test"]);

      expect(received[0].scriptId).toBe("script-2");
      expect(received[0].containerId).toBe("container-B");
    });

    it("assigns sequential callIds", async () => {
      const router = createRouter();
      const received: ScriptCommandEnvelope[] = [];
      router.onCommand((env) => { received.push(env); });

      await router.resolve("script-1", "world.say", [0, "first"]);
      await router.resolve("script-1", "world.say", [0, "second"]);

      expect(received[0].callId).toBeLessThan(received[1].callId);
    });
  });

  describe("handler return values", () => {
    it("returns the handler's result", async () => {
      const router = createRouter();
      router.onCommand(() => "npc-uuid-42");

      const result = await router.resolve("script-1", "world.npcCreate", ["NPC", { x: 0, y: 0, z: 0 }, "look"]);
      expect(result).toBe("npc-uuid-42");
    });

    it("returns async handler results", async () => {
      const router = createRouter();
      router.onCommand(async () => ({ status: 200, body: "OK" }));

      const result = await router.resolve("script-1", "world.httpRequest", ["https://api.test.com"]);
      expect(result).toEqual({ status: 200, body: "OK" });
    });

    it("throws when no handler is registered", () => {
      const router = createRouter();
      // No handler registered

      expect(() => router.resolve("script-1", "world.say", [0, "test"])).toThrow("No command handler");
    });
  });

  describe("createResolver", () => {
    it("creates a function compatible with ScriptManager.setApiResolver", async () => {
      const router = createRouter();
      const received: ScriptCommand[] = [];
      router.onCommand((env) => { received.push(env.command); });

      const resolver = router.createResolver();
      await resolver("script-1", "world.say", [0, "via resolver"]);

      expect(received[0].type).toBe("say");
    });
  });
});
