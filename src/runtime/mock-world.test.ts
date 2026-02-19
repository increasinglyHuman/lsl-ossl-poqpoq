/**
 * Tests for the Mock World — validates the testing infrastructure.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MockWorldAPI, MockWorldObject, MockAgent, MockContainer } from "./mock-world.js";
import { Vector3, Quaternion, Color3 } from "../types/math.js";
import { LINK_SET } from "../types/script-container.js";

describe("MockWorldObject", () => {
  let obj: MockWorldObject;

  beforeEach(() => {
    obj = new MockWorldObject("obj-1", "TestDoor", {
      position: new Vector3(10, 0, 20),
    });
  });

  it("should track position changes", async () => {
    const newPos = new Vector3(5, 5, 5);
    await obj.setPosition(newPos);
    expect(obj.getPosition()).toBe(newPos);
  });

  it("should track rotation changes", async () => {
    await obj.rotateTo(0, 90, 0);
    const rot = obj.getRotation();
    expect(rot).toBeDefined();
  });

  it("should move relatively with moveBy", async () => {
    await obj.moveBy(new Vector3(1, 2, 3));
    const pos = obj.getPosition();
    expect(pos.x).toBe(11);
    expect(pos.y).toBe(2);
    expect(pos.z).toBe(23);
  });

  it("should track floating text", () => {
    obj.setText("Hello World", Color3.RED, 1.0);
    expect(obj.getText()).toBe("Hello World");
  });

  it("should log all method calls", async () => {
    await obj.setPosition(Vector3.ZERO);
    obj.setColor(Color3.RED);
    obj.setText("test");

    expect(obj.callLog).toHaveLength(3);
    expect(obj.callLog[0].method).toBe("setPosition");
    expect(obj.callLog[1].method).toBe("setColor");
    expect(obj.callLog[2].method).toBe("setText");
  });

  it("should support linksets", () => {
    const child1 = new MockWorldObject("child-1", "Child 1");
    const child2 = new MockWorldObject("child-2", "Child 2");
    obj.addLink(child1);
    obj.addLink(child2);

    expect(obj.getLinkCount()).toBe(3);
    expect(obj.getLink(0)).toBe(obj);
    expect(obj.getLink(1)).toBe(child1);
    expect(obj.getLink(2)).toBe(child2);
    expect(obj.getLinks()).toHaveLength(3);
  });
});

describe("MockAgent", () => {
  let agent: MockAgent;

  beforeEach(() => {
    agent = new MockAgent("agent-1", "Allen Partridge", new Vector3(10, 0, 10));
  });

  it("should report position", () => {
    const pos = agent.getPosition();
    expect(pos.x).toBe(10);
    expect(pos.z).toBe(10);
  });

  it("should track teleportation", async () => {
    const dest = new Vector3(100, 50, 200);
    await agent.teleport(dest);
    expect(agent.getPosition()).toBe(dest);
    expect(agent.callLog[0].method).toBe("teleport");
  });

  it("should track presence", () => {
    expect(agent.isPresent()).toBe(true);
    agent.setPresent(false);
    expect(agent.isPresent()).toBe(false);
  });

  it("should generate username from name", () => {
    expect(agent.username).toBe("allen.partridge");
  });
});

describe("MockContainer", () => {
  let container: MockContainer;

  beforeEach(() => {
    const obj = new MockWorldObject("obj-1", "Container");
    container = new MockContainer("container-1", obj);
  });

  it("should manage assets", () => {
    container.addAsset({ id: "tex-1", name: "wood", type: "texture" });
    container.addAsset({ id: "snd-1", name: "click", type: "sound" });

    expect(container.hasAsset("wood")).toBe(true);
    expect(container.hasAsset("nonexistent")).toBe(false);
    expect(container.getAsset("wood")?.type).toBe("texture");
    expect(container.getAssets().length).toBe(2);
    expect(container.getAssets("sound").length).toBe(1);
    expect(container.getAssetCount()).toBe(2);
    expect(container.getAssetCount("texture")).toBe(1);
  });

  it("should forward link messages", () => {
    const messages: Array<{ num: number; str: string }> = [];
    container.onLinkMessage((_link, num, str) => {
      messages.push({ num, str });
    });

    container.sendLinkMessage(LINK_SET, 500, "AUTH", "key");
    expect(messages).toHaveLength(1);
    expect(messages[0].num).toBe(500);
    expect(messages[0].str).toBe("AUTH");
  });
});

describe("MockWorldAPI", () => {
  let world: MockWorldAPI;

  beforeEach(() => {
    world = new MockWorldAPI();
  });

  it("should store and retrieve objects", () => {
    const obj = new MockWorldObject("door-1", "Front Door");
    world.addObject(obj);

    expect(world.getObject("door-1")).toBe(obj);
    expect(world.getObject("Front Door")).toBe(obj);
    expect(world.getObject("nonexistent")).toBeNull();
  });

  it("should find objects in radius", () => {
    world.addObject(new MockWorldObject("near", "Near", { position: new Vector3(5, 0, 0) }));
    world.addObject(new MockWorldObject("far", "Far", { position: new Vector3(100, 0, 0) }));

    const found = world.getObjectsInRadius(Vector3.ZERO, 10);
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe("Near");
  });

  it("should track chat messages", () => {
    world.say(0, "Hello!");
    world.whisper(0, "Secret");
    world.shout(0, "LOUD");

    expect(world.chatLog).toHaveLength(3);
    expect(world.chatLog[0]).toEqual({ type: "say", channel: 0, message: "Hello!" });
    expect(world.chatLog[1]).toEqual({ type: "whisper", channel: 0, message: "Secret" });
    expect(world.chatLog[2]).toEqual({ type: "shout", channel: 0, message: "LOUD" });
  });

  it("should manage agents", () => {
    const agent = new MockAgent("user-1", "Allen");
    world.addAgent(agent);

    expect(world.getAgent("user-1")).toBe(agent);
    expect(world.getAgents()).toHaveLength(1);
    expect(world.getAgentCount()).toBe(1);
  });

  it("should support storage API", async () => {
    await world.storage.set("key1", "value1");
    expect(await world.storage.get("key1")).toBe("value1");
    expect(await world.storage.get("nonexistent")).toBeNull();

    const keys = await world.storage.keys();
    expect(keys).toContain("key1");

    await world.storage.delete("key1");
    expect(await world.storage.get("key1")).toBeNull();
  });

  it("should support NPC creation", () => {
    const npc = world.npc.create("Guard", new Vector3(10, 0, 10));
    expect(npc.name).toBe("Guard");
    expect(npc.isActive()).toBe(true);
    expect(world.npc.getAll()).toHaveLength(1);
    expect(world.npc.get(npc.id)).toBe(npc);
  });

  it("should track time", () => {
    world.setTime(42);
    expect(world.getTime()).toBe(42);
  });
});
