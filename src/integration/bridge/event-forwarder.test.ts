import { describe, it, expect, vi } from "vitest";
import { ReferenceEventForwarder } from "./event-forwarder.js";
import type { ScriptEventEnvelope, AgentInfo, ObjectInfo } from "../protocol/script-event.js";

// === Test Helpers ===

function createAgent(id = "agent-1", name = "TestUser"): AgentInfo {
  return { id, name, position: { x: 0, y: 0, z: 0 } };
}

function createObject(id = "other-1", name = "OtherPrim"): ObjectInfo {
  return { id, name, position: { x: 1, y: 0, z: 1 } };
}

// === Tests ===

describe("ReferenceEventForwarder", () => {
  describe("Touch events", () => {
    it("forwardTouchStart dispatches touchStart envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);
      const agent = createAgent();

      forwarder.forwardTouchStart("obj-1", agent, 2);

      expect(dispatch).toHaveBeenCalledOnce();
      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.targetObjectId).toBe("obj-1");
      expect(env.event.type).toBe("touchStart");
      expect((env.event as { agent: AgentInfo }).agent).toBe(agent);
      expect((env.event as { face: number }).face).toBe(2);
    });

    it("forwardTouch dispatches touch envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);
      const agent = createAgent();

      forwarder.forwardTouch("obj-1", agent, 0);

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("touch");
    });

    it("forwardTouchEnd dispatches touchEnd envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);
      const agent = createAgent();

      forwarder.forwardTouchEnd("obj-1", agent);

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("touchEnd");
      expect((env.event as { face: number }).face).toBe(0); // default face
    });

    it("uses default face 0 when not specified", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardTouchStart("obj-1", createAgent());

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect((env.event as { face: number }).face).toBe(0);
    });
  });

  describe("Collision events", () => {
    it("forwardCollisionStart dispatches collisionStart envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);
      const other = createObject();

      forwarder.forwardCollisionStart("obj-1", other);

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.targetObjectId).toBe("obj-1");
      expect(env.event.type).toBe("collisionStart");
      expect((env.event as { other: ObjectInfo }).other).toBe(other);
    });

    it("forwardCollision dispatches collision envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardCollision("obj-1", createObject());

      expect(dispatch.mock.calls[0][0].event.type).toBe("collision");
    });

    it("forwardCollisionEnd dispatches collisionEnd envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardCollisionEnd("obj-1", createObject());

      expect(dispatch.mock.calls[0][0].event.type).toBe("collisionEnd");
    });
  });

  describe("Lifecycle events", () => {
    it("forwardRez dispatches rez envelope with startParam", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardRez("obj-1", 42);

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("rez");
      expect((env.event as { startParam: number }).startParam).toBe(42);
    });

    it("forwardRez defaults startParam to 0", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardRez("obj-1");

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect((env.event as { startParam: number }).startParam).toBe(0);
    });

    it("forwardChanged dispatches changed envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardChanged("obj-1", 0x04); // CHANGED_COLOR

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("changed");
      expect((env.event as { change: number }).change).toBe(0x04);
    });

    it("forwardMoney dispatches money envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);
      const agent = createAgent();

      forwarder.forwardMoney("obj-1", agent, 100);

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("money");
      expect((env.event as { agent: AgentInfo; amount: number }).amount).toBe(100);
      expect((env.event as { agent: AgentInfo }).agent).toBe(agent);
    });

    it("forwardPermissions dispatches permissions envelope with scriptId", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardPermissions("obj-1", 0x02, "script-5");

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("permissions");
      expect((env.event as { permissions: number }).permissions).toBe(0x02);
      expect(env.targetScriptId).toBe("script-5");
    });
  });

  describe("Perception events", () => {
    it("forwardSensor dispatches sensor envelope with detected agents", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);
      const detected = [createAgent("a1", "Alice"), createAgent("a2", "Bob")];

      forwarder.forwardSensor("obj-1", detected, "script-3");

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("sensor");
      expect((env.event as { detected: AgentInfo[] }).detected).toHaveLength(2);
      expect(env.targetScriptId).toBe("script-3");
    });

    it("forwardNoSensor dispatches noSensor envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardNoSensor("obj-1", "script-3");

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("noSensor");
      expect(env.targetScriptId).toBe("script-3");
    });
  });

  describe("Communication events", () => {
    it("forwardListen dispatches listen envelope with message data", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardListen("obj-1", 0, "Alice", "agent-1", "Hello world!", "script-2");

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("listen");
      const event = env.event as { channel: number; senderName: string; senderId: string; message: string };
      expect(event.channel).toBe(0);
      expect(event.senderName).toBe("Alice");
      expect(event.senderId).toBe("agent-1");
      expect(event.message).toBe("Hello world!");
      expect(env.targetScriptId).toBe("script-2");
    });
  });

  describe("Data events", () => {
    it("forwardHttpResponse dispatches httpResponse envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);
      const headers = { "content-type": "application/json" };

      forwarder.forwardHttpResponse("obj-1", "req-42", 200, headers, '{"ok":true}', "script-1");

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("httpResponse");
      const event = env.event as { requestId: string; status: number; body: string; headers: Record<string, string> };
      expect(event.requestId).toBe("req-42");
      expect(event.status).toBe(200);
      expect(event.body).toBe('{"ok":true}');
      expect(event.headers).toEqual(headers);
    });

    it("forwardDataserver dispatches dataserver envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardDataserver("obj-1", "query-7", "some data result");

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("dataserver");
      const event = env.event as { queryId: string; data: string };
      expect(event.queryId).toBe("query-7");
      expect(event.data).toBe("some data result");
    });
  });

  describe("poqpoq extension events", () => {
    it("forwardPlayerEnterZone dispatches playerEnterZone envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);
      const agent = createAgent();

      forwarder.forwardPlayerEnterZone("obj-1", agent, "zone-1", "Marketplace");

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("playerEnterZone");
      const event = env.event as { agent: AgentInfo; zoneId: string; zoneName: string };
      expect(event.agent).toBe(agent);
      expect(event.zoneId).toBe("zone-1");
      expect(event.zoneName).toBe("Marketplace");
    });

    it("forwardPlayerLeaveZone dispatches playerLeaveZone envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);
      const agent = createAgent();

      forwarder.forwardPlayerLeaveZone("obj-1", agent, "zone-1", "Marketplace");

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("playerLeaveZone");
    });

    it("forwardDayNightCycle dispatches dayNightCycle envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardDayNightCycle("obj-1", "dusk", 18);

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("dayNightCycle");
      const event = env.event as { phase: string; hour: number };
      expect(event.phase).toBe("dusk");
      expect(event.hour).toBe(18);
    });

    it("forwardWeatherChange dispatches weatherChange envelope", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardWeatherChange("obj-1", "rain", 0.7);

      const env: ScriptEventEnvelope = dispatch.mock.calls[0][0];
      expect(env.event.type).toBe("weatherChange");
      const event = env.event as { weather: string; intensity: number };
      expect(event.weather).toBe("rain");
      expect(event.intensity).toBe(0.7);
    });
  });

  describe("targetObjectId routing", () => {
    it("all events include correct targetObjectId", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardTouchStart("prim-99", createAgent());
      forwarder.forwardCollisionStart("prim-42", createObject());
      forwarder.forwardRez("prim-7");

      expect(dispatch).toHaveBeenCalledTimes(3);
      expect(dispatch.mock.calls[0][0].targetObjectId).toBe("prim-99");
      expect(dispatch.mock.calls[1][0].targetObjectId).toBe("prim-42");
      expect(dispatch.mock.calls[2][0].targetObjectId).toBe("prim-7");
    });
  });

  describe("optional scriptId targeting", () => {
    it("includes targetScriptId when provided", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardSensor("obj-1", [], "specific-script");

      expect(dispatch.mock.calls[0][0].targetScriptId).toBe("specific-script");
    });

    it("omits targetScriptId when not provided", () => {
      const dispatch = vi.fn();
      const forwarder = new ReferenceEventForwarder(dispatch);

      forwarder.forwardSensor("obj-1", []);

      expect(dispatch.mock.calls[0][0].targetScriptId).toBeUndefined();
    });
  });
});
