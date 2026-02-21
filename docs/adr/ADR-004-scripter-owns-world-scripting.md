# ADR-004: Scripter Takes Over World Scripting Internals

**Status:** Accepted (Phase 7A–7D implemented)
**Date:** 2026-02-20
**Authors:** Allen Partridge (p0qp0q), Claude
**Supersedes:** ADR-003 World-side bridge section
**Builds on:** ADR-002 (Integration Layer Architecture), ADR-003 (Cross-Repo Integration)

---

## Context

Phases 1–6 of the Black Box Scripter are complete. The scripting pipeline is production-ready:

| Asset | Status |
|-------|--------|
| Transpiler | 94.1% corpus rate (1,807/1,921 OutWorldz scripts) |
| Runtime | SES sandbox, worker pool, timers, events, link messages |
| Protocol | 71 command types, 26 event types, typed envelopes |
| Command Router | 57 implemented method→command mappings |
| Bundle Pipeline | Parse → transpile → load, end-to-end tested |
| Editor | Monaco + IntelliSense, live dual-mode, deployed at poqpoq.com/scripter/ |
| CLI | `transpile` + `bundle` commands, deployed on server |
| Bridge | Reference BabylonBridge (71 commands), event forwarder, media surface |
| Steering | Craig Reynolds behaviors (11 algorithms), NPC FSMs (4 runners) |
| Combat | CombatPresets (projectile, explosion, melee, turret, tracking missile) |
| Tests | 770 passing across 24 test files |

Meanwhile, the World team's scripting integration is functional but incomplete:

- **BabylonBridge:** 13 commands implemented, 14 stubbed (`console.warn`)
- **EventForwarder:** Touch events active, collision/rez wired but deferred
- **Bandwidth:** World team is focused on Babylon.js rendering, AI, UI chrome, and multiplayer

**The gap:** Users need media-on-a-prim (YouTube, Discord, OBS streaming), full NPC lifecycle (pathfinding, patrol), and the 14 stubbed commands finished. The World team does not have bandwidth to build these.

**The proposal:** Scripter takes over all scripting command implementations — including shipping a **reference BabylonBridge** that World imports directly. World's scripting code shrinks from ~690 lines to ~50 lines of imports + wiring.

---

## Decision

### Interface-Based Bridge (Zero Babylon.js Imports)

The core principle from ADR-002 stands: **this repo never imports Babylon.js**. We achieve bridge ownership through TypeScript structural typing.

Scripter defines narrow interfaces (`SceneLike`, `MeshLike`, `MaterialLike`, etc.) that Babylon.js objects satisfy structurally. The bridge code uses these interfaces — at runtime, actual Babylon.js objects are passed in.

**New directory:** `src/integration/bridge/`

```
src/integration/bridge/
  engine-types.ts              Structural interfaces for Babylon.js objects
  reference-bridge.ts          Full command handler (59 commands)
  event-forwarder.ts           Babylon.js observables → ScriptEvent
  media-surface.ts             Media-on-a-prim: video, iframe, WebRTC
  media-policy.ts              URL allowlist + CSP validation
  steering.ts                  Craig Reynolds steering behaviors (pure math)
  npc-behavior.ts              Patrol/wander/follow/guard FSMs + presets
  index.ts                     Barrel exports
```

**World's integration after this ADR:**

```typescript
import { ReferenceBabylonBridge, ReferenceEventForwarder } from "blackbox-scripter/bridge";

// Babylon.js Scene structurally satisfies SceneLike
const bridge = new ReferenceBabylonBridge(scene, { audio, npc, physics, chat });
const forwarder = new ReferenceEventForwarder(scene, adapter);
adapter.onScriptCommand(bridge.handle);
forwarder.start();
```

**Why not the alternatives:**
- **Peer dependency** (`@babylonjs/core`) would pollute the package with ~36MB for consumers who just want the transpiler
- **Factory functions** push equivalent complexity back to World with different entry points — no net gain

---

## Implementation Phases

### Phase 7A: Bridge Foundation — COMPLETE

> Commit `7d5cf21` · 56 tests

Shipped reference BabylonBridge from Scripter. Completed all 14 World stubs.

**Files delivered:**

| File | Purpose |
|------|---------|
| `engine-types.ts` | `SceneLike`, `MeshLike`, `MaterialLike`, `AnimationGroupLike`, `PhysicsSystemLike`, `AudioEngineLike`, `NPCManagerLike`, `ChatSystemLike`, `HostSystems` |
| `reference-bridge.ts` | Full command handler — structural typing, zero Babylon.js imports |
| `event-forwarder.ts` | Touch/collision/rez → ScriptEventEnvelope |
| `index.ts` | Barrel exports |

**14 stubs completed:** `setTexture`, `setText`, `setGlow`, `instantMessage`, `dialog`, `applyForce`, `applyImpulse`, `setPhysics`, `npcRemove`, `npcMoveTo`, `npcSay`, `npcPlayAnimation`, `npcStopAnimation`, `requestPermissions`

