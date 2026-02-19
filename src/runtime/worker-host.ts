/**
 * Worker Host — Creates and manages the Web Worker pool.
 *
 * Responsibilities:
 * - Spawn N workers (configurable, default 4)
 * - Assign scripts to workers (round-robin)
 * - Health monitoring via watchdog pings
 * - Terminate and respawn unresponsive workers
 * - Route messages between main thread components and workers
 */

import type {
  WorkerInbound,
  WorkerOutbound,
  WorkerPoolConfig,
  ScriptConfig,
  ScriptMetadata,
  ScriptState,
} from "./types.js";
import { DEFAULT_POOL_CONFIG, DEFAULT_SCRIPT_CONFIG } from "./types.js";

/** Worker state tracking */
interface WorkerSlot {
  /** Worker instance */
  worker: Worker;
  /** Worker index in the pool */
  id: number;
  /** Script IDs assigned to this worker */
  scripts: Set<string>;
  /** Last pong timestamp (for watchdog) */
  lastPong: number;
  /** Whether worker is alive and responsive */
  alive: boolean;
}

/** Callback for messages from workers */
export type WorkerMessageHandler = (scriptId: string, message: WorkerOutbound) => void;

export class WorkerHost {
  private workers: WorkerSlot[] = [];
  private config: WorkerPoolConfig;
  private scriptConfig: ScriptConfig;
  private scriptWorkerMap = new Map<string, number>(); // scriptId → workerId
  private allScripts = new Map<string, ScriptMetadata>();
  private messageHandler: WorkerMessageHandler | null = null;
  private watchdogInterval: ReturnType<typeof setInterval> | null = null;
  private workerUrl: string | URL;
  private nextAssignment = 0; // round-robin counter

  constructor(
    workerUrl: string | URL,
    poolConfig: Partial<WorkerPoolConfig> = {},
    scriptConfig: Partial<ScriptConfig> = {}
  ) {
    this.workerUrl = workerUrl;
    this.config = { ...DEFAULT_POOL_CONFIG, ...poolConfig };
    this.scriptConfig = { ...DEFAULT_SCRIPT_CONFIG, ...scriptConfig };
  }

  /**
   * Start the worker pool. Creates all workers and begins health monitoring.
   */
  start(): void {
    for (let i = 0; i < this.config.poolSize; i++) {
      this.spawnWorker(i);
    }
    this.startWatchdog();
  }

  /**
   * Stop all workers and clean up.
   */
  stop(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    for (const slot of this.workers) {
      slot.worker.terminate();
      slot.alive = false;
    }
    this.workers = [];
    this.scriptWorkerMap.clear();
    this.allScripts.clear();
  }

