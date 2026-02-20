/**
 * Bundle Parser — Parses Legacy OAR manifest.json and resolves script bindings.
 *
 * The parser takes a manifest JSON string, validates it, and resolves the
 * binding chain: object.inventory[i].asset_uuid → assets[uuid].path.
 *
 * Browser-compatible: takes strings, never touches the filesystem.
 */

import type {
  BundleManifest,
  BundleObject,
  ParsedBundle,
  ScriptBinding,
  ResolvedAsset,
  ValidationError,
} from "./bundle-types.js";

export class BundleParser {
  /**
   * Parse a manifest JSON string into a resolved ParsedBundle.
   * Throws on invalid JSON. Returns validation errors inline for schema issues.
   */
  parse(manifestJson: string): ParsedBundle {
    const manifest = JSON.parse(manifestJson) as BundleManifest;
    return this.parseManifest(manifest);
  }

  /**
   * Parse a pre-parsed manifest object.
   */
  parseManifest(manifest: BundleManifest): ParsedBundle {
    const scripts = this.resolveScriptBindings(manifest);
    const animations = this.resolveAssetsByType(manifest, "animation");
    const sounds = this.resolveAssetsByType(manifest, "sound");

    return {
      sceneName: manifest.scene_name ?? "Unknown",
      formatVersion: manifest.format_version ?? "1.0",
      region: manifest.region ?? null,
      scripts,
      animations,
      sounds,
      statistics: manifest.statistics ?? {
        total_objects: 0,
        total_assets: 0,
        geometry_assets: 0,
        non_geometry_assets: 0,
        copied_files: {},
        by_type: {},
      },
    };
  }

  /**
   * Validate a manifest for structural correctness.
   * Returns an array of validation errors (empty = valid).
   */
  validate(manifest: BundleManifest): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!manifest.format_version) {
      errors.push({ field: "format_version", message: "Missing format_version" });
    }

    if (!manifest.scene_name) {
      errors.push({ field: "scene_name", message: "Missing scene_name" });
    }

    if (!manifest.objects || typeof manifest.objects !== "object") {
      errors.push({ field: "objects", message: "Missing or invalid objects map" });
    }

    if (!manifest.assets || typeof manifest.assets !== "object") {
      errors.push({ field: "assets", message: "Missing or invalid assets map" });
    }

    // Validate inventory references
    if (manifest.objects && manifest.assets) {
      for (const [objectId, obj] of Object.entries(manifest.objects)) {
        if (!obj.inventory) continue;
        for (const item of obj.inventory) {
          if (item.type === "script" && !manifest.assets[item.asset_uuid]) {
            errors.push({
              field: `objects.${objectId}.inventory`,
              message: `Script "${item.name}" references asset "${item.asset_uuid}" which is not in the assets catalog`,
            });
          }
        }
      }
    }

    return errors;
  }

  /**
   * Resolve the script binding chain:
   * For each object with inventory items of type "script",
   * look up the asset UUID in the assets catalog to get the file path.
   */
  private resolveScriptBindings(manifest: BundleManifest): ScriptBinding[] {
    const bindings: ScriptBinding[] = [];
    const objects = manifest.objects ?? {};
    const assets = manifest.assets ?? {};

    for (const [objectId, obj] of Object.entries(objects)) {
      if (!obj.inventory) continue;

      for (const item of obj.inventory) {
        if (item.type !== "script") continue;

        const asset = assets[item.asset_uuid];
        if (!asset) continue; // Skip unresolvable references

        bindings.push({
          objectId,
          objectName: obj.name ?? "Unknown",
          scriptName: item.name,
          assetUuid: item.asset_uuid,
          assetPath: asset.path,
        });
      }
    }

    return bindings;
  }

  /**
   * Resolve all assets of a given type.
   */
  private resolveAssetsByType(manifest: BundleManifest, type: string): ResolvedAsset[] {
    const resolved: ResolvedAsset[] = [];
    const assets = manifest.assets ?? {};

    for (const [uuid, asset] of Object.entries(assets)) {
      if (asset.type === type) {
        resolved.push({ uuid, type: asset.type, path: asset.path });
      }
    }

    return resolved;
  }
}
