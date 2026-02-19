/**
 * LSL Function → World API Mapping Table (The Rosetta Stone)
 *
 * This maps every LSL ll* function to its poqpoq World API equivalent.
 * Used by:
 *   1. The LSL transpiler (Phase 3) to convert function calls
 *   2. The editor (Phase 4) for dual-mode display
 *   3. Documentation generation
 *
 * Format: { lsl: "llFunctionName", api: "this.world.method()", category, notes }
 *
 * Categories match LSL wiki organization for easy cross-reference.
 * Status: "mapped" = has equivalent, "partial" = behavior differs, "unmapped" = no equivalent yet
 */

export interface FunctionMapping {
  /** LSL function name (e.g., "llSay") */
  lsl: string;
  /** poqpoq API equivalent (e.g., "this.world.say") */
  api: string;
  /** Functional category */
  category: string;
  /** Implementation status */
  status: "mapped" | "partial" | "unmapped" | "deprecated";
  /** Notes on behavioral differences */
  notes?: string;
}

/**
 * Core LSL function mappings.
 * This is not exhaustive yet — covers the most commonly used ~150 functions.
 * Full coverage of all 400+ will be built incrementally.
 */
export const LSL_FUNCTION_MAP: FunctionMapping[] = [
  // === Communication ===
  { lsl: "llSay", api: "this.say(channel, message)", category: "communication", status: "mapped" },
  { lsl: "llWhisper", api: "this.whisper(channel, message)", category: "communication", status: "mapped" },
  { lsl: "llShout", api: "this.shout(channel, message)", category: "communication", status: "mapped" },
  { lsl: "llRegionSay", api: "this.world.regionSay(channel, message)", category: "communication", status: "mapped" },
  { lsl: "llRegionSayTo", api: "this.world.getAgent(id)?.sendMessage(message)", category: "communication", status: "mapped" },
  { lsl: "llListen", api: "this.listen(channel, name, id, message)", category: "communication", status: "mapped" },
  { lsl: "llListenRemove", api: "handle.remove()", category: "communication", status: "mapped", notes: "Uses handle pattern instead of integer ID" },
  { lsl: "llInstantMessage", api: "this.world.getAgent(id)?.sendMessage(message)", category: "communication", status: "mapped" },
  { lsl: "llOwnerSay", api: "this.say(0, message)", category: "communication", status: "mapped", notes: "Channel 0 to owner only" },
  { lsl: "llMessageLinked", api: "this.sendLinkMessage(link, num, str, id)", category: "communication", status: "mapped", notes: "Broadcasts within container; supports LINK_SET, LINK_THIS, LINK_ROOT, LINK_ALL_OTHERS, LINK_ALL_CHILDREN" },

  // === Object Manipulation ===
  { lsl: "llSetPos", api: "this.object.setPosition(pos)", category: "object", status: "mapped", notes: "Returns Promise, no 0.2s delay" },
  { lsl: "llGetPos", api: "this.object.getPosition()", category: "object", status: "mapped" },
  { lsl: "llSetRot", api: "this.object.setRotation(rot)", category: "object", status: "mapped" },
  { lsl: "llGetRot", api: "this.object.getRotation()", category: "object", status: "mapped" },
  { lsl: "llSetScale", api: "this.object.setScale(scale)", category: "object", status: "mapped" },
  { lsl: "llGetScale", api: "this.object.getScale()", category: "object", status: "mapped" },
  { lsl: "llSetColor", api: "this.object.setColor(color, face)", category: "object", status: "mapped" },
  { lsl: "llSetAlpha", api: "this.object.setAlpha(alpha, face)", category: "object", status: "mapped" },
  { lsl: "llSetTexture", api: "this.object.setTexture(texture, face)", category: "object", status: "mapped" },
  { lsl: "llSetText", api: "this.object.setText(text, color, alpha)", category: "object", status: "mapped" },
  { lsl: "llSetPrimitiveParams", api: "this.object.setMaterial(config, face)", category: "object", status: "partial", notes: "Uses MaterialConfig instead of rule list" },
  { lsl: "llGetObjectName", api: "this.object.name", category: "object", status: "mapped" },
  { lsl: "llGetObjectDesc", api: "this.object.description", category: "object", status: "mapped" },
  { lsl: "llGetKey", api: "this.object.id", category: "object", status: "mapped" },
  { lsl: "llGetCreator", api: "this.object.creatorId", category: "object", status: "mapped" },
  { lsl: "llGetOwner", api: "this.owner.id", category: "object", status: "mapped" },
  { lsl: "llGetNumberOfPrims", api: "this.object.getLinkCount()", category: "object", status: "mapped" },
  { lsl: "llGetLinkKey", api: "this.object.getLink(num)?.id", category: "object", status: "mapped" },

  // === Physics ===
  { lsl: "llApplyImpulse", api: "this.object.applyImpulse(force, local)", category: "physics", status: "mapped" },
  { lsl: "llApplyRotationalImpulse", api: "this.object.applyTorque(torque, local)", category: "physics", status: "mapped" },
  { lsl: "llSetForce", api: "this.object.applyForce(force, local)", category: "physics", status: "mapped" },
  { lsl: "llGetVel", api: "this.object.getVelocity()", category: "physics", status: "mapped" },
  { lsl: "llSetBuoyancy", api: "this.object.setPhysics({ gravity: false })", category: "physics", status: "partial" },
  { lsl: "llMoveToTarget", api: "this.object.setPosition(target, { duration })", category: "physics", status: "mapped", notes: "Uses animation options instead of tau" },
  { lsl: "llSetPhysicsMaterial", api: "this.object.setPhysics(config)", category: "physics", status: "mapped" },

  // === Agent Interaction ===
  { lsl: "llDetectedKey", api: "detected[index].id", category: "agent", status: "mapped", notes: "Uses array index instead of function" },
  { lsl: "llDetectedName", api: "detected[index].name", category: "agent", status: "mapped" },
  { lsl: "llDetectedPos", api: "detected[index].position", category: "agent", status: "mapped" },
  { lsl: "llDetectedRot", api: "detected[index].rotation", category: "agent", status: "mapped" },
  { lsl: "llDetectedVel", api: "detected[index].velocity", category: "agent", status: "mapped" },
  { lsl: "llDetectedType", api: "detected[index].type", category: "agent", status: "mapped" },
  { lsl: "llGetAgentSize", api: "agent.getPosition()", category: "agent", status: "partial" },
  { lsl: "llRequestPermissions", api: "this.requestPermissions(agent, perms)", category: "agent", status: "mapped" },
  { lsl: "llSitTarget", api: "this.object.setSitTarget(offset, rot)", category: "agent", status: "mapped" },

  // === Effects ===
  { lsl: "llParticleSystem", api: "this.object.particles(config)", category: "effects", status: "mapped", notes: "Uses ParticleConfig instead of rule list" },
  { lsl: "llPlaySound", api: "this.object.playSound(sound)", category: "effects", status: "mapped" },
  { lsl: "llLoopSound", api: "this.object.loopSound(sound, volume)", category: "effects", status: "mapped" },
  { lsl: "llStopSound", api: "this.object.stopSound()", category: "effects", status: "mapped" },
  { lsl: "llTriggerSound", api: "this.object.playSound(sound, { spatial: false })", category: "effects", status: "mapped" },
  { lsl: "llSetLinkPrimitiveParamsFast", api: "this.object.getLink(link)?.setMaterial(config)", category: "effects", status: "partial" },

  // === Timer ===
  { lsl: "llSetTimerEvent", api: "this.setTimer(interval)", category: "timer", status: "mapped", notes: "Supports multiple named timers" },
  { lsl: "llSleep", api: "await this.delay(seconds)", category: "timer", status: "mapped", notes: "Does NOT block other scripts (async)" },

  // === Perception ===
  { lsl: "llSensor", api: "this.sensor(name, id, type, range, arc)", category: "perception", status: "mapped" },
  { lsl: "llSensorRepeat", api: "this.sensorRepeat(name, id, type, range, arc, rate)", category: "perception", status: "mapped" },
  { lsl: "llSensorRemove", api: "this.sensorRemove()", category: "perception", status: "mapped" },
  { lsl: "llCastRay", api: "this.world.raycast(start, end)", category: "perception", status: "mapped" },
  { lsl: "llGetRegionAgentCount", api: "this.world.getAgentCount()", category: "perception", status: "mapped" },
  { lsl: "llGetAgentList", api: "this.world.getAgents()", category: "perception", status: "mapped" },

  // === Data ===
  { lsl: "llGetNotecardLine", api: "await this.world.storage.get(key)", category: "data", status: "mapped", notes: "Key-value storage replaces notecard reading" },
  { lsl: "llHTTPRequest", api: "await this.world.http.get(url)", category: "data", status: "mapped", notes: "Returns Promise, no callback" },
  { lsl: "llGetFreeMemory", api: "/* no equivalent — no memory limit */", category: "data", status: "deprecated", notes: "No 64KB limit in poqpoq" },

  // === Math ===
  { lsl: "llVecDist", api: "v1.distanceTo(v2)", category: "math", status: "mapped" },
  { lsl: "llVecNorm", api: "v.normalize()", category: "math", status: "mapped" },
  { lsl: "llVecMag", api: "v.length()", category: "math", status: "mapped" },
  { lsl: "llRot2Euler", api: "rot.toEuler()", category: "math", status: "mapped" },
  { lsl: "llEuler2Rot", api: "Quaternion.fromEuler(v)", category: "math", status: "mapped" },
  { lsl: "llAxes2Rot", api: "Quaternion.fromAxisAngle(axis, angle)", category: "math", status: "mapped" },
  { lsl: "llFrand", api: "Math.random() * max", category: "math", status: "mapped" },
  { lsl: "llAbs", api: "Math.abs(val)", category: "math", status: "mapped" },
  { lsl: "llFloor", api: "Math.floor(val)", category: "math", status: "mapped" },
  { lsl: "llCeil", api: "Math.ceil(val)", category: "math", status: "mapped" },
  { lsl: "llRound", api: "Math.round(val)", category: "math", status: "mapped" },
  { lsl: "llSqrt", api: "Math.sqrt(val)", category: "math", status: "mapped" },
  { lsl: "llPow", api: "Math.pow(base, exp)", category: "math", status: "mapped" },
  { lsl: "llSin", api: "Math.sin(val)", category: "math", status: "mapped" },
  { lsl: "llCos", api: "Math.cos(val)", category: "math", status: "mapped" },
  { lsl: "llTan", api: "Math.tan(val)", category: "math", status: "mapped" },
  { lsl: "llAsin", api: "Math.asin(val)", category: "math", status: "mapped" },
  { lsl: "llAcos", api: "Math.acos(val)", category: "math", status: "mapped" },
  { lsl: "llAtan2", api: "Math.atan2(y, x)", category: "math", status: "mapped" },

  // === String ===
  { lsl: "llStringLength", api: "str.length", category: "string", status: "mapped" },
  { lsl: "llSubStringIndex", api: "str.indexOf(substr)", category: "string", status: "mapped" },
  { lsl: "llGetSubString", api: "str.substring(start, end)", category: "string", status: "mapped" },
  { lsl: "llDeleteSubString", api: "str.slice(0, start) + str.slice(end + 1)", category: "string", status: "mapped" },
  { lsl: "llToLower", api: "str.toLowerCase()", category: "string", status: "mapped" },
  { lsl: "llToUpper", api: "str.toUpperCase()", category: "string", status: "mapped" },
  { lsl: "llParseString2List", api: "str.split(separator)", category: "string", status: "mapped" },
  { lsl: "llStringTrim", api: "str.trim()", category: "string", status: "mapped" },

  // === List → Array ===
  { lsl: "llGetListLength", api: "arr.length", category: "list", status: "mapped" },
  { lsl: "llList2String", api: "arr[index]", category: "list", status: "mapped", notes: "TypeScript arrays are typed" },
  { lsl: "llList2Integer", api: "arr[index]", category: "list", status: "mapped" },
  { lsl: "llList2Float", api: "arr[index]", category: "list", status: "mapped" },
  { lsl: "llList2Vector", api: "arr[index]", category: "list", status: "mapped" },
  { lsl: "llListSort", api: "arr.sort()", category: "list", status: "mapped" },
  { lsl: "llListFindList", api: "arr.findIndex()", category: "list", status: "mapped" },
  { lsl: "llList2CSV", api: "arr.join(',')", category: "list", status: "mapped" },
  { lsl: "llCSV2List", api: "str.split(',')", category: "list", status: "mapped" },
  { lsl: "llListInsertList", api: "arr.splice(pos, 0, ...items)", category: "list", status: "mapped" },
  { lsl: "llDeleteSubList", api: "arr.splice(start, count)", category: "list", status: "mapped" },

  // === Environment ===
  { lsl: "llGetTimeOfDay", api: "this.world.environment.getTimeOfDay()", category: "environment", status: "mapped" },
  { lsl: "llGetSunDirection", api: "this.world.environment.getSunDirection()", category: "environment", status: "mapped" },
  { lsl: "llGetRegionName", api: "this.world.getRegionName()", category: "environment", status: "mapped" },
  { lsl: "llGetUnixTime", api: "this.world.getUnixTime()", category: "environment", status: "mapped" },
  { lsl: "llGround", api: "this.world.getGroundHeight(pos)", category: "environment", status: "mapped" },
  { lsl: "llSetRegionSunDirection", api: "this.world.environment.setTimeOfDay(hour)", category: "environment", status: "partial" },

  // === OSSL Extensions ===
  { lsl: "osNpcCreate", api: "this.world.npc.create(name, pos, appearance)", category: "ossl-npc", status: "mapped" },
  { lsl: "osNpcRemove", api: "npc.remove()", category: "ossl-npc", status: "mapped" },
  { lsl: "osNpcMoveTo", api: "await npc.moveTo(pos)", category: "ossl-npc", status: "mapped", notes: "Returns Promise" },
  { lsl: "osNpcSay", api: "npc.say(message, channel)", category: "ossl-npc", status: "mapped" },
  { lsl: "osNpcSit", api: "npc.sit(target)", category: "ossl-npc", status: "mapped" },
  { lsl: "osNpcStand", api: "npc.stand()", category: "ossl-npc", status: "mapped" },
  { lsl: "osNpcPlayAnimation", api: "npc.playAnimation(anim)", category: "ossl-npc", status: "mapped" },
  { lsl: "osNpcStopAnimation", api: "npc.stopAnimation(anim)", category: "ossl-npc", status: "mapped" },
  { lsl: "osNpcSetRot", api: "npc.setRotation(rot)", category: "ossl-npc", status: "mapped" },
  { lsl: "osGetNotecard", api: "await this.world.storage.get(key)", category: "ossl-data", status: "mapped" },
  { lsl: "osSetTerrainHeight", api: "/* world.environment API */", category: "ossl-terrain", status: "unmapped", notes: "Planned for Phase 5" },
  { lsl: "osTeleportAgent", api: "await agent.teleport(destination)", category: "ossl-agent", status: "mapped" },
  { lsl: "osSetDynamicTextureURL", api: "this.object.setTexture(url, face)", category: "ossl-texture", status: "partial" },
  { lsl: "osParseJSON", api: "JSON.parse(str)", category: "ossl-data", status: "mapped", notes: "Native JSON support" },
];

/** Quick lookup by LSL function name */
export const LSL_LOOKUP = new Map<string, FunctionMapping>(
  LSL_FUNCTION_MAP.map(m => [m.lsl, m])
);

/** Get mapping stats */
export function getMappingStats() {
  const total = LSL_FUNCTION_MAP.length;
  const mapped = LSL_FUNCTION_MAP.filter(m => m.status === "mapped").length;
  const partial = LSL_FUNCTION_MAP.filter(m => m.status === "partial").length;
  const unmapped = LSL_FUNCTION_MAP.filter(m => m.status === "unmapped").length;
  const deprecated = LSL_FUNCTION_MAP.filter(m => m.status === "deprecated").length;

  return { total, mapped, partial, unmapped, deprecated };
}