**New protocol extensions:** `setMedia`, `stopMedia`, `setMediaVolume`, `sensor`, `sensorRepeat`, `sensorRemove`, `rezObject`, `die`, `npcLookAt`, `npcFollow`, `npcPatrol`, `npcWander`

### Phase 7B: Media-on-a-Prim — COMPLETE

> Commit `85eecf8` · 48 tests

Embedded web content on mesh faces — video, iframe, and WebRTC streaming.

**Two-layer approach:**
1. **Video/stream** (YouTube, Twitch, OBS): `VideoTexture` mapping `<video>` to mesh UV
2. **Rich HTML** (Discord widgets, web pages): Screen-space `<iframe>` overlay with hit-test anchoring

**Files delivered:**

| File | Purpose |
|------|---------|
| `media-surface.ts` | Factory-injected DOM surface manager (video + iframe) |
| `media-policy.ts` | URL allowlist + CSP validation per media type |

Scripts call `this.object.setMedia(face, url, options)`. Bridge handles lifecycle, cleanup, and CSP.

### Phase 7C: NPC, Steering Behaviors & Animation Expansion — COMPLETE

> 113 tests (46 steering + 20 behavior + 18 bridge + 15 resolver + 14 router)

Goes beyond LSL/OSSL's `osNpcMoveTo` point-to-point movement. Scripter now ships a **Craig Reynolds steering behavior library** as a first-class feature, giving creators composable autonomous movement.

**Architecture: Pure Math + Declarative Protocol**

Two layers solve the tick problem (steering needs per-frame evaluation, but the bridge is stateless):

1. **`steering.ts`** — Pure math functions. Takes `Vec3Like` positions/velocities, returns `Vec3Like` force vectors. No state, no side effects, no engine dependency. World's NPCManager imports and calls per-frame.

2. **`npc-behavior.ts`** — Behavior FSMs that compose steering via declarative protocol commands. Scripts configure behaviors; the host translates to per-frame force calculations.

**11 steering behaviors:**

| Behavior | Description |
|----------|-------------|
| `seek` | Full-speed toward target |
| `flee` | Away from threat (with panic distance) |
| `arrive` | Seek with deceleration |
| `pursue` | Intercept moving target |
| `evade` | Flee from predicted position |
| `wander` | Smooth random movement (circle + jitter) |
| `obstacleAvoidance` | Feeler-ray avoidance |
| `separation` | Push away from neighbors |
| `cohesion` | Pull toward neighbor center |
| `alignment` | Match neighbor heading |
| `tether` | Soft pull back to anchor zone |

**4 behavior FSM runners:** PatrolRunner (waypoint sequencing with pause/animation/say), WanderRunner (tethered random movement), FollowRunner (maintain distance from target), GuardRunner (idle wander ↔ aggro pursuit with leash)

**3 steering presets:** `tetheredWander`, `boids`, `chaseWithLeash`

**12 new protocol commands:** `npcWhisper`, `npcShout`, `npcSit`, `npcStand`, `npcSetRotation`, `npcGetPosition`, `npcGetRotation`, `npcTouch`, `npcLoadAppearance`, `npcStopMove`, `npcSetSteering`, `npcClearSteering`

**14 new osNpc\* function resolver entries:** `osNpcGetPos`, `osNpcMoveToTarget`, `osNpcStopMoveToTarget`, `osNpcGetRot`, `osNpcSetRot`, `osNpcWhisper`, `osNpcShout`, `osNpcSit`, `osNpcStand`, `osNpcPlayAnimation`, `osNpcStopAnimation`, `osNpcTouch`, `osNpcLoadAppearance`, `osNpcSaveAppearance`

**Files delivered:**

| File | Purpose |
|------|---------|
| `steering.ts` | 11 Reynolds behaviors + composition helpers (~250 LOC) |
| `npc-behavior.ts` | 4 FSM runners + steering presets (~300 LOC) |
| Protocol additions | `SteeringBehaviorConfig` union + 12 command types |
| Engine types | `NPCManagerLike` extended with 12 optional methods |
| Bridge/router | Dispatch + routing for all new commands |
| Function resolver | 14 osNpc* SPECIAL_HANDLERS + OS_NPC_* constants |

### Phase 7D: Physics, Combat & Environment — COMPLETE

> 57 tests (11 physics bridge + 2 lifecycle bridge + 13 router + 17 resolver + 14 combat)

Closes the physics/combat function gap — the largest remaining hole in the transpiler (487 files, 25% of corpus).

**17 new function resolver entries:** `llSetStatus`, `llGetStatus`, `llSetDamage`, `llRezObject`, `llRezAtRoot`, `llPushObject`, `llStopMoveToTarget`, `llSetTorque`, `llVolumeDetect`, `llCollisionFilter`, `llSetBuoyancy`, `llWater`, `llGroundNormal`, `llGroundSlope`, `llSetPhysicsShapeType`, `llLookAt`, `llStopLookAt`

**12 new protocol commands:** `SetStatusCommand`, `SetDamageCommand`, `PushObjectCommand`, `SetTorqueCommand`, `VolumeDetectCommand`, `CollisionFilterCommand`, `SetBuoyancyCommand`, `StopMoveToTargetCommand`, `LookAtCommand`, `StopLookAtCommand`, `SetPhysicsShapeCommand`, `RezAtRootCommand`

