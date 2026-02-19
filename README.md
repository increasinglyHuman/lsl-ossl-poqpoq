<p align="center">
  <img src="favicon.svg" width="120" alt="poqpoq fox kit" />
</p>

<h1 align="center">poqpoq Script Engine</h1>

<p align="center">
  <strong>TypeScript-based scripting for the open metaverse</strong><br>
  Built on 25 years of virtual world heritage. Modernized for the browser era.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/runtime-Web_Workers_+_SES-4B32C3" alt="Web Workers + SES" />
  <img src="https://img.shields.io/badge/engine-Babylon.js-E8542E?logo=webgl&logoColor=white" alt="Babylon.js" />
  <img src="https://img.shields.io/badge/editor-Monaco-007ACC?logo=visualstudiocode&logoColor=white" alt="Monaco Editor" />
  <img src="https://img.shields.io/badge/compat-LSL_%2F_OSSL-8B5CF6" alt="LSL/OSSL Compatible" />
  <img src="https://img.shields.io/badge/license-MIT-22C55E" alt="MIT License" />
  <img src="https://img.shields.io/badge/phase-2_of_6-F59E0B" alt="Phase 2 of 6" />
</p>

<p align="center">
  <a href="LICENSE">MIT License</a> ·
  <a href="docs/adr/ADR-001-language-and-runtime-architecture.md">Architecture (ADR-001)</a> ·
  <a href="https://poqpoq.com/world/">poqpoq World</a>
</p>

---

## What Is This?

A modular scripting engine for [poqpoq World](https://poqpoq.com/world/) that gives creators the power to make interactive objects, NPCs, games, and experiences — all in TypeScript, all in the browser.

**Backward compatible** with LSL (Linden Scripting Language) and OSSL (OpenSim Scripting Language) through an automatic transpiler. Import a 15-year-old OpenSim region and watch its scripts come alive.

## Why?

LSL shipped in 2003. It gave us event-driven objects, state machines, and a scripting community that built an entire civilization. But it also gave us 64KB memory limits, no arrays, no modules, and `llSleep()` that freezes the entire thread.

We keep what works. We fix what doesn't.

| LSL (2003) | poqpoq Script Engine (2026) |
|---|---|
| 64KB memory per script | No artificial limits |
| No arrays, no structs | Full TypeScript: Map, Set, classes, generics |
| No modules or imports | ES module system |
| Single timer per script | Multiple named timers |
| `llSleep()` blocks everything | `await this.delay()` — non-blocking |
| Script-per-prim | Scripts control any objects |
| Flat `ll*` function soup | Structured `world.npc.*`, `world.http.*` APIs |
| No error handling | try/catch, async/await |
| Text editor in a 3D viewer | Monaco (VS Code) in the browser |

## Quick Look

```typescript
import { WorldScript, type Agent } from "poqpoq/types";

export default class MagicDoor extends WorldScript {
  states = {
    default: {
      async onTouchStart(agent: Agent) {
        await this.open();
        this.say(0, `Welcome, ${agent.name}!`);
      },
      onTimer() {
        this.close();
      }
    }
  };

  async open() {
    await this.object.rotateTo(0, 90, 0, { duration: 0.5 });
    this.setTimer(10, "autoClose");
  }

  async close() {
    this.clearTimer("autoClose");
    await this.object.rotateTo(0, 0, 0, { duration: 0.5 });
  }
}
```

The same door in LSL would be ~50 lines across two state blocks with manual rotation math. Here it's readable, async, and type-safe.

## Architecture

```
User writes TypeScript in Monaco Editor (in-browser)
    ↓  milliseconds
Compiled to JavaScript
    ↓  injected into isolated sandbox
Web Worker + SES Compartment (secure, native V8 speed)
    ↓  message bridge
Babylon.js renders changes in the 3D world
```

**Security**: Three-layer sandbox (Web Worker isolation → SES frozen intrinsics → AST loop protection). Scripts cannot access the DOM, make unauthorized network requests, or affect other scripts. Same philosophy as LSL, modern implementation.

**LSL Compatibility**: An LSL-to-TypeScript transpiler converts imported scripts automatically. The 120+ function [mapping table](src/api/ll-map.ts) covers `ll*` and `os*` functions.

## Project Structure

```
src/
  types/        Core type definitions (Vector3, WorldScript, Agent, NPC, etc.)
  api/          World API interfaces and LSL function mapping
  runtime/      Script sandbox (Web Worker + SES) [Phase 2]
  transpiler/   LSL → TypeScript transpiler [Phase 3]
  editor/       Monaco-based script editor [Phase 4]
examples/       Example scripts
docs/adr/       Architecture Decision Records
```

## Roadmap

| Phase | Status | What |
|-------|--------|------|
| 1. Foundation | **Done** | Core types, World API, LSL mapping table |
| 2. Runtime | **Done** | Worker pool, SES sandbox, event dispatch, timers, inter-script messaging |
| 3. Transpiler | Next | LSL lexer/parser/codegen |
| 4. Editor | Planned | Monaco + IntelliSense + dual TS/LSL mode |
| 5. Integration | Planned | Babylon.js wiring, OAR import, NEXUS sync |
| 6. Polish | Planned | Example library, docs, migration guide |

## The Ecosystem

This engine is part of the **poqpoq** open metaverse platform:

- **[poqpoq World](https://github.com/increasinglyHuman/poqpoq-world)** — AI-first metaverse (Babylon.js)
- **[Black Box Legacy](https://github.com/increasinglyHuman/blackbox-legacy)** — OAR → GLB converter with LSL script sidecars
- **[Black Box Animator](https://github.com/increasinglyHuman/blackBoxIKStudio)** — GLB animation editor with IK
- **[Black Box Skinner](https://github.com/increasinglyHuman/Skinner)** — Vertex weight painter

## Contributing

This is an open-source project under the MIT license. We welcome contributions — especially from LSL veterans who know where the bodies are buried.

## License

[MIT](LICENSE) — Allen Partridge (p0qp0q)
