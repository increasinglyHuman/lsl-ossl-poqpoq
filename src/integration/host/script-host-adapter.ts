/**
 * ScriptHostAdapter — High-level facade for integrating the script engine
 * into a host application (e.g., poqpoq World).
 *
 * Wraps ScriptManager + EventDispatcher + CommandRouter + BundleTranspiler
 * into a clean API that the host calls.
 *
 * Usage from World:
 *   const adapter = new ScriptHostAdapter({ workerUrl: "/worker.js" });
 *   adapter.onScriptCommand(envelope => babylonBridge.execute(envelope));
 *   adapter.start();
 *   adapter.loadBundle(manifestJson, scriptSources);
 *   adapter.dispatchWorldEvent({ targetObjectId: "door", event: { type: "touchStart", ... } });
 */

import { ScriptManager } from "../../runtime/script-manager.js";
import type { LoadScriptOptions } from "../../runtime/script-manager.js";
import type { ScriptConfig, WorkerPoolConfig, ScriptMetadata } from "../../runtime/types.js";
import { BundleParser } from "../bundle/bundle-parser.js";
import { BundleTranspiler } from "../bundle/bundle-transpiler.js";
import type { TranspiledBundle } from "../bundle/bundle-transpiler.js";
import type { TranspileOptions } from "../../transpiler/types.js";
import { CommandRouter } from "./command-router.js";
import type { CommandHandler, ScriptCommandEnvelope } from "../protocol/script-command.js";
import type { ScriptEventEnvelope, ScriptEvent } from "../protocol/script-event.js";

// === Configuration ===

export interface ScriptHostConfig {
  /** URL to the worker entry script */
  workerUrl: string | URL;
  /** Worker pool configuration */
  pool?: Partial<WorkerPoolConfig>;
  /** Default script configuration */
  script?: Partial<ScriptConfig>;
  /** Default transpile options for bundle loading */
  transpile?: Partial<TranspileOptions>;
}

// === Result Types ===

export interface LoadBundleResult {
  /** The transpilation results */
  transpiled: TranspiledBundle;
  /** Script IDs loaded into the runtime, keyed by binding assetPath */
  loadedScripts: Map<string, string>;
  /** Scripts that failed to load */
  failedScripts: string[];
}

export interface ObjectScriptStatus {
  objectId: string;
  scripts: Array<{
    scriptId: string;
    name: string;
    state: string;
  }>;
}

// === Adapter ===

export class ScriptHostAdapter {
  private scriptManager: ScriptManager;
  private commandRouter: CommandRouter;
  private bundleParser: BundleParser;
  private bundleTranspiler: BundleTranspiler;
  private transpileOptions: Partial<TranspileOptions>;

  /** Track which container each script belongs to (for CommandRouter) */
  private scriptContainerMap = new Map<string, string>();

  /** Log handler */
  private logHandler: ((scriptId: string, level: string, args: unknown[]) => void) | null = null;
  /** Error handler */
  private errorHandler: ((scriptId: string, error: string, stack?: string) => void) | null = null;

  constructor(config: ScriptHostConfig) {
    this.scriptManager = new ScriptManager(config.workerUrl, config.pool, config.script);
    this.bundleParser = new BundleParser();
    this.bundleTranspiler = new BundleTranspiler();
    this.transpileOptions = config.transpile ?? {};

    // Create router with container lookup
    this.commandRouter = new CommandRouter(
      (scriptId) => this.scriptContainerMap.get(scriptId) ?? "unknown"
    );

    // Wire the router as the API resolver
    this.scriptManager.setApiResolver(
      (scriptId, method, args) => this.handleApiCall(scriptId, method, args)
    );
  }

  // === Lifecycle ===

  /** Start the runtime — spawn workers, start timer loop. */
  start(): void {
    this.scriptManager.start();
  }

  /** Stop the runtime — terminate all workers, stop timers. */
  stop(): void {
    this.scriptManager.stop();
    this.scriptContainerMap.clear();
  }

  // === Script Loading ===

  /**
   * Load a single TypeScript script onto an object.
   * @returns Script ID, or null on failure.
   */
  loadScript(source: string, objectId: string, options?: { name?: string; linkNumber?: number }): string | null {
    const loadOptions: LoadScriptOptions = {
      containerId: objectId,
      name: options?.name,
      linkNumber: options?.linkNumber,
    };

    const scriptId = this.scriptManager.loadScript(source, loadOptions);
    if (scriptId) {
      this.scriptContainerMap.set(scriptId, objectId);
    }
    return scriptId;
  }

