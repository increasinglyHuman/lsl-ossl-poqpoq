/**
 * Runtime types — Bridge protocol, script metadata, lifecycle states.
 * Defines the contract between Main Thread and Worker Pool.
 */

// === Script Lifecycle ===

export type ScriptState = "loading" | "running" | "paused" | "terminated" | "error";

export interface ScriptMetadata {
  /** Unique script instance ID */
  readonly scriptId: string;
  /** Container (object) this script belongs to */
  readonly containerId: string;
  /** Link number within the container's linkset (0 = root) */
  readonly linkNumber: number;
  /** Human-readable script name */
  readonly name: string;
  /** Which worker this script is assigned to */
  workerId: number;
  /** Current lifecycle state */
  state: ScriptState;
}

// === Bridge Protocol: Main Thread → Worker ===

export interface InitMessage {
  readonly type: "init";
  readonly scriptId: string;
  readonly code: string;
  readonly name: string;
  /** Serialized endowment configuration (not the objects themselves) */
  readonly config: ScriptConfig;
}

export interface EventMessage {
  readonly type: "event";
  readonly scriptId: string;
  readonly event: string;
  readonly args: unknown[];
}

export interface ApiResponseMessage {
  readonly type: "api-response";
  readonly callId: number;
  readonly result?: unknown;
  readonly error?: string;
}

export interface TerminateMessage {
  readonly type: "terminate";
  readonly scriptId: string;
}

export interface PingMessage {
  readonly type: "ping";
  readonly timestamp: number;
}

export type WorkerInbound =
  | InitMessage
  | EventMessage
  | ApiResponseMessage
  | TerminateMessage
  | PingMessage;

// === Bridge Protocol: Worker → Main Thread ===

export interface ApiCallMessage {
  readonly type: "api-call";
  readonly scriptId: string;
  readonly callId: number;
  readonly method: string;
  readonly args: unknown[];
}

export interface ReadyMessage {
  readonly type: "ready";
  readonly scriptId: string;
}

export interface ErrorMessage {
  readonly type: "error";
  readonly scriptId: string;
  readonly error: string;
  readonly stack?: string;
}

export interface LogMessage {
  readonly type: "log";
  readonly scriptId: string;
  readonly level: "log" | "warn" | "error";
  readonly args: unknown[];
}

export interface PongMessage {
  readonly type: "pong";
  readonly timestamp: number;
}

export type WorkerOutbound =
  | ApiCallMessage
  | ReadyMessage
  | ErrorMessage
  | LogMessage
  | PongMessage;

// === Script Configuration ===

export interface ScriptConfig {
  /** Maximum loop iterations before termination (default: 1_000_000) */
  readonly maxIterations: number;
  /** Maximum call stack depth (default: 256) */
  readonly maxCallDepth: number;
  /** Watchdog timeout in ms — worker killed if unresponsive (default: 5000) */
  readonly watchdogTimeout: number;
  /** Maximum pending link messages per script (default: 64, matches LSL) */
  readonly maxLinkMessageQueue: number;
}

export const DEFAULT_SCRIPT_CONFIG: ScriptConfig = {
  maxIterations: 1_000_000,
  maxCallDepth: 256,
  watchdogTimeout: 5_000,
  maxLinkMessageQueue: 64,
};

// === Worker Pool Configuration ===

export interface WorkerPoolConfig {
  /** Number of workers in the pool (default: 4) */
  readonly poolSize: number;
  /** Maximum scripts per worker before refusing new scripts (default: 50) */
  readonly maxScriptsPerWorker: number;
}

export const DEFAULT_POOL_CONFIG: WorkerPoolConfig = {
  poolSize: 4,
  maxScriptsPerWorker: 50,
};

// === Timer Types ===

export interface TimerEntry {
  readonly scriptId: string;
  readonly timerId: string;
  readonly interval: number;
  readonly repeating: boolean;
  nextFire: number;
}

// === Link Message Types ===

export interface LinkMessageEntry {
  readonly senderScriptId: string;
  readonly senderLink: number;
  readonly num: number;
  readonly str: string;
  readonly id: string;
}
