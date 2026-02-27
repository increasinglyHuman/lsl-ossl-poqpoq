# ADR-005: Glitch Preview Integration

**Status:** Accepted
**Date:** 2026-02-26
**Authors:** Allen Partridge (p0qp0q), Claude
**Supersedes:** N/A
**Builds on:** ADR-002 (Integration Layer Architecture), ADR-004 (Scripter Owns World Scripting)

---

## Context

Phases 1–8 of the Black Box Scripter are complete:

| Asset | Status |
|-------|--------|
| Transpiler | 91.4% corpus rate (1,756/1,921 OutWorldz scripts) |
| Runtime | SES sandbox, worker pool, timers, events, link messages |
| Protocol | 81 command types, 26 event types, typed envelopes |
| Command Router | 68 implemented method→command mappings |
| Bridge | Reference BabylonBridge (81 commands), event forwarder, media surface |
| Editor | Monaco + IntelliSense, live dual-mode, deployed at poqpoq.com/scripter/ |
| Tests | 815 passing across 24 test files |

**The problem:** Users can transpile LSL to TypeScript in the editor, but they cannot *see* the results. There is no visual feedback loop — no way to watch a script change a prim's color, rez objects, or respond to touch events. The edit-compile-run cycle is incomplete.

**Glitch** (`/home/p0qp0q/blackbox/glitch/`) is a minimal, embeddable Babylon.js 3D previewer — "the `console.log()` of 3D authoring". Phase 1 is complete with:

- WebGPU-first Babylon.js engine (falls back to WebGL)
- Walkable mannequin with animation state machine
- Orbit + over-the-shoulder camera with switcher
- PostMessage bridge for parent tool ↔ Glitch communication
- `scripter` already defined as a valid `GlitchType`
- HUD overlay, grid floor, physics stub, debug tools (F1/F2/F3)

**The opportunity:** Connect the Scripter editor to a Glitch iframe preview. When a user transpiles LSL, they click "Preview" and see their script running in a live 3D scene. The ScriptCommand protocol (ADR-002) is already JSON-serializable and transport-agnostic — it crosses the Worker boundary via `postMessage`. The same mechanism can cross an iframe boundary.

### OutWorldz Corpus Analysis

Survey of 1,141 OutWorldz scripts reveals the most compelling preview demos:

| Category | Count | Examples |
|----------|-------|---------|
| Visual effects (color, glow, particles) | ~280 | Color-cycling boxes, bling jewelry, fireplace |
| Touch-interactive objects | ~200 | Doors, light switches, sit targets |
| Timer-driven animation | ~150 | Rotating signs, oscillating platforms |
| Object rezzing / building | ~80 | Necklace generators, geodesic domes |
| NPC / pet behaviors | ~60 | Follower pets, tour guides |
| Communication (say, listen) | ~120 | Chatbots, greeter scripts |
| HUD games & UI | ~50 | Vendor panels, inventory systems |

The MVP needs only: `setPosition`, `setRotation`, `setScale`, `setColor`, `setAlpha`, `setText`, `say`, `rezObject`, `die`, plus `touchStart` and `timer` events — enough to run ~60% of these demos.

---

## Decision

### Option A: Runtime in Scripter, Rendering in Glitch (CHOSEN)

The script runtime (Web Worker + SES sandbox) stays in **Scripter**. ScriptCommands are forwarded to Glitch via `postMessage`. Glitch implements a lightweight `GlitchScriptBridge` that dispatches commands against Babylon.js. Events (touch, collision) flow back from Glitch to Scripter.

### Option B: Runtime in Glitch (rejected)

Embedding the full Scripter runtime in Glitch would require bundling the SES sandbox, AST transformer, and worker pool into Glitch — turning a ~200KB previewer into a ~300KB+ scripting engine. It would also duplicate the runtime, making protocol/runtime version sync a nightmare.

### Option C: Shared Worker (rejected)

A SharedWorker sitting between both windows could host the runtime. But SharedWorker support is inconsistent (no Safari), and the existing Worker pool in Scripter already handles script execution. The benefit does not justify the complexity.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│  SCRIPTER (parent window)                                │
│                                                           │
│  Monaco Editor  ──transpile──►  TypeScript output        │
│       │                              │                    │
│  [Preview btn]              ScriptHostAdapter             │
│       │                    ┌──────────┐                   │
│       │                    │ WorkerHost│ (SES sandbox)    │
│       │                    │ Scripts   │                   │
│       │                    └────┬─────┘                   │
│       │                         │ ScriptCommand           │
│       │                    CommandRouter                   │
│       │                         │                         │
│       │              ┌──────────┴──────────┐              │
│       │              │  PreviewRelay       │              │
│       │              │  (postMessage →)    │              │
│       │              └──────────┬──────────┘              │
│       │                         │                         │
└───────┼─────────────────────────┼─────────────────────────┘
        │  iframe                 │  postMessage
