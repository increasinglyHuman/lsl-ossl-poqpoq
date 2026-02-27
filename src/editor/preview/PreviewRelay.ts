/**
 * PreviewRelay — Forwards ScriptCommand envelopes to a Glitch iframe via postMessage.
 *
 * Implements the same CommandHandler signature as ReferenceBabylonBridge,
 * but instead of calling Babylon.js, it relays commands across the iframe boundary.
 *
 * @see ADR-005 (Glitch Preview Integration)
 */

import type { ScriptCommandEnvelope } from "../../integration/protocol/script-command.js";

export type ConsoleCallback = (data: {
  channel: number;
  message: string;
  verb: string;
  senderName: string;
}) => void;

export class PreviewRelay {
  private iframe: HTMLIFrameElement;
  private consoleCallback: ConsoleCallback | null = null;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
  }

  /**
   * CommandHandler-compatible function for ScriptHostAdapter.
   * Forwards the envelope to the Glitch iframe via postMessage.
   */
  handle = (envelope: ScriptCommandEnvelope): unknown => {
    const cmd = envelope.command;

    // Intercept communication commands for the editor console
    if (cmd.type === "say" || cmd.type === "whisper" || cmd.type === "shout") {
      const chatCmd = cmd as { type: string; channel: number; message: string };
      this.consoleCallback?.({
        channel: chatCmd.channel,
        message: chatCmd.message,
        verb: cmd.type,
        senderName: envelope.containerId,
      });
    }

    // Forward all commands to Glitch
    this.iframe.contentWindow?.postMessage(
      { type: "scripter_command", source: "scripter", envelope },
      "*",
    );

    return undefined;
  };

  /**
   * Send a reset signal to Glitch (clears scene, disposes all objects).
   */
  sendReset(): void {
    this.iframe.contentWindow?.postMessage(
      { type: "scripter_reset", source: "scripter" },
      "*",
    );
  }

  /**
   * Send a create-prim command to Glitch (sets up root object before script runs).
   */
  sendCreatePrim(options: {
    objectId: string;
    primType?: number;
    position?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    name?: string;
  }): void {
    this.iframe.contentWindow?.postMessage(
      { type: "scripter_create_prim", source: "scripter", ...options },
      "*",
    );
  }

  /**
   * Inform Glitch that a script has been loaded (informational).
   */
  sendLoad(scriptId: string, objectId: string): void {
    this.iframe.contentWindow?.postMessage(
      { type: "scripter_load", source: "scripter", scriptId, objectId },
      "*",
    );
  }

  /**
   * Register a callback for console output (say/whisper/shout from scripts).
   */
  onConsole(callback: ConsoleCallback): void {
    this.consoleCallback = callback;
  }

  dispose(): void {
    this.consoleCallback = null;
  }
}
