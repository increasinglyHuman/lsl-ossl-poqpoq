/**
 * LSL Function Resolver — Resolves ll-star and os-star calls to TypeScript equivalents.
 *
 * Consumes LSL_FUNCTION_MAP from ll-map.ts and adds special handling for:
 *   - llDetected* (array access pattern)
 *   - llSleep (async)
 *   - llSetTimerEvent (0 = clear)
 *   - llGetSubString / llDeleteSubString (LSL's inclusive-end semantics)
 *   - llDumpList2String / llList2CSV (method calls)
 *   - Type casts and property accesses disguised as function calls
 */

import { LSL_LOOKUP, type FunctionMapping } from "../api/ll-map.js";

// ============================================================
// Resolution result
// ============================================================

export interface ResolvedFunction {
  /** How to emit this call */
  kind:
    | "method"       // this.method(args)
    | "property"     // this.property (no args)
    | "detected"     // detected[i].field
    | "static"       // Math.func(args) or similar
    | "special"      // Custom transform
    | "unmapped";    // TODO marker

  /** The TypeScript expression template, with $0, $1, ... for arguments */
  template: string;

  /** Whether this call needs await */
  needsAwait: boolean;

  /** Whether the containing function needs to be marked async */
  needsAsync: boolean;

  /** The original LSL function name */
  lslName: string;

  /** Category from ll-map */
  category: string;

  /** Any warnings to emit */
  warning?: string;
}

// ============================================================
// Detected field mapping
// ============================================================

const DETECTED_FIELDS: Record<string, string> = {
  llDetectedKey: "id",
  llDetectedName: "name",
  llDetectedPos: "position",
  llDetectedRot: "rotation",
  llDetectedVel: "velocity",
  llDetectedType: "type",
  llDetectedOwner: "ownerId",
  llDetectedGroup: "groupId",
  llDetectedGrab: "grabOffset",
  llDetectedLinkNumber: "linkNumber",
  llDetectedTouchFace: "touchFace",
  llDetectedTouchNormal: "touchNormal",
  llDetectedTouchBinormal: "touchBinormal",
  llDetectedTouchPos: "touchPosition",
  llDetectedTouchST: "touchST",
  llDetectedTouchUV: "touchUV",
};

// ============================================================
// Special function handlers
// ============================================================

/**
 * Functions requiring custom code generation beyond simple name mapping.
 * Key = LSL function name, value = handler returning ResolvedFunction.
 */
