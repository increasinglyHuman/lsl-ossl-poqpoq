# ADR-001: Language & Runtime Architecture

**Status:** Accepted
**Date:** 2026-02-19
**Authors:** Allen Partridge (p0qp0q), Claude
**Supersedes:** N/A

---

## Context

poqpoq World is a browser-based AI-first metaverse built on Babylon.js. It needs a scripting system that:

1. Empowers creators to make interactive objects, NPCs, games, and experiences
2. Runs safely in the browser without compromising user security
3. Preserves compatibility with 25 years of LSL/OSSL virtual world scripts (via OAR imports from the Legacy converter pipeline)
4. Integrates with poqpoq's AI companion system
5. Works both embedded in poqpoq World and as a standalone editor/IDE

The virtual world scripting landscape includes:
- **LSL** (2003): Event-driven, state machines, 64KB memory, no modules, no data structures
- **OSSL**: 258+ added functions, zero language improvements
- **SLua** (2025): Linden Lab's Luau-based replacement, in beta
- **Roblox Luau**: 3.5M developers, excellent sandboxing, Lua-derived
- **VRChat UdonSharp**: C# subset, too restrictive, being replaced
- **Decentraland SDK7**: TypeScript + WebWorkers, proven in browser metaverse
- **Godot GDScript**: Custom language, 84% adoption in its ecosystem

## Decision

### Primary Language: TypeScript

User scripts are authored in TypeScript, targeting a curated World API. Rationale:

- **Engine alignment**: Babylon.js is TypeScript-native. Script authors work in the same language as the engine, with native access to engine types (Vector3, Quaternion, Color3, etc.)
- **Dot-syntax**: Natural structured language (`world.objects.door.position.y = 3.0`)
- **Developer pool**: Millions of JS/TS developers vs. hundreds of LSL scripters
- **Browser-native execution**: TS compiles to JS, V8 JIT-compiles to machine code. No performance penalty.
- **Tooling for free**: Monaco Editor provides in-browser IntelliSense, autocomplete, type checking, and error highlighting
- **Proven precedent**: Decentraland SDK7 uses TypeScript + WebWorkers for browser-based metaverse scripting

### LSL Backward Compatibility: Transpiler

An LSL-to-TypeScript transpiler automatically converts imported OAR scripts. The `ll` function library maps to the World API:

```
LSL:  llSay(0, "Hello");
  TS:  world.say(0, "Hello");

LSL:  llSetPos(<128.0, 128.0, 23.0>);
  TS:  this.object.setPosition(new Vector3(128, 128, 23));

LSL:  state running;
  TS:  this.transitionTo("running");
```

The editor supports dual-mode display: users can view/edit in LSL or TypeScript syntax.

### Runtime: Web Worker + SES Compartments (Layered Sandbox)

Security uses defense-in-depth with three layers, achieving near-native V8 performance:

```
Layer 1: Web Worker (OS-level thread isolation)
  ├── No DOM, no fetch, no storage APIs
  ├── worker.terminate() as hard kill switch
  └── Prevents user scripts from blocking the renderer

Layer 2: SES Compartments (JavaScript-level isolation)
  ├── lockdown() freezes all intrinsics (Object.prototype, etc.)
  ├── Each script gets its own Compartment with curated API only
  ├── No eval, no Function constructor, no prototype pollution
  └── Near-native V8 JIT performance (not interpreted like WASM)

Layer 3: AST Transformation (static analysis + instrumentation)
  ├── TypeScript → JavaScript compilation
  ├── Infinite loop protection (instruction counting)
  ├── Static analysis to flag dangerous patterns
  └── Whitelist-based API access verification
```

**Why not WASM sandboxing?** Running QuickJS-in-WASM gives perfect isolation but is 10-50x slower than native V8. Our layered approach achieves equivalent security at native speed. WASM remains an option for future "untrusted plugin" scenarios if needed.

### Editor: Monaco (VS Code in the browser)

Monaco Editor provides the editing experience, running in-browser with:
- Full TypeScript IntelliSense and autocomplete for the World API
- Syntax highlighting for both TypeScript and LSL modes
- Error checking before execution
- Dual-mode: toggle between TypeScript and LSL views for imported scripts
- Embeddable in poqpoq World (in-world editing) and standalone (external IDE)