  /**
   * Load all scripts from an OAR bundle.
   *
   * @param manifestJson  The manifest.json contents as a string
   * @param scriptSources Map of assetPath → LSL source code
   * @returns Load results including transpilation diagnostics
   */
  loadBundle(manifestJson: string, scriptSources: Map<string, string>): LoadBundleResult {
    // 1. Parse the manifest
    const bundle = this.bundleParser.parse(manifestJson);

    // 2. Transpile all scripts
    const transpiled = this.bundleTranspiler.transpile(bundle, scriptSources, this.transpileOptions);

    // 3. Load each successful script into the runtime
    const loadedScripts = new Map<string, string>();
    const failedScripts: string[] = [];

    for (const script of transpiled.scripts) {
      if (!script.result.success) {
        failedScripts.push(script.binding.assetPath);
        continue;
      }

      const scriptId = this.scriptManager.loadScript(script.result.code, {
        containerId: script.binding.objectId,
        name: script.binding.scriptName,
      });

      if (scriptId) {
        loadedScripts.set(script.binding.assetPath, scriptId);
        this.scriptContainerMap.set(scriptId, script.binding.objectId);
      } else {
        failedScripts.push(script.binding.assetPath);
      }
    }

    return { transpiled, loadedScripts, failedScripts };
  }

  // === Event Dispatch ===

  /**
   * Forward a world event to scripts on the target object.
   * The host calls this when something happens in the 3D world.
   */
  dispatchWorldEvent(envelope: ScriptEventEnvelope): void {
    const dispatcher = this.scriptManager.getEventDispatcher();
    const event = envelope.event;

    // If targeting a specific script, dispatch directly
    if (envelope.targetScriptId) {
      this.dispatchEventToScript(envelope.targetScriptId, event);
      return;
    }

    // Otherwise dispatch to all scripts on the target object
    switch (event.type) {
      case "touchStart":
        dispatcher.dispatchTouch("onTouchStart", envelope.targetObjectId, event.agent, event.face);
        break;
      case "touch":
        dispatcher.dispatchTouch("onTouch", envelope.targetObjectId, event.agent, event.face);
        break;
      case "touchEnd":
        dispatcher.dispatchTouch("onTouchEnd", envelope.targetObjectId, event.agent, event.face);
        break;

      case "collisionStart":
        dispatcher.dispatchCollision("onCollisionStart", envelope.targetObjectId, event.other);
        break;
      case "collision":
        dispatcher.dispatchCollision("onCollision", envelope.targetObjectId, event.other);
        break;
      case "collisionEnd":
        dispatcher.dispatchCollision("onCollisionEnd", envelope.targetObjectId, event.other);
        break;

      case "listen":
        dispatcher.dispatchChat(event.channel, event.senderName, event.senderId, event.message);
        break;

      case "rez":
        dispatcher.dispatchRez(envelope.targetObjectId, event.startParam);
        break;

      case "changed":
        dispatcher.dispatchChanged(envelope.targetObjectId, event.change);
        break;

      case "money":
        dispatcher.dispatchMoney(envelope.targetObjectId, event.agent, event.amount);
        break;

      case "permissions":
        // Permissions are per-script, not per-object — need targetScriptId
        // If no targetScriptId, dispatch to all scripts on the object
        dispatcher.dispatchToContainer(envelope.targetObjectId, "onPermissions", [event.permissions]);
        break;

      case "sensor":
        // Sensor results go to all scripts on the target
        dispatcher.dispatchToContainer(envelope.targetObjectId, "onSensor", [event.detected]);
        break;

      case "noSensor":
        dispatcher.dispatchToContainer(envelope.targetObjectId, "onNoSensor", []);
        break;

      case "timer":
        // Timer events are typically per-script, handled by TimerManager
        // This path is for external timer events
        dispatcher.dispatchToContainer(envelope.targetObjectId, "onTimer", [event.timerId]);
        break;

      case "dataserver":
        dispatcher.dispatchToContainer(envelope.targetObjectId, "onDataserver", [event.queryId, event.data]);
        break;

      case "httpResponse":
        dispatcher.dispatchToContainer(envelope.targetObjectId, "onHttpResponse", [
          event.requestId, event.status, event.headers, event.body,
        ]);
        break;

      // poqpoq extensions
      case "playerEnterZone":
        dispatcher.dispatchToContainer(envelope.targetObjectId, "onPlayerEnterZone", [event.agent, event.zoneId, event.zoneName]);
        break;

      case "playerLeaveZone":
        dispatcher.dispatchToContainer(envelope.targetObjectId, "onPlayerLeaveZone", [event.agent, event.zoneId, event.zoneName]);
        break;

      case "dayNightCycle":
        dispatcher.dispatchToContainer(envelope.targetObjectId, "onDayNightCycle", [event.phase, event.hour]);
        break;

      case "weatherChange":
        dispatcher.dispatchToContainer(envelope.targetObjectId, "onWeatherChange", [event.weather, event.intensity]);
        break;
    }
  }

