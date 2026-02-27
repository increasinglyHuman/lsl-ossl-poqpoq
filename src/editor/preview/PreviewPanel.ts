/**
 * PreviewPanel — Manages the Glitch iframe preview, event handling, and console.
 *
 * Lifecycle:
 * 1. Creates iframe pointing to Glitch with scripter type
 * 2. On iframe load, sends `glitch_spawn` with scripter config
 * 3. Waits for `glitch_ready` confirmation from Glitch
 * 4. Commands flow through PreviewRelay, events flow back via postMessage
 * 5. Listens for touch/collision events from Glitch, dispatches to scripts
 *
 * @see ADR-005 (Glitch Preview Integration)
 */

import { PreviewRelay } from "./PreviewRelay.js";
import { PreviewConsole } from "./PreviewConsole.js";

export interface PreviewPanelOptions {
  /** URL of the Glitch preview (defaults to /glitch/) */
  glitchUrl?: string;
  /** Callback when Glitch sends a touch or other event */
  onEvent?: (envelope: { objectId: string; event: { type: string; [key: string]: unknown } }) => void;
}

export type PreviewState = "idle" | "loading" | "ready" | "disposed";

export class PreviewPanel {
  private container: HTMLElement;
  private iframe: HTMLIFrameElement | null = null;
  private relay: PreviewRelay | null = null;
  private console: PreviewConsole;
  private state: PreviewState = "idle";
  private options: PreviewPanelOptions;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private readyResolve: (() => void) | null = null;

  constructor(parent: HTMLElement, options: PreviewPanelOptions = {}) {
    this.options = options;

    this.container = document.createElement("div");
    this.container.style.cssText =
      "display: flex; flex-direction: column; height: 100%; " +
      "background: var(--poqpoq-background, #1e1e1e); " +
      "border-left: 1px solid var(--poqpoq-border, #3e3e3e);";

    // Preview header with controls
    const header = this.createHeader();
    this.container.appendChild(header);

    // Iframe container (~70% height)
    const iframeContainer = document.createElement("div");
    iframeContainer.style.cssText = "flex: 7; position: relative; overflow: hidden;";
    this.container.appendChild(iframeContainer);

    // Console container (~30% height)
    const consoleContainer = document.createElement("div");
    consoleContainer.style.cssText = "flex: 3; overflow: hidden;";
    this.container.appendChild(consoleContainer);

    this.console = new PreviewConsole(consoleContainer);

    parent.appendChild(this.container);

    // Create and load the iframe
    this.createIframe(iframeContainer);
  }

  private createHeader(): HTMLElement {
    const header = document.createElement("div");
    header.style.cssText =
      "display: flex; align-items: center; gap: 6px; padding: 4px 8px; " +
      "background: var(--poqpoq-background-secondary, #252526); " +
      "border-bottom: 1px solid var(--poqpoq-border, #3e3e3e); " +
      "font-size: 11px; color: var(--poqpoq-text-secondary, #888); " +
      "user-select: none;";

    const label = document.createElement("span");
    label.textContent = "3D Preview";
    label.style.cssText = "font-weight: bold; color: #7B68EE; margin-right: auto;";
    header.appendChild(label);

    // Reset button
    const resetBtn = this.createHeaderButton("\u21BB Reset", "Reset the preview scene", () => {
      this.reset();
    });
    header.appendChild(resetBtn);

    return header;
  }

  private createHeaderButton(text: string, title: string, onClick: () => void): HTMLElement {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.title = title;
    btn.style.cssText =
      "background: transparent; border: 1px solid var(--poqpoq-border, #3e3e3e); " +
      "color: var(--poqpoq-text-secondary, #888); cursor: pointer; " +
      "font-size: 10px; padding: 2px 8px; border-radius: 2px;";
    btn.addEventListener("click", onClick);
    btn.addEventListener("mouseenter", () => {
      btn.style.borderColor = "#7B68EE";
      btn.style.color = "#7B68EE";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.borderColor = "var(--poqpoq-border, #3e3e3e)";
      btn.style.color = "var(--poqpoq-text-secondary, #888)";
    });
    return btn;
  }

  private createIframe(parent: HTMLElement): void {
    this.state = "loading";

    this.iframe = document.createElement("iframe");
    this.iframe.style.cssText = "width: 100%; height: 100%; border: none;";
    this.iframe.setAttribute("allow", "autoplay");

    // Determine Glitch URL
    const baseUrl = this.options.glitchUrl ?? "/glitch/";
    const url = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "embed=scripter";

    // Send spawn payload once iframe has loaded (Glitch is waiting for it)
    this.iframe.addEventListener("load", () => {
      this.iframe?.contentWindow?.postMessage({
        type: "glitch_spawn",
        source: "parent",
        payload: {
          glitchType: "scripter",
          label: "Script Preview",
          camera: { mode: "orbit", distance: 5 },
          options: { showGrid: true },
        },
      }, "*");
    });

    this.iframe.src = url;
    parent.appendChild(this.iframe);

    // Create relay
    this.relay = new PreviewRelay(this.iframe);
    this.relay.onConsole((data) => {
      this.console.log(data);
    });

    // Listen for messages from Glitch
    this.messageHandler = (event: MessageEvent): void => {
      const data = event.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string") return;

      switch (data.type) {
        case "glitch_ready":
          this.state = "ready";
          this.readyResolve?.();
          this.readyResolve = null;
          this.console.system("Preview connected");
          break;

        case "scripter_event":
          if (data.envelope && this.options.onEvent) {
            this.options.onEvent(data.envelope);
          }
          break;

        case "scripter_console":
          this.console.log({
            channel: data.channel ?? 0,
            message: data.message ?? "",
            verb: data.verb ?? "say",
            senderName: data.senderName ?? "Object",
          });
          break;

        case "glitch_error":
          this.console.system(`Preview error: ${data.error ?? "unknown"}`);
          break;
      }
    };
    window.addEventListener("message", this.messageHandler);
  }

  /**
   * Wait for the Glitch iframe to report ready.
   * Resolves immediately if already ready.
   */
  waitForReady(): Promise<void> {
    if (this.state === "ready") return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });
  }

  /**
   * Get the PreviewRelay for command forwarding.
   */
  getRelay(): PreviewRelay | null {
    return this.relay;
  }

  /**
   * Get the preview console for direct output.
   */
  getConsole(): PreviewConsole {
    return this.console;
  }

  /**
   * Reset the preview scene.
   */
  reset(): void {
    this.relay?.sendReset();
    this.console.clear();
    this.console.system("Preview reset");
  }

  /**
   * Get current state.
   */
  getState(): PreviewState {
    return this.state;
  }

  dispose(): void {
    if (this.state === "disposed") return;
    this.state = "disposed";

    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }

    this.relay?.dispose();
    this.relay = null;
    this.console.dispose();
    this.iframe?.remove();
    this.iframe = null;
    this.container.remove();
  }
}
