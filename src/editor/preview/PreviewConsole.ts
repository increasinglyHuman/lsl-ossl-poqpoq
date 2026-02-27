/**
 * PreviewConsole — Displays script say/whisper/shout output in the preview panel.
 *
 * Styled to match the editor's error panel. Shows timestamped messages
 * with color-coded verb indicators.
 */

export class PreviewConsole {
  private container: HTMLElement;
  private outputEl: HTMLElement;
  private maxLines = 200;

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.style.cssText =
      "display: flex; flex-direction: column; height: 100%; " +
      "background: var(--poqpoq-background, #1e1e1e); " +
      "border-top: 1px solid var(--poqpoq-border, #3e3e3e);";

    // Header
    const header = document.createElement("div");
    header.style.cssText =
      "display: flex; align-items: center; justify-content: space-between; " +
      "padding: 4px 8px; font-size: 11px; " +
      "color: var(--poqpoq-text-secondary, #888); " +
      "background: var(--poqpoq-background-secondary, #252526); " +
      "border-bottom: 1px solid var(--poqpoq-border, #3e3e3e); " +
      "user-select: none;";

    const title = document.createElement("span");
    title.textContent = "Script Output";
    header.appendChild(title);

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.title = "Clear console output";
    clearBtn.style.cssText =
      "background: transparent; border: none; color: var(--poqpoq-text-secondary, #888); " +
      "cursor: pointer; font-size: 10px; padding: 2px 6px;";
    clearBtn.addEventListener("click", () => this.clear());
    header.appendChild(clearBtn);

    this.container.appendChild(header);

    // Output area
    this.outputEl = document.createElement("div");
    this.outputEl.style.cssText =
      "flex: 1; overflow-y: auto; padding: 4px 8px; " +
      "font-family: 'Space Mono', 'Consolas', monospace; font-size: 11px; " +
      "line-height: 1.5; color: var(--poqpoq-text, #ccc);";
    this.container.appendChild(this.outputEl);

    parent.appendChild(this.container);
  }

  /**
   * Add a message to the console.
   */
  log(data: {
    channel: number;
    message: string;
    verb: string;
    senderName: string;
  }): void {
    const line = document.createElement("div");
    line.style.cssText = "padding: 1px 0; word-break: break-word;";

    // Verb badge
    const badge = document.createElement("span");
    badge.style.cssText =
      "display: inline-block; padding: 0 4px; border-radius: 2px; " +
      "font-size: 10px; margin-right: 4px; font-weight: bold;";

    switch (data.verb) {
      case "say":
        badge.textContent = "SAY";
        badge.style.background = "rgba(123, 104, 238, 0.3)";
        badge.style.color = "#9B8BFF";
        break;
      case "whisper":
        badge.textContent = "WHISPER";
        badge.style.background = "rgba(100, 100, 100, 0.3)";
        badge.style.color = "#aaa";
        break;
      case "shout":
        badge.textContent = "SHOUT";
        badge.style.background = "rgba(255, 152, 0, 0.3)";
        badge.style.color = "#FFB74D";
        break;
      default:
        badge.textContent = data.verb.toUpperCase();
        badge.style.background = "rgba(100, 100, 100, 0.2)";
        badge.style.color = "#888";
    }
    line.appendChild(badge);

    // Channel (if non-zero)
    if (data.channel !== 0) {
      const ch = document.createElement("span");
      ch.textContent = `[ch ${data.channel}] `;
      ch.style.color = "var(--poqpoq-text-secondary, #666)";
      line.appendChild(ch);
    }

    // Message text
    const msg = document.createElement("span");
    msg.textContent = data.message;
    line.appendChild(msg);

    this.outputEl.appendChild(line);

    // Trim old lines
    while (this.outputEl.children.length > this.maxLines) {
      this.outputEl.removeChild(this.outputEl.firstChild!);
    }

    // Auto-scroll to bottom
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  /**
   * Add a system message (non-script output).
   */
  system(message: string): void {
    const line = document.createElement("div");
    line.style.cssText =
      "padding: 1px 0; color: var(--poqpoq-text-secondary, #666); font-style: italic;";
    line.textContent = message;
    this.outputEl.appendChild(line);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  clear(): void {
    this.outputEl.innerHTML = "";
  }

  dispose(): void {
    this.container.remove();
  }
}
