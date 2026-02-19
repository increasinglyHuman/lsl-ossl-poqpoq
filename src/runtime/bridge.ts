/**
 * Bridge — Main thread ↔ Worker communication layer.
 *
 * Handles:
 * - Routing API calls from workers to the correct handler (WorldAPI, ObjectAPI, etc.)
 * - Async request-response matching (callId → Promise resolver)
 * - Command batching (aggregate API calls per frame)
 * - Error propagation back to scripts
 */

import type { WorkerHost } from "./worker-host.js";
import type { WorkerOutbound, ApiCallMessage, LogMessage, ErrorMessage } from "./types.js";

/** Handler for a specific API method call */
export type ApiMethodHandler = (
  scriptId: string,
  method: string,
  args: unknown[]
) => unknown | Promise<unknown>;

/** Callback for script log messages */
export type LogHandler = (scriptId: string, level: "log" | "warn" | "error", args: unknown[]) => void;

/** Callback for script errors */
export type ErrorHandler = (scriptId: string, error: string, stack?: string) => void;

/** Callback when a script becomes ready */
export type ReadyHandler = (scriptId: string) => void;

export class Bridge {
  private workerHost: WorkerHost;
  private apiHandler: ApiMethodHandler | null = null;
  private logHandler: LogHandler | null = null;
  private errorHandler: ErrorHandler | null = null;
  private readyHandler: ReadyHandler | null = null;

  /** Queued API calls waiting to be processed (for batching) */
  private pendingBatch: ApiCallMessage[] = [];
  private batchScheduled = false;

  constructor(workerHost: WorkerHost) {
    this.workerHost = workerHost;

    // Wire up the worker message handler
    this.workerHost.onMessage((_scriptId, msg) => this.handleWorkerMessage(msg));
  }

  /**
   * Set the handler for API method calls from scripts.
   * This is the main integration point where script calls
   * like `this.object.setPosition(pos)` are resolved.
   */
  onApiCall(handler: ApiMethodHandler): void {
    this.apiHandler = handler;
  }

  /**
   * Set the handler for script log messages.
   */
  onLog(handler: LogHandler): void {
    this.logHandler = handler;
  }

  /**
   * Set the handler for script errors.
   */
  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  /**
   * Set the handler for script ready events.
   */
  onReady(handler: ReadyHandler): void {
    this.readyHandler = handler;
  }

  /**
   * Process a batch of API calls.
   * Called once per frame (or immediately for synchronous processing).
   */
  flush(): void {
    const batch = this.pendingBatch;
    this.pendingBatch = [];
    this.batchScheduled = false;

    for (const call of batch) {
      this.processApiCall(call);
    }
  }

  // === Private Methods ===

  private handleWorkerMessage(msg: WorkerOutbound): void {
    switch (msg.type) {
      case "api-call":
        this.enqueueApiCall(msg);
        break;

      case "log":
        if (this.logHandler) {
          this.logHandler(msg.scriptId, msg.level, msg.args);
        }
        break;

      case "error":
        if (this.errorHandler) {
          this.errorHandler(msg.scriptId, msg.error, msg.stack);
        }
        break;

      case "ready":
        if (this.readyHandler) {
          this.readyHandler(msg.scriptId);
        }
        break;

      case "pong":
        // Handled by WorkerHost directly
        break;
    }
  }

  /**
   * Queue an API call for batched processing.
   * Schedules a microtask to flush the batch.
   */
  private enqueueApiCall(call: ApiCallMessage): void {
    this.pendingBatch.push(call);

    if (!this.batchScheduled) {
      this.batchScheduled = true;
      // Use queueMicrotask for same-frame processing
      queueMicrotask(() => this.flush());
    }
  }

  /**
   * Process a single API call and send the response back.
   */
  private async processApiCall(call: ApiCallMessage): Promise<void> {
    if (!this.apiHandler) {
      this.workerHost.sendApiResponse(
        call.scriptId,
        call.callId,
        undefined,
        "No API handler registered"
      );
      return;
    }

    try {
      const result = await this.apiHandler(call.scriptId, call.method, call.args);
      this.workerHost.sendApiResponse(call.scriptId, call.callId, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.workerHost.sendApiResponse(call.scriptId, call.callId, undefined, message);
    }
  }
}
