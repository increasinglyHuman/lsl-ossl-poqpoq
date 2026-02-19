/**
 * ScriptContainer — represents the binding between a script and its home object.
 *
 * Preserves LSL's "drop a script in a prim" paradigm:
 * - The container IS the object the script lives in
 * - Assets (textures, sounds, notecards) bundled in the same object are accessible
 * - Sibling scripts in the same container can communicate via link messages
 *
 * This is the bridge between LSL's script-per-prim model and poqpoq's
 * decoupled architecture. Scripts default to controlling their container
 * but can reach beyond via world.getObject().
 */

import type { WorldObject } from "./world-object.js";

// === Asset Types ===

export type AssetType =
  | "texture"
  | "sound"
  | "animation"
  | "notecard"
  | "script"
  | "object"
  | "clothing"
  | "bodypart"
  | "landmark";

export interface Asset {
  /** Asset UUID */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Asset type */
  readonly type: AssetType;
}

// === Link Target Constants (match LSL) ===

/** All prims/scripts in the linkset */
export const LINK_SET = -1;
/** All children (link > 1) */
export const LINK_ALL_OTHERS = -2;
/** All children (link > 1) — alias */
export const LINK_ALL_CHILDREN = -3;
/** This prim only */
export const LINK_THIS = -4;
/** Root prim only (link 0) */
export const LINK_ROOT = 0;

/**
 * Link target type — matches LSL's link number constants.
 * Negative values are special constants, positive are link numbers.
 */
export type LinkTarget = number;

// === ScriptContainer Interface ===

export interface ScriptContainer {
  /** Container (object) UUID */
  readonly id: string;

  /** The home object this container wraps */
  readonly object: WorldObject;

  /** IDs of all scripts currently in this container */
  readonly scripts: readonly string[];

  // === Asset Inventory ===

  /**
   * Get an asset by name — maps to llGetInventoryKey(name)
   * Returns null if not found.
   */
  getAsset(name: string): Asset | null;

  /**
   * Get all assets, optionally filtered by type.
   * Maps to llGetInventoryNumber(type) + llGetInventoryName(type, index)
   */
  getAssets(type?: AssetType): Asset[];

  /**
   * Check if an asset exists — maps to llGetInventoryType(name)
   */
  hasAsset(name: string): boolean;

  /**
   * Get the number of assets of a given type — maps to llGetInventoryNumber(type)
   */
  getAssetCount(type?: AssetType): number;

  // === Inter-Script Messaging ===

  /**
   * Send a link message to scripts in this container.
   * Maps to llMessageLinked(link, num, str, id).
   *
   * @param link Target: LINK_SET (all), LINK_THIS, LINK_ROOT, or a link number
   * @param num Integer message type (convention: apps use ranges, e.g. OpenCollar 500+, AVsitter 90000+)
   * @param str String payload (often pipe-delimited for complex data)
   * @param id Key/UUID payload (second string channel in LSL)
   */
  sendLinkMessage(link: LinkTarget, num: number, str: string, id: string): void;
}
