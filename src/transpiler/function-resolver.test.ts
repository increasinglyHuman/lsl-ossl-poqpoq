/**
 * Tests for the LSL Function Resolver.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FunctionResolver } from "./function-resolver.js";

describe("FunctionResolver", () => {
  let resolver: FunctionResolver;

  beforeEach(() => {
    resolver = new FunctionResolver();
  });

  describe("llDetected* family", () => {
    it("should resolve llDetectedKey to detected[i].id", () => {
      const result = resolver.resolve("llDetectedKey", ["0"]);
      expect(result.kind).toBe("detected");
      expect(result.template).toBe("detected[0].id");
    });

    it("should resolve llDetectedName to detected[i].name", () => {
      const result = resolver.resolve("llDetectedName", ["i"]);
      expect(result.kind).toBe("detected");
      expect(result.template).toBe("detected[i].name");
    });

    it("should resolve llDetectedPos to detected[i].position", () => {
      const result = resolver.resolve("llDetectedPos", ["0"]);
      expect(result.template).toBe("detected[0].position");
    });

    it("should resolve llDetectedRot to detected[i].rotation", () => {
      const result = resolver.resolve("llDetectedRot", ["0"]);
      expect(result.template).toBe("detected[0].rotation");
    });

    it("should resolve llDetectedVel to detected[i].velocity", () => {
      const result = resolver.resolve("llDetectedVel", ["0"]);
      expect(result.template).toBe("detected[0].velocity");
    });

    it("should resolve llDetectedType to detected[i].type", () => {
      const result = resolver.resolve("llDetectedType", ["0"]);
      expect(result.template).toBe("detected[0].type");
    });

    it("should resolve llDetectedTouchFace to detected[i].touchFace", () => {
      const result = resolver.resolve("llDetectedTouchFace", ["0"]);
      expect(result.template).toBe("detected[0].touchFace");
    });

    it("should not need async", () => {
      const result = resolver.resolve("llDetectedKey", ["0"]);
      expect(result.needsAwait).toBe(false);
      expect(result.needsAsync).toBe(false);
    });
  });

  describe("async functions", () => {
    it("should resolve llSleep as async delay", () => {
      const result = resolver.resolve("llSleep", ["2.0"]);
      expect(result.template).toBe("await this.delay(2.0)");
      expect(result.needsAwait).toBe(true);
      expect(result.needsAsync).toBe(true);
    });

    it("should resolve llHTTPRequest as async", () => {
      const result = resolver.resolve("llHTTPRequest", ['"https://example.com"', "[]"]);
      expect(result.needsAwait).toBe(true);
      expect(result.needsAsync).toBe(true);
    });
  });

  describe("communication functions", () => {
    it("should resolve llSay", () => {
      const result = resolver.resolve("llSay", ["0", '"Hello"']);
      expect(result.template).toBe('this.say(0, "Hello")');
      expect(result.kind).toBe("method");
    });

    it("should resolve llWhisper", () => {
      const result = resolver.resolve("llWhisper", ["0", '"Psst"']);
      expect(result.template).toBe('this.whisper(0, "Psst")');
    });

    it("should resolve llShout", () => {
      const result = resolver.resolve("llShout", ["0", '"HEY!"']);
      expect(result.template).toBe('this.shout(0, "HEY!")');
    });

    it("should resolve llOwnerSay", () => {
      const result = resolver.resolve("llOwnerSay", ['"Debug info"']);
      expect(result.template).toBe('this.ownerSay("Debug info")');
    });

    it("should resolve llListen", () => {
      const result = resolver.resolve("llListen", ["42", '""', '""', '""']);
      expect(result.template).toBe('this.listen(42, "", "", "")');
    });

    it("should resolve llMessageLinked", () => {
      const result = resolver.resolve("llMessageLinked", ["LINK_SET", "1", '"msg"', '"id"']);
      expect(result.template).toBe('this.sendLinkMessage(LINK_SET, 1, "msg", "id")');
    });
  });

  describe("timer functions", () => {
    it("should resolve llSetTimerEvent", () => {
      const result = resolver.resolve("llSetTimerEvent", ["1.0"]);
      expect(result.template).toBe("this.setTimer(1.0)");
      expect(result.needsAsync).toBe(false);
    });
  });

  describe("object manipulation", () => {
    it("should resolve llSetPos", () => {
      const result = resolver.resolve("llSetPos", ["pos"]);
      expect(result.template).toBe("this.object.setPosition(pos)");
    });

    it("should resolve llGetPos", () => {
      const result = resolver.resolve("llGetPos", []);
      expect(result.template).toBe("this.object.getPosition()");
    });

    it("should resolve llSetRot", () => {
      const result = resolver.resolve("llSetRot", ["rot"]);
      expect(result.template).toBe("this.object.setRotation(rot)");
    });

    it("should resolve llGetRot", () => {
      const result = resolver.resolve("llGetRot", []);
      expect(result.template).toBe("this.object.getRotation()");
    });

    it("should resolve llGetKey as property access", () => {
      const result = resolver.resolve("llGetKey", []);
      expect(result.kind).toBe("property");
      expect(result.template).toBe("this.object.id");
    });

    it("should resolve llGetOwner as property access", () => {
      const result = resolver.resolve("llGetOwner", []);
      expect(result.kind).toBe("property");
      expect(result.template).toBe("this.owner.id");
    });

    it("should resolve llGetObjectName as property access", () => {
      const result = resolver.resolve("llGetObjectName", []);
      expect(result.kind).toBe("property");
      expect(result.template).toBe("this.object.name");
    });

    it("should resolve llSetText", () => {
      const result = resolver.resolve("llSetText", ['"Hi"', "color", "1.0"]);
      expect(result.template).toBe('this.object.setText("Hi", color, 1.0)');
    });
  });

  describe("math functions", () => {
    it("should resolve llVecDist as method on first arg", () => {
      const result = resolver.resolve("llVecDist", ["v1", "v2"]);
      expect(result.template).toBe("v1.distanceTo(v2)");
    });

    it("should resolve llVecNorm as method on arg", () => {
      const result = resolver.resolve("llVecNorm", ["v"]);
      expect(result.template).toBe("v.normalize()");
    });

    it("should resolve llVecMag as method on arg", () => {
      const result = resolver.resolve("llVecMag", ["v"]);
      expect(result.template).toBe("v.length()");
    });

    it("should resolve llRot2Euler as method on arg", () => {
      const result = resolver.resolve("llRot2Euler", ["r"]);
      expect(result.template).toBe("r.toEuler()");
    });

    it("should resolve llEuler2Rot as static call", () => {
      const result = resolver.resolve("llEuler2Rot", ["v"]);
      expect(result.kind).toBe("static");
      expect(result.template).toBe("Quaternion.fromEuler(v)");
    });

    it("should resolve llFrand", () => {
      const result = resolver.resolve("llFrand", ["10.0"]);
      expect(result.template).toBe("Math.random() * 10.0");
    });

    it("should resolve standard Math functions", () => {
      expect(resolver.resolve("llSin", ["x"]).template).toBe("Math.sin(x)");
      expect(resolver.resolve("llCos", ["x"]).template).toBe("Math.cos(x)");
      expect(resolver.resolve("llSqrt", ["x"]).template).toBe("Math.sqrt(x)");
      expect(resolver.resolve("llAbs", ["x"]).template).toBe("Math.abs(x)");
      expect(resolver.resolve("llFloor", ["x"]).template).toBe("Math.floor(x)");
      expect(resolver.resolve("llCeil", ["x"]).template).toBe("Math.ceil(x)");
      expect(resolver.resolve("llRound", ["x"]).template).toBe("Math.round(x)");
      expect(resolver.resolve("llPow", ["x", "y"]).template).toBe("Math.pow(x, y)");
      expect(resolver.resolve("llAtan2", ["y", "x"]).template).toBe("Math.atan2(y, x)");
    });
  });

  describe("string functions", () => {
    it("should resolve llGetSubString to helper", () => {
      const result = resolver.resolve("llGetSubString", ["s", "0", "5"]);
      expect(result.template).toBe("lslSubString(s, 0, 5)");
    });

    it("should resolve llDeleteSubString to helper", () => {
      const result = resolver.resolve("llDeleteSubString", ["s", "2", "4"]);
      expect(result.template).toBe("lslDeleteSubString(s, 2, 4)");
    });

    it("should resolve llStringLength as property access", () => {
      const result = resolver.resolve("llStringLength", ["s"]);
      expect(result.template).toBe("s.length");
    });

    it("should resolve llSubStringIndex as indexOf", () => {
      const result = resolver.resolve("llSubStringIndex", ["s", '"needle"']);
      expect(result.template).toBe('s.indexOf("needle")');
    });

    it("should resolve llToLower and llToUpper", () => {
      expect(resolver.resolve("llToLower", ["s"]).template).toBe("s.toLowerCase()");
      expect(resolver.resolve("llToUpper", ["s"]).template).toBe("s.toUpperCase()");
    });
  });

  describe("list functions", () => {
    it("should resolve llGetListLength as property", () => {
      const result = resolver.resolve("llGetListLength", ["arr"]);
      expect(result.template).toBe("arr.length");
    });

    it("should resolve llList2String as array access with cast", () => {
      const result = resolver.resolve("llList2String", ["arr", "0"]);
      expect(result.template).toBe("String(arr[0])");
    });

    it("should resolve llList2Integer as array access with cast", () => {
      const result = resolver.resolve("llList2Integer", ["arr", "i"]);
      expect(result.template).toBe("Number(arr[i])");
    });

    it("should resolve llList2CSV as join", () => {
      const result = resolver.resolve("llList2CSV", ["arr"]);
      expect(result.template).toBe('arr.join(",")');
    });

    it("should resolve llCSV2List as split", () => {
      const result = resolver.resolve("llCSV2List", ["s"]);
      expect(result.template).toBe('s.split(",")');
    });

    it("should resolve llDumpList2String as join", () => {
      const result = resolver.resolve("llDumpList2String", ["arr", '" "']);
      expect(result.template).toBe('arr.join(" ")');
    });
  });

  describe("effects", () => {
    it("should resolve llParticleSystem", () => {
      const result = resolver.resolve("llParticleSystem", ["config"]);
      expect(result.template).toBe("this.object.particles(config)");
    });

    it("should resolve llPlaySound", () => {
      const result = resolver.resolve("llPlaySound", ['"sound-uuid"', "1.0"]);
      expect(result.template).toBe('this.object.playSound("sound-uuid", 1.0)');
    });
  });

  describe("OSSL functions", () => {
    it("should resolve osNpcCreate as async", () => {
      const result = resolver.resolve("osNpcCreate", ['"NPC"', "pos", '"appearance"']);
      expect(result.needsAwait).toBe(true);
      expect(result.needsAsync).toBe(true);
    });

    it("should resolve osGetNotecard as async storage", () => {
      const result = resolver.resolve("osGetNotecard", ['"config"']);
      expect(result.template).toBe('await this.world.storage.get("config")');
      expect(result.needsAsync).toBe(true);
    });

    it("should resolve osParseJSON as JSON.parse", () => {
      const result = resolver.resolve("osParseJSON", ["data"]);
      expect(result.template).toBe("JSON.parse(data)");
    });
  });

  describe("unmapped functions", () => {
    it("should return unmapped kind with TODO marker", () => {
      const result = resolver.resolve("llSomeUnknownFunction", ["a", "b"]);
      expect(result.kind).toBe("unmapped");
      expect(result.template).toContain("TODO");
      expect(result.template).toContain("llSomeUnknownFunction");
      expect(result.warning).toContain("Unmapped");
    });
  });

  describe("isBuiltin", () => {
    it("should recognize special handlers", () => {
      expect(resolver.isBuiltin("llSay")).toBe(true);
      expect(resolver.isBuiltin("llSleep")).toBe(true);
    });

    it("should recognize detected family", () => {
      expect(resolver.isBuiltin("llDetectedKey")).toBe(true);
      expect(resolver.isBuiltin("llDetectedName")).toBe(true);
    });

    it("should recognize ll-map entries", () => {
      expect(resolver.isBuiltin("llRegionSay")).toBe(true);
    });

    it("should not recognize user-defined functions", () => {
      expect(resolver.isBuiltin("myCustomFunc")).toBe(false);
    });
  });

  describe("NPC Phase 7C functions", () => {
    it("resolves osNpcGetPos to this.world.npc.getPosition", () => {
      const result = resolver.resolve("osNpcGetPos", ["npcId"]);
      expect(result.template).toBe("this.world.npc.getPosition(npcId)");
      expect(result.needsAwait).toBe(false);
    });

    it("resolves osNpcMoveToTarget as async moveTo", () => {
      const result = resolver.resolve("osNpcMoveToTarget", ["npcId", "pos", "options"]);
      expect(result.template).toBe("await this.world.npc.moveTo(npcId, pos, options)");
      expect(result.needsAwait).toBe(true);
    });

    it("resolves osNpcStopMoveToTarget to stopMove", () => {
      const result = resolver.resolve("osNpcStopMoveToTarget", ["npcId"]);
      expect(result.template).toBe("this.world.npc.stopMove(npcId)");
    });

    it("resolves osNpcGetRot to getRotation", () => {
      const result = resolver.resolve("osNpcGetRot", ["npcId"]);
      expect(result.template).toBe("this.world.npc.getRotation(npcId)");
    });

    it("resolves osNpcSetRot to setRotation", () => {
      const result = resolver.resolve("osNpcSetRot", ["npcId", "rot"]);
      expect(result.template).toBe("this.world.npc.setRotation(npcId, rot)");
    });

    it("resolves osNpcWhisper to whisper", () => {
      const result = resolver.resolve("osNpcWhisper", ["npcId", "0", '"msg"']);
      expect(result.template).toBe('this.world.npc.whisper(npcId, 0, "msg")');
    });

    it("resolves osNpcShout to shout", () => {
      const result = resolver.resolve("osNpcShout", ["npcId", "0", '"msg"']);
      expect(result.template).toBe('this.world.npc.shout(npcId, 0, "msg")');
    });

    it("resolves osNpcSit to sit", () => {
      const result = resolver.resolve("osNpcSit", ["npcId", "targetId"]);
      expect(result.template).toBe("this.world.npc.sit(npcId, targetId)");
    });

    it("resolves osNpcStand to stand", () => {
      const result = resolver.resolve("osNpcStand", ["npcId"]);
      expect(result.template).toBe("this.world.npc.stand(npcId)");
    });

    it("resolves osNpcPlayAnimation to playAnimation", () => {
      const result = resolver.resolve("osNpcPlayAnimation", ["npcId", '"wave"']);
      expect(result.template).toBe('this.world.npc.playAnimation(npcId, "wave")');
    });

    it("resolves osNpcStopAnimation to stopAnimation", () => {
      const result = resolver.resolve("osNpcStopAnimation", ["npcId", '"wave"']);
      expect(result.template).toBe('this.world.npc.stopAnimation(npcId, "wave")');
    });

    it("resolves osNpcTouch to touch", () => {
      const result = resolver.resolve("osNpcTouch", ["npcId", "objId"]);
      expect(result.template).toBe("this.world.npc.touch(npcId, objId)");
    });

    it("resolves osNpcLoadAppearance to loadAppearance", () => {
      const result = resolver.resolve("osNpcLoadAppearance", ["npcId", '"warrior"']);
      expect(result.template).toBe('this.world.npc.loadAppearance(npcId, "warrior")');
    });

    it("resolves osNpcSaveAppearance to saveAppearance", () => {
      const result = resolver.resolve("osNpcSaveAppearance", ["npcId", '"snapshot"']);
      expect(result.template).toBe('this.world.npc.saveAppearance(npcId, "snapshot")');
    });
  });

  describe("async function set", () => {
    it("should contain llSleep", () => {
      expect(FunctionResolver.ASYNC_FUNCTIONS.has("llSleep")).toBe(true);
    });

    it("should contain llHTTPRequest", () => {
      expect(FunctionResolver.ASYNC_FUNCTIONS.has("llHTTPRequest")).toBe(true);
    });

    it("should contain OSSL async functions", () => {
      expect(FunctionResolver.ASYNC_FUNCTIONS.has("osNpcCreate")).toBe(true);
      expect(FunctionResolver.ASYNC_FUNCTIONS.has("osGetNotecard")).toBe(true);
    });

    it("should contain osNpcMoveToTarget", () => {
      expect(FunctionResolver.ASYNC_FUNCTIONS.has("osNpcMoveToTarget")).toBe(true);
    });
  });

  describe("Phase 7D: physics, combat & environment functions", () => {
    it("resolves llSetStatus to this.object.setStatus", () => {
      const result = resolver.resolve("llSetStatus", ["STATUS_PHYSICS", "TRUE"]);
      expect(result.template).toBe("this.object.setStatus(STATUS_PHYSICS, TRUE)");
      expect(result.category).toBe("physics");
    });

    it("resolves llGetStatus to this.object.getStatus", () => {
      const result = resolver.resolve("llGetStatus", ["STATUS_PHYSICS"]);
      expect(result.template).toBe("this.object.getStatus(STATUS_PHYSICS)");
      expect(result.category).toBe("physics");
    });

    it("resolves llSetDamage to this.object.setDamage", () => {
      const result = resolver.resolve("llSetDamage", ["100.0"]);
      expect(result.template).toBe("this.object.setDamage(100.0)");
      expect(result.category).toBe("combat");
    });

    it("resolves llRezObject to this.object.rez", () => {
      const result = resolver.resolve("llRezObject", ['"bullet"', "pos", "vel", "rot", "0"]);
      expect(result.template).toBe('this.object.rez("bullet", pos, vel, rot, 0)');
      expect(result.category).toBe("object");
    });

    it("resolves llRezAtRoot to this.object.rezAtRoot", () => {
      const result = resolver.resolve("llRezAtRoot", ['"obj"', "pos", "vel", "rot", "1"]);
      expect(result.template).toBe('this.object.rezAtRoot("obj", pos, vel, rot, 1)');
      expect(result.category).toBe("object");
    });

    it("resolves llPushObject to this.world.pushObject", () => {
      const result = resolver.resolve("llPushObject", ["targetId", "impulse", "angImpulse", "FALSE"]);
      expect(result.template).toBe("this.world.pushObject(targetId, impulse, angImpulse, FALSE)");
      expect(result.category).toBe("combat");
    });

    it("resolves llStopMoveToTarget to this.object.stopMoveToTarget", () => {
      const result = resolver.resolve("llStopMoveToTarget", []);
      expect(result.template).toBe("this.object.stopMoveToTarget()");
      expect(result.category).toBe("physics");
    });

    it("resolves llSetTorque to this.object.setTorque", () => {
      const result = resolver.resolve("llSetTorque", ["torque", "TRUE"]);
      expect(result.template).toBe("this.object.setTorque(torque, TRUE)");
      expect(result.category).toBe("physics");
    });

    it("resolves llVolumeDetect to this.object.volumeDetect", () => {
      const result = resolver.resolve("llVolumeDetect", ["TRUE"]);
      expect(result.template).toBe("this.object.volumeDetect(TRUE)");
      expect(result.category).toBe("physics");
    });

    it("resolves llCollisionFilter to this.object.collisionFilter", () => {
      const result = resolver.resolve("llCollisionFilter", ['"name"', '"id"', "TRUE"]);
      expect(result.template).toBe('this.object.collisionFilter("name", "id", TRUE)');
      expect(result.category).toBe("physics");
    });

    it("resolves llSetBuoyancy to this.object.setBuoyancy", () => {
      const result = resolver.resolve("llSetBuoyancy", ["1.0"]);
      expect(result.template).toBe("this.object.setBuoyancy(1.0)");
      expect(result.category).toBe("physics");
    });

    it("resolves llWater to this.world.getWaterHeight", () => {
      const result = resolver.resolve("llWater", ["pos"]);
      expect(result.template).toBe("this.world.getWaterHeight(pos)");
      expect(result.category).toBe("environment");
    });

    it("resolves llGroundNormal to this.world.getGroundNormal", () => {
      const result = resolver.resolve("llGroundNormal", ["offset"]);
      expect(result.template).toBe("this.world.getGroundNormal(offset)");
      expect(result.category).toBe("environment");
    });

    it("resolves llGroundSlope to this.world.getGroundSlope", () => {
      const result = resolver.resolve("llGroundSlope", ["offset"]);
      expect(result.template).toBe("this.world.getGroundSlope(offset)");
      expect(result.category).toBe("environment");
    });

    it("resolves llSetPhysicsShapeType to this.object.setPhysicsShape", () => {
      const result = resolver.resolve("llSetPhysicsShapeType", ["PRIM_PHYSICS_SHAPE_CONVEX", "[]"]);
      expect(result.template).toBe("this.object.setPhysicsShape(PRIM_PHYSICS_SHAPE_CONVEX, [])");
      expect(result.category).toBe("physics");
    });

    it("resolves llLookAt to this.object.lookAt", () => {
      const result = resolver.resolve("llLookAt", ["target", "1.0", "0.5"]);
      expect(result.template).toBe("this.object.lookAt(target, 1.0, 0.5)");
      expect(result.category).toBe("physics");
    });

    it("resolves llStopLookAt to this.object.stopLookAt", () => {
      const result = resolver.resolve("llStopLookAt", []);
      expect(result.template).toBe("this.object.stopLookAt()");
      expect(result.category).toBe("physics");
    });
  });

  describe("media functions", () => {
    it("resolves llSetPrimMediaParams to this.object.setMediaParams", () => {
      const result = resolver.resolve("llSetPrimMediaParams", ["0", "[2, url]"]);
      expect(result.template).toBe("this.object.setMediaParams(0, [2, url])");
      expect(result.category).toBe("media");
    });

    it("resolves llClearPrimMedia to this.object.clearMedia", () => {
      const result = resolver.resolve("llClearPrimMedia", ["face"]);
      expect(result.template).toBe("this.object.clearMedia(face)");
      expect(result.category).toBe("media");
    });

    it("resolves llGetPrimMediaParams to this.object.getMediaParams", () => {
      const result = resolver.resolve("llGetPrimMediaParams", ["0", "[2]"]);
      expect(result.template).toBe("this.object.getMediaParams(0, [2])");
      expect(result.category).toBe("media");
    });

    it("resolves llSetLinkMedia to link-level setMediaParams", () => {
      const result = resolver.resolve("llSetLinkMedia", ["link", "0", "rules"]);
      expect(result.template).toBe("this.object.getLink(link)?.setMediaParams(0, rules)");
    });

    it("resolves llClearLinkMedia to link-level clearMedia", () => {
      const result = resolver.resolve("llClearLinkMedia", ["link", "0"]);
      expect(result.template).toBe("this.object.getLink(link)?.clearMedia(0)");
    });

    it("resolves llGetLinkMedia to link-level getMediaParams", () => {
      const result = resolver.resolve("llGetLinkMedia", ["link", "0", "rules"]);
      expect(result.template).toBe("this.object.getLink(link)?.getMediaParams(0, rules)");
    });
  });
});
