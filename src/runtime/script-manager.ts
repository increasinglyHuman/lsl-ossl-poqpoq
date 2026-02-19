/**
 * Script Manager — Full lifecycle orchestration.
 *
 * load → compile → transform → inject → run → pause → resume → terminate
 *
 * This is the main entry point for the runtime. Users of the engine call:
 *   scriptManager.loadScript(source, containerId, options)
 *
 * And the manager handles everything: compilation, safety transforms,
 * worker assignment, event wiring, timer management, and cleanup.
 */

import type { ScriptConfig, WorkerPoolConfig, ScriptMetadata, WorkerOutbound } from "./types.js";
import { DEFAULT_SCRIPT_CONFIG, DEFAULT_POOL_CONFIG } from "./types.js";
import { transformForSandbox } from "./transform.js";
import { WorkerHost } from "./worker-host.js";
import { Bridge } from "./bridge.js";
import { TimerManager } from "./timer-manager.js";
import { LinkMessageBus } from "./link-message-bus.js";
import { EventDispatcher } from "./event-dispatcher.js";
import type { LinkTarget } from "../types/script-container.js";

/** Options for loading a script */
export interface LoadScriptOptions {
  /** Script name (human-readable) */
  name?: string;
  /** Container (object) ID this script belongs to */
  containerId: string;
  /** Link number within the linkset (0 = root, default: 0) */
  linkNumber?: number;
  /** Override script config */
  config?: Partial<ScriptConfig>;
}

/** API handler that the engine provides to resolve script API calls */
export type WorldApiResolver = (
  scriptId: string,
  method: string,
  args: unknown[]
) => unknown | Promise<unknown>;

export class ScriptManager {
  private workerHost: WorkerHost;
  private bridge: Bridge;
  private timerManager: TimerManager;
  private linkMessageBus: LinkMessageBus;
  private eventDispatcher: EventDispatcher;
  private scriptConfig: ScriptConfig;
  private apiResolver: WorldApiResolver | null = null;
  private scriptSources = new Map<string, string>(); // scriptId → original source

  /** Log handler — defaults to console */
  private logHandler: (scriptId: string, level: string, args: unknown[]) => void =
    (_id, level, args) => {
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn(`[Script]`, ...args);
    };

  /** Error handler — defaults to console.error */
  private errorHandler: (scriptId: string, error: string, stack?: string) => void =
    (id, error, stack) => console.error(`[Script ${id}] Error:`, error, stack ?? "");

  constructor(
    workerUrl: string | URL,
    poolConfig: Partial<WorkerPoolConfig> = {},
    scriptConfig: Partial<ScriptConfig> = {}
  ) {
    this.scriptConfig = { ...DEFAULT_SCRIPT_CONFIG, ...scriptConfig };

    // Create components
    this.workerHost = new WorkerHost(workerUrl, poolConfig, scriptConfig);
    this.bridge = new Bridge(this.workerHost);
    this.timerManager = new TimerManager();
    this.linkMessageBus = new LinkMessageBus(this.scriptConfig.maxLinkMessageQueue);
    this.eventDispatcher = new EventDispatcher(
      this.workerHost,
      this.timerManager,
      this.linkMessageBus
    );

    // Wire up bridge handlers
    this.bridge.onApiCall((scriptId, method, args) => this.handleApiCall(scriptId, method, args));
    this.bridge.onLog((scriptId, level, args) => this.logHandler(scriptId, level, args));
    this.bridge.onError((scriptId, error, stack) => this.errorHandler(scriptId, error, stack));
    this.bridge.onReady((scriptId) => this.handleScriptReady(scriptId));
  }

  /**
   * Start the runtime — spawn workers, start timer loop.
   */
  start(): void {
    this.workerHost.start();
    this.timerManager.start();
  }

  /**
   * Stop the runtime — terminate all workers, stop timers.
   */
  stop(): void {
    this.timerManager.stop();
    this.workerHost.stop();
  }

  /**
   * Set the World API resolver — called for every API call from scripts.
   * This is the integration point between the runtime and the engine.
   */
  setApiResolver(resolver: WorldApiResolver): void {
    this.apiResolver = resolver;
  }

  /**
   * Set custom log handler.
   */
  setLogHandler(handler: (scriptId: string, level: string, args: unknown[]) => void): void {
    this.logHandler = handler;
  }

