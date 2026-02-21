/**
 * Reference Event Forwarder — Converts 3D engine events to ScriptEvents.
 *
 * Listens to scene observables (pointer, collision, etc.) and creates
 * typed ScriptEventEnvelope objects for dispatch to scripts.
 *
 * Like ReferenceBabylonBridge, this uses structural interfaces to avoid
 * direct Babylon.js imports.
 *
 * Usage (in World repo):
 *   import { ReferenceEventForwarder } from "blackbox-scripter/bridge";
 *   const forwarder = new ReferenceEventForwarder(dispatch);
 *   forwarder.forwardTouch(objectId, agent, face);
 */

import type { ScriptEventEnvelope, AgentInfo, ObjectInfo } from "../protocol/script-event.js";

export type EventDispatchFn = (envelope: ScriptEventEnvelope) => void;

export class ReferenceEventForwarder {
  private dispatch: EventDispatchFn;

  constructor(dispatch: EventDispatchFn) {
    this.dispatch = dispatch;
  }

  // === Touch Events ===

  forwardTouchStart(objectId: string, agent: AgentInfo, face: number = 0): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "touchStart", agent, face },
    });
  }

  forwardTouch(objectId: string, agent: AgentInfo, face: number = 0): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "touch", agent, face },
    });
  }

  forwardTouchEnd(objectId: string, agent: AgentInfo, face: number = 0): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "touchEnd", agent, face },
    });
  }

  // === Collision Events ===

  forwardCollisionStart(objectId: string, other: ObjectInfo): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "collisionStart", other },
    });
  }

  forwardCollision(objectId: string, other: ObjectInfo): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "collision", other },
    });
  }

  forwardCollisionEnd(objectId: string, other: ObjectInfo): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "collisionEnd", other },
    });
  }

  // === Lifecycle Events ===

  forwardRez(objectId: string, startParam: number = 0): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "rez", startParam },
    });
  }

  forwardChanged(objectId: string, change: number): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "changed", change },
    });
  }

  forwardMoney(objectId: string, agent: AgentInfo, amount: number): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "money", agent, amount },
    });
  }

  forwardPermissions(objectId: string, permissions: number, scriptId?: string): void {
    this.dispatch({
      targetObjectId: objectId,
      targetScriptId: scriptId,
      event: { type: "permissions", permissions },
    });
  }

  // === Perception Events ===

  forwardSensor(objectId: string, detected: AgentInfo[], scriptId?: string): void {
    this.dispatch({
      targetObjectId: objectId,
      targetScriptId: scriptId,
      event: { type: "sensor", detected },
    });
  }

  forwardNoSensor(objectId: string, scriptId?: string): void {
    this.dispatch({
      targetObjectId: objectId,
      targetScriptId: scriptId,
      event: { type: "noSensor" },
    });
  }

  // === Communication Events ===

  forwardListen(objectId: string, channel: number, senderName: string, senderId: string, message: string, scriptId?: string): void {
    this.dispatch({
      targetObjectId: objectId,
      targetScriptId: scriptId,
      event: { type: "listen", channel, senderName, senderId, message },
    });
  }

  // === Data Events ===

  forwardHttpResponse(objectId: string, requestId: string, status: number, headers: Record<string, string>, body: string, scriptId?: string): void {
    this.dispatch({
      targetObjectId: objectId,
      targetScriptId: scriptId,
      event: { type: "httpResponse", requestId, status, headers, body },
    });
  }

  forwardDataserver(objectId: string, queryId: string, data: string, scriptId?: string): void {
    this.dispatch({
      targetObjectId: objectId,
      targetScriptId: scriptId,
      event: { type: "dataserver", queryId, data },
    });
  }

  // === poqpoq Extension Events ===

  forwardPlayerEnterZone(objectId: string, agent: AgentInfo, zoneId: string, zoneName: string): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "playerEnterZone", agent, zoneId, zoneName },
    });
  }

  forwardPlayerLeaveZone(objectId: string, agent: AgentInfo, zoneId: string, zoneName: string): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "playerLeaveZone", agent, zoneId, zoneName },
    });
  }

  forwardDayNightCycle(objectId: string, phase: "dawn" | "day" | "dusk" | "night", hour: number): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "dayNightCycle", phase, hour },
    });
  }

  forwardWeatherChange(objectId: string, weather: string, intensity: number): void {
    this.dispatch({
      targetObjectId: objectId,
      event: { type: "weatherChange", weather, intensity },
    });
  }
}
