# ADR-002: Integration Layer Architecture

**Status:** Accepted
**Date:** 2026-02-19
**Authors:** Allen Partridge (p0qp0q), Claude
**Supersedes:** N/A
**Builds on:** ADR-001 (Language & Runtime Architecture)

---

## Context

Phases 1-4 of the poqpoq Script Engine are complete:

| Phase | What | Tests |
|-------|------|-------|
| 1. Foundation | Core types, World API, 179-function LSL mapping table | — |
| 2. Runtime | Worker pool + SES sandbox, event dispatch, timers, link messages | 72 |
| 3. Transpiler | LSL lexer, parser, type tracker, function resolver, codegen | 283 |
| 4. Editor | Monaco + IntelliSense, dual TS/LSL mode, full UI shell | — |

**Total: 355 tests, all passing.**

Phase 5 connects this engine to the live Babylon.js 3D world — poqpoq World. The fundamental question: **how does a standalone scripting engine (this repo) integrate with a Babylon.js application (World repo) without creating a monolithic coupling?**

### Constraints

1. **Separate codebases**: The engine lives in `lsl-ossl-poqpoq/`, the 3D world lives in `World/`. They have different build pipelines, dependencies, and release cadences.

2. **No Babylon.js dependency**: This repo must never import Babylon.js. It defines scripting abstractions (Vector3, WorldObject, events) — the host implements them against Babylon's actual types.

3. **Bundle size**: The World engine is "insanely small" (~2MB). Monaco Editor alone is ~4MB. Loading everything on startup would explode the bundle size for users who never open the editor.

4. **Worker boundary**: Scripts run in Web Workers. All communication between scripts and the host must be JSON-serializable — no class instances, no functions, no Babylon.js objects can cross the Worker boundary.

5. **OAR import pipeline**: The Legacy converter produces bundles with `manifest.json` + `assets/scripts/{uuid}.lsl`. The engine must consume these to auto-transpile and bind scripts to scene objects.

6. **Browser-first**: All code must work in the browser. No Node.js filesystem APIs in the parser or transpiler.

---

## Decision

### Three Load Profiles

The engine is structured as a multi-entry-point npm package with three distinct load profiles:

```
┌────────────────────────────────────────────────────────────┐
│                    poqpoq World (host)                     │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │   Runtime     │  │   Bridge     │  │     Editor        │ │
│  │   ~50KB       │  │   ~10KB      │  │     ~4MB          │ │
│  │   always      │  │   always     │  │     lazy-loaded   │ │
│  │              │  │              │  │                    │ │
│  │ ScriptManager │  │ BabylonBridge│  │ Monaco + Shell    │ │
│  │ EventDispatch │  │ (in World    │  │ (on-demand when   │ │
│  │ Protocol types│  │  repo)       │  │  creator opens    │ │
│  │ Bundle parser │  │              │  │  the editor)      │ │
│  │ CommandRouter │  │              │  │                    │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────┘ │
│         │                 │                                  │
│         │  ScriptCommand  │                                  │
│         ├────────────────►│  ← typed, JSON-serializable     │
│         │  ScriptEvent    │                                  │
│         │◄────────────────┤  ← typed, JSON-serializable     │
│         │                 │                                  │
└─────────┴─────────────────┴──────────────────────────────────┘
```

**Runtime (~50KB)** — always loaded by World:
- `ScriptManager`: Worker pool lifecycle, script load/terminate
- `EventDispatcher`: Route world events to scripts
- `CommandRouter`: Convert untyped API calls to typed `ScriptCommand`
- `BundleParser`: Parse OAR manifest.json, resolve script-to-object bindings
- `BundleTranspiler`: Batch-transpile all LSL scripts in a bundle
- `ScriptHostAdapter`: High-level facade wrapping everything above
- Protocol types: `ScriptCommand`, `ScriptEvent`, envelope wrappers

**Editor (~4MB)** — lazy-loaded on demand:
- Monaco Editor with World API IntelliSense
- Dual-mode TS/LSL display
- Console, file management, UI shell
- Only loaded when a creator opens the script editor

**Bridge (~10KB)** — lives in the World repo:
- Implements `CommandHandler` against Babylon.js scene graph
- Translates `ScriptCommand` → Babylon.js API calls
- Translates Babylon.js events → `ScriptEvent`
- This is the *only* code that imports both the engine and Babylon.js

### Message-Passing Protocol

The contract between engine and host is two discriminated unions of plain JSON-serializable messages:

**ScriptCommand** (script → host) — every World API method that requires host action:

| Category | Commands |
|----------|----------|
| Transform | `setPosition`, `setRotation`, `setScale` |
| Appearance | `setColor`, `setAlpha`, `setTexture`, `setText`, `setGlow` |
| Communication | `say`, `whisper`, `shout`, `regionSay`, `instantMessage`, `dialog` |
| Effects | `playSound`, `stopSound`, `setParticles`, `stopParticles` |
| Animation | `playAnimation`, `stopAnimation` |
| Physics | `applyForce`, `applyImpulse`, `setPhysics` |
| HTTP | `httpRequest` |
| NPC | `npcCreate`, `npcRemove`, `npcMoveTo`, `npcSay`, `npcPlayAnimation` |
| Permissions | `requestPermissions` |

