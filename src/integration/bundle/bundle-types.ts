/**
 * Bundle Types — TypeScript interfaces matching Legacy's manifest.json output.
 *
 * The Legacy OAR converter (bundle_exporter.py) produces a directory with:
 *   scene.glb          — Combined 3D geometry
 *   manifest.json      — Metadata, object inventory, asset catalog
 *   assets/scripts/    — LSL source files (uuid.lsl)
 *   assets/animations/ — Animation files
 *   assets/sounds/     — Sound files
 *   terrain/           — Heightmap data
 *
 * These types model the manifest.json structure.
 */

// === Raw Manifest (matches Legacy's JSON output) ===

export interface BundleManifest {
  readonly format_version: string;
  readonly scene_name: string;
  readonly created: string;
  readonly region: RegionConfig | null;
  readonly parcels: ParcelData[];
  readonly objects: Record<string, BundleObject>;
  readonly assets: Record<string, BundleAsset>;
  readonly statistics: BundleStatistics;
}

export interface RegionConfig {
  readonly size: [number, number];
  readonly water_height: number;
  readonly terrain_raise_limit: number;
  readonly terrain_lower_limit: number;
  readonly maturity_rating: number;
  readonly agent_limit: number;
  readonly object_bonus: number;
  readonly flags: RegionFlags;
  readonly ground_textures: string[];
  readonly environment: string | null;
}

export interface RegionFlags {
  readonly allow_damage: boolean;
  readonly allow_land_resell: boolean;
  readonly block_fly: boolean;
  readonly block_terraform: boolean;
  readonly disable_scripts: boolean;
  readonly use_estate_sun: boolean;
  readonly fixed_sun: boolean;
}

export interface ParcelData {
  readonly uuid: string;
  readonly name: string;
  readonly description: string;
  readonly owner_id: string;
  readonly group_id: string;
  readonly is_group_owned: boolean;
  readonly area: number;
  readonly sale_price: number;
  readonly flags: number;
  readonly music_url: string;
  readonly media_url: string;
  readonly landing: {
    readonly type: number;
    readonly position: number[] | null;
    readonly look_at: number[] | null;
  };
}

export interface BundleObject {
  readonly name: string;
  readonly description: string;
  readonly creator_id: string;
  readonly creator_name: string;
  readonly creator_grid: string;
  readonly owner_id: string;
  readonly group_id: string;
  readonly creation_date: number;
  readonly permissions: ObjectPermissions;
  readonly flags: string;
  readonly sale_price: number;
  readonly sale_type: number;
  readonly inventory?: InventoryItem[];
}

export interface ObjectPermissions {
  readonly base: number;
  readonly owner: number;
  readonly group: number;
  readonly everyone: number;
  readonly next_owner: number;
}

export interface InventoryItem {
  readonly name: string;
  readonly type: string;
  readonly asset_uuid: string;
}

export interface BundleAsset {
  readonly type: string;
  readonly path: string;
}

export interface BundleStatistics {
  readonly total_objects: number;
  readonly total_assets: number;
  readonly geometry_assets: number;
  readonly non_geometry_assets: number;
  readonly copied_files: Record<string, number>;
  readonly by_type: Record<string, number>;
}

// === Parsed Output (resolved bindings) ===

/** A resolved script-to-object binding */
export interface ScriptBinding {
  /** Object UUID from manifest */
  readonly objectId: string;
  /** Human-readable object name */
  readonly objectName: string;
  /** Script inventory item name */
  readonly scriptName: string;
  /** Script asset UUID */
  readonly assetUuid: string;
  /** Path to LSL file within bundle: "assets/scripts/{uuid}.lsl" */
  readonly assetPath: string;
}

/** Parsed and resolved bundle, ready for transpilation */
export interface ParsedBundle {
  readonly sceneName: string;
  readonly formatVersion: string;
  readonly region: RegionConfig | null;
  readonly scripts: ScriptBinding[];
  readonly animations: ResolvedAsset[];
  readonly sounds: ResolvedAsset[];
  readonly statistics: BundleStatistics;
}

/** A resolved non-script asset */
export interface ResolvedAsset {
  readonly uuid: string;
  readonly type: string;
  readonly path: string;
}

/** Validation error from manifest parsing */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
}
