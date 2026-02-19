/**
 * Event Dispatcher — Routes world events to the correct script handlers.
 *
 * This is the central nervous system of the runtime:
 * - Touch events → all scripts on the touched object
 * - Collision events → scripts on colliding objects
 * - Timer events → the specific script that set the timer
 * - Listen events → scripts that registered a listener on that channel
 * - Link messages → routed by the LinkMessageBus
 * - Sensor events → the script that triggered the scan
 *
 * Event handler resolution:
 * 1. Current state handler (e.g., states.open.onTouchStart)
 * 2. Global handler (e.g., onTouchStart on the class)
 * 3. Both fire if both exist (state first, then global)
 * — This resolution happens in the WORKER, not here.
 * — This dispatcher just routes the event to the correct worker.
 */

import type { WorkerHost } from "./worker-host.js";
import type { TimerManager } from "./timer-manager.js";
import type { LinkMessageBus } from "./link-message-bus.js";

/** Listen registration for chat channels */
interface ListenRegistration {
  scriptId: string;
  channel: number;
  nameFilter?: string;
  idFilter?: string;
  messageFilter?: string;
  handle: string;
}

export class EventDispatcher {
  private workerHost: WorkerHost;
  private timerManager: TimerManager;
  private linkMessageBus: LinkMessageBus;

  /** Active listen registrations: handle → registration */
  private listeners = new Map<string, ListenRegistration>();
  /** Channel index: channel → Set<handle> */
  private channelIndex = new Map<number, Set<string>>();
  /** Script index: scriptId → Set<handle> */
  private scriptListeners = new Map<string, Set<string>>();

  private nextListenHandle = 0;

  constructor(
    workerHost: WorkerHost,
    timerManager: TimerManager,
    linkMessageBus: LinkMessageBus
  ) {
    this.workerHost = workerHost;
    this.timerManager = timerManager;
    this.linkMessageBus = linkMessageBus;

    // Wire up timer fires → event dispatch
    this.timerManager.onFire((scriptId, timerId) => {
      this.dispatchToScript(scriptId, "onTimer", [timerId]);
    });

    // Wire up link message delivery → event dispatch
    this.linkMessageBus.onDeliver((targetScriptId, senderLink, num, str, id) => {
      this.dispatchToScript(targetScriptId, "onLinkMessage", [senderLink, num, str, id]);
    });
  }

  // === Object Events ===

  /**
   * Dispatch a touch event to all scripts on an object.
   */
  dispatchTouch(
    event: "onTouchStart" | "onTouch" | "onTouchEnd",
    containerId: string,
    agent: { id: string; name: string },
    face: number
  ): void {
    const scripts = this.workerHost.getScriptsInContainer(containerId);
    for (const script of scripts) {
      this.dispatchToScript(script.scriptId, event, [agent, face]);
    }
  }

  /**
   * Dispatch a collision event to scripts on both colliding objects.
   */
  dispatchCollision(
    event: "onCollisionStart" | "onCollision" | "onCollisionEnd",
    containerId: string,
    otherObject: { id: string; name: string }
  ): void {
    const scripts = this.workerHost.getScriptsInContainer(containerId);
    for (const script of scripts) {
      this.dispatchToScript(script.scriptId, event, [otherObject]);
    }
  }

  /**
   * Dispatch a rez event to all scripts on an object.
   */
  dispatchRez(containerId: string, startParam: number): void {
    const scripts = this.workerHost.getScriptsInContainer(containerId);
    for (const script of scripts) {
      this.dispatchToScript(script.scriptId, "onRez", [startParam]);
    }
  }

  /**
   * Dispatch an object change event.
   */
  dispatchChanged(containerId: string, change: number): void {
    const scripts = this.workerHost.getScriptsInContainer(containerId);
    for (const script of scripts) {
      this.dispatchToScript(script.scriptId, "onChanged", [change]);
    }
  }

  /**
   * Dispatch a money event (payment received).
   */
  dispatchMoney(containerId: string, agent: { id: string; name: string }, amount: number): void {
    const scripts = this.workerHost.getScriptsInContainer(containerId);
    for (const script of scripts) {
      this.dispatchToScript(script.scriptId, "onMoney", [agent, amount]);
    }
  }

  // === Communication Events ===

