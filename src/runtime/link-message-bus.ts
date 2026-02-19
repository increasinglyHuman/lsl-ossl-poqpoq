/**
 * Link Message Bus — Inter-script messaging within containers.
 *
 * Maps to LSL's llMessageLinked() / link_message system.
 * This is the backbone of complex multi-script objects like:
 * - OpenCollar (20+ scripts, message codes 0-510, 2000-2003)
 * - AVsitter (furniture, message range 90000-90500)
 * - HUD systems (parameterized control networking)
 * - Dance chimeras, vehicles, complex gadgets
 *
 * Design:
 * - Runs on main thread (not in workers)
 * - Knows which scripts belong to which container and link number
 * - Resolves LINK_SET, LINK_THIS, LINK_ROOT, LINK_ALL_OTHERS, etc.
 * - Enforces 64-message queue limit per script (matches LSL)
 * - Broadcast semantics: every matching script hears every message
 */

import {
  LINK_SET,
  LINK_ALL_OTHERS,
  LINK_ALL_CHILDREN,
  LINK_THIS,
  LINK_ROOT,
} from "../types/script-container.js";
import type { LinkTarget } from "../types/script-container.js";
import type { LinkMessageEntry } from "./types.js";

/** Script registration info for the bus */
interface ScriptRegistration {
  scriptId: string;
  containerId: string;
  linkNumber: number;
}

/** Callback to deliver a link message to a script */
export type LinkMessageDeliveryHandler = (
  targetScriptId: string,
  senderLink: number,
  num: number,
  str: string,
  id: string
) => void;

export class LinkMessageBus {
  /** All registered scripts: scriptId → registration */
  private scripts = new Map<string, ScriptRegistration>();

  /** Container index: containerId → Set<scriptId> */
  private containers = new Map<string, Set<string>>();

  /** Pending message queues per script (enforces 64-message limit) */
  private queues = new Map<string, LinkMessageEntry[]>();

  /** Maximum pending messages per script (matches LSL's 64) */
  private maxQueueSize: number;

  /** Delivery callback */
  private deliveryHandler: LinkMessageDeliveryHandler | null = null;

  constructor(maxQueueSize: number = 64) {
    this.maxQueueSize = maxQueueSize;
  }

  /**
   * Set the delivery handler — called for each message delivered to a script.
   */
  onDeliver(handler: LinkMessageDeliveryHandler): void {
    this.deliveryHandler = handler;
  }

  /**
   * Register a script with the bus.
   */
  register(scriptId: string, containerId: string, linkNumber: number): void {
    this.scripts.set(scriptId, { scriptId, containerId, linkNumber });

    let containerScripts = this.containers.get(containerId);
    if (!containerScripts) {
      containerScripts = new Set();
      this.containers.set(containerId, containerScripts);
    }
    containerScripts.add(scriptId);
  }

  /**
   * Unregister a script from the bus.
   */
  unregister(scriptId: string): void {
    const reg = this.scripts.get(scriptId);
    if (!reg) return;

    this.scripts.delete(scriptId);
    this.queues.delete(scriptId);

    const containerScripts = this.containers.get(reg.containerId);
    if (containerScripts) {
      containerScripts.delete(scriptId);
      if (containerScripts.size === 0) {
        this.containers.delete(reg.containerId);
      }
    }
  }

  /**
   * Send a link message from a script to targets in the same container.
   * Maps to llMessageLinked(link, num, str, id).
   *
   * @param senderScriptId The script sending the message
   * @param link Target selector (LINK_SET, LINK_THIS, LINK_ROOT, etc.)
   * @param num Integer message type
   * @param str String payload
   * @param id Key/UUID payload
   */
  send(
    senderScriptId: string,
    link: LinkTarget,
    num: number,
    str: string,
    id: string
  ): void {
    const sender = this.scripts.get(senderScriptId);
    if (!sender) return;

    const containerScripts = this.containers.get(sender.containerId);
    if (!containerScripts) return;

    // Resolve targets based on link selector
    const targets = this.resolveTargets(
      sender,
      link,
      containerScripts
    );

    // Deliver to each target
    for (const targetId of targets) {
      this.deliver(targetId, sender.linkNumber, num, str, id);
    }
  }

  /**
   * Get the queue size for a script (for monitoring/debugging).
   */
  getQueueSize(scriptId: string): number {
    return this.queues.get(scriptId)?.length ?? 0;
  }

  /**
   * Get all scripts in a container.
   */
  getContainerScripts(containerId: string): string[] {
    const scripts = this.containers.get(containerId);
    return scripts ? [...scripts] : [];
  }

  // === Private Methods ===

  /**
   * Resolve which scripts should receive a message based on link target.
   */
  private resolveTargets(
    sender: ScriptRegistration,
    link: LinkTarget,
    containerScripts: Set<string>
  ): string[] {
    const targets: string[] = [];

    for (const scriptId of containerScripts) {
      const reg = this.scripts.get(scriptId);
      if (!reg) continue;

      switch (link) {
        case LINK_SET:
          // All scripts in the container (including sender)
          targets.push(scriptId);
          break;

        case LINK_THIS:
          // Scripts on the same link number as sender
          if (reg.linkNumber === sender.linkNumber) {
            targets.push(scriptId);
          }
          break;

        case LINK_ROOT:
          // Scripts on link 0 (root prim)
          if (reg.linkNumber === 0) {
            targets.push(scriptId);
          }
          break;

        case LINK_ALL_OTHERS:
          // All scripts except those on sender's link number
          if (reg.linkNumber !== sender.linkNumber) {
            targets.push(scriptId);
          }
          break;

        case LINK_ALL_CHILDREN:
          // Scripts on link > 1
          if (reg.linkNumber > 1) {
            targets.push(scriptId);
          }
          break;

        default:
          // Specific link number
          if (typeof link === "number" && link >= 0 && reg.linkNumber === link) {
            targets.push(scriptId);
          }
          break;
      }
    }

    return targets;
  }

  /**
   * Deliver a message to a specific script.
   * Enforces the per-script queue limit.
   */
  private deliver(
    targetScriptId: string,
    senderLink: number,
    num: number,
    str: string,
    id: string
  ): void {
    // Check queue limit
    let queue = this.queues.get(targetScriptId);
    if (!queue) {
      queue = [];
      this.queues.set(targetScriptId, queue);
    }

    if (queue.length >= this.maxQueueSize) {
      // Drop oldest message (matches LSL behavior — silently drops excess)
      queue.shift();
    }

    // Add to queue
    const entry: LinkMessageEntry = {
      senderScriptId: targetScriptId, // stored for debugging
      senderLink,
      num,
      str,
      id,
    };
    queue.push(entry);

    // Deliver immediately via callback
    if (this.deliveryHandler) {
      this.deliveryHandler(targetScriptId, senderLink, num, str, id);
      // Remove from queue after delivery
      const idx = queue.indexOf(entry);
      if (idx !== -1) queue.splice(idx, 1);
    }
  }
}
