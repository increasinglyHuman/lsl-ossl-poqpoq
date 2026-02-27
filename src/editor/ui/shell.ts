/**
 * Shell — Main editor layout that assembles all UI components.
 *
 * Layout (without preview):
 * +------------------------------------------------------------------+
 * |  [Toolbar]                                                        |
 * +----------+-------------------------------------------------------+
 * |          |  [Tab Bar]                                             |
 * | Sidebar  |  +------------------------+------------------------+  |
 * |          |  | LSL Editor (left)      | TS Output (right)      |  |
 * |          |  +------------------------+------------------------+  |
 * |          |  [Error Panel]                                        |
 * +----------+-------------------------------------------------------+
 *
 * Layout (with preview):
 * +------------------------------------------------------------------+
 * |  [Toolbar]                                                        |
 * +----------+---------------------------+---------------------------+
 * |          |  [Tab Bar]                | [3D Preview Header]       |
 * | Sidebar  |  [Editors]               | [Glitch iframe]           |
 * |          |  [Error Panel]            | [Script Console]          |
 * +----------+---------------------------+---------------------------+
 */

import { Toolbar } from "./toolbar.js";
import { Sidebar } from "./sidebar.js";
import { TabBar } from "./tab-bar.js";
import { ErrorPanel } from "./error-panel.js";
import { DualModeEditor } from "../dual-mode.js";
import { EditorWrapper } from "../editor.js";
import { EditorScriptManager } from "../script-manager.js";
import { applyTheme, DARK_THEME, LIGHT_THEME, type EditorTheme } from "./theme.js";
import { PreviewPanel } from "../preview/PreviewPanel.js";

export class Shell {
  private container: HTMLElement;
  private scripts: EditorScriptManager;
  private toolbar: Toolbar;
  private sidebar: Sidebar;
  private tabBar: TabBar;
  private errorPanel: ErrorPanel;
  private dualMode: DualModeEditor | null = null;
  private tsOnlyEditor: EditorWrapper | null = null;
  private editorContainer: HTMLElement;
  private previewPanel: PreviewPanel | null = null;
  private previewContainer: HTMLElement | null = null;
  private currentTheme: EditorTheme;
  private isDark = true;
  private previewOpen = false;

  constructor(container: HTMLElement, scripts: EditorScriptManager) {
    this.container = container;
    this.scripts = scripts;
    this.currentTheme = DARK_THEME;

    // Apply initial theme
    applyTheme(this.currentTheme);

    // Build layout
    container.style.cssText =
      "display: grid; grid-template-rows: auto 1fr; " +
      "grid-template-columns: auto 1fr; " +
      "height: 100%; width: 100%; overflow: hidden; " +
      "background: var(--poqpoq-background, #1e1e1e); " +
      "color: var(--poqpoq-text, #ccc);";

    // Toolbar (spans full width)
    const toolbarContainer = document.createElement("div");
    toolbarContainer.style.gridColumn = "1 / -1";
    container.appendChild(toolbarContainer);

    this.toolbar = new Toolbar(toolbarContainer, {
      onTranspile: () => this.transpileAndSave(),
      onThemeToggle: () => this.toggleTheme(),
      onImport: () => this.importFile(),
      onExport: () => this.exportFile(),
      onPreview: () => this.togglePreview(),
    });

    // Sidebar
    const sidebarContainer = document.createElement("div");
    sidebarContainer.style.gridRow = "2";
    container.appendChild(sidebarContainer);

    this.sidebar = new Sidebar(sidebarContainer, this.scripts, (id) =>
      this.activateScript(id)
    );

    // Main content area (tabs + editor + errors)
    const mainArea = document.createElement("div");
    mainArea.style.cssText =
      "display: flex; flex-direction: column; overflow: hidden; grid-row: 2;";
    container.appendChild(mainArea);

    // Tab bar
    const tabBarContainer = document.createElement("div");
    mainArea.appendChild(tabBarContainer);

    this.tabBar = new TabBar(tabBarContainer, this.scripts, (id) =>
      this.activateScript(id)
    );

    // Editor area
    this.editorContainer = document.createElement("div");
    this.editorContainer.style.cssText = "flex: 1; overflow: hidden;";
    mainArea.appendChild(this.editorContainer);

    // Error panel
    const errorContainer = document.createElement("div");
    mainArea.appendChild(errorContainer);

    this.errorPanel = new ErrorPanel(errorContainer, (line, col) => {
      this.navigateToError(line, col);
    });

    // Load active script
    const active = this.scripts.getActive();
    if (active) {
      this.loadScript(active.id);
    }
  }

  /** Re-layout editors on window resize */
  layout(): void {
    this.dualMode?.layout();
    this.tsOnlyEditor?.layout();
  }

  /** Clean up everything */
  dispose(): void {
    this.previewPanel?.dispose();
    this.dualMode?.dispose();
    this.tsOnlyEditor?.dispose();
    this.toolbar.dispose();
    this.sidebar.dispose();
    this.tabBar.dispose();
    this.errorPanel.dispose();
  }

