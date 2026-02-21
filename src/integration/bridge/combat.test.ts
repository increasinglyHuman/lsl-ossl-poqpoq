import { describe, it, expect } from "vitest";
import {
  CombatPresets,
  type ProjectileConfig,
  type ExplosionConfig,
  type MeleeConfig,
  type TurretConfig,
} from "./combat.js";

describe("CombatPresets", () => {
  describe("projectile", () => {
    it("returns sensible defaults", () => {
      const p = CombatPresets.projectile();
      expect(p.damage).toBe(25);
      expect(p.speed).toBe(20);
      expect(p.lifespan).toBe(5);
      expect(p.buoyancy).toBe(1);
      expect(p.dieOnCollision).toBe(true);
    });

    it("allows overrides", () => {
      const p = CombatPresets.projectile({ damage: 100, speed: 50 });
      expect(p.damage).toBe(100);
      expect(p.speed).toBe(50);
      expect(p.buoyancy).toBe(1); // default preserved
    });

    it("satisfies ProjectileConfig shape", () => {
      const p: ProjectileConfig = CombatPresets.projectile();
      expect(p).toBeDefined();
    });
  });

  describe("explosion", () => {
    it("returns sensible defaults", () => {
      const e = CombatPresets.explosion();
      expect(e.radius).toBe(5);
      expect(e.force).toBe(100);
      expect(e.damage).toBe(50);
      expect(e.duration).toBe(0.5);
    });

    it("allows overrides", () => {
      const e = CombatPresets.explosion({ radius: 10, particles: "fire" });
      expect(e.radius).toBe(10);
      expect(e.particles).toBe("fire");
    });

    it("satisfies ExplosionConfig shape", () => {
      const e: ExplosionConfig = CombatPresets.explosion();
      expect(e).toBeDefined();
    });
  });

  describe("melee", () => {
    it("returns sensible defaults", () => {
      const m = CombatPresets.melee();
      expect(m.damage).toBe(30);
      expect(m.range).toBe(3);
      expect(m.arc).toBeCloseTo(Math.PI / 2);
      expect(m.pushForce).toBe(10);
      expect(m.cooldown).toBe(1);
    });

    it("allows overrides", () => {
      const m = CombatPresets.melee({ animation: "slash", damage: 75 });
      expect(m.animation).toBe("slash");
      expect(m.damage).toBe(75);
    });

    it("satisfies MeleeConfig shape", () => {
      const m: MeleeConfig = CombatPresets.melee();
      expect(m).toBeDefined();
    });
  });

  describe("turret", () => {
    it("returns sensible defaults with embedded projectile", () => {
      const t = CombatPresets.turret();
      expect(t.sensorRange).toBe(20);
      expect(t.sensorInterval).toBe(1);
      expect(t.sensorType).toBe(1);
      expect(t.trackSpeed).toBe(5);
      expect(t.fireRate).toBe(2);
      expect(t.projectile.damage).toBe(25); // default projectile
    });

    it("allows custom projectile", () => {
      const t = CombatPresets.turret({
        projectile: CombatPresets.projectile({ damage: 200, speed: 100 }),
      });
      expect(t.projectile.damage).toBe(200);
      expect(t.projectile.speed).toBe(100);
    });

    it("satisfies TurretConfig shape", () => {
      const t: TurretConfig = CombatPresets.turret();
      expect(t).toBeDefined();
    });
  });

  describe("trackingMissile", () => {
    it("includes target and default missile config", () => {
      const m = CombatPresets.trackingMissile({ x: 10, y: 0, z: 10 });
      expect(m.trackTarget).toEqual({ x: 10, y: 0, z: 10 });
      expect(m.speed).toBe(15);
      expect(m.lifespan).toBe(8);
      expect(m.damage).toBe(50);
    });

    it("allows overrides", () => {
      const m = CombatPresets.trackingMissile(
        { x: 0, y: 5, z: 0 },
        { damage: 200 },
      );
      expect(m.damage).toBe(200);
      expect(m.trackTarget).toEqual({ x: 0, y: 5, z: 0 });
    });
  });
});
