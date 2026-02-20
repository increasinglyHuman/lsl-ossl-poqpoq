import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BundleParser } from "./bundle-parser.js";
import type { BundleManifest } from "./bundle-types.js";

const FIXTURES = resolve(__dirname, "../../../tests/fixtures/bundles");

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name, "manifest.json"), "utf-8");
}

describe("BundleParser", () => {
  const parser = new BundleParser();

  describe("parse (minimal bundle)", () => {
    it("parses the minimal manifest", () => {
      const bundle = parser.parse(loadFixture("minimal"));
      expect(bundle.sceneName).toBe("Minimal Test Scene");
      expect(bundle.formatVersion).toBe("1.0");
    });

    it("resolves one script binding", () => {
      const bundle = parser.parse(loadFixture("minimal"));
      expect(bundle.scripts).toHaveLength(1);

      const script = bundle.scripts[0];
      expect(script.objectId).toBe("obj-uuid-001");
      expect(script.objectName).toBe("Hello Button");
      expect(script.scriptName).toBe("Hello Script");
      expect(script.assetUuid).toBe("abc-123");
      expect(script.assetPath).toBe("assets/scripts/abc-123.lsl");
    });

    it("parses region config", () => {
      const bundle = parser.parse(loadFixture("minimal"));
      expect(bundle.region).not.toBeNull();
      expect(bundle.region!.water_height).toBe(20);
      expect(bundle.region!.size).toEqual([256, 256]);
    });

    it("has empty animations and sounds", () => {
      const bundle = parser.parse(loadFixture("minimal"));
      expect(bundle.animations).toHaveLength(0);
      expect(bundle.sounds).toHaveLength(0);
    });

    it("preserves statistics", () => {
      const bundle = parser.parse(loadFixture("minimal"));
      expect(bundle.statistics.total_objects).toBe(1);
      expect(bundle.statistics.total_assets).toBe(1);
    });
  });

  describe("parse (multi-script bundle)", () => {
    it("resolves all 4 script bindings across 3 objects", () => {
      const bundle = parser.parse(loadFixture("multi-script"));
      expect(bundle.scripts).toHaveLength(4);

      const names = bundle.scripts.map((s) => s.scriptName).sort();
      expect(names).toEqual([
        "Door Controller",
        "Particle Effect",
        "Sign Display",
        "Vendor Script",
      ]);
    });

    it("resolves script bindings to correct objects", () => {
      const bundle = parser.parse(loadFixture("multi-script"));

      const doorScripts = bundle.scripts.filter((s) => s.objectId === "obj-door-001");
      expect(doorScripts).toHaveLength(1);
      expect(doorScripts[0].scriptName).toBe("Door Controller");

      const vendorScripts = bundle.scripts.filter((s) => s.objectId === "obj-vendor-001");
      expect(vendorScripts).toHaveLength(2);
      const vendorNames = vendorScripts.map((s) => s.scriptName).sort();
      expect(vendorNames).toEqual(["Particle Effect", "Vendor Script"]);
    });

    it("resolves animations and sounds", () => {
      const bundle = parser.parse(loadFixture("multi-script"));
      expect(bundle.animations).toHaveLength(1);
      expect(bundle.animations[0].uuid).toBe("anim-001");
      expect(bundle.sounds).toHaveLength(1);
      expect(bundle.sounds[0].uuid).toBe("sound-001");
    });

    it("ignores non-script inventory items in script bindings", () => {
      const bundle = parser.parse(loadFixture("multi-script"));
      // Door has a sound in inventory, vendor has an animation — neither should appear in scripts
      for (const script of bundle.scripts) {
        expect(script.assetPath).toMatch(/\.lsl$/);
      }
    });
  });

  describe("parse (edge cases)", () => {
    it("handles empty objects map", () => {
      const manifest: BundleManifest = {
        format_version: "1.0",
        scene_name: "Empty",
        created: "2026-01-01",
        region: null,
        parcels: [],
        objects: {},
        assets: {},
        statistics: {
          total_objects: 0,
          total_assets: 0,
          geometry_assets: 0,
          non_geometry_assets: 0,
          copied_files: {},
          by_type: {},
        },
      };
      const bundle = parser.parseManifest(manifest);
      expect(bundle.scripts).toHaveLength(0);
      expect(bundle.sceneName).toBe("Empty");
    });

    it("handles objects without inventory", () => {
      const manifest: BundleManifest = {
        format_version: "1.0",
        scene_name: "No Inventory",
        created: "2026-01-01",
        region: null,
        parcels: [],
        objects: {
          "obj-1": {
            name: "Plain Object",
            description: "",
            creator_id: "",
            creator_name: "",
            creator_grid: "",
            owner_id: "",
            group_id: "",
            creation_date: 0,
            permissions: { base: 0, owner: 0, group: 0, everyone: 0, next_owner: 0 },
            flags: "None",
            sale_price: 0,
            sale_type: 0,
          },
        },
        assets: {},
        statistics: {
          total_objects: 1,
          total_assets: 0,
          geometry_assets: 0,
          non_geometry_assets: 0,
          copied_files: {},
          by_type: {},
        },
      };
      const bundle = parser.parseManifest(manifest);
      expect(bundle.scripts).toHaveLength(0);
    });

    it("skips scripts with unresolvable asset references", () => {
      const manifest: BundleManifest = {
        format_version: "1.0",
        scene_name: "Broken Ref",
        created: "2026-01-01",
        region: null,
        parcels: [],
        objects: {
          "obj-1": {
            name: "Broken",
            description: "",
            creator_id: "",
            creator_name: "",
            creator_grid: "",
            owner_id: "",
            group_id: "",
            creation_date: 0,
            permissions: { base: 0, owner: 0, group: 0, everyone: 0, next_owner: 0 },
            flags: "None",
            sale_price: 0,
            sale_type: 0,
            inventory: [{ name: "Ghost Script", type: "script", asset_uuid: "nonexistent" }],
          },
        },
        assets: {},
        statistics: {
          total_objects: 1,
          total_assets: 0,
          geometry_assets: 0,
          non_geometry_assets: 0,
          copied_files: {},
          by_type: {},
        },
      };
      const bundle = parser.parseManifest(manifest);
      expect(bundle.scripts).toHaveLength(0);
    });

    it("throws on invalid JSON", () => {
      expect(() => parser.parse("not json")).toThrow();
    });
  });

  describe("validate", () => {
    it("returns no errors for a valid manifest", () => {
      const manifest = JSON.parse(loadFixture("minimal")) as BundleManifest;
      const errors = parser.validate(manifest);
      expect(errors).toHaveLength(0);
    });

    it("detects missing format_version", () => {
      const manifest = { scene_name: "Test", objects: {}, assets: {} } as unknown as BundleManifest;
      const errors = parser.validate(manifest);
      expect(errors.some((e) => e.field === "format_version")).toBe(true);
    });

    it("detects missing scene_name", () => {
      const manifest = { format_version: "1.0", objects: {}, assets: {} } as unknown as BundleManifest;
      const errors = parser.validate(manifest);
      expect(errors.some((e) => e.field === "scene_name")).toBe(true);
    });

    it("detects dangling script references", () => {
      const manifest: BundleManifest = {
        format_version: "1.0",
        scene_name: "Dangling",
        created: "",
        region: null,
        parcels: [],
        objects: {
          "obj-1": {
            name: "Test",
            description: "",
            creator_id: "",
            creator_name: "",
            creator_grid: "",
            owner_id: "",
            group_id: "",
            creation_date: 0,
            permissions: { base: 0, owner: 0, group: 0, everyone: 0, next_owner: 0 },
            flags: "None",
            sale_price: 0,
            sale_type: 0,
            inventory: [{ name: "Missing", type: "script", asset_uuid: "no-such-asset" }],
          },
        },
        assets: {},
        statistics: {
          total_objects: 1,
          total_assets: 0,
          geometry_assets: 0,
          non_geometry_assets: 0,
          copied_files: {},
          by_type: {},
        },
      };
      const errors = parser.validate(manifest);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("no-such-asset");
    });

    it("allows non-script inventory to reference missing assets", () => {
      const manifest: BundleManifest = {
        format_version: "1.0",
        scene_name: "OK",
        created: "",
        region: null,
        parcels: [],
        objects: {
          "obj-1": {
            name: "Test",
            description: "",
            creator_id: "",
            creator_name: "",
            creator_grid: "",
            owner_id: "",
            group_id: "",
            creation_date: 0,
            permissions: { base: 0, owner: 0, group: 0, everyone: 0, next_owner: 0 },
            flags: "None",
            sale_price: 0,
            sale_type: 0,
            inventory: [{ name: "Sound", type: "sound", asset_uuid: "missing-sound" }],
          },
        },
        assets: {},
        statistics: {
          total_objects: 1,
          total_assets: 0,
          geometry_assets: 0,
          non_geometry_assets: 0,
          copied_files: {},
          by_type: {},
        },
      };
      const errors = parser.validate(manifest);
      expect(errors).toHaveLength(0);
    });
  });
});
