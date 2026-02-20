/**
 * Integration Layer — Connects the script engine to a host application.
 *
 * Three sub-modules:
 *   protocol/  — ScriptCommand + ScriptEvent typed contracts
 *   bundle/    — OAR bundle parser + batch transpiler
 *   host/      — ScriptHostAdapter + CommandRouter
 */

// Protocol types
export type {
  Vec3,
  Quat,
  Color,
  ScriptCommand,
  ScriptCommandType,
  ScriptCommandEnvelope,
  CommandHandler,
} from "./protocol/index.js";

export type {
  AgentInfo,
  ObjectInfo,
  ScriptEvent,
  ScriptEventType,
  ScriptEventEnvelope,
} from "./protocol/index.js";

// Bundle
export { BundleParser } from "./bundle/index.js";
export { BundleTranspiler } from "./bundle/index.js";
export type {
  BundleManifest,
  BundleObject,
  BundleAsset,
  ScriptBinding,
  ParsedBundle,
  TranspiledBundle,
  TranspiledScript,
  BundleDiagnostic,
  ValidationError,
} from "./bundle/index.js";

// Host
export { CommandRouter } from "./host/index.js";
export { ScriptHostAdapter } from "./host/index.js";
export type {
  ScriptHostConfig,
  LoadBundleResult,
  ObjectScriptStatus,
} from "./host/index.js";