**ScriptEvent** (host → script) — every event the host can dispatch:

| Category | Events |
|----------|--------|
| Touch | `touchStart`, `touch`, `touchEnd` |
| Collision | `collisionStart`, `collision`, `collisionEnd` |
| Communication | `listen` |
| Lifecycle | `timer`, `rez`, `changed`, `money`, `permissions` |
| Perception | `sensor`, `noSensor` |
| Data | `dataserver`, `httpResponse` |
| poqpoq extensions | `playerEnterZone`, `playerLeaveZone`, `dayNightCycle`, `weatherChange` |

All messages use `{ x: number, y: number, z: number }` instead of `Vector3` class instances. The bridge translates to/from Babylon.js `Vector3` on its side.

### OAR Bundle Pipeline

```
Legacy OAR Converter
    ↓  produces
manifest.json + assets/scripts/*.lsl
    ↓  consumed by
BundleParser.parse(manifestJson)
    ↓  produces
ParsedBundle { scripts: ScriptBinding[] }
    ↓  consumed by
BundleTranspiler.transpile(bundle, sources)
    ↓  produces
TranspiledBundle { scripts: TranspiledScript[] }
    ↓  consumed by
ScriptHostAdapter.loadBundle(manifest, sources)
    ↓  loads into
ScriptManager (existing Phase 2 runtime)
```

The binding chain resolves: `object.inventory[i].asset_uuid` → `assets[uuid].path` → `.lsl` file → transpile → load into worker.

### Integration with Existing Runtime

Phase 5 wraps — not replaces — the existing Phase 2 runtime:

| Existing Component | How Phase 5 Uses It |
|---|---|
| `ScriptManager.setApiResolver()` | Wired to `CommandRouter.resolve()` |
| `ScriptManager.getEventDispatcher()` | Used by `dispatchWorldEvent()` to forward typed events |
| `ScriptManager.loadScript()` | Called for each transpiled script |
| `ScriptManager.getScriptsInContainer()` | Used by `getScriptStatus()` queries |
| `ScriptManager.terminateScript()` | Called by `removeObject()` cleanup |
| `EventDispatcher.dispatchTouch()` | Called when host sends `touchStart` event |
| `EventDispatcher.dispatchChat()` | Called when host sends `listen` event |
| `transpile()` | Called by `BundleTranspiler` for each LSL script |

The `CommandRouter` bridges the gap between the runtime's untyped `method: string` + `args: unknown[]` interface and the typed `ScriptCommand` protocol. Built-in methods (timers, listen, link messages) that `ScriptManager.handleBuiltInCall()` already handles pass through without conversion.

---

## Package Structure

```
poqpoq-script-engine/
├── dist/
│   ├── types/          → Core types (always available)
│   ├── api/            → World API interfaces
│   ├── runtime/        → Worker pool, sandbox, events
│   ├── transpiler/     → LSL→TS transpiler
│   ├── integration/    → Phase 5: protocol, bundle, host adapter
│   │   ├── protocol/   → ScriptCommand, ScriptEvent types
│   │   ├── bundle/     → OAR bundle parser + transpiler
│   │   └── host/       → ScriptHostAdapter, CommandRouter
│   └── editor/         → Monaco editor (lazy-loadable)
```

**npm exports:**
```json
{
  ".": "./dist/types/index.js",
  "./runtime": "./dist/runtime/index.js",
  "./transpiler": "./dist/transpiler/index.js",
  "./integration": "./dist/integration/index.js",
  "./protocol": "./dist/integration/protocol/index.js",
  "./editor": "./dist/editor/index.js"
}
```

**Usage from World:**
```typescript
// Always loaded (~50KB runtime + protocol types)
import { ScriptHostAdapter } from "poqpoq-script-engine/integration";
import type { ScriptCommand, ScriptEvent } from "poqpoq-script-engine/protocol";

// Lazy-loaded (~4MB) only when creator opens editor
const { Shell } = await import("poqpoq-script-engine/editor");
```

---

## Implementation Steps

1. **Protocol Types** — `ScriptCommand` + `ScriptEvent` discriminated unions with envelope wrappers
2. **Bundle Types + Parser** — TypeScript interfaces matching Legacy's manifest.json, binding resolver
3. **Bundle Transpiler** — Batch LSL→TS for all scripts in a parsed bundle
4. **Command Router** — Untyped `method+args` → typed `ScriptCommand` adapter
5. **ScriptHostAdapter** — High-level facade wrapping ScriptManager + EventDispatcher + CommandRouter + BundleTranspiler
6. **Package Restructuring** — Multi-entry-point exports, path aliases, README update

