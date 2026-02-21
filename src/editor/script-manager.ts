/**
 * Editor Script Manager — Manage script documents with localStorage persistence.
 *
 * Handles CRUD operations for scripts in the editor,
 * dirty tracking, and serialization to localStorage.
 */

export interface ScriptDocument {
  id: string;
  name: string;
  language: "lsl" | "typescript";
  source: string;
  lastModified: number;
  isDirty: boolean;
}

export type ScriptEventType = "create" | "delete" | "rename" | "activate" | "save" | "update";

export type ScriptEventCallback = (type: ScriptEventType, script: ScriptDocument) => void;

const STORAGE_KEY = "poqpoq-editor-scripts";
const ACTIVE_KEY = "poqpoq-editor-active";
const VERSION_KEY = "poqpoq-editor-version";
const STORAGE_VERSION = 2; // Bump to reset stale localStorage

const DEFAULT_LSL = `// Hello World — your first LSL script
default
{
    state_entry()
    {
        llSay(0, "Hello, poqpoq World!");
    }

    touch_start(integer num_detected)
    {
        llSay(0, "Touched by " + llDetectedName(0));
    }
}
`;

const DEFAULT_TS = `import { WorldScript, type Agent } from "poqpoq/types";

export default class MyScript extends WorldScript {
  states = {
    default: {
      async onTouchStart(this: MyScript, agent: Agent) {
        this.say(0, \`Hello, \${agent.name}!\`);
      },
    },
  };
}
`;

export class EditorScriptManager {
  private scripts: Map<string, ScriptDocument>;
  private activeId: string | null = null;
  private listeners: ScriptEventCallback[] = [];

  constructor() {
    // Reset stale localStorage when storage version changes
    const storedVersion = Number(localStorage.getItem(VERSION_KEY) || "0");
    if (storedVersion < STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVE_KEY);
      localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
    }

    this.scripts = this.loadFromStorage();
    this.activeId = this.loadActiveId();

    if (this.scripts.size === 0) {
      this.createDefaults();
    }

    // Ensure active script is valid
    if (this.activeId && !this.scripts.has(this.activeId)) {
      this.activeId = this.scripts.keys().next().value ?? null;
    }
  }

  /** List all scripts sorted by name */
  list(): ScriptDocument[] {
    return [...this.scripts.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /** Get a script by ID */
  get(id: string): ScriptDocument | null {
    return this.scripts.get(id) ?? null;
  }

  /** Get the currently active script */
  getActive(): ScriptDocument | null {
    if (!this.activeId) return null;
    return this.scripts.get(this.activeId) ?? null;
  }

  /** Get active script ID */
  getActiveId(): string | null {
    return this.activeId;
  }

  /** Set the active script */
  setActive(id: string): void {
    if (!this.scripts.has(id)) return;
    this.activeId = id;
    localStorage.setItem(ACTIVE_KEY, id);
    this.emit("activate", this.scripts.get(id)!);
  }

  /** Create a new script */
  create(name: string, language: "lsl" | "typescript", initialSource?: string): ScriptDocument {
    const id = crypto.randomUUID();
    const source = initialSource ?? (language === "lsl" ? "" : DEFAULT_TS);
    const doc: ScriptDocument = {
      id,
      name,
      language,
      source,
      lastModified: Date.now(),
      isDirty: false,
    };
    this.scripts.set(id, doc);
    this.save();
    this.emit("create", doc);
    return doc;
  }

  /** Rename a script */
  rename(id: string, newName: string): void {
    const doc = this.scripts.get(id);
    if (!doc) return;
    doc.name = newName;
    doc.lastModified = Date.now();
    this.save();
    this.emit("rename", doc);
  }

  /** Delete a script */
  delete(id: string): void {
    const doc = this.scripts.get(id);
    if (!doc) return;
    this.scripts.delete(id);

    if (this.activeId === id) {
      const remaining = this.scripts.keys().next().value;
      this.activeId = remaining ?? null;
      if (this.activeId) {
        localStorage.setItem(ACTIVE_KEY, this.activeId);
      } else {
        localStorage.removeItem(ACTIVE_KEY);
      }
    }

    this.save();
    this.emit("delete", doc);
  }

  /** Update a script's source code */
  updateSource(id: string, source: string): void {
    const doc = this.scripts.get(id);
    if (!doc) return;
    doc.source = source;
    doc.isDirty = true;
    doc.lastModified = Date.now();
    // Don't persist on every keystroke — call save() explicitly
    this.emit("update", doc);
  }

  /** Mark a script as saved (not dirty) */
  markSaved(id: string): void {
    const doc = this.scripts.get(id);
    if (!doc) return;
    doc.isDirty = false;
    this.save();
    this.emit("save", doc);
  }

  /** Persist all scripts to localStorage */
  save(): void {
    const data: Record<string, ScriptDocument> = {};
    for (const [id, doc] of this.scripts) {
      data[id] = { ...doc, isDirty: false };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /** Subscribe to script events */
  onChange(callback: ScriptEventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** Get count of scripts */
  get count(): number {
    return this.scripts.size;
  }

  private emit(type: ScriptEventType, script: ScriptDocument): void {
    for (const listener of this.listeners) {
      listener(type, script);
    }
  }

  private loadFromStorage(): Map<string, ScriptDocument> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Map();
      const data = JSON.parse(raw) as Record<string, ScriptDocument>;
      return new Map(Object.entries(data));
    } catch {
      return new Map();
    }
  }

  private loadActiveId(): string | null {
    return localStorage.getItem(ACTIVE_KEY);
  }

  private createDefaults(): void {
    const hello = this.create("HelloWorld.lsl", "lsl", DEFAULT_LSL);
    const _ts = this.create("MyScript.ts", "typescript", DEFAULT_TS);

    this.activeId = hello.id;
    this.save();
    localStorage.setItem(ACTIVE_KEY, hello.id);
  }
}