  /**
   * Register a listen on a channel.
   * Returns a handle ID for later removal.
   */
  registerListen(
    scriptId: string,
    channel: number,
    name?: string,
    id?: string,
    message?: string
  ): string {
    const handle = `listen_${this.nextListenHandle++}`;

    const reg: ListenRegistration = {
      scriptId,
      channel,
      nameFilter: name,
      idFilter: id,
      messageFilter: message,
      handle,
    };

    this.listeners.set(handle, reg);

    // Channel index
    let channelListeners = this.channelIndex.get(channel);
    if (!channelListeners) {
      channelListeners = new Set();
      this.channelIndex.set(channel, channelListeners);
    }
    channelListeners.add(handle);

    // Script index
    let scriptHandles = this.scriptListeners.get(scriptId);
    if (!scriptHandles) {
      scriptHandles = new Set();
      this.scriptListeners.set(scriptId, scriptHandles);
    }
    scriptHandles.add(handle);

    return handle;
  }

  /**
   * Remove a listen registration.
   */
  removeListen(handle: string): void {
    const reg = this.listeners.get(handle);
    if (!reg) return;

    this.listeners.delete(handle);

    const channelListeners = this.channelIndex.get(reg.channel);
    if (channelListeners) {
      channelListeners.delete(handle);
      if (channelListeners.size === 0) {
        this.channelIndex.delete(reg.channel);
      }
    }

    const scriptHandles = this.scriptListeners.get(reg.scriptId);
    if (scriptHandles) {
      scriptHandles.delete(handle);
      if (scriptHandles.size === 0) {
        this.scriptListeners.delete(reg.scriptId);
      }
    }
  }

  /**
   * Remove all listens for a script (cleanup on terminate).
   */
  removeAllListens(scriptId: string): void {
    const handles = this.scriptListeners.get(scriptId);
    if (!handles) return;

    for (const handle of handles) {
      const reg = this.listeners.get(handle);
      if (reg) {
        const channelListeners = this.channelIndex.get(reg.channel);
        if (channelListeners) {
          channelListeners.delete(handle);
          if (channelListeners.size === 0) {
            this.channelIndex.delete(reg.channel);
          }
        }
        this.listeners.delete(handle);
      }
    }

    this.scriptListeners.delete(scriptId);
  }

  /**
   * Dispatch a chat message to listening scripts.
   * Called when say/whisper/shout/regionSay fires.
   */
  dispatchChat(
    channel: number,
    senderName: string,
    senderId: string,
    message: string
  ): void {
    const channelListeners = this.channelIndex.get(channel);
    if (!channelListeners) return;

    for (const handle of channelListeners) {
      const reg = this.listeners.get(handle);
      if (!reg) continue;

      // Apply filters (empty string = match all, matching LSL behavior)
      if (reg.nameFilter && reg.nameFilter !== senderName) continue;
      if (reg.idFilter && reg.idFilter !== senderId) continue;
      if (reg.messageFilter && reg.messageFilter !== message) continue;

      this.dispatchToScript(reg.scriptId, "onListen", [
        channel,
        senderName,
        senderId,
        message,
      ]);
    }
  }

  // === Sensor Events ===

  /**
   * Dispatch sensor results to a specific script.
   */
  dispatchSensor(scriptId: string, detected: unknown[]): void {
    this.dispatchToScript(scriptId, "onSensor", [detected]);
  }

  /**
   * Dispatch no-sensor (nothing found) to a script.
   */
  dispatchNoSensor(scriptId: string): void {
    this.dispatchToScript(scriptId, "onNoSensor", []);
  }

  // === Permission Events ===

  /**
   * Dispatch permission grant/deny.
   */
  dispatchPermissions(scriptId: string, permissions: number): void {
    this.dispatchToScript(scriptId, "onPermissions", [permissions]);
  }

  // === Generic Dispatch ===

  /**
   * Dispatch any event to all scripts in a container.
   */
  dispatchToContainer(containerId: string, event: string, args: unknown[]): void {
    const scripts = this.workerHost.getScriptsInContainer(containerId);
    for (const script of scripts) {
      this.dispatchToScript(script.scriptId, event, args);
    }
  }

  /**
   * Dispatch an event to a specific script.
   * The worker handles state-specific vs global handler resolution.
   */
  dispatchToScript(scriptId: string, event: string, args: unknown[]): void {
    this.workerHost.sendEvent(scriptId, event, args);
  }

  /**
   * Clean up all resources for a terminated script.
   */
  cleanupScript(scriptId: string): void {
    this.removeAllListens(scriptId);
    this.timerManager.clearAllTimers(scriptId);
    this.linkMessageBus.unregister(scriptId);
  }
}
