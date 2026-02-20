import { describe, it, expect } from "vitest";
import type {
  ScriptEvent,
  ScriptEventEnvelope,
  TouchStartEvent,
  ListenEvent,
  CollisionStartEvent,
  RezEvent,
  SensorEvent,
  HttpResponseEvent,
  PlayerEnterZoneEvent,
  DayNightCycleEvent,
  WeatherChangeEvent,
  MoneyEvent,
  DataserverEvent,
} from "./script-event.js";

describe("ScriptEvent", () => {
  describe("construction", () => {
    it("creates a touchStart event", () => {
      const evt: TouchStartEvent = {
        type: "touchStart",
        agent: { id: "agent-1", name: "Alice" },
        face: 3,
      };
      expect(evt.type).toBe("touchStart");
      expect(evt.agent.name).toBe("Alice");
      expect(evt.face).toBe(3);
    });

    it("creates a listen event", () => {
      const evt: ListenEvent = {
        type: "listen",
        channel: 42,
        senderName: "Bob",
        senderId: "bob-123",
        message: "Hello there",
      };
      expect(evt.channel).toBe(42);
      expect(evt.message).toBe("Hello there");
    });

    it("creates a collisionStart event", () => {
      const evt: CollisionStartEvent = {
        type: "collisionStart",
        other: { id: "obj-99", name: "Wall", position: { x: 10, y: 0, z: 5 } },
      };
      expect(evt.other.name).toBe("Wall");
      expect(evt.other.position?.x).toBe(10);
    });

    it("creates a rez event", () => {
      const evt: RezEvent = {
        type: "rez",
        startParam: 7,
      };
      expect(evt.startParam).toBe(7);
    });

    it("creates a sensor event with detected agents", () => {
      const evt: SensorEvent = {
        type: "sensor",
        detected: [
          { id: "a-1", name: "Player1", position: { x: 5, y: 0, z: 5 } },
          { id: "a-2", name: "Player2" },
        ],
      };
      expect(evt.detected).toHaveLength(2);
      expect(evt.detected[0].position?.x).toBe(5);
      expect(evt.detected[1].position).toBeUndefined();
    });

    it("creates an httpResponse event", () => {
      const evt: HttpResponseEvent = {
        type: "httpResponse",
        requestId: "req-42",
        status: 200,
        headers: { "content-type": "application/json" },
        body: '{"ok":true}',
      };
      expect(evt.status).toBe(200);
      expect(evt.headers["content-type"]).toBe("application/json");
    });

    it("creates a money event", () => {
      const evt: MoneyEvent = {
        type: "money",
        agent: { id: "buyer-1", name: "Buyer" },
        amount: 250,
      };
      expect(evt.amount).toBe(250);
    });

    it("creates a dataserver event", () => {
      const evt: DataserverEvent = {
        type: "dataserver",
        queryId: "q-1",
        data: "Hello from notecard",
      };
      expect(evt.queryId).toBe("q-1");
    });
  });

  describe("poqpoq extension events", () => {
    it("creates a playerEnterZone event", () => {
      const evt: PlayerEnterZoneEvent = {
        type: "playerEnterZone",
        agent: { id: "a-1", name: "Explorer" },
        zoneId: "zone-forest",
        zoneName: "Enchanted Forest",
      };
      expect(evt.zoneName).toBe("Enchanted Forest");
    });

    it("creates a dayNightCycle event", () => {
      const evt: DayNightCycleEvent = {
        type: "dayNightCycle",
        phase: "dusk",
        hour: 18.5,
      };
      expect(evt.phase).toBe("dusk");
      expect(evt.hour).toBe(18.5);
    });

    it("creates a weatherChange event", () => {
      const evt: WeatherChangeEvent = {
        type: "weatherChange",
        weather: "rain",
        intensity: 0.7,
      };
      expect(evt.weather).toBe("rain");
      expect(evt.intensity).toBe(0.7);
    });
  });

  describe("JSON serialization", () => {
    it("round-trips through JSON", () => {
      const evt: ScriptEvent = {
        type: "touchStart",
        agent: { id: "a-1", name: "Test", position: { x: 1, y: 2, z: 3 } },
        face: 0,
      };
      const roundTripped = JSON.parse(JSON.stringify(evt)) as ScriptEvent;
      expect(roundTripped).toEqual(evt);
    });

    it("serializes noSensor (minimal event)", () => {
      const evt: ScriptEvent = { type: "noSensor" };
      const json = JSON.stringify(evt);
      expect(json).toBe('{"type":"noSensor"}');
    });
  });

  describe("type narrowing", () => {
    it("narrows via switch on type discriminant", () => {
      const events: ScriptEvent[] = [
        { type: "touchStart", agent: { id: "a", name: "A" }, face: 0 },
        { type: "listen", channel: 0, senderName: "B", senderId: "b", message: "msg" },
        { type: "collisionEnd", other: { id: "x", name: "X" } },
        { type: "rez", startParam: 0 },
        { type: "noSensor" },
        { type: "dayNightCycle", phase: "night", hour: 22 },
        { type: "permissions", permissions: 0xFF },
      ];

      for (const evt of events) {
        switch (evt.type) {
          case "touchStart":
            expect(evt.agent).toBeDefined();
            break;
          case "listen":
            expect(evt.message).toBe("msg");
            break;
          case "collisionEnd":
            expect(evt.other.id).toBe("x");
            break;
          case "rez":
            expect(evt.startParam).toBe(0);
            break;
          case "noSensor":
            // Minimal event — no extra fields
            expect(Object.keys(evt)).toEqual(["type"]);
            break;
          case "dayNightCycle":
            expect(evt.phase).toBe("night");
            break;
          case "permissions":
            expect(evt.permissions).toBe(0xFF);
            break;
        }
      }
    });
  });

  describe("ScriptEventEnvelope", () => {
    it("wraps an event with target metadata", () => {
      const envelope: ScriptEventEnvelope = {
        targetObjectId: "door-123",
        event: {
          type: "touchStart",
          agent: { id: "user-1", name: "Visitor" },
          face: 2,
        },
      };
      expect(envelope.targetObjectId).toBe("door-123");
      expect(envelope.targetScriptId).toBeUndefined();
      expect(envelope.event.type).toBe("touchStart");
    });

    it("can target a specific script", () => {
      const envelope: ScriptEventEnvelope = {
        targetObjectId: "obj-1",
        targetScriptId: "script-specific",
        event: {
          type: "timer",
          timerId: "autoClose",
        },
      };
      expect(envelope.targetScriptId).toBe("script-specific");
    });

    it("round-trips envelope through JSON", () => {
      const envelope: ScriptEventEnvelope = {
        targetObjectId: "obj-1",
        event: {
          type: "sensor",
          detected: [{ id: "d-1", name: "NearbyPlayer" }],
        },
      };
      const roundTripped = JSON.parse(JSON.stringify(envelope)) as ScriptEventEnvelope;
      expect(roundTripped).toEqual(envelope);
    });
  });
});