### State Machines: Preserved as First-Class Pattern

LSL's most beloved feature is preserved through TypeScript class patterns:

```typescript
export default class Door extends WorldScript {
  // States declared as methods
  states = {
    closed: {
      onTouch(agent: Agent) {
        this.object.rotateTo(0, 90, 0, { duration: 0.5 });
        this.say(0, "Opening...");
        this.transitionTo("open");
      }
    },
    open: {
      onTouch(agent: Agent) {
        this.object.rotateTo(0, 0, 0, { duration: 0.5 });
        this.say(0, "Closing...");
        this.transitionTo("closed");
      },
      onTimer() {
        // Auto-close after 10 seconds
        this.transitionTo("closed");
      }
    }
  };

  onStateEntry(state: string) {
    if (state === "open") this.setTimer(10);
    if (state === "closed") this.clearTimer();
  }
}
```

### Event Model: Preserved and Extended

LSL's event-driven philosophy is preserved. Objects respond to world events:

```typescript
export default class Greeter extends WorldScript {
  onTouch(agent: Agent) { }
  onCollisionStart(other: WorldObject) { }
  onTimer() { }
  onListen(channel: number, name: string, id: string, message: string) { }
  onSensor(detected: Agent[]) { }
  onMoney(agent: Agent, amount: number) { }
  onRez(startParam: number) { }
  // ... all LSL events mapped to TypeScript methods
}
```

**Extended events** (new to poqpoq):

```typescript
  onCompanionMessage(companion: Companion, message: string) { }
  onPlayerEnterZone(agent: Agent, zone: Zone) { }
  onPlayerLeaveZone(agent: Agent, zone: Zone) { }
  onDayNightCycle(phase: "dawn" | "day" | "dusk" | "night") { }
  onWeatherChange(weather: WeatherState) { }
  onQuestProgress(quest: Quest, stage: number) { }
```

### Module System

Scripts can import from:
1. **Standard library** - curated utility modules shipped with poqpoq
2. **World library** - scripts published to the current world/region
3. **Package registry** - community-published script packages (future)

```typescript
import { easeInOut } from "poqpoq/animation";
import { NPCBehavior } from "poqpoq/npc";
import { DoorController } from "./shared/doors";
```

Modules resolve through a controlled loader - no arbitrary URL imports, no filesystem access.

### World API Surface (Core)

The World API replaces LSL's 400+ `ll` functions with a structured, typed API:

```typescript
// Object manipulation
this.object.setPosition(pos: Vector3): void
this.object.setRotation(rot: Quaternion): void
this.object.setScale(scale: Vector3): void
this.object.applyForce(force: Vector3): void

// Communication
world.say(channel: number, message: string): void
world.whisper(channel: number, message: string): void
world.shout(channel: number, message: string): void
world.listen(channel: number, callback: ListenCallback): ListenHandle

// Agent interaction
agent.getName(): string
agent.getPosition(): Vector3
agent.teleport(destination: Vector3 | Landmark): void
agent.giveItem(item: InventoryItem): void

// Environment
world.setTime(hour: number): void
world.getTime(): number
world.setWeather(weather: WeatherState): void

// Perception
world.sensor(range: number, arc: number, type: SensorType): Agent[]
world.raycast(origin: Vector3, direction: Vector3): RaycastHit

// Effects
this.object.particles(config: ParticleConfig): ParticleEmitter
this.object.playSound(sound: SoundAsset, volume: number): void
this.object.setMaterial(face: number, material: MaterialConfig): void

// Data
world.storage.get(key: string): Promise<any>
world.storage.set(key: string, value: any): Promise<void>
world.http.get(url: string): Promise<Response>
world.http.post(url: string, body: any): Promise<Response>

// NPC (first-class, not bolted on like OSSL)
world.npc.create(name: string, appearance: NPCAppearance): NPC
npc.moveTo(position: Vector3): Promise<void>
npc.say(message: string): void
npc.playAnimation(anim: AnimationAsset): void
npc.lookAt(target: Vector3 | Agent): void

// AI Companion (unique to poqpoq)
world.companion.ask(prompt: string): Promise<string>
world.companion.announce(message: string): void
```