  /**
   * Set the callback for messages from workers.
   */
  onMessage(handler: WorkerMessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Load a script into the worker pool.
   * Assigns it to the least-loaded worker.
   */
  loadScript(
    scriptId: string,
    code: string,
    name: string,
    containerId: string,
    linkNumber: number
  ): boolean {
    const workerId = this.pickWorker();
    if (workerId === -1) return false;

    const slot = this.workers[workerId];
    if (!slot?.alive) return false;

    // Register the script
    slot.scripts.add(scriptId);
    this.scriptWorkerMap.set(scriptId, workerId);
    this.allScripts.set(scriptId, {
      scriptId,
      containerId,
      linkNumber,
      name,
      workerId,
      state: "loading",
    });

    // Send init message to worker
    this.sendToWorker(workerId, {
      type: "init",
      scriptId,
      code,
      name,
      config: this.scriptConfig,
    });

    return true;
  }

  /**
   * Send an event to a specific script's worker.
   */
  sendEvent(scriptId: string, event: string, args: unknown[]): void {
    const workerId = this.scriptWorkerMap.get(scriptId);
    if (workerId === undefined) return;

    this.sendToWorker(workerId, {
      type: "event",
      scriptId,
      event,
      args,
    });
  }

  /**
   * Send an API response back to a script's worker.
   */
  sendApiResponse(scriptId: string, callId: number, result?: unknown, error?: string): void {
    const workerId = this.scriptWorkerMap.get(scriptId);
    if (workerId === undefined) return;

    this.sendToWorker(workerId, {
      type: "api-response",
      callId,
      result,
      error,
    });
  }

  /**
   * Terminate a specific script.
   */
  terminateScript(scriptId: string): void {
    const workerId = this.scriptWorkerMap.get(scriptId);
    if (workerId === undefined) return;

    const slot = this.workers[workerId];
    if (slot) {
      slot.scripts.delete(scriptId);
    }

    this.sendToWorker(workerId, {
      type: "terminate",
      scriptId,
    });

    this.scriptWorkerMap.delete(scriptId);
    const meta = this.allScripts.get(scriptId);
    if (meta) meta.state = "terminated";
  }

  /**
   * Get metadata for a script.
   */
  getScript(scriptId: string): ScriptMetadata | undefined {
    return this.allScripts.get(scriptId);
  }

  /**
   * Get all scripts in a container.
   */
  getScriptsInContainer(containerId: string): ScriptMetadata[] {
    return Array.from(this.allScripts.values()).filter(
      (s) => s.containerId === containerId && s.state !== "terminated"
    );
  }

  /**
   * Update a script's state.
   */
  setScriptState(scriptId: string, state: ScriptState): void {
    const meta = this.allScripts.get(scriptId);
    if (meta) meta.state = state;
  }

  // === Private Methods ===

  private spawnWorker(id: number): void {
    const worker = new Worker(this.workerUrl, { type: "module" });
    const slot: WorkerSlot = {
      worker,
      id,
      scripts: new Set(),
      lastPong: Date.now(),
      alive: true,
    };

    worker.onmessage = (event: MessageEvent<WorkerOutbound>) => {
      this.handleWorkerMessage(id, event.data);
    };

    worker.onerror = (event) => {
      console.error(`[WorkerHost] Worker ${id} error:`, event.message);
      slot.alive = false;
      this.respawnWorker(id);
    };

    this.workers[id] = slot;
  }

  private handleWorkerMessage(workerId: number, msg: WorkerOutbound): void {
    const slot = this.workers[workerId];

    switch (msg.type) {
      case "pong":
        if (slot) slot.lastPong = msg.timestamp;
        return;

      case "ready": {
        const meta = this.allScripts.get(msg.scriptId);
        if (meta) meta.state = "running";
        break;
      }

      case "error": {
        const meta = this.allScripts.get(msg.scriptId);
        if (meta) meta.state = "error";
        break;
      }
    }

    // Forward all messages to the registered handler
    if (this.messageHandler) {
      const scriptId = "scriptId" in msg ? (msg as any).scriptId as string : "__worker__";
      this.messageHandler(scriptId, msg);
    }
  }

  private sendToWorker(workerId: number, message: WorkerInbound): void {
    const slot = this.workers[workerId];
    if (slot?.alive) {
      slot.worker.postMessage(message);
    }
  }

  /**
   * Pick the worker with the fewest scripts (simple load balancing).
   */
  private pickWorker(): number {
    let bestId = -1;
    let bestCount = Infinity;

    for (const slot of this.workers) {
      if (!slot.alive) continue;
      if (slot.scripts.size >= this.config.maxScriptsPerWorker) continue;
      if (slot.scripts.size < bestCount) {
        bestCount = slot.scripts.size;
        bestId = slot.id;
      }
    }

    return bestId;
  }

  /**
   * Respawn a dead worker and reassign its scripts.
   */
  private respawnWorker(workerId: number): void {
    const oldSlot = this.workers[workerId];
    const orphanedScripts = oldSlot ? [...oldSlot.scripts] : [];

    // Kill the old worker
    if (oldSlot) {
      try { oldSlot.worker.terminate(); } catch { /* already dead */ }
    }

    // Spawn a fresh one
    this.spawnWorker(workerId);

    // Mark orphaned scripts as error state — they need to be reloaded
    for (const scriptId of orphanedScripts) {
      const meta = this.allScripts.get(scriptId);
      if (meta) {
        meta.state = "error";
        meta.workerId = -1;
      }
      this.scriptWorkerMap.delete(scriptId);
    }
  }

  /**
   * Watchdog — ping all workers, terminate unresponsive ones.
   */
  private startWatchdog(): void {
    this.watchdogInterval = setInterval(() => {
      const now = Date.now();

      for (const slot of this.workers) {
        if (!slot.alive) continue;

        // Check if last pong was too long ago
        if (now - slot.lastPong > this.scriptConfig.watchdogTimeout) {
          console.warn(`[WorkerHost] Worker ${slot.id} unresponsive, respawning`);
          slot.alive = false;
          this.respawnWorker(slot.id);
          continue;
        }

        // Send ping
        this.sendToWorker(slot.id, { type: "ping", timestamp: now });
      }
    }, this.scriptConfig.watchdogTimeout / 2);
  }
}