┌───────┼─────────────────────────┼─────────────────────────┐
│  GLITCH (child iframe)          ▼                         │
│                          PostMessageBridge                 │
│                                │                          │
│                       GlitchScriptBridge                  │
│                       ┌────────┴────────┐                 │
│                       │  PrimFactory    │                 │
│                       │  ObjectRegistry │                 │
│                       │  EffectManager  │                 │
│                       └────────┬────────┘                 │
│                                │                          │
│                          Babylon.js Scene                  │
│                    (meshes, materials, particles)          │
│                                │                          │
│                    scene.onPointerDown                    │
│                         │ touch event                     │
│                    postMessage ← back to Scripter         │
└───────────────────────────────────────────────────────────┘
```

**Why this works:**

1. **Protocol reuse** — `ScriptCommand` already crosses the Worker `postMessage` boundary. Crossing an iframe `postMessage` boundary is the same serialization.
2. **Glitch stays lean** — No runtime, no transpiler, no SES. Just a Babylon.js command renderer (~30KB additional code).
3. **Single runtime** — One Worker pool, one event dispatcher, one timer manager. No sync issues.
4. **Existing hooks** — `ScriptHostAdapter` accepts a `CommandHandler` interface. `PreviewRelay` implements it by forwarding to the iframe instead of calling Babylon.js directly.

---

## PostMessage Protocol Extension

### New Message Types (Scripter → Glitch)

| Type | Purpose | Payload |
|------|---------|---------|
| `scripter_load` | Load transpiled script | `{ scriptId, code, objectId }` |
| `scripter_command` | Forward a ScriptCommand | `{ envelope: ScriptCommandEnvelope }` |
| `scripter_reset` | Clear scene, stop scripts | `{}` |
| `scripter_create_prim` | Create root object before script runs | `{ objectId, primType, position, rotation?, scale?, name? }` |

### New Message Types (Glitch → Scripter)

| Type | Purpose | Payload |
|------|---------|---------|
| `scripter_event` | Touch, collision, etc. | `{ envelope: ScriptEventEnvelope }` |
| `scripter_loaded` | Script ready confirmation | `{ scriptId }` |
| `scripter_console` | say/whisper/shout output | `{ channel, message, senderName, objectId }` |

All messages include `source: 'scripter' | 'glitch'` for origin identification. The existing `glitch_ready` message signals that Glitch is initialized and ready to receive `scripter_*` messages.

### Lifecycle Flow

```
Scripter                              Glitch
   │                                     │
   │──── iframe src=/glitch/?embed ──────►│
   │                                     │──── initialize engine
   │◄──── glitch_ready ─────────────────│
   │                                     │
   │──── scripter_reset ────────────────►│  clear scene
   │──── scripter_create_prim ──────────►│  create root object
   │──── scripter_load ─────────────────►│  (informational only)
   │                                     │
   │  [script executes in Worker]        │
   │  [script calls llSetColor()]        │
   │  [CommandRouter → PreviewRelay]     │
   │                                     │
   │──── scripter_command ──────────────►│  setColor → mesh
   │──── scripter_command ──────────────►│  setText → floating text
   │                                     │
   │  [user clicks mesh in Glitch]       │
   │                                     │
   │◄──── scripter_event ──────────────│  touchStart
   │  [EventDispatcher → script]         │
   │  [script calls llSetPos()]          │
   │──── scripter_command ──────────────►│  setPosition → mesh
```

---

## Glitch-Side Implementation

### GlitchScriptBridge

New file: `glitch/src/scripting/GlitchScriptBridge.ts`

Central command dispatcher. Receives `ScriptCommandEnvelope` messages and translates them into Babylon.js API calls. Pattern-matches the existing `ReferenceBabylonBridge` in Scripter but is self-contained (no Scripter dependency).

```typescript
export class GlitchScriptBridge {
  private objectRegistry: ObjectRegistry;
  private primFactory: PrimFactory;
  private scene: Scene;