  // === Command Handling ===

  /**
   * Register a handler for commands from scripts.
   * The host implements this to translate commands into Babylon.js calls.
   */
  onScriptCommand(handler: CommandHandler): void {
    this.commandRouter.onCommand(handler);
  }

  // === Query ===

  /** Get script status for a specific object. */
  getScriptStatus(objectId: string): ObjectScriptStatus {
    const scripts = this.scriptManager.getScriptsInContainer(objectId);
    return {
      objectId,
      scripts: scripts.map((s) => ({
        scriptId: s.scriptId,
        name: s.name,
        state: s.state,
      })),
    };
  }

  /** Get script status for all objects with scripts. */
  getAllScriptStatus(): ObjectScriptStatus[] {
    const objectIds = new Set<string>(this.scriptContainerMap.values());
    return Array.from(objectIds).map((id) => this.getScriptStatus(id));
  }

  // === Cleanup ===

  /** Remove all scripts from an object. */
  removeObject(objectId: string): void {
    const scripts = this.scriptManager.getScriptsInContainer(objectId);
    for (const script of scripts) {
      this.scriptManager.terminateScript(script.scriptId);
      this.scriptContainerMap.delete(script.scriptId);
    }
  }

  // === Logging ===

  /** Set a custom log handler. */
  onLog(handler: (scriptId: string, level: string, args: unknown[]) => void): void {
    this.logHandler = handler;
    this.scriptManager.setLogHandler(handler);
  }

  /** Set a custom error handler. */
  onError(handler: (scriptId: string, error: string, stack?: string) => void): void {
    this.errorHandler = handler;
    this.scriptManager.setErrorHandler(handler);
  }

  // === Internal ===

  /** Get the underlying ScriptManager (for advanced use / testing). */
  getScriptManager(): ScriptManager {
    return this.scriptManager;
  }

  /** Get the underlying CommandRouter (for advanced use / testing). */
  getCommandRouter(): CommandRouter {
    return this.commandRouter;
  }

  /**
   * Handle an API call from a script. Routes to CommandRouter,
   * falls through to undefined for built-in methods.
   */
  private handleApiCall(scriptId: string, method: string, args: unknown[]): unknown | Promise<unknown> {
    return this.commandRouter.resolve(scriptId, method, args);
  }

  /**
   * Dispatch a typed event to a specific script.
   */
  private dispatchEventToScript(scriptId: string, event: ScriptEvent): void {
    const dispatcher = this.scriptManager.getEventDispatcher();

    switch (event.type) {
      case "touchStart":
        dispatcher.dispatchToScript(scriptId, "onTouchStart", [event.agent, event.face]);
        break;
      case "touch":
        dispatcher.dispatchToScript(scriptId, "onTouch", [event.agent, event.face]);
        break;
      case "touchEnd":
        dispatcher.dispatchToScript(scriptId, "onTouchEnd", [event.agent, event.face]);
        break;
      case "timer":
        dispatcher.dispatchToScript(scriptId, "onTimer", [event.timerId]);
        break;
      case "sensor":
        dispatcher.dispatchToScript(scriptId, "onSensor", [event.detected]);
        break;
      case "noSensor":
        dispatcher.dispatchToScript(scriptId, "onNoSensor", []);
        break;
      case "permissions":
        dispatcher.dispatchToScript(scriptId, "onPermissions", [event.permissions]);
        break;
      default:
        // For all other events, use the generic dispatcher
        dispatcher.dispatchToScript(scriptId, `on${event.type.charAt(0).toUpperCase()}${event.type.slice(1)}`, [event]);
        break;
    }
  }
}
