/**
 * poqpoq Script Engine — Runtime exports
 */

// Core types
export type {
  ScriptState,
  ScriptMetadata,
  ScriptConfig,
  WorkerPoolConfig,
  WorkerInbound,
  WorkerOutbound,
  TimerEntry,
  LinkMessageEntry,
} from "./types.js";
export { DEFAULT_SCRIPT_CONFIG, DEFAULT_POOL_CONFIG } from "./types.js";

// AST Transform
export { transformForSandbox } from "./transform.js";
export type { TransformResult, TransformWarning } from "./transform.js";

// Sandbox
export { initializeSES, createCompartment, evaluateScript } from "./sandbox.js";
export type { ScriptEndowments } from "./sandbox.js";

// Worker management
export { WorkerHost } from "./worker-host.js";
export { Bridge } from "./bridge.js";

// Event system
export { EventDispatcher } from "./event-dispatcher.js";
export { TimerManager } from "./timer-manager.js";
export { LinkMessageBus } from "./link-message-bus.js";

// Script lifecycle
export { ScriptManager } from "./script-manager.js";
export type { LoadScriptOptions, WorldApiResolver } from "./script-manager.js";

// Mock world (testing)
export { MockWorldAPI, MockWorldObject, MockAgent, MockContainer } from "./mock-world.js";