  /**
   * Set custom error handler.
   */
  setErrorHandler(handler: (scriptId: string, error: string, stack?: string) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Load a script into the runtime.
   *
   * @param source TypeScript or JavaScript source code
   * @param options Loading options (container, link number, etc.)
   * @returns Script ID, or null on failure
   */
  loadScript(source: string, options: LoadScriptOptions): string | null {
    const scriptId = generateScriptId();
    const name = options.name ?? `script_${scriptId.slice(0, 8)}`;
    const linkNumber = options.linkNumber ?? 0;

    // 1. Transform the code for sandbox safety
    const transformed = transformForSandbox(source, options.config ?? this.scriptConfig);
    if (!transformed.success) {
      this.errorHandler(scriptId, `Transform failed: ${transformed.error}`);
      return null;
    }

    // Log warnings
    for (const warn of transformed.warnings) {
      this.logHandler(scriptId, "warn", [`Transform: ${warn.message}`]);
    }

    // 2. Store original source (for reset)
    this.scriptSources.set(scriptId, source);

    // 3. Register with link message bus
    this.linkMessageBus.register(scriptId, options.containerId, linkNumber);

    // 4. Load into worker
    const success = this.workerHost.loadScript(
      scriptId,
      transformed.code,
      name,
      options.containerId,
      linkNumber
    );

    if (!success) {
      this.errorHandler(scriptId, "Failed to assign script to worker pool");
      this.linkMessageBus.unregister(scriptId);
      this.scriptSources.delete(scriptId);
      return null;
    }

    return scriptId;
  }

  /**
   * Terminate a script and clean up all resources.
   */
  terminateScript(scriptId: string): void {
    this.eventDispatcher.cleanupScript(scriptId);
    this.workerHost.terminateScript(scriptId);
    this.scriptSources.delete(scriptId);
  }

  /**
   * Reset a script — terminate and reload from original source.
   */
  resetScript(scriptId: string): void {
    const source = this.scriptSources.get(scriptId);
    const meta = this.workerHost.getScript(scriptId);
    if (!source || !meta) return;

    const { containerId, linkNumber, name } = meta;

    // Terminate old instance
    this.terminateScript(scriptId);

    // Reload with a new ID
    this.loadScript(source, { name, containerId, linkNumber });
  }

  /**
   * Get the event dispatcher (for external event sources to push events).
   */
  getEventDispatcher(): EventDispatcher {
    return this.eventDispatcher;
  }

  /**
   * Get the timer manager (for testing/inspection).
   */
  getTimerManager(): TimerManager {
    return this.timerManager;
  }

  /**
   * Get the link message bus (for testing/inspection).
   */
  getLinkMessageBus(): LinkMessageBus {
    return this.linkMessageBus;
  }

  /**
   * Get metadata for a script.
   */
  getScript(scriptId: string): ScriptMetadata | undefined {
    return this.workerHost.getScript(scriptId);
  }

  /**
   * Get all scripts in a container.
   */
  getScriptsInContainer(containerId: string): ScriptMetadata[] {
    return this.workerHost.getScriptsInContainer(containerId);
  }

  // === Private Methods ===

  /**
   * Handle API calls from scripts, routing to the appropriate handler.
   */
  private async handleApiCall(
    scriptId: string,
    method: string,
    args: unknown[]
  ): Promise<unknown> {
    // Handle built-in methods that the runtime itself implements
    const builtIn = this.handleBuiltInCall(scriptId, method, args);
    if (builtIn !== undefined) return builtIn;

    // Forward to the engine's API resolver
    if (this.apiResolver) {
      return this.apiResolver(scriptId, method, args);
    }

    throw new Error(`No handler for API method: ${method}`);
  }

  /**
   * Handle API methods that the runtime implements directly.
   */
  private handleBuiltInCall(
    scriptId: string,
    method: string,
    args: unknown[]
  ): unknown | undefined {
    switch (method) {
      // Timer methods
      case "world.setTimer": {
        const [interval, timerId] = args as [number, string?];
        const id = this.timerManager.setTimer(scriptId, interval, timerId);
        return { id, cancel: () => this.timerManager.clearTimer(scriptId, id) };
      }
      case "world.clearTimer": {
        const [timerId] = args as [string?];
        this.timerManager.clearTimer(scriptId, timerId ?? "default");
        return undefined;
      }
      case "world.setTimeout": {
        const [_callback, ms] = args as [unknown, number];
        const id = `__oneshot_${Date.now()}`;
        this.timerManager.setOneShot(scriptId, ms / 1000, id);
        return undefined;
      }

      // Communication
      case "world.listen": {
        const [channel, name, id, message] = args as [number, string?, string?, string?];
        const handle = this.eventDispatcher.registerListen(scriptId, channel, name, id, message);
        return { id: handle, remove: () => this.eventDispatcher.removeListen(handle) };
      }

      // Link messages
      case "container.sendLinkMessage": {
        const [link, num, str, id] = args as [LinkTarget, number, string, string];
        this.linkMessageBus.send(scriptId, link, num, str, id);
        return undefined;
      }

      // Logging
      case "world.log": {
        this.logHandler(scriptId, "log", args);
        return undefined;
      }

      // Script reset
      case "world.resetScript": {
        this.resetScript(scriptId);
        return undefined;
      }

      default:
        return undefined; // Not a built-in, fall through to API resolver
    }
  }

  /**
   * Handle a script becoming ready (initialization complete).
   */
  private handleScriptReady(scriptId: string): void {
    this.workerHost.setScriptState(scriptId, "running");

    // Fire the onRez/onScriptReset event
    this.eventDispatcher.dispatchToScript(scriptId, "onScriptReset", []);
  }
}

/**
 * Generate a unique script ID.
 * Uses crypto.randomUUID if available, falls back to simple random.
 */
function generateScriptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
