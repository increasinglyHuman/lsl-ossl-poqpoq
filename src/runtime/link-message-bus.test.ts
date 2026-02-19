/**
 * Tests for the Link Message Bus.
 * Validates inter-script messaging patterns used by complex LSL objects
 * like OpenCollar (20 scripts), AVsitter, HUDs, vehicles.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkMessageBus } from "./link-message-bus.js";
import { LINK_SET, LINK_THIS, LINK_ROOT, LINK_ALL_OTHERS, LINK_ALL_CHILDREN } from "../types/script-container.js";

describe("LinkMessageBus", () => {
  let bus: LinkMessageBus;
  let delivered: Array<{ targetScriptId: string; senderLink: number; num: number; str: string; id: string }>;

  beforeEach(() => {
    bus = new LinkMessageBus(64);
    delivered = [];
    bus.onDeliver((targetScriptId, senderLink, num, str, id) => {
      delivered.push({ targetScriptId, senderLink, num, str, id });
    });
  });

  describe("registration", () => {
    it("should register and unregister scripts", () => {
      bus.register("script-a", "container-1", 0);
      expect(bus.getContainerScripts("container-1")).toEqual(["script-a"]);

      bus.unregister("script-a");
      expect(bus.getContainerScripts("container-1")).toEqual([]);
    });

    it("should track multiple scripts in a container", () => {
      bus.register("script-a", "container-1", 0);
      bus.register("script-b", "container-1", 1);
      bus.register("script-c", "container-1", 2);
      expect(bus.getContainerScripts("container-1")).toHaveLength(3);
    });

    it("should keep containers separate", () => {
      bus.register("script-a", "container-1", 0);
      bus.register("script-b", "container-2", 0);
      expect(bus.getContainerScripts("container-1")).toEqual(["script-a"]);
      expect(bus.getContainerScripts("container-2")).toEqual(["script-b"]);
    });
  });

  describe("LINK_SET — broadcast to all (OpenCollar pattern)", () => {
    it("should deliver to all scripts in the container", () => {
      // Simulate OpenCollar: 3 scripts in one collar
      bus.register("oc_auth", "collar", 0);
      bus.register("oc_dialog", "collar", 0);
      bus.register("oc_anim", "collar", 1);

      // oc_auth broadcasts CMD_OWNER (500) to LINK_SET
      bus.send("oc_auth", LINK_SET, 500, "AUTH_REQUEST", "agent-uuid");

      expect(delivered).toHaveLength(3);
      expect(delivered.map((d) => d.targetScriptId)).toContain("oc_auth");
      expect(delivered.map((d) => d.targetScriptId)).toContain("oc_dialog");
      expect(delivered.map((d) => d.targetScriptId)).toContain("oc_anim");

      // All should have correct sender link and message data
      for (const d of delivered) {
        expect(d.senderLink).toBe(0);
        expect(d.num).toBe(500);
        expect(d.str).toBe("AUTH_REQUEST");
        expect(d.id).toBe("agent-uuid");
      }
    });

    it("should not deliver to scripts in other containers", () => {
      bus.register("collar-script", "collar", 0);
      bus.register("hud-script", "hud", 0);

      bus.send("collar-script", LINK_SET, 100, "test", "");

      expect(delivered).toHaveLength(1);
      expect(delivered[0].targetScriptId).toBe("collar-script");
    });
  });

  describe("LINK_THIS — same link number only", () => {
    it("should deliver only to scripts on the same link", () => {
      bus.register("script-root-a", "obj", 0);
      bus.register("script-root-b", "obj", 0);
      bus.register("script-child", "obj", 1);

      bus.send("script-root-a", LINK_THIS, 1, "msg", "");

      expect(delivered).toHaveLength(2); // root-a and root-b (both on link 0)
      expect(delivered.map((d) => d.targetScriptId)).toContain("script-root-a");
      expect(delivered.map((d) => d.targetScriptId)).toContain("script-root-b");
    });
  });

  describe("LINK_ROOT — link 0 only", () => {
    it("should deliver only to scripts on link 0", () => {
      bus.register("root-script", "obj", 0);
      bus.register("child-script-1", "obj", 1);
      bus.register("child-script-2", "obj", 2);

      bus.send("child-script-1", LINK_ROOT, 42, "data", "");

      expect(delivered).toHaveLength(1);
      expect(delivered[0].targetScriptId).toBe("root-script");
      expect(delivered[0].senderLink).toBe(1);
    });
  });

  describe("LINK_ALL_OTHERS — exclude sender's link", () => {
    it("should deliver to all except sender's link number", () => {
      bus.register("script-0a", "obj", 0);
      bus.register("script-0b", "obj", 0);
      bus.register("script-1", "obj", 1);
      bus.register("script-2", "obj", 2);

      bus.send("script-0a", LINK_ALL_OTHERS, 99, "ping", "");

      expect(delivered).toHaveLength(2);
      expect(delivered.map((d) => d.targetScriptId)).toContain("script-1");
      expect(delivered.map((d) => d.targetScriptId)).toContain("script-2");
    });
  });

  describe("LINK_ALL_CHILDREN — link > 1", () => {
    it("should deliver to scripts on links > 1", () => {
      bus.register("root", "obj", 0);
      bus.register("link1", "obj", 1);
      bus.register("link2", "obj", 2);
      bus.register("link3", "obj", 3);

      bus.send("root", LINK_ALL_CHILDREN, 1, "update", "");

      expect(delivered).toHaveLength(2); // link 2 and 3 (> 1)
      expect(delivered.map((d) => d.targetScriptId)).toContain("link2");
      expect(delivered.map((d) => d.targetScriptId)).toContain("link3");
    });
  });

  describe("specific link number", () => {
    it("should deliver only to scripts on that link", () => {
      bus.register("script-0", "obj", 0);
      bus.register("script-1a", "obj", 1);
      bus.register("script-1b", "obj", 1);
      bus.register("script-2", "obj", 2);

      bus.send("script-0", 1, 200, "data", "key");

      expect(delivered).toHaveLength(2);
      expect(delivered.map((d) => d.targetScriptId)).toContain("script-1a");
      expect(delivered.map((d) => d.targetScriptId)).toContain("script-1b");
    });
  });

  describe("message queue limits", () => {
    it("should enforce 64-message queue limit", () => {
      // Create a bus with delivery disabled (messages queue up)
      const limitBus = new LinkMessageBus(64);
      // Don't register a delivery handler — messages will queue

      limitBus.register("sender", "obj", 0);
      limitBus.register("target", "obj", 1);

      // Send 70 messages — only 64 should be in queue
      for (let i = 0; i < 70; i++) {
        limitBus.send("sender", LINK_SET, i, `msg${i}`, "");
      }

      // Queue should be at most 64
      expect(limitBus.getQueueSize("target")).toBeLessThanOrEqual(64);
    });
  });

  describe("OpenCollar-like protocol", () => {
    it("should handle real OpenCollar message patterns", () => {
      // Register OpenCollar scripts (simplified)
      const scripts = ["oc_root", "oc_auth", "oc_dialog", "oc_anim", "oc_settings"];
      for (const s of scripts) {
        bus.register(s, "collar", 0);
      }

      // CMD_OWNER = 500
      bus.send("oc_root", LINK_SET, 500, "menu", "owner-key");

      // All 5 scripts should receive the message
      expect(delivered).toHaveLength(5);
      expect(delivered.every((d) => d.num === 500)).toBe(true);
      expect(delivered.every((d) => d.str === "menu")).toBe(true);

      // Clear for next test
      delivered.length = 0;

      // LM_SETTING_SAVE = 2000
      bus.send("oc_settings", LINK_SET, 2000, "global_prefix=My Collar", "");
      expect(delivered).toHaveLength(5);
      expect(delivered.every((d) => d.num === 2000)).toBe(true);
    });
  });

  describe("AVsitter-like protocol", () => {
    it("should handle AVsitter message ranges", () => {
      bus.register("av_main", "furniture", 0);
      bus.register("av_sitter1", "furniture", 1);
      bus.register("av_sitter2", "furniture", 2);

      // 90000 = pose initiation
      bus.send("av_main", LINK_SET, 90000, "0|Sitting", "");
      expect(delivered).toHaveLength(3);
      expect(delivered.every((d) => d.num === 90000)).toBe(true);

      delivered.length = 0;

      // 90045 = pose activation to specific sitter
      bus.send("av_main", 1, 90045, "1|Dance1|animation_uuid", "sitter-key");
      expect(delivered).toHaveLength(1);
      expect(delivered[0].targetScriptId).toBe("av_sitter1");
      expect(delivered[0].num).toBe(90045);
    });
  });

  describe("edge cases", () => {
    it("should handle send from unregistered script", () => {
      bus.send("nonexistent", LINK_SET, 1, "test", "");
      expect(delivered).toHaveLength(0);
    });

    it("should handle send to empty container", () => {
      bus.register("alone", "empty-container", 0);
      bus.unregister("alone");
      bus.send("alone", LINK_SET, 1, "test", "");
      expect(delivered).toHaveLength(0);
    });

    it("should cleanup container when last script unregisters", () => {
      bus.register("only-script", "solo-container", 0);
      bus.unregister("only-script");
      expect(bus.getContainerScripts("solo-container")).toEqual([]);
    });
  });
});
