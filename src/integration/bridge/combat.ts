/**
 * Combat Presets — Declarative config types and convenience constructors
 * for common combat patterns (projectiles, explosions, melee, turrets).
 *
 * Same pattern as SteeringPresets: pure data, no engine dependency.
 * Scripts use these to configure combat behaviors; the host engine
 * translates configs into actual rez/physics/particle calls.
 */

import type { Vec3Like } from "./engine-types.js";

// === Config Types ===

export interface ProjectileConfig {
  readonly damage: number;
  readonly speed: number;
  readonly lifespan: number;
  readonly buoyancy: number;
  readonly trail?: string;
  readonly dieOnCollision: boolean;
  readonly direction?: Vec3Like;
}

export interface ExplosionConfig {
  readonly radius: number;
  readonly force: number;
  readonly damage: number;
  readonly duration: number;
  readonly particles?: string;
  readonly sound?: string;
}

export interface MeleeConfig {
  readonly damage: number;
  readonly range: number;
  readonly animation?: string;
  readonly arc: number;
  readonly pushForce: number;
  readonly cooldown: number;
}

export interface TurretConfig {
  readonly sensorRange: number;
  readonly sensorInterval: number;
  readonly sensorType: number;
  readonly projectile: ProjectileConfig;
  readonly trackSpeed: number;
  readonly fireRate: number;
}

// === Presets ===

export const CombatPresets = {
  /**
   * Create a projectile config with sensible defaults.
   * Defaults: buoyancy 1 (no gravity), die on collision, 5s lifespan.
   */
  projectile(overrides: Partial<ProjectileConfig> = {}): ProjectileConfig {
    return {
      damage: 25,
      speed: 20,
      lifespan: 5,
      buoyancy: 1,
      dieOnCollision: true,
      ...overrides,
    };
  },

  /**
   * Create an explosion config with sensible defaults.
   * Defaults: radius 5, force 100, 0.5s duration.
   */
  explosion(overrides: Partial<ExplosionConfig> = {}): ExplosionConfig {
    return {
      radius: 5,
      force: 100,
      damage: 50,
      duration: 0.5,
      ...overrides,
    };
  },

  /**
   * Create a melee attack config with sensible defaults.
   * Defaults: arc PI/2 (90 degrees), 1s cooldown.
   */
  melee(overrides: Partial<MeleeConfig> = {}): MeleeConfig {
    return {
      damage: 30,
      range: 3,
      arc: Math.PI / 2,
      pushForce: 10,
      cooldown: 1,
      ...overrides,
    };
  },

  /**
   * Create a turret config that composes a projectile.
   * Defaults: 20m sensor range, 1s scan interval, 2 rounds/sec.
   */
  turret(overrides: Partial<TurretConfig> = {}): TurretConfig {
    return {
      sensorRange: 20,
      sensorInterval: 1,
      sensorType: 1, // AGENT
      projectile: CombatPresets.projectile(),
      trackSpeed: 5,
      fireRate: 2,
      ...overrides,
    };
  },

  /**
   * Create a tracking missile: projectile + pursue steering hint.
   * The host engine should apply pursue behavior to the rezzed projectile.
   */
  trackingMissile(
    target: Vec3Like,
    overrides: Partial<ProjectileConfig> = {},
  ): ProjectileConfig & { readonly trackTarget: Vec3Like } {
    return {
      ...CombatPresets.projectile({
        speed: 15,
        lifespan: 8,
        damage: 50,
        ...overrides,
      }),
      trackTarget: target,
    };
  },
} as const;