  activateScript(id: string): void {
    this.saveCurrentScript();
    this.scripts.setActive(id);
    this.tabBar.openTab(id);
    this.loadScript(id);
  }

  private loadScript(id: string): void {
    const script = this.scripts.get(id);
    if (!script) return;

    // Dispose previous editors
    this.dualMode?.dispose();
    this.dualMode = null;
    this.tsOnlyEditor?.dispose();
    this.tsOnlyEditor = null;
    this.editorContainer.innerHTML = "";

    const theme = this.currentTheme.monacoTheme;

    if (script.language === "lsl") {
      // LSL: show dual-mode (LSL + transpiled TS)
      this.dualMode = new DualModeEditor(this.editorContainer, {
        theme,
        onDiagnostics: (diags) => this.errorPanel.setDiagnostics(diags),
      });
      this.dualMode.setClassName(this.deriveClassName(script.name));
      this.dualMode.setSource(script.source);

      // Track changes
      this.dualMode.getLSLEditor().onDidChangeContent(() => {
        this.scripts.updateSource(id, this.dualMode!.getSource());
      });
    } else {
      // TypeScript: show single editor
      this.tsOnlyEditor = new EditorWrapper(this.editorContainer, {
        language: "typescript",
        theme,
        value: script.source,
      });

      this.tsOnlyEditor.onDidChangeContent(() => {
        this.scripts.updateSource(id, this.tsOnlyEditor!.getValue());
      });

      this.errorPanel.setDiagnostics([]);
    }
  }

  saveCurrentScript(): void {
    const activeId = this.scripts.getActiveId();
    if (!activeId) return;

    const script = this.scripts.get(activeId);
    if (!script) return;

    if (script.language === "lsl" && this.dualMode) {
      this.scripts.updateSource(activeId, this.dualMode.getSource());
    } else if (this.tsOnlyEditor) {
      this.scripts.updateSource(activeId, this.tsOnlyEditor.getValue());
    }

    this.scripts.save();
    this.scripts.markSaved(activeId);
  }

  /** Force transpile and save the current script */
  transpileAndSave(): void {
    this.saveCurrentScript();
    this.dualMode?.transpileNow();
  }

  /** Toggle the 3D preview panel on/off */
  private togglePreview(): void {
    if (this.previewOpen) {
      // Close preview
      this.previewPanel?.dispose();
      this.previewPanel = null;
      this.previewContainer?.remove();
      this.previewContainer = null;
      this.previewOpen = false;

      // Restore two-column layout
      this.container.style.gridTemplateColumns = "auto 1fr";
      this.layout();
    } else {
      // Open preview — add third column
      this.previewOpen = true;
      this.container.style.gridTemplateColumns = "auto 1fr 40%";

      // Create preview container in the grid
      this.previewContainer = document.createElement("div");
      this.previewContainer.style.cssText = "grid-row: 2; overflow: hidden;";
      this.container.appendChild(this.previewContainer);

      // Create preview panel
      this.previewPanel = new PreviewPanel(this.previewContainer, {
        onEvent: (envelope) => {
          // Touch events from Glitch — logged to console for now
          // Full event dispatch will be wired in when ScriptHostAdapter is integrated
          console.log("[Preview] Event:", envelope.event.type, envelope.objectId);
        },
      });

      this.layout();
    }
  }

  private toggleTheme(): void {
    this.isDark = !this.isDark;
    this.currentTheme = this.isDark ? DARK_THEME : LIGHT_THEME;
    applyTheme(this.currentTheme);

    // Update Monaco editor themes
    const theme = this.currentTheme.monacoTheme;
    this.dualMode?.getLSLEditor().setTheme(theme);
    this.dualMode?.getTSEditor().setTheme(theme);
    this.tsOnlyEditor?.setTheme(theme);
  }

  private importFile(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".lsl,.ts,.txt";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const source = reader.result as string;
        const language = file.name.endsWith(".ts") ? "typescript" as const : "lsl" as const;
        const script = this.scripts.create(file.name, language);
        this.scripts.updateSource(script.id, source);
        this.scripts.save();
        this.activateScript(script.id);
      };
      reader.readAsText(file);
    });

    input.click();
  }

  private exportFile(): void {
    const active = this.scripts.getActive();
    if (!active) return;

    let content: string;
    let filename: string;

    if (active.language === "lsl" && this.dualMode) {
      // Export the transpiled TypeScript
      const result = this.dualMode.transpileNow();
      content = result.code;
      filename = active.name.replace(/\.lsl$/i, ".ts");
    } else {
      content = active.source;
      filename = active.name;
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private navigateToError(line: number, column: number): void {
    const editor = this.dualMode?.getLSLEditor();
    if (!editor) return;

    const monacoEditor = editor.getEditor();
    monacoEditor.setPosition({ lineNumber: line, column });
    monacoEditor.revealLineInCenter(line);
    monacoEditor.focus();
  }

  private deriveClassName(filename: string): string {
    return filename
      .replace(/\.lsl$/i, "")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .replace(/^(\d)/, "_$1") || "LSLScript";
  }
}
