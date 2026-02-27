/**
 * Toolbar — Top action bar with spinning logo cube, brand name,
 * transpile, mode toggle, theme, and import/export.
 */

import { UIComponent } from "./component.js";

export interface ToolbarCallbacks {
  onTranspile: () => void;
  onThemeToggle: () => void;
  onImport: () => void;
  onExport: () => void;
  onPreview?: () => void;
}

/** Inject keyframe animation for the spinning logo cube (CSS @keyframes can't be inline) */
function injectLogoCubeStyles(): void {
  if (document.getElementById("logo-cube-styles")) return;
  const style = document.createElement("style");
  style.id = "logo-cube-styles";
  style.textContent = `
    @keyframes rotate-logo {
      0%   { transform: rotateX(0deg) rotateY(0deg); }
      100% { transform: rotateX(360deg) rotateY(360deg); }
    }
  `;
  document.head.appendChild(style);
}

const FACE_NAMES = ["front", "back", "left", "right", "top", "bottom"] as const;
const FACE_TRANSFORMS: Record<string, string> = {
  front:  "translateZ(15px)",
  back:   "rotateY(180deg) translateZ(15px)",
  left:   "rotateY(-90deg) translateZ(15px)",
  right:  "rotateY(90deg) translateZ(15px)",
  top:    "rotateX(90deg) translateZ(15px)",
  bottom: "rotateX(-90deg) translateZ(15px)",
};

export class Toolbar extends UIComponent {
  constructor(parent: HTMLElement, private callbacks: ToolbarCallbacks) {
    super(parent);
    injectLogoCubeStyles();
    this.mount();
  }

  render(): HTMLElement {
    const toolbar = this.h("div", {
      className: "toolbar",
      style:
        "display: flex; align-items: center; height: 38px; padding: 0 12px; gap: 8px; " +
        "background: var(--poqpoq-background-secondary, #252526); " +
        "border-bottom: 1px solid var(--poqpoq-border, #3e3e3e); " +
        "user-select: none;",
    });

    // Logo area — spinning cube + branded name
    const logo = this.h("div", {
      style:
        "display: flex; align-items: center; gap: 10px; margin-right: auto; " +
        "color: var(--poqpoq-text, #ccc);",
    });

    // Spinning wireframe logo cube (30x30px)
    const cubeContainer = this.h("div", {
      style:
        "width: 30px; height: 30px; position: relative; " +
        "transform-style: preserve-3d; flex-shrink: 0; " +
        "animation: rotate-logo 4s linear infinite;",
    });

    for (const face of FACE_NAMES) {
      const faceEl = this.h("div", {
        style:
          "position: absolute; width: 30px; height: 30px; " +
          "border: 2px solid #7B68EE; " +
          "background: rgba(123, 104, 238, 0.1); " +
          "box-shadow: inset 0 0 10px rgba(123, 104, 238, 0.3), " +
          "0 0 10px rgba(123, 104, 238, 0.5); " +
          `transform: ${FACE_TRANSFORMS[face]};`,
      });
      cubeContainer.appendChild(faceEl);
    }

    // Brand text: "BLACK BOX" (gray) + "SCRIPTER" (purple glow)
    const brandName = this.h("span", {
      style:
        "font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 15px; " +
        "letter-spacing: -0.3px; color: var(--poqpoq-text, #e0e0e0);",
    }, "BLACK BOX ");

    const productName = this.h("span", {
      style:
        "font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 15px; " +
        "letter-spacing: -0.3px; color: #7B68EE; " +
        "text-shadow: 0 0 8px rgba(123, 104, 238, 0.5);",
    }, "SCRIPTER");

    brandName.appendChild(productName);

    logo.appendChild(cubeContainer);
    logo.appendChild(brandName);

    // Transpile button
    const transpileBtn = this.makeButton("\u25B6 Transpile", "Transpile LSL to TypeScript (Ctrl+S)", () =>
      this.callbacks.onTranspile()
    );
    transpileBtn.style.background = "var(--poqpoq-accent, #007acc)";
    transpileBtn.style.color = "#fff";

    // Import button
    const importBtn = this.makeButton("\u21E7 Import", "Import an LSL or TypeScript file", () =>
      this.callbacks.onImport()
    );

    // Export button
    const exportBtn = this.makeButton("\u21E9 Export", "Export transpiled TypeScript", () =>
      this.callbacks.onExport()
    );

    // Preview button
    const previewBtn = this.makeButton("\u25A3 Preview", "Open 3D preview (Ctrl+Shift+P)", () =>
      this.callbacks.onPreview?.()
    );
    previewBtn.style.background = "rgba(123, 104, 238, 0.2)";
    previewBtn.style.borderColor = "#7B68EE";
    previewBtn.style.color = "#9B8BFF";

    // Theme toggle
    const themeBtn = this.makeButton("\u263E", "Toggle dark/light theme", () =>
      this.callbacks.onThemeToggle()
    );

    toolbar.appendChild(logo);
    toolbar.appendChild(transpileBtn);
    toolbar.appendChild(previewBtn);
    toolbar.appendChild(importBtn);
    toolbar.appendChild(exportBtn);
    toolbar.appendChild(themeBtn);

    return toolbar;
  }

  private makeButton(label: string, title: string, onClick: () => void): HTMLElement {
    const btn = this.h("button", {
      style:
        "background: var(--poqpoq-surface, #2d2d2d); " +
        "border: 1px solid var(--poqpoq-border, #3e3e3e); " +
        "color: var(--poqpoq-text, #ccc); " +
        "padding: 4px 10px; border-radius: 3px; cursor: pointer; " +
        "font-size: 12px; white-space: nowrap;",
    }, label);
    btn.title = title;
    btn.addEventListener("click", onClick);
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "var(--poqpoq-surface-hover, #3e3e3e)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "var(--poqpoq-surface, #2d2d2d)";
    });
    return btn;
  }
}