**CombatPresets** — Declarative config types + convenience constructors for common combat patterns:
- `ProjectileConfig` — damage, speed, lifespan, buoyancy, trail, dieOnCollision
- `ExplosionConfig` — radius, force, damage, duration, particles, sound
- `MeleeConfig` — damage, range, animation, arc, pushForce, cooldown
- `TurretConfig` — sensor range/interval, embedded projectile, track speed, fire rate
- `trackingMissile()` — projectile + pursue steering hint

**Files delivered:**

| File | Purpose |
|------|---------|
| `combat.ts` | CombatPresets: 4 config types + 5 convenience constructors (~130 LOC) |
| Protocol additions | 12 new command interfaces (59 → 71 types) |
| Engine types | `PhysicsSystemLike` +11 methods, `EnvironmentSystemLike`, `InventorySystemLike` |
| Bridge/router | 13 new dispatch + 13 routing cases |
| Function resolver | 17 new SPECIAL_HANDLERS + 3 PRIM_PHYSICS_SHAPE_* constants |

---

## Testing Strategy

All bridge tests use **mock objects** satisfying structural interfaces. No browser required. Existing Vitest infrastructure, zero new dependencies.

```typescript
// Mock objects structurally satisfy SceneLike/MeshLike
const mesh = createMockMesh("door-001");
const scene = createMockScene([mesh]);
const bridge = new ReferenceBabylonBridge(scene, mockSystems);

// Test: setPosition command mutates mock mesh
bridge.handle(envelope({ type: "setPosition", objectId: "door-001", position: { x: 1, y: 2, z: 3 } }));
expect(mesh.position).toEqual({ x: 1, y: 2, z: 3 });
```

---

## World Team Impact

**Before:** World maintains BabylonBridge.ts (~373 lines) + EventForwarder.ts (~320 lines) = ~690 lines of scripting code

**After:** ~50 lines of import + construction. All new scripting features arrive via npm update.

**World action items:**
1. Add missing NPCManager methods: `removeNPC`, `moveNPC`, `sayNPC`
2. Replace BabylonBridge.ts + EventForwarder.ts with Scripter bridge imports
3. Simplify ScriptingSystem.ts to pure wiring

---

## Consequences

### Positive

- **Single ownership** of entire scripting pipeline: LSL source → transpile → sandbox → command → Babylon.js execution
- **World team freed** to focus on rendering, AI, UI, and multiplayer
- **Browser-free testing** via structural interfaces — all bridge code testable in Vitest
- **Media-on-a-prim** unlocks YouTube, Discord, OBS streaming in-world
- **Steering behaviors** give NPCs composable autonomous movement — a differentiator over LSL/OSSL
- **Combat presets** give creators declarative projectile/explosion/melee/turret configs — no physics math needed
- **~274 new tests** across phases 7A–7D, total 770

### Negative

- **Scripter scope grows** significantly (bridge + media + NPC behavior)
- **Interface maintenance** when Babylon.js changes mesh/material API

### Risk Mitigations

- **Interface drift:** CI integration test in World repo runs bridge against actual Babylon.js
- **Media security:** URL allowlist in MediaPolicy — no arbitrary iframe URLs
- **Sensor performance:** Babylon.js octree spatial index for large scenes

---

## Scope (Estimated → Actual)

| Phase | New Files | ~New Lines | ~New Tests | Status |
|-------|-----------|-----------|------------|--------|
| 7A (Bridge) | 6 → 5 | 1,450 → ~1,200 | 80 → 56 | **DONE** `7d5cf21` |
| 7B (Media) | 4 → 3 | 690 → ~600 | 40 → 48 | **DONE** `85eecf8` |
| 7C (NPC + Steering) | 2 → 4 | 550 → ~750 | 50 → 113 | **DONE** |
| 7D (Physics + Combat) | 2 → 2 | 400 → ~400 | 40 → 57 | **DONE** |
| **Total** | **14** | **~2,950** | **~274** | |

---

## References

- [ADR-002: Integration Layer Architecture](ADR-002-integration-layer-architecture.md)
- [ADR-003: Phase 6 & Cross-Repo Integration](ADR-003-phase-6-and-cross-repo-integration.md)
- [Protocol types: script-command.ts](../../src/integration/protocol/script-command.ts) — 71 command types, single source of truth
- [Command router: command-router.ts](../../src/integration/host/command-router.ts) — 57 method→command mappings
- [Host adapter: script-host-adapter.ts](../../src/integration/host/script-host-adapter.ts) — orchestrator facade
- [Steering behaviors: steering.ts](../../src/integration/bridge/steering.ts) — Craig Reynolds pure math library
- [NPC behaviors: npc-behavior.ts](../../src/integration/bridge/npc-behavior.ts) — FSM runners (patrol/wander/follow/guard)
- [Combat presets: combat.ts](../../src/integration/bridge/combat.ts) — Declarative projectile/explosion/melee/turret configs

---

*This ADR transfers bridge ownership from World to Scripter, enabling single-team end-to-end delivery of all scripting features.*