const SPECIAL_HANDLERS: Record<string, (args: string[]) => ResolvedFunction> = {
  // --- Async functions ---
  llSleep: (args) => ({
    kind: "special",
    template: `await this.delay(${args[0]})`,
    needsAwait: true,
    needsAsync: true,
    lslName: "llSleep",
    category: "timer",
  }),

  // --- Timer (0 = clear) ---
  llSetTimerEvent: (args) => ({
    kind: "special",
    template: `this.setTimer(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetTimerEvent",
    category: "timer",
  }),

  // --- String operations with LSL's inclusive-end semantics ---
  llGetSubString: (args) => ({
    kind: "special",
    template: `lslSubString(${args[0]}, ${args[1]}, ${args[2]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetSubString",
    category: "string",
  }),

  llDeleteSubString: (args) => ({
    kind: "special",
    template: `lslDeleteSubString(${args[0]}, ${args[1]}, ${args[2]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llDeleteSubString",
    category: "string",
  }),

  llInsertString: (args) => ({
    kind: "special",
    template: `lslInsertString(${args[0]}, ${args[1]}, ${args[2]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llInsertString",
    category: "string",
  }),

  // --- HTTP (async) ---
  llHTTPRequest: (args) => ({
    kind: "special",
    template: `await this.world.http.request(${args.join(", ")})`,
    needsAwait: true,
    needsAsync: true,
    lslName: "llHTTPRequest",
    category: "data",
  }),

  // --- Communication ---
  llSay: (args) => ({
    kind: "method",
    template: `this.say(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSay",
    category: "communication",
  }),

  llWhisper: (args) => ({
    kind: "method",
    template: `this.whisper(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llWhisper",
    category: "communication",
  }),

  llShout: (args) => ({
    kind: "method",
    template: `this.shout(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llShout",
    category: "communication",
  }),

  llOwnerSay: (args) => ({
    kind: "method",
    template: `this.ownerSay(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llOwnerSay",
    category: "communication",
  }),

  llListen: (args) => ({
    kind: "method",
    template: `this.listen(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llListen",
    category: "communication",
  }),

  llListenRemove: (args) => ({
    kind: "method",
    template: `this.listenRemove(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llListenRemove",
    category: "communication",
  }),

  llMessageLinked: (args) => ({
    kind: "method",
    template: `this.sendLinkMessage(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llMessageLinked",
    category: "communication",
  }),

  // --- Object manipulation ---
  llSetPos: (args) => ({
    kind: "method",
    template: `this.object.setPosition(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetPos",
    category: "object",
  }),

  llGetPos: () => ({
    kind: "method",
    template: `this.object.getPosition()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetPos",
    category: "object",
  }),

  llSetRot: (args) => ({
    kind: "method",
    template: `this.object.setRotation(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetRot",
    category: "object",
  }),

  llGetRot: () => ({
    kind: "method",
    template: `this.object.getRotation()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetRot",
    category: "object",
  }),

  llSetScale: (args) => ({
    kind: "method",
    template: `this.object.setScale(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetScale",
    category: "object",
  }),

  llGetScale: () => ({
    kind: "method",
    template: `this.object.getScale()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetScale",
    category: "object",
  }),

  llSetColor: (args) => ({
    kind: "method",
    template: `this.object.setColor(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetColor",
    category: "object",
  }),

  llSetAlpha: (args) => ({
    kind: "method",
    template: `this.object.setAlpha(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetAlpha",
    category: "object",
  }),

  llSetTexture: (args) => ({
    kind: "method",
    template: `this.object.setTexture(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetTexture",
    category: "object",
  }),

  llSetText: (args) => ({
    kind: "method",
    template: `this.object.setText(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetText",
    category: "object",
  }),

  llGetObjectName: () => ({
    kind: "property",
    template: `this.object.name`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetObjectName",
    category: "object",
  }),

  llGetObjectDesc: () => ({
    kind: "property",
    template: `this.object.description`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetObjectDesc",
    category: "object",
  }),

  llGetKey: () => ({
    kind: "property",
    template: `this.object.id`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetKey",
    category: "object",
  }),

  llGetOwner: () => ({
    kind: "property",
    template: `this.owner.id`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetOwner",
    category: "object",
  }),

  llGetCreator: () => ({
    kind: "property",
    template: `this.object.creatorId`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetCreator",
    category: "object",
  }),

  // --- Math ---
  llVecDist: (args) => ({
    kind: "special",
    template: `${args[0]}.distanceTo(${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llVecDist",
    category: "math",
  }),

  llVecNorm: (args) => ({
    kind: "special",
    template: `${args[0]}.normalize()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llVecNorm",
    category: "math",
  }),

  llVecMag: (args) => ({
    kind: "special",
    template: `${args[0]}.length()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llVecMag",
    category: "math",
  }),

  llRot2Euler: (args) => ({
    kind: "special",
    template: `${args[0]}.toEuler()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llRot2Euler",
    category: "math",
  }),

  llEuler2Rot: (args) => ({
    kind: "static",
    template: `Quaternion.fromEuler(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llEuler2Rot",
    category: "math",
  }),

  llFrand: (args) => ({
    kind: "static",
    template: `Math.random() * ${args[0]}`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llFrand",
    category: "math",
  }),

  llAbs: (args) => ({
    kind: "static",
    template: `Math.abs(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llAbs",
    category: "math",
  }),

  llFloor: (args) => ({
    kind: "static",
    template: `Math.floor(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llFloor",
    category: "math",
  }),

  llCeil: (args) => ({
    kind: "static",
    template: `Math.ceil(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llCeil",
    category: "math",
  }),

  llRound: (args) => ({
    kind: "static",
    template: `Math.round(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llRound",
    category: "math",
  }),

  llSqrt: (args) => ({
    kind: "static",
    template: `Math.sqrt(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSqrt",
    category: "math",
  }),

  llPow: (args) => ({
    kind: "static",
    template: `Math.pow(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llPow",
    category: "math",
  }),

  llSin: (args) => ({
    kind: "static",
    template: `Math.sin(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSin",
    category: "math",
  }),

  llCos: (args) => ({
    kind: "static",
    template: `Math.cos(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llCos",
    category: "math",
  }),

  llTan: (args) => ({
    kind: "static",
    template: `Math.tan(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llTan",
    category: "math",
  }),

  llAtan2: (args) => ({
    kind: "static",
    template: `Math.atan2(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llAtan2",
    category: "math",
  }),

  // --- String helpers ---
  llStringLength: (args) => ({
    kind: "special",
    template: `${args[0]}.length`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llStringLength",
    category: "string",
  }),

  llSubStringIndex: (args) => ({
    kind: "special",
    template: `${args[0]}.indexOf(${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSubStringIndex",
    category: "string",
  }),

  llToLower: (args) => ({
    kind: "special",
    template: `${args[0]}.toLowerCase()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llToLower",
    category: "string",
  }),

  llToUpper: (args) => ({
    kind: "special",
    template: `${args[0]}.toUpperCase()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llToUpper",
    category: "string",
  }),

  // --- List / Array ---
  llGetListLength: (args) => ({
    kind: "special",
    template: `${args[0]}.length`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetListLength",
    category: "list",
  }),

  llList2String: (args) => ({
    kind: "special",
    template: `String(${args[0]}[${args[1]}])`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llList2String",
    category: "list",
  }),

  llList2Integer: (args) => ({
    kind: "special",
    template: `Number(${args[0]}[${args[1]}])`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llList2Integer",
    category: "list",
  }),

  llList2Float: (args) => ({
    kind: "special",
    template: `Number(${args[0]}[${args[1]}])`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llList2Float",
    category: "list",
  }),

  llList2Key: (args) => ({
    kind: "special",
    template: `String(${args[0]}[${args[1]}])`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llList2Key",
    category: "list",
  }),

  llList2Vector: (args) => ({
    kind: "special",
    template: `${args[0]}[${args[1]}] as Vector3`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llList2Vector",
    category: "list",
  }),

  llList2CSV: (args) => ({
    kind: "special",
    template: `${args[0]}.join(",")`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llList2CSV",
    category: "list",
  }),

  llCSV2List: (args) => ({
    kind: "special",
    template: `${args[0]}.split(",")`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llCSV2List",
    category: "list",
  }),

  llDumpList2String: (args) => ({
    kind: "special",
    template: `${args[0]}.join(${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llDumpList2String",
    category: "list",
  }),

  // --- Particle system ---
  llParticleSystem: (args) => ({
    kind: "method",
    template: `this.object.particles(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llParticleSystem",
    category: "effects",
  }),

  // --- Media on a Prim ---
  llSetPrimMediaParams: (args) => ({
    kind: "method",
    template: `this.object.setMediaParams(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetPrimMediaParams",
    category: "media",
  }),

  llClearPrimMedia: (args) => ({
    kind: "method",
    template: `this.object.clearMedia(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llClearPrimMedia",
    category: "media",
  }),

  llGetPrimMediaParams: (args) => ({
    kind: "method",
    template: `this.object.getMediaParams(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetPrimMediaParams",
    category: "media",
  }),

  llSetLinkMedia: (args) => ({
    kind: "method",
    template: `this.object.getLink(${args[0]})?.setMediaParams(${args[1]}, ${args[2]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetLinkMedia",
    category: "media",
  }),

  llClearLinkMedia: (args) => ({
    kind: "method",
    template: `this.object.getLink(${args[0]})?.clearMedia(${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llClearLinkMedia",
    category: "media",
  }),

  llGetLinkMedia: (args) => ({
    kind: "method",
    template: `this.object.getLink(${args[0]})?.getMediaParams(${args[1]}, ${args[2]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetLinkMedia",
    category: "media",
  }),

  // --- Sound ---
  llPlaySound: (args) => ({
    kind: "method",
    template: `this.object.playSound(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llPlaySound",
    category: "effects",
  }),

  llLoopSound: (args) => ({
    kind: "method",
    template: `this.object.loopSound(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llLoopSound",
    category: "effects",
  }),

  llStopSound: () => ({
    kind: "method",
    template: `this.object.stopSound()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llStopSound",
    category: "effects",
  }),

  // --- Permissions ---
  llRequestPermissions: (args) => ({
    kind: "method",
    template: `this.requestPermissions(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llRequestPermissions",
    category: "agent",
  }),

  llGetPermissions: () => ({
    kind: "method",
    template: `this.getPermissions()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetPermissions",
    category: "agent",
  }),

  // --- Animation ---
  llStartAnimation: (args) => ({
    kind: "method",
    template: `this.startAnimation(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llStartAnimation",
    category: "agent",
  }),

  llStopAnimation: (args) => ({
    kind: "method",
    template: `this.stopAnimation(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llStopAnimation",
    category: "agent",
  }),

  // --- Misc ---
  llDie: () => ({
    kind: "method",
    template: `this.die()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llDie",
    category: "object",
  }),

  llGetTime: () => ({
    kind: "method",
    template: `this.getTime()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetTime",
    category: "environment",
  }),

  llGetUnixTime: () => ({
    kind: "static",
    template: `Math.floor(Date.now() / 1000)`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetUnixTime",
    category: "environment",
  }),

  llGetRegionName: () => ({
    kind: "method",
    template: `this.world.getRegionName()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetRegionName",
    category: "environment",
  }),

  // --- NPC (OSSL) ---
  osNpcCreate: (args) => ({
    kind: "special",
    template: `await this.world.npc.create(${args.join(", ")})`,
    needsAwait: true,
    needsAsync: true,
    lslName: "osNpcCreate",
    category: "ossl-npc",
  }),

  osNpcRemove: (args) => ({
    kind: "special",
    template: `await this.world.npc.remove(${args[0]})`,
    needsAwait: true,
    needsAsync: true,
    lslName: "osNpcRemove",
    category: "ossl-npc",
  }),

  osNpcMoveTo: (args) => ({
    kind: "special",
    template: `await this.world.npc.moveTo(${args.join(", ")})`,
    needsAwait: true,
    needsAsync: true,
    lslName: "osNpcMoveTo",
    category: "ossl-npc",
  }),

  osNpcSay: (args) => ({
    kind: "special",
    template: `this.world.npc.say(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcSay",
    category: "ossl-npc",
  }),

  // --- NPC Phase 7C additions ---
  osNpcGetPos: (args) => ({
    kind: "special",
    template: `this.world.npc.getPosition(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcGetPos",
    category: "ossl-npc",
  }),

  osNpcMoveToTarget: (args) => ({
    kind: "special",
    template: `await this.world.npc.moveTo(${args.join(", ")})`,
    needsAwait: true,
    needsAsync: true,
    lslName: "osNpcMoveToTarget",
    category: "ossl-npc",
  }),

  osNpcStopMoveToTarget: (args) => ({
    kind: "special",
    template: `this.world.npc.stopMove(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcStopMoveToTarget",
    category: "ossl-npc",
  }),

  osNpcGetRot: (args) => ({
    kind: "special",
    template: `this.world.npc.getRotation(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcGetRot",
    category: "ossl-npc",
  }),

  osNpcSetRot: (args) => ({
    kind: "special",
    template: `this.world.npc.setRotation(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcSetRot",
    category: "ossl-npc",
  }),

  osNpcWhisper: (args) => ({
    kind: "special",
    template: `this.world.npc.whisper(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcWhisper",
    category: "ossl-npc",
  }),

  osNpcShout: (args) => ({
    kind: "special",
    template: `this.world.npc.shout(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcShout",
    category: "ossl-npc",
  }),

  osNpcSit: (args) => ({
    kind: "special",
    template: `this.world.npc.sit(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcSit",
    category: "ossl-npc",
  }),

  osNpcStand: (args) => ({
    kind: "special",
    template: `this.world.npc.stand(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcStand",
    category: "ossl-npc",
  }),

  osNpcPlayAnimation: (args) => ({
    kind: "special",
    template: `this.world.npc.playAnimation(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcPlayAnimation",
    category: "ossl-npc",
  }),

  osNpcStopAnimation: (args) => ({
    kind: "special",
    template: `this.world.npc.stopAnimation(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcStopAnimation",
    category: "ossl-npc",
  }),

  osNpcTouch: (args) => ({
    kind: "special",
    template: `this.world.npc.touch(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcTouch",
    category: "ossl-npc",
  }),

  osNpcLoadAppearance: (args) => ({
    kind: "special",
    template: `this.world.npc.loadAppearance(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcLoadAppearance",
    category: "ossl-npc",
  }),

  osNpcSaveAppearance: (args) => ({
    kind: "special",
    template: `this.world.npc.saveAppearance(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osNpcSaveAppearance",
    category: "ossl-npc",
  }),

  osGetNotecard: (args) => ({
    kind: "special",
    template: `await this.world.storage.get(${args[0]})`,
    needsAwait: true,
    needsAsync: true,
    lslName: "osGetNotecard",
    category: "ossl-data",
  }),

  osParseJSON: (args) => ({
    kind: "static",
    template: `JSON.parse(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "osParseJSON",
    category: "ossl-data",
  }),

  // ── Phase 7D: Physics, Combat & Environment ────────────────

  llSetStatus: (args) => ({
    kind: "method",
    template: `this.object.setStatus(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetStatus",
    category: "physics",
  }),

  llGetStatus: (args) => ({
    kind: "method",
    template: `this.object.getStatus(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetStatus",
    category: "physics",
  }),

  llSetDamage: (args) => ({
    kind: "method",
    template: `this.object.setDamage(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetDamage",
    category: "combat",
  }),

  llRezObject: (args) => ({
    kind: "method",
    template: `this.object.rez(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llRezObject",
    category: "object",
  }),

  llRezAtRoot: (args) => ({
    kind: "method",
    template: `this.object.rezAtRoot(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llRezAtRoot",
    category: "object",
  }),

  llPushObject: (args) => ({
    kind: "method",
    template: `this.world.pushObject(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llPushObject",
    category: "combat",
  }),

  llStopMoveToTarget: () => ({
    kind: "method",
    template: `this.object.stopMoveToTarget()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llStopMoveToTarget",
    category: "physics",
  }),

  llSetTorque: (args) => ({
    kind: "method",
    template: `this.object.setTorque(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetTorque",
    category: "physics",
  }),

  llVolumeDetect: (args) => ({
    kind: "method",
    template: `this.object.volumeDetect(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llVolumeDetect",
    category: "physics",
  }),

  llCollisionFilter: (args) => ({
    kind: "method",
    template: `this.object.collisionFilter(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llCollisionFilter",
    category: "physics",
  }),

  llSetBuoyancy: (args) => ({
    kind: "method",
    template: `this.object.setBuoyancy(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetBuoyancy",
    category: "physics",
  }),

  llWater: (args) => ({
    kind: "method",
    template: `this.world.getWaterHeight(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llWater",
    category: "environment",
  }),

  llGroundNormal: (args) => ({
    kind: "method",
    template: `this.world.getGroundNormal(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGroundNormal",
    category: "environment",
  }),

  llGroundSlope: (args) => ({
    kind: "method",
    template: `this.world.getGroundSlope(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGroundSlope",
    category: "environment",
  }),

  llSetPhysicsShapeType: (args) => ({
    kind: "method",
    template: `this.object.setPhysicsShape(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llSetPhysicsShapeType",
    category: "physics",
  }),

  llLookAt: (args) => ({
    kind: "method",
    template: `this.object.lookAt(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llLookAt",
    category: "physics",
  }),

  llStopLookAt: () => ({
    kind: "method",
    template: `this.object.stopLookAt()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llStopLookAt",
    category: "physics",
  }),

  // ── Phase 8: Dialogs, HUDs & Inventory ───────────────────

  // --- Dialog / UI ---
  llDialog: (args) => ({
    kind: "method",
    template: `this.world.dialog(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llDialog",
    category: "dialog",
  }),

  llTextBox: (args) => ({
    kind: "method",
    template: `this.world.textBox(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llTextBox",
    category: "dialog",
  }),

  llLoadURL: (args) => ({
    kind: "method",
    template: `this.world.loadURL(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llLoadURL",
    category: "dialog",
  }),

  llMapDestination: (args) => ({
    kind: "method",
    template: `this.world.mapDestination(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llMapDestination",
    category: "dialog",
  }),

  // --- Communication gap-fill ---
  llRegionSayTo: (args) => ({
    kind: "method",
    template: `this.world.regionSayTo(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llRegionSayTo",
    category: "communication",
  }),

  llInstantMessage: (args) => ({
    kind: "method",
    template: `this.world.instantMessage(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llInstantMessage",
    category: "communication",
  }),

  // --- Inventory queries (local container ops) ---
  llGetInventoryNumber: (args) => ({
    kind: "method",
    template: `this.container.getAssetCount(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetInventoryNumber",
    category: "inventory",
  }),

  llGetInventoryName: (args) => ({
    kind: "method",
    template: `this.container.getAssetName(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetInventoryName",
    category: "inventory",
  }),

  llGetInventoryType: (args) => ({
    kind: "method",
    template: `this.container.getAssetType(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetInventoryType",
    category: "inventory",
  }),

  llGetInventoryKey: (args) => ({
    kind: "special",
    template: `(this.container.getAsset(${args[0]})?.id ?? NULL_KEY)`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetInventoryKey",
    category: "inventory",
  }),

  llGetInventoryCreator: (args) => ({
    kind: "method",
    template: `this.container.getAssetCreator(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetInventoryCreator",
    category: "inventory",
  }),

  llGetInventoryPermMask: (args) => ({
    kind: "method",
    template: `this.container.getAssetPermMask(${args[0]}, ${args[1]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetInventoryPermMask",
    category: "inventory",
  }),

  llAllowInventoryDrop: (args) => ({
    kind: "method",
    template: `this.object.allowInventoryDrop(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llAllowInventoryDrop",
    category: "inventory",
  }),

  // --- Inventory actions ---
  llGiveInventory: (args) => ({
    kind: "method",
    template: `this.world.giveInventory(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGiveInventory",
    category: "inventory",
  }),

  llGiveInventoryList: (args) => ({
    kind: "method",
    template: `this.world.giveInventoryList(${args.join(", ")})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGiveInventoryList",
    category: "inventory",
  }),

  llRemoveInventory: (args) => ({
    kind: "method",
    template: `this.container.removeAsset(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llRemoveInventory",
    category: "inventory",
  }),

  // --- Notecard (async — returns dataserver key) ---
  llGetNotecardLine: (args) => ({
    kind: "special",
    template: `await this.world.getNotecardLine(${args.join(", ")})`,
    needsAwait: true,
    needsAsync: true,
    lslName: "llGetNotecardLine",
    category: "data",
  }),

  llGetNumberOfNotecardLines: (args) => ({
    kind: "special",
    template: `await this.world.getNumberOfNotecardLines(${args[0]})`,
    needsAwait: true,
    needsAsync: true,
    lslName: "llGetNumberOfNotecardLines",
    category: "data",
  }),

  // --- Attachment ---
  llAttachToAvatar: (args) => ({
    kind: "method",
    template: `this.world.attachToAvatar(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llAttachToAvatar",
    category: "agent",
  }),

  llAttachToAvatarTemp: (args) => ({
    kind: "method",
    template: `this.world.attachToAvatarTemp(${args[0]})`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llAttachToAvatarTemp",
    category: "agent",
  }),

  llDetachFromAvatar: () => ({
    kind: "method",
    template: `this.world.detachFromAvatar()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llDetachFromAvatar",
    category: "agent",
  }),

  llGetAttached: () => ({
    kind: "method",
    template: `this.object.getAttached()`,
    needsAwait: false,
    needsAsync: false,
    lslName: "llGetAttached",
    category: "agent",
  }),
};

// ============================================================
// Resolver
// ============================================================

export class FunctionResolver {
  /**
   * Resolve an LSL function call to its TypeScript equivalent.
   *
   * @param name     The LSL function name (e.g., "llSay", "osNpcCreate")
   * @param args     The already-emitted argument strings
   * @returns        A ResolvedFunction describing how to emit the call
   */
  resolve(name: string, args: string[]): ResolvedFunction {
    // 1. Check llDetected* family
    const detectedField = DETECTED_FIELDS[name];
    if (detectedField !== undefined) {
      const index = args[0] ?? "0";
      return {
        kind: "detected",
        template: `detected[${index}].${detectedField}`,
        needsAwait: false,
        needsAsync: false,
        lslName: name,
        category: "agent",
      };
    }

    // 2. Check special handlers
    const handler = SPECIAL_HANDLERS[name];
    if (handler) {
      return handler(args);
    }

    // 3. Check ll-map for remaining mapped functions
    const mapping = LSL_LOOKUP.get(name);
    if (mapping) {
      return this.resolveFromMapping(mapping, args);
    }

    // 4. Unmapped — emit TODO marker
    return {
      kind: "unmapped",
      template: `/* TODO: ${name} */ ${name}(${args.join(", ")})`,
      needsAwait: false,
      needsAsync: false,
      lslName: name,
      category: "unknown",
      warning: `Unmapped LSL function: ${name}`,
    };
  }

  /** Convert an ll-map FunctionMapping to a ResolvedFunction */
  private resolveFromMapping(mapping: FunctionMapping, args: string[]): ResolvedFunction {
    const { lsl, api, category, status } = mapping;

    // Parse the api template to determine the call pattern
    const isAsync = api.startsWith("await ");
    const cleanApi = api.replace(/^await /, "");

    // Property access (no parentheses in api string)
    if (!cleanApi.includes("(")) {
      return {
        kind: "property",
        template: cleanApi,
        needsAwait: isAsync,
        needsAsync: isAsync,
        lslName: lsl,
        category,
        warning: status === "partial" ? `Partial mapping: ${mapping.notes}` : undefined,
      };
    }

    // Method call — substitute arguments into the api template
    // The api field has placeholder names like (channel, message)
    // We replace the whole arg list with actual args
    const methodPart = cleanApi.replace(/\(.*\)/, `(${args.join(", ")})`);

    return {
      kind: "method",
      template: methodPart,
      needsAwait: isAsync,
      needsAsync: isAsync,
      lslName: lsl,
      category,
      warning: status === "partial" ? `Partial mapping: ${mapping.notes}` : undefined,
    };
  }

  /** Check if a function name is a known LSL built-in */
  isBuiltin(name: string): boolean {
    return (
      name in DETECTED_FIELDS ||
      name in SPECIAL_HANDLERS ||
      LSL_LOOKUP.has(name)
    );
  }

  /** Get all functions that need async handling */
  static readonly ASYNC_FUNCTIONS = new Set([
    "llSleep",
    "llHTTPRequest",
    "llGetNotecardLine",
    "llGetNumberOfNotecardLines",
    "osNpcCreate",
    "osNpcRemove",
    "osNpcMoveTo",
    "osNpcMoveToTarget",
    "osGetNotecard",
  ]);
}