  handle(envelope: { scriptId: string; objectId: string; command: { type: string; [key: string]: unknown } }): void {
    switch (envelope.command.type) {
      case 'setPosition': // mesh.position.set(x, y, z)
      case 'setRotation': // mesh.rotationQuaternion = ...
      case 'setScale':    // mesh.scaling.set(x, y, z)
      case 'setColor':    // material.diffuseColor = new Color3(r, g, b)
      case 'setAlpha':    // mesh.visibility = alpha
      case 'setText':     // FloatingText plane above mesh
      case 'say':         // relay to parent as scripter_console
      case 'rezObject':   // primFactory.create() + register
      case 'die':         // mesh.dispose() + unregister
      // Phase 2+: setTexture, setGlow, setParticles, playSound, playAnimation...
    }
  }
}
```

### PrimFactory

New file: `glitch/src/scripting/PrimFactory.ts`

Maps LSL prim types to Babylon.js MeshBuilder:

| LSL Prim Type | Babylon.js MeshBuilder | Default Size |
|---------------|----------------------|-------------|
| `BOX` | `CreateBox` | 0.5m cube |
| `SPHERE` | `CreateSphere` | 0.5m radius |
| `CYLINDER` | `CreateCylinder` | 0.5m × 1m |
| `TORUS` | `CreateTorus` | 0.3m tube, 0.5m ring |
| `TUBE` | `CreateCylinder(open)` | 0.5m × 1m hollow |
| `RING` | `CreateTorus(flat)` | 0.5m ring |
| `PRISM` | `CreateCylinder(tessellation=3)` | 0.5m triangle |
| `SCULPT` | `CreateSphere` (placeholder) | 0.5m |

Each prim gets:
- `StandardMaterial` with configurable diffuseColor, alpha
- `metadata.objectId` for registry lookup
- `isPickable = true` for touch events
- Default gray color (`#808080`)

### ObjectRegistry

New file: `glitch/src/scripting/ObjectRegistry.ts`

Maps `objectId` → Babylon.js `Mesh`. Provides CRUD operations:
- `register(objectId, mesh)` — bind ID to mesh, set `mesh.metadata.objectId`
- `get(objectId)` → `Mesh | undefined`
- `remove(objectId)` → disposes mesh, removes from map
- `clear()` → disposes all meshes (used by `scripter_reset`)

### Touch Event Forwarding

Glitch's `scene.onPointerObservable` fires when a user clicks a mesh. If the mesh has `metadata.objectId`, Glitch sends a `scripter_event` message back to Scripter:

```typescript
scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
    const mesh = pointerInfo.pickInfo?.pickedMesh;
    if (mesh?.metadata?.objectId) {
      bridge.sendEvent({
        type: 'scripter_event',
        source: 'glitch',
        envelope: {
          objectId: mesh.metadata.objectId,
          event: { type: 'touchStart', agentId: 'preview-user', ... }
        }
      });
    }
  }
});
```

---

## Scripter-Side Implementation

### PreviewRelay

New file: `src/editor/preview/PreviewRelay.ts`

Implements `CommandHandler` — the same interface that `ReferenceBabylonBridge` implements. Instead of calling Babylon.js, it forwards the `ScriptCommandEnvelope` via `postMessage` to the Glitch iframe.

```typescript
export class PreviewRelay implements CommandHandler {
  constructor(private iframe: HTMLIFrameElement) {}

  handle(envelope: ScriptCommandEnvelope): unknown {
    this.iframe.contentWindow?.postMessage(
      { type: 'scripter_command', source: 'scripter', envelope },
      '*'
    );
    return undefined;
  }
}
```

This is plugged into `ScriptHostAdapter.setCommandHandler(relay)`, replacing the default no-op handler with one that routes commands to the preview.

### PreviewPanel

New file: `src/editor/preview/PreviewPanel.ts`

Manages the iframe lifecycle:
- Creates `<iframe src="/glitch/?embed=scripter">` inside the preview column
- Listens for `glitch_ready` → sends `scripter_reset` + `scripter_create_prim` + starts script
- Listens for `scripter_event` → dispatches to `EventDispatcher`
- Listens for `scripter_console` → appends to PreviewConsole
- Handles resize, close, and dispose

### Editor UI Changes

**Toolbar** (`src/editor/ui/toolbar.ts`):
- Add "Preview" button (play icon) that toggles the preview panel

**Shell** (`src/editor/ui/shell.ts`):
- Current layout: `grid-template-columns: auto 1fr` (sidebar + editor)
- With preview: `grid-template-columns: auto 1fr 40%` (sidebar + editor + preview)
- Preview column contains: Glitch iframe (~70%) + console panel (~30%)

---

## Phased Implementation

### Phase 1: Foundation MVP — "Hello Prim"

**Commands:** setPosition, setRotation, setScale, setColor, setAlpha, setText, say, rezObject, die
**Events:** touchStart, timer

**Demo scripts:** Color-cycling box, touch-toggle door, floating text

