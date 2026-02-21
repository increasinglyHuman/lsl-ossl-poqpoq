# ADR-004: Scripter Takes Over World Scripting Internals

**Status:** Proposed
**Date:** 2026-02-20
**Authors:** Allen Partridge (p0qp0q), Claude
**Supersedes:** ADR-003 World-side bridge section
**Builds on:** ADR-002 (Integration Layer Architecture), ADR-003 (Cross-Repo Integration)

---

## Context

Phases 1–6 of the Black Box Scripter are complete. The scripting pipeline is production-ready:

| Asset | Status |
|-------|--------|
| Transpiler | 94.1% corpus rate (1,807/1,921 OutWorldz scripts), 496 tests |
| Runtime | SES sandbox, worker pool, timers, events, link messages |
| Protocol | 47 command types, 26 event types, typed envelopes |
| Command Router | 32 implemented method→command mappings |
| Bundle Pipeline | Parse → transpile → load, end-to-end tested |
| Editor | Monaco + IntelliSense, live dual-mode, deployed at poqpoq.com/scripter/ |
| CLI | `transpile` + `bundle` commands, deployed on server |

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
  reference-bridge.ts          Full command handler (~55 commands)
  event-forwarder.ts           Babylon.js observables → ScriptEvent
  media-surface.ts             Media-on-a-prim: video, iframe, WebRTC
  media-policy.ts              URL allowlist + CSP validation
  npc-behavior.ts              Patrol/wander/follow state machines
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

### Phase 7A: Bridge Foundation

Ship reference BabylonBridge from Scripter. Complete all 14 World stubs.

**New files:**

| File | Purpose |
|------|---------|
| `engine-types.ts` | `SceneLike`, `MeshLike`, `MaterialLike`, `AnimationGroupLike`, `PhysicsSystemLike`, `AudioEngineLike`, `NPCManagerLike`, `ChatSystemLike` |
| `reference-bridge.ts` | Full command handler — all 32 current + new commands |
| `event-forwarder.ts` | Touch/collision/rez → ScriptEventEnvelope |
| `index.ts` | Barrel exports |
| Tests for each |

**14 stubs completed:** `setTexture`, `setText`, `setGlow`, `instantMessage`, `dialog`, `applyForce`, `applyImpulse`, `setPhysics`, `npcRemove`, `npcMoveTo`, `npcSay`, `npcPlayAnimation`, `npcStopAnimation`, `requestPermissions`

**New protocol extensions:** `setMedia`, `stopMedia`, `setMediaVolume`, `sensor`, `sensorRepeat`, `sensorRemove`, `rezObject`, `die`, `npcLookAt`, `npcFollow`, `npcPatrol`, `npcWander`

### Phase 7B: Media-on-a-Prim

Embed web content on mesh faces — the 2026 hygiene feature.

**Two-layer approach:**
1. **Video/stream** (YouTube, Twitch, OBS): `VideoTexture` mapping `<video>` to mesh UV
2. **Rich HTML** (Discord widgets, web pages): Screen-space `<iframe>` overlay with hit-test anchoring

Scripts call `this.object.setMedia(face, url, options)`. Bridge handles lifecycle, cleanup, and CSP.

### Phase 7C: NPC & Animation Expansion

Full NPC lifecycle: pathfinding via navigation mesh, patrol waypoints, wander radius, follow agent. Animation blending with weights and priorities.

### Phase 7D: Physics, Sensors, Remaining Systems

Complete the gap: sensor sweeps (spatial queries + arc), `llCastRay` (raypick), rez/die lifecycle, terrain queries.

**Phases 7B, 7C, 7D are independent** — can proceed in any order after 7A.

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
- **~210 new tests**, total approaching ~700

### Negative

- **Scripter scope grows** significantly (bridge + media + NPC behavior)
- **Interface maintenance** when Babylon.js changes mesh/material API

### Risk Mitigations

- **Interface drift:** CI integration test in World repo runs bridge against actual Babylon.js
- **Media security:** URL allowlist in MediaPolicy — no arbitrary iframe URLs
- **Sensor performance:** Babylon.js octree spatial index for large scenes

---

## Estimated Scope

| Phase | New Files | ~New Lines | ~New Tests |
|-------|-----------|-----------|------------|
| 7A (Bridge) | 6 | 1,450 | 80 |
| 7B (Media) | 4 | 690 | 40 |
| 7C (NPC) | 2 | 550 | 50 |
| 7D (Physics) | 0 | 400 | 40 |
| **Total** | **12** | **~3,100** | **~210** |

---

## References

- [ADR-002: Integration Layer Architecture](ADR-002-integration-layer-architecture.md)
- [ADR-003: Phase 6 & Cross-Repo Integration](ADR-003-phase-6-and-cross-repo-integration.md)
- [Protocol types: script-command.ts](../../src/integration/protocol/script-command.ts) — single source of truth
- [Command router: command-router.ts](../../src/integration/host/command-router.ts) — 32 current mappings
- [Host adapter: script-host-adapter.ts](../../src/integration/host/script-host-adapter.ts) — orchestrator facade

---

*This ADR transfers bridge ownership from World to Scripter, enabling single-team end-to-end delivery of all scripting features.*
