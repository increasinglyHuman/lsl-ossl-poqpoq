/**
 * Worker Entry — Code that runs INSIDE each Web Worker.
 *
 * Each worker:
 * 1. Calls lockdown() once on startup (freezes intrinsics)
 * 2. Hosts multiple scripts, each in its own SES Compartment
 * 3. Routes events to correct script handlers
 * 4. Forwards API calls back to main thread via postMessage
 *
 * Communication: Main Thread ←→ Worker via postMessage (typed bridge protocol)
 */

import { initializeSES, createCompartment, evaluateScript } from "./sandbox.js";
import type { ScriptEndowments } from "./sandbox.js";
import type {
  WorkerInbound,
  WorkerOutbound,
  ScriptConfig,
  ApiCallMessage,
} from "./types.js";
import { DEFAULT_SCRIPT_CONFIG } from "./types.js";

// === Script Instance Management ===

interface ScriptInstance {
  /** Script ID */
  id: string;
  /** The instantiated script object */
  instance: any;
  /** Current state name */
  currentState: string;
  /** State definitions from the script */
  states: Record<string, Record<string, (...args: unknown[]) => unknown>>;
}

/** Active script instances in this worker, keyed by scriptId */
const scripts = new Map<string, ScriptInstance>();

/** Auto-incrementing call ID for async API requests */
let nextCallId = 0;

/** Pending async API call resolvers */
const pendingCalls = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

// === Worker Initialization ===

/**
 * Send a typed message to the main thread.
 */
function sendToMain(message: WorkerOutbound): void {
  self.postMessage(message);
}

/**
 * Create an API proxy that forwards method calls to the main thread.
 * Every call returns a Promise that resolves when the main thread responds.
 */
function createAPIProxy(scriptId: string, namespace: string): Record<string, (...args: unknown[]) => unknown> {
  return new Proxy({} as Record<string, (...args: unknown[]) => unknown>, {
    get(_target, prop: string) {
      return (...args: unknown[]): Promise<unknown> => {
        const callId = nextCallId++;
        const method = `${namespace}.${prop}`;

        return new Promise((resolve, reject) => {
          pendingCalls.set(callId, { resolve, reject });

          sendToMain({
            type: "api-call",
            scriptId,
            callId,
            method,
            args,
          } satisfies ApiCallMessage);
        });
      };
    },
  });
}

/**
 * Create a console proxy that forwards log calls to the main thread.
 */
function createConsoleProxy(scriptId: string): Pick<Console, "log" | "warn" | "error"> {
  return {
    log: (...args: unknown[]) => sendToMain({ type: "log", scriptId, level: "log", args }),
    warn: (...args: unknown[]) => sendToMain({ type: "log", scriptId, level: "warn", args }),
    error: (...args: unknown[]) => sendToMain({ type: "log", scriptId, level: "error", args }),
  };
}

/**
 * Initialize and instantiate a script in a new Compartment.
 */
function initScript(
  scriptId: string,
  code: string,
  name: string,
  config: ScriptConfig
): void {
  try {
    const exports: Record<string, unknown> = {};

    const endowments: ScriptEndowments = {
      console: createConsoleProxy(scriptId),
      __worldAPI: createAPIProxy(scriptId, "world"),
      __objectAPI: createAPIProxy(scriptId, "object"),
      __containerAPI: createAPIProxy(scriptId, "container"),
      __owner: { id: "", name: "", username: "" }, // Injected by main thread
      __scriptId: scriptId,
      __exports: exports,
    };

    const compartment = createCompartment(name, endowments);
    evaluateScript(compartment, code);

    const ScriptClass = exports.default;
    if (!ScriptClass || typeof ScriptClass !== "function") {
      sendToMain({
        type: "error",
        scriptId,
        error: "Script did not export a default class",
      });
      return;
    }

    // Instantiate the script class
    const instance = new (ScriptClass as new () => any)();

    // Inject runtime properties via Object.defineProperty (bypasses readonly)
    Object.defineProperty(instance, "scriptId", { value: scriptId, writable: false });
    Object.defineProperty(instance, "world", { value: createAPIProxy(scriptId, "world"), writable: false });
    Object.defineProperty(instance, "object", { value: createAPIProxy(scriptId, "object"), writable: false });
    Object.defineProperty(instance, "container", { value: createAPIProxy(scriptId, "container"), writable: false });
    Object.defineProperty(instance, "owner", { value: endowments.__owner, writable: false });

    // Register the script
    scripts.set(scriptId, {
      id: scriptId,
      instance,
      currentState: "default",
      states: instance.states ?? {},
    });

    sendToMain({ type: "ready", scriptId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendToMain({ type: "error", scriptId, error: message, stack: err instanceof Error ? err.stack : undefined });
  }
}

/**
 * Dispatch an event to a script's appropriate handler.
 * Resolution order: state handler first, then global handler.
 */
async function dispatchEvent(
  scriptId: string,
  event: string,
  args: unknown[]
): Promise<void> {
  const script = scripts.get(scriptId);
  if (!script) return;

  const { instance, currentState, states } = script;

  try {
    // 1. State-specific handler
    const stateHandler = states[currentState]?.[event];
    if (typeof stateHandler === "function") {
      await stateHandler.call(instance, ...args);
    }

    // 2. Global handler (on the class itself)
    const globalHandler = instance[event];
    if (typeof globalHandler === "function" && globalHandler !== stateHandler) {
      await globalHandler.call(instance, ...args);
    }

    // Track state changes from transitionTo()
    if (instance._currentState !== undefined) {
      script.currentState = instance._currentState;
    } else if (instance.currentState !== undefined) {
      script.currentState = instance.currentState;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendToMain({
      type: "error",
      scriptId,
      error: `Event ${event}: ${message}`,
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}

/**
 * Terminate a script — remove from registry, allow GC.
 */
function terminateScript(scriptId: string): void {
  scripts.delete(scriptId);
}

// === Message Handler ===

/**
 * Main message handler — routes inbound messages from main thread.
 */
self.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init":
      initScript(msg.scriptId, msg.code, msg.name, msg.config);
      break;

    case "event":
      dispatchEvent(msg.scriptId, msg.event, msg.args);
      break;

    case "api-response": {
      const pending = pendingCalls.get(msg.callId);
      if (pending) {
        pendingCalls.delete(msg.callId);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
      break;
    }

    case "terminate":
      terminateScript(msg.scriptId);
      break;

    case "ping":
      sendToMain({ type: "pong", timestamp: msg.timestamp });
      break;
  }
};

// === SES Initialization ===

// Initialize SES lockdown immediately when the worker starts.
// This freezes all intrinsics before any script code runs.
try {
  initializeSES();
} catch (err) {
  // If SES fails to initialize, the worker is unusable
  sendToMain({
    type: "error",
    scriptId: "__worker__",
    error: `SES initialization failed: ${err instanceof Error ? err.message : String(err)}`,
  });
}