| File | Repo | Action |
|------|------|--------|
| `src/scripting/GlitchScriptBridge.ts` | Glitch | Create |
| `src/scripting/PrimFactory.ts` | Glitch | Create |
| `src/scripting/ObjectRegistry.ts` | Glitch | Create |
| `src/scripting/FloatingText.ts` | Glitch | Create |
| `src/bridge/PostMessageBridge.ts` | Glitch | Modify |
| `src/types/index.ts` | Glitch | Modify |
| `src/core/GlitchLifecycle.ts` | Glitch | Modify |
| `src/editor/preview/PreviewRelay.ts` | Scripter | Create |
| `src/editor/preview/PreviewPanel.ts` | Scripter | Create |
| `src/editor/preview/PreviewConsole.ts` | Scripter | Create |
| `src/editor/ui/toolbar.ts` | Scripter | Modify |
| `src/editor/ui/shell.ts` | Scripter | Modify |

### Phase 2: Rich Visuals — "Particle Necklace"

**Commands:** setTexture, setGlow, setParticles, stopParticles, playSound, stopSound
**Events:** touch, touchEnd, collision

**Demo scripts:** Particle emitter, bling jewelry, necklace generator, fireplace

### Phase 3: Animation & Physics — "Dance Ball"

**Commands:** playAnimation, stopAnimation, applyForce, applyImpulse, setPhysics
**Events:** collisionStart, collisionEnd

**Demo scripts:** Dance ball (sit + animate), bouncing ball, vehicle

### Phase 4: NPCs & Steering — "Pet Follower"

**Commands:** npcCreate, npcMoveTo, npcSay, npcSetSteering, npcFollow, npcWander
**Events:** sensor, noSensor

**Demo scripts:** Follower pet, tour guide NPC, flocking birds

### Phase 5: Advanced — "Full World Preview"

**Commands:** dialog, textBox, setMedia, requestPermissions, inventory commands
**Events:** listen, money, permissions, dataserver

---

## Consequences

### Positive

- **Instant visual feedback** — Users see script effects in real-time, closing the edit-compile-run loop.
- **Protocol reuse** — No new serialization format. ScriptCommand envelopes cross the iframe boundary exactly as they cross the Worker boundary.
- **Glitch stays lean** — ~30KB of scripting code added to a ~200KB previewer. No runtime, no transpiler, no SES.
- **Single runtime** — One Worker pool, one event dispatcher. No sync issues between duplicate runtimes.
- **Corpus-validated demos** — The MVP command set covers ~60% of the OutWorldz corpus, with each subsequent phase adding ~10% more.
- **Zero coupling** — Glitch has no import dependency on Scripter. Communication is pure postMessage with a simple JSON protocol.

### Negative

- **Two-frame latency** — Commands cross two postMessage boundaries (Worker → parent → iframe). Acceptable for scripting — typically < 1ms total.
- **Two-repo changes** — Phase 1 requires coordinated changes in both Scripter and Glitch repos.
- **Limited debugging** — Scripts execute in Scripter's Worker but effects render in Glitch's iframe. Source mapping across this boundary is not possible.

### Risks

- **Glitch iframe security** — `postMessage` origin must be validated. Glitch should only accept messages from the expected parent origin.
- **WebGPU initialization delay** — Glitch's Babylon.js engine startup (WebGPU → WebGL fallback) may add 1-2 seconds before the preview is responsive.
- **Mobile viewport** — The three-column layout (sidebar + editor + preview) may not work on narrow screens. Needs a responsive breakpoint or toggle mode.

---

## References

- [ADR-002: Integration Layer Architecture](ADR-002-integration-layer-architecture.md) — ScriptCommand protocol, message-passing contract
- [ADR-004: Scripter Owns World Scripting](ADR-004-scripter-owns-world-scripting.md) — Reference BabylonBridge, structural typing pattern
- [Glitch PostMessageBridge](../../../../glitch/src/bridge/PostMessageBridge.ts) — Existing postMessage protocol
- [Glitch Types](../../../../glitch/src/types/index.ts) — GlitchType, GlitchSpawnPayload, Vec3
- [Glitch Lifecycle](../../../../glitch/src/core/GlitchLifecycle.ts) — 13-step initialization orchestrator
- [ReferenceBabylonBridge](../../src/integration/bridge/reference-bridge.ts) — Command dispatch pattern to replicate
- [OutWorldz Corpus](../../tests/fixtures/lsl/outworldz/) — 1,921 LSL scripts for demo validation

---

*This ADR was informed by analysis of the Glitch Phase 1 codebase, the existing ScriptCommand protocol, the OutWorldz corpus survey (1,141 categorized scripts), and World's BabylonBridge integration pattern.*