**Test target:** ~97 new tests across 6 test files. End-to-end verification with synthetic bundles and existing tier1/tier2 LSL fixtures.

---

## Consequences

### Positive

- **Zero Babylon.js coupling** — This repo never imports Babylon.js. The bridge lives in World and can evolve independently.
- **Minimal always-loaded cost** — ~50KB runtime vs ~4MB+ if the editor were bundled. World stays lean.
- **Typed contract** — `ScriptCommand`/`ScriptEvent` discriminated unions catch integration errors at compile time. No more untyped `method: string` guessing.
- **OAR pipeline end-to-end** — Legacy → Bundle → Transpile → Load → Execute. A 15-year-old OpenSim region's scripts can run in poqpoq World.
- **Browser-compatible** — Bundle parser takes strings, not files. Works in any environment.
- **Testable in isolation** — The full pipeline (parse → transpile → route commands) can be tested without a 3D engine running.

### Negative

- **Indirection cost** — Message-passing adds a layer vs. direct Babylon.js calls. Acceptable for scripting (not frame-rate-critical).
- **Bridge maintenance** — The World-side bridge must be updated when new commands are added. Mitigated by TypeScript exhaustive switch checking.
- **Two-repo coordination** — Protocol changes require updates in both repos. Mitigated by the protocol types being the single source of truth, published as part of this package.

### Risks

- **virtuallyHuman scripts may use unmapped LSL functions** — The transpiler handles 179 functions. VH scripts with exotic `os*` functions may need new mappings added to Phase 3.
- **World-side bridge implementation** is out of scope for this phase — it lives in the World repo and will be built when World integrates the engine.

---

## References

- [ADR-001: Language & Runtime Architecture](ADR-001-language-and-runtime-architecture.md) — Foundation decisions
- [Legacy OAR Converter](../../../Legacy/src/bundle_exporter.py) — Bundle format producer
- [World Manifest](../../../World/src/world/WorldManifest.ts) — Current scene manifest (will gain script support)
- [NEXUS Architecture](../../../World/docs/NEXUS_VS_PERCEPTION_ARCHITECTURE.md) — World state persistence
- [Good Neighbor Policy](../../../World/docs/GOOD_NEIGHBOR_POLICY_API_ARCHITECTURE_v2.2_2025-10-05.md) — API and port conventions

---

## Progress Overview

### Phases 1-4: Complete

**Phase 1 — Foundation** (core types + API surface)
- 8 type definition files: `Vector3`, `Quaternion`, `WorldScript`, `Agent`, `WorldObject`, `NPC`, `Companion`, `ScriptContainer`
- World API interface with structured namespaces (`world.npc.*`, `world.http.*`, `this.object.*`)
- LSL mapping table: 179 `ll*`/`os*` functions → World API equivalents
- Event system: all LSL events + poqpoq extensions (`onDayNightCycle`, `onWeatherChange`, etc.)

**Phase 2 — Runtime** (sandbox + execution, 72 tests)
- Web Worker pool (4-8 workers) with `ScriptManager` lifecycle
- SES Compartment sandboxing with frozen intrinsics
- AST transformation: loop protection, global access rewriting
- `EventDispatcher`: touch, collision, chat, rez, sensor, timer events
- `TimerManager`: multiple named timers per script (vs LSL's single timer)
- `LinkMessageBus`: inter-script messaging with LINK_SET/THIS/ROOT routing
- Mock world API for testing (`MockWorldAPI`, `MockAgent`)

**Phase 3 — Transpiler** (LSL→TypeScript, 283 tests)
- Hand-written recursive descent lexer (60+ token types) and parser
- Type tracker with scope chain and 230+ built-in function return types
- Function resolver with 50+ special handlers (e.g., `llDetectedName()` → `detected[i].name`)
- Two-pass code generator: scan phase (mark async functions) + emit phase (class wrapping, imports)
- Vector literal `<x,y,z>` ambiguity solved via shift-precedence parsing
- Async propagation: `llSleep` calls propagate `async` transitively through call graph
- 5 real LSL fixture scripts (tier 1-3) all transpile successfully

**Phase 4 — Editor** (Monaco + UI shell)
- Monaco Editor with full World API IntelliSense and autocomplete
- Dual-mode: toggle between TypeScript and LSL syntax views
- Console panel with script output, errors, copy-to-clipboard
- File management: create, rename, delete scripts
- Full UI shell: toolbar, sidebar, status bar, resizable panels
- Montserrat Black branding, dark theme
- Works standalone (no poqpoq World dependency)

### Phase 5 — Integration Layer (this ADR, in progress)

See Implementation Steps above.

### Phase 6 — Polish (planned)

Example script library, documentation site, LSL migration guide, security audit.

---

*This ADR was informed by analysis of the Legacy OAR converter bundle format, World's NEXUS architecture and manifest system, and the existing Phase 2 runtime integration hooks.*
