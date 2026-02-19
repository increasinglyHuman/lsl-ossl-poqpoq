/**
 * SES Sandbox — Creates isolated execution compartments for user scripts.
 *
 * Uses Hardened JavaScript (SES) to provide:
 * - Frozen intrinsics (Object.prototype, Array.prototype, etc. are immutable)
 * - Per-script Compartments with curated endowments
 * - No access to DOM, fetch, WebSocket, or any browser APIs
 * - harden() makes endowments tamper-proof
 *
 * This runs INSIDE a Web Worker (already thread-isolated).
 * Together: Worker isolation + SES isolation = defense in depth.
 */

// SES types — the ses package provides these globally after lockdown()
declare function lockdown(options?: {
  errorTaming?: "safe" | "unsafe";
  errorTrapping?: "platform" | "exit" | "abort" | "report" | "none";
  unhandledRejectionTrapping?: "report" | "none";
  consoleTaming?: "safe" | "unsafe";
  overrideTaming?: "moderate" | "min" | "severe";
  stackFiltering?: "concise" | "verbose";
}): void;

declare function harden<T>(obj: T): T;

declare class Compartment {
  constructor(
    endowments?: Record<string, unknown>,
    modules?: Record<string, unknown>,
    options?: { name?: string }
  );
  evaluate(code: string): unknown;
  globalThis: Record<string, unknown>;
}

/** Whether lockdown() has been called in this realm */
let locked = false;

/**
 * Initialize SES in the current realm (call once per Worker).
 * Freezes all JavaScript intrinsics — irreversible.
 */
export function initializeSES(): void {
  if (locked) return;

  lockdown({
    // "unsafe" errorTaming preserves stack traces for debugging
    errorTaming: "unsafe",
    // Report unhandled rejections rather than crashing
    unhandledRejectionTrapping: "report",
    // Preserve console for debugging
    consoleTaming: "unsafe",
    // "moderate" allows safe override of frozen properties via assignment
    overrideTaming: "moderate",
    // Verbose stacks during development
    stackFiltering: "verbose",
  });

  locked = true;
}

/** Endowments provided to every sandboxed script */
export interface ScriptEndowments {
  /** Proxied console (log/warn/error forwarded to main thread) */
  console: Pick<Console, "log" | "warn" | "error">;
  /** World API proxy (all calls become postMessage to main thread) */
  __worldAPI: Record<string, (...args: unknown[]) => unknown>;
  /** Object API proxy (this.object methods) */
  __objectAPI: Record<string, (...args: unknown[]) => unknown>;
  /** Container API proxy (this.container methods) */
  __containerAPI: Record<string, (...args: unknown[]) => unknown>;
  /** Owner data (read-only agent info) */
  __owner: { id: string; name: string; username: string };
  /** Script metadata */
  __scriptId: string;
  /** Export collection point */
  __exports: Record<string, unknown>;
}

/**
 * Create a sandboxed Compartment for a single script.
 *
 * @param endowments The curated API surface the script can access
 * @returns The Compartment instance, ready for evaluate()
 */
export function createCompartment(
  name: string,
  endowments: ScriptEndowments
): Compartment {
  if (!locked) {
    throw new Error("SES not initialized — call initializeSES() first");
  }

  // Harden all endowments to prevent the script from modifying them
  const hardened = harden({
    console: endowments.console,
    __worldAPI: endowments.__worldAPI,
    __objectAPI: endowments.__objectAPI,
    __containerAPI: endowments.__containerAPI,
    __owner: endowments.__owner,
    __scriptId: endowments.__scriptId,
    __exports: endowments.__exports,
    // Safe globals that SES already freezes but we explicitly provide
    Math,
    JSON,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    encodeURIComponent,
    decodeURI,
    decodeURIComponent,
    // No: fetch, XMLHttpRequest, WebSocket, Worker, eval, Function, Proxy, Reflect
    // No: window, document, location, navigator, self, globalThis
    // No: setTimeout, setInterval (proxied through timer manager)
  });

  return new Compartment(hardened, {}, { name: `script:${name}` });
}

/**
 * Evaluate transformed code inside a Compartment.
 * Returns the script class (the default export).
 *
 * @param compartment The SES Compartment
 * @param code Transformed code (from transform.ts)
 * @returns The exported script class, or null on error
 */
export function evaluateScript(
  compartment: Compartment,
  code: string
): { scriptClass: unknown; error?: string } {
  try {
    compartment.evaluate(code);

    // The transformed code assigns to __exports.default
    const exports = compartment.globalThis.__exports as Record<string, unknown>;
    const scriptClass = exports?.default;

    if (!scriptClass) {
      return {
        scriptClass: null,
        error: "Script did not export a default class",
      };
    }

    return { scriptClass };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { scriptClass: null, error: message };
  }
}