### Script-Object Relationship: Decoupled

Unlike LSL's script-per-prim model, scripts can:
- Be attached to any object or group of objects
- Control multiple objects from a single script
- Run without a visible object (background/world scripts)
- Be shared across objects via modules

```typescript
// One script controlling multiple objects
export default class DrawBridge extends WorldScript {
  bridge = world.getObject("bridge-platform");
  chain_l = world.getObject("chain-left");
  chain_r = world.getObject("chain-right");

  async raise() {
    await Promise.all([
      this.bridge.rotateTo(0, -45, 0, { duration: 3 }),
      this.chain_l.scaleTo(1, 0.5, 1, { duration: 3 }),
      this.chain_r.scaleTo(1, 0.5, 1, { duration: 3 }),
    ]);
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Core type system, project scaffolding, World API type definitions

**Deliverables:**
- [ ] TypeScript project with build pipeline (Vite + TypeScript)
- [ ] Core type definitions: `WorldScript`, `Vector3`, `Quaternion`, `Agent`, `WorldObject`, `NPC`
- [ ] World API interface definitions (types only, no implementation)
- [ ] Event system type definitions (all LSL events + poqpoq extensions)
- [ ] State machine base class with `transitionTo()` lifecycle
- [ ] Unit test framework (Vitest)
- [ ] CI pipeline (GitHub Actions)

**Key files:**
```
src/types/          → Core type definitions
src/api/            → World API interfaces
src/api/ll-map.ts   → LSL function → World API mapping table
```

**Guideline:** Types are the contract. Get them right and everything downstream flows. Every `ll` function from LSL should have a mapped equivalent in the World API types, even if unimplemented. This is the Rosetta Stone.

---

### Phase 2: Script Runtime (Weeks 3-5)
**Goal:** Scripts execute safely in the browser with the sandbox architecture

**Deliverables:**
- [ ] Web Worker script host (creates/destroys workers per script)
- [ ] SES integration (`lockdown()` + `Compartment` per script)
- [ ] AST transformation pipeline (TypeScript → safe JavaScript)
  - [ ] Infinite loop protection (instruction counting in loops)
  - [ ] Global access rewriting (block window, document, etc.)
  - [ ] Static analysis warnings
- [ ] Message bridge: Worker ↔ Main thread communication protocol
  - [ ] Command batching (aggregate commands per frame)
  - [ ] SharedArrayBuffer for high-frequency transform data (position/rotation)
- [ ] Script lifecycle: load → compile → inject → run → pause → terminate
- [ ] Execution budgets: CPU time limits, memory monitoring
- [ ] Timer system (multiple timers per script, unlike LSL's single timer)
- [ ] Event dispatch: world events → script worker → handler execution

**Key files:**
```
src/runtime/worker-host.ts       → Worker creation and management
src/runtime/sandbox.ts           → SES lockdown + Compartment setup
src/runtime/transform.ts         → AST transformation pipeline
src/runtime/bridge.ts            → Main thread ↔ Worker messaging
src/runtime/scheduler.ts         → Script execution scheduling
src/runtime/event-dispatcher.ts  → Event routing to scripts
```

**Guideline:** The sandbox is the security foundation. It must be bulletproof before any user-facing features. Test with adversarial scripts: infinite loops, prototype pollution, eval escapes, memory bombs. If a script can escape the sandbox, nothing else matters.

---

### Phase 3: LSL Transpiler (Weeks 5-7)
**Goal:** LSL scripts from OAR imports automatically convert to TypeScript

**Deliverables:**
- [ ] LSL lexer (tokenizer)
- [ ] LSL parser (AST generation) — covers full LSL grammar including states, events, types
- [ ] LSL → TypeScript code generator
  - [ ] Type mapping: `integer` → `number`, `vector` → `Vector3`, `rotation` → `Quaternion`, `key` → `string`, `list` → `any[]`
  - [ ] State machine mapping: LSL `state X { ... }` → TypeScript state pattern
  - [ ] Event mapping: `touch_start(integer n)` → `onTouch(agent: Agent)`
  - [ ] Function mapping: all `ll*` and `os*` functions → World API calls
  - [ ] Operator mapping: LSL vector/rotation operators → method calls
- [ ] OSSL function support (258+ `os*` functions mapped)
- [ ] Transpiler CLI: `poqpoq transpile input.lsl -o output.ts`
- [ ] Batch transpiler for OAR sidecar bundles (process all scripts in a bundle)
- [ ] Validation suite: transpile → compile → verify against known LSL scripts

**Key files:**
```
src/transpiler/lexer.ts          → LSL tokenization
src/transpiler/parser.ts         → LSL AST generation
src/transpiler/codegen.ts        → AST → TypeScript output
src/transpiler/ll-functions.ts   → ll* function mapping table
src/transpiler/os-functions.ts   → os* function mapping table
src/transpiler/cli.ts            → CLI entry point
```

**Guideline:** Use the 18 LSL scripts from the local OpenSim source and the scripts extracted from OAR files as the test corpus. Every script in the corpus must transpile without errors. Semantic equivalence testing: run original LSL behavior descriptions against transpiled output. Reference the LibLSLCC ANTLR grammar and LSL-PyOptimizer for edge cases.

---

### Phase 4: Editor (Weeks 7-10)
**Goal:** Monaco-based editor with full TypeScript + LSL support

**Deliverables:**
- [ ] Monaco Editor integration with World API type definitions
- [ ] Custom IntelliSense: autocomplete for `world.*`, `this.object.*`, events
- [ ] LSL syntax highlighting and basic IntelliSense (via TextMate grammar from buildersbrewery/linden-scripting-language)
- [ ] Dual-mode toggle: view same script as TypeScript or LSL (transpile on toggle)
- [ ] Script execution: "Run" button → compile → inject into runtime → execute
- [ ] Console panel: script output, errors, logs
- [ ] Script management: create, save, load, delete scripts per object/world
- [ ] Standalone mode: editor works as independent web app (no poqpoq World required)
- [ ] Embedded mode: editor opens as panel within poqpoq World UI

**Key files:**
```
src/editor/Editor.tsx             → Main editor component
src/editor/MonacoSetup.ts         → Monaco configuration + World API types
src/editor/LSLMode.ts             → LSL language support for Monaco
src/editor/DualModeToggle.ts      → TS ↔ LSL view switching
src/editor/ScriptConsole.ts       → Output/error console
src/editor/ScriptManager.ts       → CRUD operations for scripts
```

**Guideline:** The editor IS the product for Phase 4. It should feel as good as VS Code for a domain-specific task. Autocomplete must be snappy (<100ms). Error highlighting must be real-time. The "Run" button must produce visible results in under 500ms. Test with non-programmers: can they modify an example script and see the result without reading documentation?

---

### Phase 5: poqpoq World Integration (Weeks 10-13)
**Goal:** Scripts run live in poqpoq World, OAR imports come alive

**Deliverables:**
- [ ] Babylon.js World API implementation (wire types to actual engine calls)
  - [ ] Object manipulation (position, rotation, scale, physics)
  - [ ] Communication (say, whisper, shout, listen channels)
  - [ ] Perception (sensors, raycasting)
  - [ ] Effects (particles, sounds, materials)
  - [ ] NPC system (create, move, animate, pathfind)
  - [ ] Environment (time, weather, lighting)
- [ ] Script ↔ Object binding system (attach scripts to scene nodes)
- [ ] OAR sidecar loader: reads manifest.json, auto-transpiles LSL, binds to objects
- [ ] Multi-user script sync via NEXUS (scripts run on each client, events synchronized)
- [ ] AI Companion script API (`world.companion.ask()`, `world.companion.announce()`)
- [ ] Permission system: who can edit which scripts, copy/mod/transfer
- [ ] Script persistence: save/load script state across sessions

**Key files:**
```
src/api/babylon-impl/             → Babylon.js implementations of World API
src/api/babylon-impl/objects.ts   → Object manipulation
src/api/babylon-impl/comms.ts     → Communication channels
src/api/babylon-impl/npc.ts       → NPC system
src/api/babylon-impl/effects.ts   → Particles, sounds, materials
src/integration/oar-loader.ts     → OAR sidecar → live scripts
src/integration/nexus-sync.ts     → Multi-user script synchronization
src/integration/companion.ts      → AI companion bridge
```

**Guideline:** This phase is where it all comes together. Start with the OAR sidecar loader - import a real OAR world, auto-transpile its scripts, watch them come alive. This is the demo that proves the entire pipeline works. Prioritize the most visible LSL behaviors first: doors that open, lights that turn on, objects that respond to touch. Save NPC and AI integration for last - they're the cherry on top.

---

### Phase 6: Polish & Community (Weeks 13-16)
**Goal:** Production-ready, documented, and community-friendly

**Deliverables:**
- [ ] Script library: 20+ example scripts covering common patterns
  - [ ] Interactive door, elevator, vehicle
  - [ ] NPC vendor, greeter, patrol guard
  - [ ] Particle effects: fire, water, sparkles
  - [ ] Game mechanics: scorekeeper, timer, collectible
  - [ ] AI-powered: chatbot object, quest giver, tour guide
- [ ] Documentation site: API reference, tutorials, migration guide (LSL → poqpoq)
- [ ] LSL migration guide: side-by-side examples for every common LSL pattern
- [ ] Script package registry (basic - publish/install community scripts)
- [ ] Performance profiling and optimization
- [ ] Security audit: adversarial testing of sandbox
- [ ] Open metaverse compatibility: export scripts in LSL-compatible format

**Guideline:** The example scripts ARE the documentation. Every script should be a self-contained lesson. The migration guide should make an LSL scripter feel at home within an hour. The security audit should be paranoid - assume attackers will try everything.

---

## Consequences

### Positive
- TypeScript gives us the largest possible developer community
- Browser-native execution means no platform lock-in (Windows, Mac, Linux, tablets)
- LSL transpiler preserves 25 years of virtual world scripts
- Layered sandbox provides security without performance penalty
- Monaco editor provides professional-grade editing for free
- AI companion integration is unique to poqpoq - no competitor has this
- Module system solves LSL's most fundamental limitation
- Decoupled script-object model eliminates script-per-prim fragmentation

### Negative
- TypeScript has a steeper learning curve than LSL for absolute beginners
- LSL transpilation will never be 100% perfect (some edge cases will need manual fixes)
- SES/Compartments add complexity to the runtime architecture
- Dual-mode editor (TS + LSL) doubles the syntax support burden

### Mitigations
- Example scripts and in-editor templates lower the learning curve
- AI companion can help users write and debug scripts ("Hey Bob, make this door open when I touch it")
- SES complexity is encapsulated in the runtime layer - script authors never see it
- LSL mode can be "read-only" initially (view transpiled LSL, but edit in TS)

---

## References

- [Decentraland SDK7 Architecture](https://docs.decentraland.org/creator/development-guide/sdk7/sdk-101/) — TypeScript + WebWorker sandbox for browser metaverse
- [Roblox Luau Sandbox](https://luau.org/sandbox/) — Gold standard for metaverse script sandboxing
- [SES / Hardened JavaScript](https://github.com/endojs/endo/tree/master/packages/ses) — Agoric's production SES implementation
- [LSL Portal](https://wiki.secondlife.com/wiki/LSL_Portal) — Complete LSL language reference
- [OSSL Functions](http://opensimulator.org/wiki/OSSL) — OpenSim scripting extensions
- [SLua](https://github.com/secondlife/slua) — Linden Lab's Luau-based LSL replacement
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — VS Code's editor component
- [LibLSLCC](https://github.com/Teriks/LibLSLCC) — Reference LSL compiler with ANTLR grammar
- [LSL-PyOptimizer](https://github.com/Sei-Lisa/LSL-PyOptimizer) — LSL optimizer with syntax extensions
- [buildersbrewery/linden-scripting-language](https://github.com/buildersbrewery/linden-scripting-language) — TextMate grammars for LSL
- [poqpoq World Architecture](../../../World/CLAUDE.md) — Engine architecture and AI companion system
- [Legacy OAR Converter](../../../Legacy/) — OAR → GLB + sidecar pipeline

---

*This ADR was informed by comprehensive research into LSL/OSSL history, competitor analysis (Roblox, VRChat, Godot, Decentraland, Resonite, Spatial.io), browser sandboxing techniques, and the existing poqpoq World and Legacy OAR converter architectures.*
